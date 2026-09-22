import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { sendStatusChangeEmail } from "@/lib/mailer"
import { pushNotification } from "@/lib/notifications"
import {
  consumePointOfSaleStockTx,
  restoreLotAllocationsByReferenceTx,
  restockPointOfSaleStockTx,
} from "@/lib/stock-service"

const VALID_STATUS = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]

export async function PATCH(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { status, pointOfSaleId } = body

    if (!status || !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const order = await getPrisma().$transaction(async (tx) => {
      const previous = await tx.order.findUnique({
        where: { id },
        select: {
          items: true, paymentStatus: true, status: true,
          orderNumber: true, source: true, pointOfSaleId: true,
        },
      })

      if (!previous) throw new Error("Commande introuvable")

      if (status === "CONFIRMED" && previous.status === "PENDING") {
        if (!pointOfSaleId) {
          throw new Error("Veuillez sélectionner un point de vente pour confirmer la commande")
        }

        const pos = await tx.pointOfSale.findUnique({
          where: { id: pointOfSaleId },
          select: { id: true, name: true, isActive: true },
        })
        if (!pos || !pos.isActive) {
          throw new Error("Point de vente introuvable ou inactif")
        }

        for (const item of previous.items) {
          // Les commandes issues d'une pré-commande ont déjà été débitées lors de
          // la confirmation de la réservation.
          if (previous.source === "RESERVATION") break

          const fifoResult = await consumePointOfSaleStockTx(tx, {
            variantId: item.variantId,
            pointOfSaleId,
            quantity: item.quantity,
            type: "SALE",
            reason: `Vente commande ${previous.orderNumber}`,
            reference: previous.orderNumber,
          })

          if (fifoResult.allocations.length > 0) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { lotId: fifoResult.allocations[0].lotId },
            })
          }
        }

        await tx.order.update({
          where: { id },
          data: { pointOfSaleId },
        })
      }

      if (status === "CANCELLED" && previous.status !== "CANCELLED") {
        const lotAllocations = await tx.lotAllocation.findMany({
          where: { reference: previous.orderNumber },
        })
        const statusSetStock = ["CONFIRMED", "PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"].includes(previous.status)
        const shouldRestock = statusSetStock || lotAllocations.length > 0

        if (shouldRestock && previous.pointOfSaleId) {
          for (const item of previous.items) {
            await restockPointOfSaleStockTx(tx, {
              variantId: item.variantId,
              pointOfSaleId: previous.pointOfSaleId,
              quantity: item.quantity,
              type: "CANCEL_RESTOCK",
              reason: "Retour stock après annulation commande",
              reference: previous.orderNumber,
            })
          }
        } else if (shouldRestock) {
          for (const item of previous.items) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })

            await tx.stockMovement.create({
              data: {
                variantId: item.variantId,
                type: "RETURN",
                quantity: item.quantity,
                reason: "Retour stock après annulation commande",
                reference: previous.orderNumber,
              },
            })
          }
        }

        if (lotAllocations.length > 0) {
          await restoreLotAllocationsByReferenceTx(tx, previous.orderNumber)
        }
      }

      const updateData: Record<string, string | boolean> = { status }

      if ((status === "OUT_FOR_DELIVERY" || status === "DELIVERED") && previous.paymentStatus !== "PAID") {
        updateData.paymentStatus = "PAID"
      }
      if (status === "CANCELLED" && previous.paymentStatus === "PAID") {
        updateData.paymentStatus = "REFUNDED"
      }
      if (status === "DELIVERED" && previous.source === "WEB") {
        updateData.ticketGenerated = true
      }

      const updated = await tx.order.update({ where: { id }, data: updateData })

      if (status === "OUT_FOR_DELIVERY") {
        await tx.delivery.updateMany({ where: { orderId: id }, data: { status: "IN_TRANSIT" } })
      }
      if (status === "DELIVERED") {
        await tx.delivery.updateMany({
          where: { orderId: id },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        })
      }
      if (status === "CANCELLED") {
        await tx.delivery.updateMany({ where: { orderId: id }, data: { status: "FAILED" } })
      }

      return updated
    })

    const fullOrder = await getPrisma().order.findUnique({
      where: { id },
      select: {
        orderNumber: true, customerName: true, customerEmail: true,
        total: true, items: { select: { quantity: true, price: true, variant: { select: { format: true, product: { select: { name: true } } } } } },
      },
    })
    if (fullOrder) {
      sendStatusChangeEmail({
        orderNumber: fullOrder.orderNumber,
        customerName: fullOrder.customerName ?? "",
        customerEmail: fullOrder.customerEmail ?? "",
        newStatus: status,
        total: fullOrder.total,
        items: fullOrder.items.map((i) => ({ name: i.variant?.product?.name ?? "Produit", format: i.variant?.format ?? "", quantity: i.quantity, price: i.price })),
      }).catch(() => {})
      pushNotification({
        type: "status_change",
        orderNumber: fullOrder.orderNumber,
        customerName: fullOrder.customerName ?? "",
        newStatus: status,
        total: fullOrder.total,
      })
    }

    return NextResponse.json({ id: order.id, status: order.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commande introuvable ou erreur serveur"
    const status = message.includes("introuvable") ? 404 : message.includes("Stock") || message.includes("point de vente") ? 400 : 500
    console.error("PATCH order error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
