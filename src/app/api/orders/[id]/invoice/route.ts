import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { consumePointOfSaleStockTx } from "@/lib/stock-service"

interface InvoiceItemInput {
  orderItemId: string
  quantity: number
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const body = (await req.json()) as { pointOfSaleId?: string; items?: InvoiceItemInput[] }
    const pointOfSaleId = body.pointOfSaleId?.trim() || ""
    const incomingItems = Array.isArray(body.items) ? body.items : []

    if (!pointOfSaleId) {
      return NextResponse.json({ error: "Veuillez sélectionner un point de vente" }, { status: 400 })
    }
    if (incomingItems.length === 0) {
      return NextResponse.json({ error: "Aucun article à facturer" }, { status: 400 })
    }

    const order = await getPrisma().order.findUnique({
      where: { id },
      include: {
        items: true,
        delivery: true,
        pointOfSale: { select: { id: true, name: true, code: true } },
      },
    })
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })

    // Guard: déjà facturée si un mouvement SALE existe pour cette référence
    const existingSale = await getPrisma().stockMovement.findFirst({
      where: { reference: order.orderNumber, type: "SALE" },
      select: { id: true },
    })
    const shouldConsume = !existingSale

    const pos = await getPrisma().pointOfSale.findUnique({
      where: { id: pointOfSaleId },
      select: { id: true, name: true, code: true, isActive: true },
    })
    if (!pos || !pos.isActive) {
      return NextResponse.json({ error: "Point de vente introuvable ou inactif" }, { status: 400 })
    }

    const orderItemMap = new Map(order.items.map((it) => [it.id, it]))
    for (const it of incomingItems) {
      const original = orderItemMap.get(it.orderItemId)
      if (!original) {
        return NextResponse.json({ error: `Article ${it.orderItemId} introuvable dans la commande` }, { status: 400 })
      }
      const qty = Math.floor(Number(it.quantity))
      if (!Number.isFinite(qty) || qty < 1) {
        return NextResponse.json({ error: `Quantité invalide pour ${original.variantId}` }, { status: 400 })
      }
    }

    const result = await getPrisma().$transaction(async (tx) => {
      for (const it of incomingItems) {
        const original = orderItemMap.get(it.orderItemId)!
        const qty = Math.floor(Number(it.quantity))

        if (shouldConsume) {
          const fifoResult = await consumePointOfSaleStockTx(tx, {
            variantId: original.variantId,
            pointOfSaleId,
            quantity: qty,
            type: "SALE",
            reason: `Facture commande ${order.orderNumber}`,
            reference: order.orderNumber,
          })
          if (fifoResult.allocations.length > 0) {
            await tx.orderItem.update({
              where: { id: original.id },
              data: { lotId: fifoResult.allocations[0].lotId },
            })
          }
        }

        if (qty !== original.quantity) {
          await tx.orderItem.update({
            where: { id: original.id },
            data: { quantity: qty, total: original.price * qty },
          })
        }
      }

      const updatedItems = await tx.orderItem.findMany({ where: { orderId: id } })
      const newSubtotal = updatedItems.reduce((sum, it) => sum + it.price * it.quantity, 0)
      const deliveryFee = order.deliveryFee ?? 0
      const newTotal = newSubtotal + deliveryFee

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          paymentStatus: "PAID",
          pointOfSaleId,
          ticketGenerated: true,
        },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          pointOfSale: { select: { id: true, name: true, code: true } },
        },
      })

      return { updatedOrder, updatedItems }
    })

    const ticketItems = result.updatedOrder.items.map((item) => ({
      name: item.variant?.product?.name ?? "Produit",
      format: item.variant?.format ?? "",
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    }))

    return NextResponse.json({
      success: true,
      alreadyInvoiced: !shouldConsume,
      order: {
        id: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        total: result.updatedOrder.total,
        paymentStatus: result.updatedOrder.paymentStatus,
        pointOfSale: result.updatedOrder.pointOfSale,
      },
      ticket: {
        orderNumber: result.updatedOrder.orderNumber,
        customerName: result.updatedOrder.customerName,
        customerPhone: result.updatedOrder.customerPhone || undefined,
        sellerName: session?.user?.name ?? null,
        paymentMethod: result.updatedOrder.paymentMethod,
        paymentStatus: result.updatedOrder.paymentStatus,
        total: result.updatedOrder.total,
        createdAt: result.updatedOrder.createdAt.toISOString(),
        pointOfSale: result.updatedOrder.pointOfSale
          ? { name: result.updatedOrder.pointOfSale.name, code: result.updatedOrder.pointOfSale.code }
          : pos
            ? { name: pos.name, code: pos.code }
            : null,
        items: ticketItems,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    const status =
      message.includes("Stock") || message.includes("Point de vente") || message.includes("Quantité") || message.includes("Article")
        ? 400
        : message.includes("introuvable")
          ? 404
          : 500
    console.error("POST invoice error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
