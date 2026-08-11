import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { generateOrderNumber } from "@/lib/utils"
import { allocateStockFIFO } from "@/lib/lot-utils"

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

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const body = (await request.json()) as SaleRequestBody
    const items = normalizeItems(body.items)

    if (items.length === 0) {
      return NextResponse.json({ error: "Au moins un article est requis" }, { status: 400 })
    }

    const sale = await (async () => {
      if (body.pointOfSaleId) {
        const point = await prisma.pointOfSale.findUnique({ where: { id: body.pointOfSaleId } })
        if (!point || !point.isActive) throw new Error("Point de vente invalide ou inactif")
      }
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: items.map((item) => item.variantId) } },
        include: { product: true },
      })

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]))

      for (const item of items) {
        const variant = variantMap.get(item.variantId)
        if (!variant) throw new Error("Produit introuvable")
        if (!body.pointOfSaleId && variant.stock < item.quantity) {
          throw new Error(`Stock insuffisant pour ${variant.product.name} ${variant.format}`)
        }
        if (body.pointOfSaleId) {
          const pointStock = await prisma.pointOfSaleStock.findUnique({ where: { pointOfSaleId_variantId: { pointOfSaleId: body.pointOfSaleId, variantId: item.variantId } } })
          if (!pointStock || pointStock.quantity < item.quantity) throw new Error(`Stock insuffisant dans le point de vente pour ${variant.product.name} ${variant.format}`)
        }
      }

      const subtotal = items.reduce((sum, item) => {
        const variant = variantMap.get(item.variantId)
        return sum + (variant?.price ?? 0) * item.quantity
      }, 0)

      const orderNumber = generateOrderNumber()
      const order = await prisma.order.create({
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
        include: {
          items: { include: { variant: { include: { product: true } } } },
        },
      })

      for (const item of items) {
        await prisma.productVariant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.quantity } } })
        if (body.pointOfSaleId) {
          const stock = await prisma.pointOfSaleStock.findUnique({ where: { pointOfSaleId_variantId: { pointOfSaleId: body.pointOfSaleId, variantId: item.variantId } } })
          if (stock && stock.quantity >= item.quantity) {
            await prisma.pointOfSaleStock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } })
          }
        }

        try {
          const fifoResult = await allocateStockFIFO(item.variantId, item.quantity, "SALE", orderNumber)
          const orderItem = order.items.find((oi) => oi.variantId === item.variantId)
          if (orderItem && fifoResult.allocations.length > 0) {
            await prisma.orderItem.update({
              where: { id: orderItem.id },
              data: { lotId: fifoResult.allocations[0].lotId },
            })
          }
        } catch {
          // Lots may not exist yet; fall back to legacy movement
        }

        await prisma.stockMovement.create({ data: { variantId: item.variantId, pointOfSaleId: body.pointOfSaleId || null, type: "SALE", quantity: item.quantity, reason: "Vente comptoir", reference: orderNumber } })
      }

      return order
    })()

    return NextResponse.json(
      {
        id: sale.id,
        orderNumber: sale.orderNumber,
        customerName: sale.customerName,
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus,
        status: sale.status,
        subtotal: sale.subtotal,
        total: sale.total,
        createdAt: sale.createdAt.toISOString(),
        items: sale.items.map((item) => ({
          id: item.id,
          name: item.variant.product.name,
          format: item.variant.format,
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
