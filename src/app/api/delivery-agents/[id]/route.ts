import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/api-auth"

const VALID_KINDS = ["MAISON", "PARTNER"]

export async function PATCH(req: Request, ctx: RouteContext<"/api/delivery-agents/[id]">) {
  const forbidden = await requireModuleAccess("livraisons", "edit")
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const prisma = getPrisma()

    const agent = await prisma.deliveryAgent.findUnique({
      where: { id },
      include: { fees: true },
    })
    if (!agent) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: "Nom du livreur requis" }, { status: 400 })
      data.name = name
    }
    if (body.kind !== undefined) {
      const kind = String(body.kind).toUpperCase()
      if (!VALID_KINDS.includes(kind)) return NextResponse.json({ error: "Type invalide (MAISON ou PARTNER)" }, { status: 400 })
      if (kind === "PARTNER" && !(body.companyName ? String(body.companyName).trim() : agent.companyName))
        return NextResponse.json({ error: "Raison sociale requise pour un partenaire" }, { status: 400 })
      data.kind = kind
    }
    if (body.companyName !== undefined) data.companyName = body.companyName ? String(body.companyName).trim() : null
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null
    if (body.vehicle !== undefined) data.vehicle = body.vehicle ? String(body.vehicle).trim() : null
    if (body.plateNumber !== undefined) data.plateNumber = body.plateNumber ? String(body.plateNumber).trim() : null
    if (body.zonesLabel !== undefined) data.zonesLabel = body.zonesLabel ? String(body.zonesLabel).trim() : null
    if (body.isAvailable !== undefined) data.isAvailable = Boolean(body.isAvailable)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null
    if (body.userId !== undefined) {
      const userId = body.userId ? String(body.userId) : null
      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
        const linked = await prisma.deliveryAgent.findFirst({ where: { userId, NOT: { id: agent.id } } })
        if (linked) return NextResponse.json({ error: "Cet utilisateur est déjà lié à un autre livreur" }, { status: 409 })
      }
      data.userId = userId
    }

    const rawFees: { zoneId: string; fee: number }[] = Array.isArray(body.fees)
      ? (body.fees as { zoneId?: unknown; fee?: unknown }[]).map((f) => ({
          zoneId: String(f?.zoneId || ""),
          fee: Math.max(0, Number(f?.fee) || 0),
        }))
      : []
    const fees = Array.isArray(body.fees) ? rawFees.filter((f) => f.zoneId) : null

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.deliveryAgent.update({ where: { id }, data })
      if (fees) {
        const zoneIds = fees.map((f) => f.zoneId)
        const zones = await tx.deliveryZone.findMany({ where: { id: { in: zoneIds } }, select: { id: true } })
        if (zones.length !== new Set(zoneIds).size) throw new Error("ZONE_INVALIDE")
        await tx.deliveryAgentFee.deleteMany({ where: { agentId: id } })
        await tx.deliveryAgentFee.createMany({ data: fees.map((f) => ({ agentId: id, zoneId: f.zoneId, fee: f.fee })) })
      }
      return a
    })

    const agentWithFees = await prisma.deliveryAgent.findUnique({
      where: { id: updated.id },
      include: { fees: true },
    })
    return NextResponse.json({ agent: agentWithFees })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ""
    if (msg === "ZONE_INVALIDE") return NextResponse.json({ error: "Zone de tarif invalide" }, { status: 404 })
    console.error("PATCH delivery-agent error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/delivery-agents/[id]">) {
  const forbidden = await requireModuleAccess("livraisons", "delete")
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const prisma = getPrisma()
    const agent = await prisma.deliveryAgent.findUnique({
      where: { id },
      include: { _count: { select: { deliveries: true } } },
    })
    if (!agent) return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 })
    if (agent._count.deliveries > 0) {
      return NextResponse.json(
        { error: `Impossible : ${agent._count.deliveries} livraison(s) assignées à ce livreur. Réassignez-les avant suppression.` },
        { status: 409 }
      )
    }
    await prisma.deliveryAgent.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE delivery-agent error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
