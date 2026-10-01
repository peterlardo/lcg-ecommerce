import { NextResponse } from "next/server"
import type { Prisma, DeliveryStatus } from "@prisma/client"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { notifyReservationStep } from "@/lib/reservation-notify"

const VALID_STATUS = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]
// Statuts d'une livraison à domicile qui supposent un livreur.
const NEEDS_AGENT = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]
// Statuts qui font sortir la marchandise : la commande doit avoir été confirmée
// (point de vente choisi, stock débité) avant.
const SHIPPING = ["PICKED_UP", "IN_TRANSIT", "DELIVERED"]

class DeliveryRuleError extends Error {
  constructor(message: string, public status = 409) {
    super(message)
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/deliveries/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const prisma = getPrisma()
    const { id } = await ctx.params
    const body = await req.json()

    const current = await prisma.delivery.findUnique({
      where: { id },
      select: {
        id: true, orderId: true, agentId: true, status: true, mode: true,
        order: { select: { status: true, source: true, paymentStatus: true } },
      },
    })
    if (!current) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 })

    const posFilter = await getUserPointOfSaleIds()
    if (posFilter?.role === "DELIVERY_AGENT") {
      const own = await prisma.deliveryAgent.findFirst({ where: { userId: posFilter.userId }, select: { id: true } })
      if (!own || current.agentId !== own.id) {
        return NextResponse.json({ error: "Cette livraison ne vous est pas assignee" }, { status: 403 })
      }
    }

    const changesFlow = body.status !== undefined || body.agentId !== undefined
    if (changesFlow && current.order.status === "CANCELLED") {
      throw new DeliveryRuleError("La commande est annulée : cette livraison ne peut plus être modifiée")
    }
    if (changesFlow && current.status === "DELIVERED") {
      throw new DeliveryRuleError("Livraison déjà effectuée : elle ne peut plus être modifiée")
    }

    const data: Prisma.DeliveryUpdateInput = {}
    let agentAfter = current.agentId

    if (body.agentId !== undefined) {
      const agentId = body.agentId ? String(body.agentId) : null
      if (agentId) {
        const agent = await prisma.deliveryAgent.findFirst({ where: { id: agentId, isActive: true } })
        if (!agent) return NextResponse.json({ error: "Livreur introuvable ou desactive" }, { status: 404 })
        if (!agent.isAvailable && agentId !== current.agentId) {
          return NextResponse.json({ error: `Le livreur « ${agent.name} » n'est pas disponible` }, { status: 400 })
        }
        data.agent = { connect: { id: agentId } }
        data.assignedAt = new Date()
        if (current.status === "PENDING" || current.status === "FAILED") data.status = "ASSIGNED"
      } else {
        if (["PICKED_UP", "IN_TRANSIT"].includes(current.status)) {
          throw new DeliveryRuleError("Livraison en route : impossible de retirer le livreur")
        }
        data.agent = { disconnect: true }
        data.assignedAt = null
        if (current.status === "ASSIGNED") data.status = "PENDING"
      }
      agentAfter = agentId
    }

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase()
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
      }
      if (current.mode === "DELIVERY" && NEEDS_AGENT.includes(status) && !agentAfter) {
        throw new DeliveryRuleError("Assignez d'abord un livreur à cette livraison", posFilter?.role === "DELIVERY_AGENT" ? 403 : 409)
      }
      if (SHIPPING.includes(status) && current.order.status === "PENDING") {
        throw new DeliveryRuleError("Confirmez d'abord la commande (choix du point de vente) avant de la livrer")
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
      const date = body.scheduledDate ? new Date(body.scheduledDate) : null
      if (date && Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Date de livraison invalide" }, { status: 400 })
      }
      data.scheduledDate = date
    }

    if (body.notes !== undefined) data.notes = String(body.notes || "")

    // Livraison et commande mises à jour ensemble : jamais l'une sans l'autre.
    const delivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id }, data })
      const orderSync: Prisma.OrderUpdateInput = {}
      if (updated.status === "IN_TRANSIT" && current.status !== "IN_TRANSIT") orderSync.status = "OUT_FOR_DELIVERY"
      if (updated.status === "DELIVERED") {
        orderSync.status = "DELIVERED"
        if (current.order.source === "WEB") orderSync.ticketGenerated = true
      }
      // Même règle que le changement de statut d'une commande : en livraison ou livrée = payée.
      if (orderSync.status && current.order.paymentStatus !== "PAID") orderSync.paymentStatus = "PAID"
      if (Object.keys(orderSync).length > 0) {
        await tx.order.update({ where: { id: current.orderId }, data: orderSync })
      }
      return updated
    })

    // Pré-commande : le client est prévenu (WhatsApp + e-mail) à chaque étape de la livraison.
    if (current.order.source === "RESERVATION" && delivery.status !== current.status) {
      const step = ({ IN_TRANSIT: "IN_TRANSIT", DELIVERED: "DELIVERED", FAILED: "FAILED" } as const)[delivery.status as "IN_TRANSIT" | "DELIVERED" | "FAILED"]
      if (step) await notifyReservationStep({ orderId: current.orderId }, step, { failedReason: delivery.failedReason ?? undefined })
    }

    return NextResponse.json({
      id: delivery.id,
      status: delivery.status,
      agentId: delivery.agentId,
      mode: delivery.mode,
      failedReason: delivery.failedReason,
    })
  } catch (error) {
    if (error instanceof DeliveryRuleError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("PATCH delivery error:", error)
    return NextResponse.json({ error: "Livraison introuvable ou erreur serveur" }, { status: 500 })
  }
}
