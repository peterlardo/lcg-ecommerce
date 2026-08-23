import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { sendStatusChangeEmail } from "@/lib/mailer"
import { pushNotification } from "@/lib/notifications"
import { allocateStockFIFOTx } from "@/lib/lot-utils"

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

    const order = await prisma.$transaction(async (tx) => {
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
          // Les commandes issues d'une pré-commande ont déjà été débitées du stock
          // central lors de la confirmation de la réservation (voir confirmReservation)
          if (previous.source === "RESERVATION") break

          const posStock = await tx.pointOfSaleStock.findUnique({
            where: { pointOfSaleId_variantId: { pointOfSaleId, variantId: item.variantId } },
          })

          const available = posStock?.quantity ?? 0
          if (available < item.quantity) {
            const variant = await tx.productVariant.findUnique({
              where: { id: item.variantId },
              select: { product: { select: { name: true } }, format: true },
            })
            const name = variant ? `${variant.product.name} ${variant.format}` : item.variantId
            throw new Error(`Stock insuffisant au point de vente "${pos.name}" pour ${name} (disponible: ${available}, demandé: ${item.quantity})`)
          }

          await tx.pointOfSaleStock.update({
            where: { pointOfSaleId_variantId: { pointOfSaleId, variantId: item.variantId } },
            data: { quantity: { decrement: item.quantity } },
          })

          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              pointOfSaleId,
              type: "SALE",
              quantity: item.quantity,
              reason: `Vente commande ${previous.orderNumber}`,
              reference: previous.orderNumber,
            },
          })

          await allocateStockFIFOTx(tx, item.variantId, item.quantity, "SALE", previous.orderNumber)
        }

        await tx.order.update({
          where: { id },
          data: { pointOfSaleId },
        })
      }

      if (status === "CANCELLED" && previous.status !== "CANCELLED") {
        const statusSetStock = ["CONFIRMED", "PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"].includes(previous.status)

        if (statusSetStock && previous.pointOfSaleId && previous.source !== "RESERVATION") {
          for (const item of previous.items) {
            const posStock = await tx.pointOfSaleStock.findUnique({
              where: { pointOfSaleId_variantId: { pointOfSaleId: previous.pointOfSaleId, variantId: item.variantId } },
            })

            if (posStock) {
              await tx.pointOfSaleStock.update({
                where: { pointOfSaleId_variantId: { pointOfSaleId: previous.pointOfSaleId, variantId: item.variantId } },
                data: { quantity: { increment: item.quantity } },
              })
            } else {
              await tx.pointOfSaleStock.create({
                data: {
                  pointOfSaleId: previous.pointOfSaleId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                },
              })
            }

            await tx.stockMovement.create({
              data: {
                variantId: item.variantId,
                pointOfSaleId: previous.pointOfSaleId,
                type: "CANCEL_RESTOCK",
                quantity: item.quantity,
                reason: "Retour stock après annulation commande",
                reference: previous.orderNumber,
              },
            })
          }
        }

        if (statusSetStock && previous.source === "RESERVATION") {
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
                reason: "Retour stock central après annulation commande",
                reference: previous.orderNumber,
              },
            })
          }
        }

        const lotAllocations = await tx.lotAllocation.findMany({
          where: { reference: previous.orderNumber },
        })
        if (lotAllocations.length > 0) {
          for (const alloc of lotAllocations) {
            await tx.productionLot.update({
              where: { id: alloc.lotId },
              data: {
                remainingQuantity: { increment: alloc.quantity },
                status: "ACTIVE",
              },
            })
          }
          await tx.lotAllocation.deleteMany({ where: { reference: previous.orderNumber } })
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

    const fullOrder = await prisma.order.findUnique({
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
