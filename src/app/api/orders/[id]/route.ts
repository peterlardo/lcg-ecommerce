import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

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
    const { status } = body

    if (!status || !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const order = await prisma.$transaction(async (tx) => {
      const previous = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      })

      if (!previous) throw new Error("Commande introuvable")

      if (status === "CANCELLED" && previous.status !== "CANCELLED") {
        for (const item of previous.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              type: "CANCEL_RESTOCK",
              quantity: item.quantity,
              reason: "Retour stock après annulation commande",
              reference: previous.orderNumber,
            },
          })
        }
      }

      if (previous.status === "CANCELLED" && status !== "CANCELLED") {
        for (const item of previous.items) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stock: true },
          })
          if (!variant || variant.stock < item.quantity) {
            throw new Error("Stock insuffisant pour réactiver la commande")
          }
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              type: "SALE_REACTIVATED",
              quantity: item.quantity,
              reason: "Réactivation commande",
              reference: previous.orderNumber,
            },
          })
        }
      }

      const updated = await tx.order.update({ where: { id }, data: { status } })

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

    return NextResponse.json({ id: order.id, status: order.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commande introuvable ou erreur serveur"
    const status = message.includes("introuvable") ? 404 : message.includes("Stock") ? 400 : 500
    console.error("PATCH order error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
