import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { generateOrderNumber } from "@/lib/utils"
import { allocateStockFIFOTx } from "@/lib/lot-utils"

const PAYMENT_METHODS = ["CASH_ON_DELIVERY", "MOBILE_MONEY", "CARD"] as const

type PaymentMethod = (typeof PAYMENT_METHODS)[number]

interface SaleItemInput {
  variantId: string
  quantity: number
}

interface SaleRequestBody {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  paymentMethod?: string
  notes?: string
  pointOfSaleId?: string
  items?: SaleItemInput[]
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : "CASH_ON_DELIVERY"
}

function normalizeItems(value: unknown): SaleItemInput[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>
      const variantId = String(record.variantId || "")
      const quantity = Math.max(1, Number(record.quantity) || 1)
      return variantId ? { variantId, quantity } : null
    })
    .filter((item): item is SaleItemInput => Boolean(item))
}

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const posFilter = await getUserPointOfSaleIds()
  const posIds = posFilter?.posIds ?? null

  const sales = await prisma.order.findMany({
    where: {
      notes: { startsWith: "Vente comptoir" },
      ...(posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : {}),
    },
    include: {
      pointOfSale: { select: { id: true, name: true, code: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    sales.map((sale) => ({
      id: sale.id,
      orderNumber: sale.orderNumber,
      customerName: sale.customerName || "Client comptoir",
      customerPhone: sale.customerPhone || "",
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      status: sale.status,
      total: sale.total,
      notes: sale.notes,
      createdAt: sale.createdAt.toISOString(),
      pointOfSale: sale.pointOfSale,
      items: sale.items.map((item) => ({
        id: item.id,
        name: (item as any).variant?.product?.name ?? "Produit",
        format: (item as any).variant?.format ?? "",
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
    }))
  )
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const body = (await request.json()) as SaleRequestBody
    const items = normalizeItems(body.items)

    if (items.length === 0) {
      return NextResponse.json({ error: "Au moins un article est requis" }, { status: 400 })
    }

    if (body.pointOfSaleId) {
      const point = await prisma.pointOfSale.findUnique({ where: { id: body.pointOfSaleId } })
      if (!point || !point.isActive) return NextResponse.json({ error: "Point de vente invalide ou inactif" }, { status: 400 })
    }

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: items.map((item) => item.variantId) } },
      include: { product: true },
    })
    const variantMap = new Map(variants.map((v) => [v.id, v]))

    const orderNumber = generateOrderNumber()

    const order = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const variant = variantMap.get(item.variantId)
        if (!variant) throw new Error("Produit introuvable")

        if (!body.pointOfSaleId) {
          if (variant.stock < item.quantity) {
            throw new Error(`Stock insuffisant pour ${variant.product.name} ${variant.format} (disponible: ${variant.stock}, demandé: ${item.quantity})`)
          }
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.quantity } } })
        } else {
          const pointStock = await tx.pointOfSaleStock.findUnique({
            where: { pointOfSaleId_variantId: { pointOfSaleId: body.pointOfSaleId, variantId: item.variantId } },
          })
          if (!pointStock || pointStock.quantity < item.quantity) {
            throw new Error(`Stock insuffisant dans le point de vente pour ${variant.product.name} ${variant.format}`)
          }
          await tx.pointOfSaleStock.update({ where: { id: pointStock.id }, data: { quantity: { decrement: item.quantity } } })
        }
      }

      const subtotal = items.reduce((sum, item) => {
        const variant = variantMap.get(item.variantId)
        return sum + (variant?.price ?? 0) * item.quantity
      }, 0)

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerName: body.customerName?.trim() || "Client comptoir",
          customerEmail: body.customerEmail?.trim() || "",
          customerPhone: body.customerPhone?.trim() || "",
          paymentMethod: normalizePaymentMethod(body.paymentMethod),
          paymentStatus: "PAID",
          status: "DELIVERED",
          subtotal,
          deliveryFee: 0,
          total: subtotal,
          notes: ["Vente comptoir", body.notes?.trim()].filter(Boolean).join(" - "),
          pointOfSaleId: body.pointOfSaleId || null,
          items: {
            create: items.map((item) => {
              const variant = variantMap.get(item.variantId)
              if (!variant) throw new Error("Produit introuvable")
              return {
                productId: variant.productId,
                variantId: variant.id,
                quantity: item.quantity,
                price: variant.price,
                total: variant.price * item.quantity,
              }
            }),
          },
        },
        include: { items: { include: { variant: { include: { product: true } } } } },
      })

      for (const item of items) {
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            pointOfSaleId: body.pointOfSaleId || null,
            type: "SALE",
            quantity: item.quantity,
            reason: "Vente comptoir",
            reference: orderNumber,
          },
        })
      }

      for (const item of items) {
        try {
          const fifoResult = await allocateStockFIFOTx(tx, item.variantId, item.quantity, "SALE", orderNumber)
          const orderItem = createdOrder.items.find((oi) => oi.variantId === item.variantId)
          if (orderItem && fifoResult.allocations.length > 0) {
            await tx.orderItem.update({
              where: { id: orderItem.id },
              data: { lotId: fifoResult.allocations[0].lotId },
            })
          }
        } catch (fifoError) {
          console.error(`FIFO allocation warning for ${item.variantId}:`, fifoError)
        }
      }

      return createdOrder
    })

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        subtotal: order.subtotal,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          name: (item as any).variant?.product?.name ?? "Produit",
          format: (item as any).variant?.format ?? "",
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne du serveur"
    const status = message.includes("Stock") || message.includes("introuvable") ? 400 : 500
    console.error("POST sale error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
