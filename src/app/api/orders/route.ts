import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { createOrder, type OrderInput } from "@/data/store"
import { sendOrderEmail, sendOrderDevisEmail, buildOrderDevisText, type OrderMailData } from "@/lib/mailer"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { generateOrderNumber } from "@/lib/utils"
import { pushNotification } from "@/lib/notifications"
import { DeliveryChoiceError } from "@/lib/delivery"

const PAYMENT_METHODS = ["CARD", "MOBILE_MONEY", "CASH_ON_DELIVERY"]

interface OrderItemBody {
  productId?: unknown
  variantId?: unknown
  name?: unknown
  format?: unknown
  quantity?: unknown
  price?: unknown
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const role = session?.user?.role
    const selfId = session!.user!.id

    const posFilter = await getUserPointOfSaleIds()
    const posIds = posFilter?.posIds ?? null

    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get("userId")?.trim() || ""
    const dateParam = searchParams.get("date")?.trim() || ""

    const posClause: Prisma.OrderWhereInput | null =
      posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : null

    const ownScope: Prisma.OrderWhereInput = {
      OR: [{ NOT: { notes: { startsWith: "Vente comptoir" } } }, { userId: selfId }],
    }

    const where: Prisma.OrderWhereInput =
      role === "ADMIN"
        ? (posClause ?? {})
        : role === "COMMERCIAL"
          ? { userId: selfId }
          : { AND: [...(posClause ? [posClause] : []), ownScope] }

    if (session?.user?.role === "ADMIN" && userIdParam) where.userId = userIdParam
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const start = new Date(`${dateParam}T00:00:00`)
      const end = new Date(`${dateParam}T23:59:59.999`)
      where.createdAt = { gte: start, lte: end }
    }

    const orders = await getPrisma().order.findMany({
      where,
      select: {
        id: true,
        userId: true,
        user: { select: { name: true } },
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        subtotal: true,
        deliveryFee: true,
        total: true,
        notes: true,
        source: true,
        ticketGenerated: true,
        pointOfSaleId: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            price: true,
            total: true,
            variant: { select: { format: true, product: { select: { name: true } } } },
          },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            address: true,
            city: true,
            district: true,
            scheduledDate: true,
            deliveredAt: true,
            notes: true,
            mode: true,
            fee: true,
            agentId: true,
            agent: { select: { id: true, name: true, kind: true } },
            zone: { select: { id: true, name: true } },
          },
        },
        pointOfSale: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json(
      orders.map((o) => ({
        id: o.id,
        userId: o.userId ?? null,
        userName: o.user?.name ?? null,
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
        ticketGenerated: o.ticketGenerated,
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
              mode: o.delivery.mode,
              fee: o.delivery.fee,
              agent: o.delivery.agent?.name ?? null,
              agentId: o.delivery.agentId,
              zone: o.delivery.zone?.name ?? null,
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
    const deliveryMode = String(body.deliveryMode || "DELIVERY").toUpperCase() === "PICKUP" ? "PICKUP" : "DELIVERY"

    if (!body.customerName || !body.customerPhone || items.length === 0) {
      return NextResponse.json(
        { error: "Client, téléphone et articles sont requis" },
        { status: 400 }
      )
    }

    if (deliveryMode === "DELIVERY" && !body.address) {
      return NextResponse.json({ error: "Adresse de livraison requise" }, { status: 400 })
    }

    if (deliveryMode === "DELIVERY" && !body.deliveryZoneId) {
      return NextResponse.json({ error: "Choisissez une zone de livraison" }, { status: 400 })
    }

    const paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod)
      ? body.paymentMethod
      : "CASH_ON_DELIVERY"

    // Saisie opérateur : l'auteur est l'utilisateur connecté (cloche de notifications, visibilité)
    const operatorId = body.source === "OPERATOR" ? ((await auth())?.user?.id as string | undefined) ?? null : null

    const input: OrderInput = {
      orderNumber: body.orderNumber || generateOrderNumber(),
      userId: operatorId,
      customerName: String(body.customerName),
      customerEmail: String(body.customerEmail || ""),
      customerPhone: String(body.customerPhone),
      address: String(body.address || "Retrait sur place"),
      city: String(body.city || "Brazzaville"),
      district: body.district ? String(body.district) : undefined,
      paymentMethod,
      source: body.source === "OPERATOR" ? "OPERATOR" : "WEB",
      notes: body.notes ? String(body.notes) : undefined,
      deliveryMode,
      deliveryZoneId: deliveryMode === "DELIVERY" ? String(body.deliveryZoneId) : null,
      deliveryAgentId: deliveryMode === "DELIVERY" && body.deliveryAgentId ? String(body.deliveryAgentId) : null,
      couponCode: body.couponCode ? String(body.couponCode).trim().toUpperCase() : null,
      items: items.map((item: OrderItemBody) => ({
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

    const mailData: OrderMailData = {
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
        price: order.items.find((oi) => oi.variantId === i.variantId)?.price ?? i.price,
      })),
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discountAmount: order.discountAmount,
      couponCode: order.couponCode,
      total: order.total,
    }

    await sendOrderEmail(mailData)
    await sendOrderDevisEmail(mailData)
    sendWhatsAppMessage(order.customerPhone, buildOrderDevisText(mailData)).catch(() => {})

    pushNotification({
      type: "new_order",
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
      total: order.total,
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne du serveur"
    const deliveryError = error instanceof DeliveryChoiceError
    const status =
      deliveryError ||
      message.includes("Stock") || message.includes("introuvable") || message.includes("Code promo") || message.includes("Montant minimum")
        ? 400
        : 500
    console.error("POST order error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
