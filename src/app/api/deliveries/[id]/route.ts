import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

const VALID_STATUS = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]

export async function PATCH(req: Request, ctx: RouteContext<"/api/deliveries/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const data: any = {}

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase()
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
      }
      data.status = status
      if (status === "DELIVERED") data.deliveredAt = new Date()
    }

    if (body.deliveryAgentId !== undefined) {
      data.deliveryAgentId = body.deliveryAgentId ? String(body.deliveryAgentId) : null
      if (data.deliveryAgentId && !data.status) data.status = "ASSIGNED"
    }

    if (body.scheduledDate !== undefined) {
      data.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null
    }

    if (body.notes !== undefined) data.notes = String(body.notes || "")

    const delivery = await prisma.delivery.update({ where: { id }, data })

    if (data.status === "IN_TRANSIT") {
      await prisma.order.update({ where: { id: delivery.orderId }, data: { status: "OUT_FOR_DELIVERY" } })
    }
    if (data.status === "DELIVERED") {
      await prisma.order.update({ where: { id: delivery.orderId }, data: { status: "DELIVERED" } })
    }

    return NextResponse.json({ id: delivery.id, status: delivery.status })
  } catch (error) {
    console.error("PATCH delivery error:", error)
    return NextResponse.json({ error: "Livraison introuvable ou erreur serveur" }, { status: 500 })
  }
}
