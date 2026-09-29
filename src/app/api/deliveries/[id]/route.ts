import { NextResponse } from "next/server"
import type { Prisma, DeliveryStatus } from "@prisma/client"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"

const VALID_STATUS = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]

export async function PATCH(req: Request, ctx: RouteContext<"/api/deliveries/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const prisma = getPrisma()
    const { id } = await ctx.params
    const body = await req.json()

    const current = await prisma.delivery.findUnique({
      where: { id },
      select: { id: true, orderId: true, agentId: true, status: true, mode: true },
    })
    if (!current) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 })

    const posFilter = await getUserPointOfSaleIds()
    if (posFilter?.role === "DELIVERY_AGENT") {
      const own = await prisma.deliveryAgent.findFirst({ where: { userId: posFilter.userId }, select: { id: true } })
      if (!own || current.agentId !== own.id) {
        return NextResponse.json({ error: "Cette livraison ne vous est pas assignee" }, { status: 403 })
      }
    }

    const data: Prisma.DeliveryUpdateInput = {}

    if (body.agentId !== undefined) {
      const agentId = body.agentId ? String(body.agentId) : null
      if (agentId) {
        const agent = await prisma.deliveryAgent.findFirst({ where: { id: agentId, isActive: true } })
        if (!agent) return NextResponse.json({ error: "Livreur introuvable ou desactive" }, { status: 404 })
        if (!agent.isAvailable) {
          return NextResponse.json({ error: `Le livreur « ${agent.name} » n'est pas disponible` }, { status: 400 })
        }
        data.agent = { connect: { id: agentId } }
        data.assignedAt = new Date()
        if (current.status === "PENDING") data.status = "ASSIGNED"
      } else {
        data.agent = { disconnect: true }
        data.assignedAt = null
        if (current.status === "ASSIGNED") data.status = "PENDING"
      }
    }

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase()
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
      }
      const needsAgent = current.mode === "DELIVERY" && current.agentId == null && body.agentId === undefined
      if (needsAgent && posFilter?.role === "DELIVERY_AGENT") {
        return NextResponse.json({ error: "Livraison non assignee : demandez un livreur" }, { status: 403 })
      }
      data.status = status as DeliveryStatus
      if (status === "DELIVERED") {
        data.deliveredAt = new Date()
        data.failedReason = null
      }
      if (status === "FAILED") {
        const reason = String(body.failedReason || "").trim()
        if (!reason) return NextResponse.json({ error: "Motif de l'echec requis" }, { status: 400 })
        data.failedReason = reason
      }
    }

    if (body.failedReason !== undefined && data.status !== "FAILED") {
      data.failedReason = body.failedReason ? String(body.failedReason) : null
    }

    if (body.scheduledDate !== undefined) {
      data.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null
    }

    if (body.notes !== undefined) data.notes = String(body.notes || "")

    const delivery = await prisma.delivery.update({ where: { id }, data })

    if (delivery.status === "IN_TRANSIT") {
      await prisma.order.update({ where: { id: delivery.orderId }, data: { status: "OUT_FOR_DELIVERY" } })
    }
    if (delivery.status === "DELIVERED") {
      const order = await prisma.order.findUnique({ where: { id: delivery.orderId }, select: { source: true } })
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: "DELIVERED", ...(order?.source === "WEB" ? { ticketGenerated: true } : {}) },
      })
    }

    return NextResponse.json({
      id: delivery.id,
      status: delivery.status,
      agentId: delivery.agentId,
      mode: delivery.mode,
      failedReason: delivery.failedReason,
    })
  } catch (error) {
    console.error("PATCH delivery error:", error)
    return NextResponse.json({ error: "Livraison introuvable ou erreur serveur" }, { status: 500 })
  }
}
