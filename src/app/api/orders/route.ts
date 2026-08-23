import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { createOrder, type OrderInput } from "@/data/store"
import { sendOrderEmail } from "@/lib/mailer"
import { generateOrderNumber } from "@/lib/utils"
import { pushNotification } from "@/lib/notifications"

const PAYMENT_METHODS = ["CARD", "MOBILE_MONEY", "CASH_ON_DELIVERY"]

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const posFilter = await getUserPointOfSaleIds()
    const posIds = posFilter?.posIds ?? null

    const orders = await prisma.order.findMany({
      where: posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : undefined,
      include: {
        items: {
          include: { variant: { include: { product: true } } },
        },
        delivery: { include: { deliveryAgent: true } },
        pointOfSale: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(
      orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName ?? "",
        customerEmail: o.customerEmail ?? "",
        customerPhone: o.customerPhone ?? "",
        status: o.status,
        paymentMethod: o.paymentMethod ?? "",
        paymentStatus: o.paymentStatus,
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        total: o.total,
        notes: o.notes,
        source: o.source || "WEB",
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          variantId: i.variantId,
          name: i.variant?.product?.name ?? "",
          format: i.variant?.format ?? "",
          quantity: i.quantity,
          price: i.price,
          total: i.total,
        })),
        delivery: o.delivery
          ? {
              id: o.delivery.id,
              status: o.delivery.status,
              address: o.delivery.address,
              city: o.delivery.city,
              district: o.delivery.district,
              scheduledDate: o.delivery.scheduledDate?.toISOString() ?? null,
              deliveredAt: o.delivery.deliveredAt?.toISOString() ?? null,
              notes: o.delivery.notes,
              agent: o.delivery.deliveryAgent?.name ?? null,
            }
          : null,
        pointOfSaleId: o.pointOfSaleId ?? null,
        pointOfSale: o.pointOfSale ?? null,
      }))
    )
  } catch (error) {
    console.error("GET orders error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []

    if (!body.customerName || !body.customerPhone || !body.address || items.length === 0) {
      return NextResponse.json(
        { error: "Client, téléphone, adresse et articles sont requis" },
        { status: 400 }
      )
    }

    const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod)
      ? body.paymentMethod
      : "CASH_ON_DELIVERY"

    const input: OrderInput = {
      orderNumber: body.orderNumber || generateOrderNumber(),
      userId: null,
      customerName: String(body.customerName),
      customerEmail: String(body.customerEmail || ""),
      customerPhone: String(body.customerPhone),
      address: String(body.address),
      city: String(body.city || "Brazzaville"),
      district: body.district ? String(body.district) : undefined,
      paymentMethod,
      source: body.source === "OPERATOR" ? "OPERATOR" : "WEB",
      notes: body.notes ? String(body.notes) : undefined,
      deliveryFee: Number(body.deliveryFee) || 0,
      items: items.map((item: any) => ({
        productId: String(item.productId || ""),
        variantId: String(item.variantId || ""),
        name: String(item.name || "Produit"),
        format: String(item.format || ""),
        quantity: Math.max(1, Number(item.quantity) || 1),
        price: Math.max(0, Number(item.price) || 0),
      })),
    }

    if (input.items.some((item) => !item.productId || !item.variantId)) {
      return NextResponse.json({ error: "Articles invalides" }, { status: 400 })
    }

    const order = await createOrder(input)

    await sendOrderEmail({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      address: input.address,
      city: input.city,
      district: input.district || "",
      paymentMethod,
      source: order.source,
      notes: order.notes || "",
      items: input.items.map((i) => ({
        name: i.name,
        format: i.format,
        quantity: i.quantity,
        price: i.price,
      })),
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
    })

    pushNotification({
      type: "new_order",
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
      total: order.total,
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne du serveur"
    const status = message.includes("Stock") || message.includes("introuvable") ? 400 : 500
    console.error("POST order error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
