import { NextResponse } from "next/server"
import type { DeliveryStatus } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess, requireModuleAccess } from "@/lib/api-auth"

const ACTIVE_STATUSES: DeliveryStatus[] = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"]
const VALID_KINDS = ["MAISON", "PARTNER"]

type AgentFeeInput = { zoneId: string; fee: number }

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const prisma = getPrisma()
    const [agents, zones, activeCounts] = await Promise.all([
      prisma.deliveryAgent.findMany({
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        include: {
          user: { select: { id: true, name: true, email: true, isActive: true } },
          fees: true,
        },
      }),
      prisma.deliveryZone.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.delivery.groupBy({
        by: ["agentId"],
        where: { agentId: { not: null }, status: { in: ACTIVE_STATUSES } },
        _count: { _all: true },
      }),
    ])

    const countMap = new Map(activeCounts.map((c) => [c.agentId, c._count?._all ?? 0]))

    return NextResponse.json({
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        kind: agent.kind,
        userId: agent.userId,
        user: agent.user,
        companyName: agent.companyName,
        phone: agent.phone,
        vehicle: agent.vehicle,
        plateNumber: agent.plateNumber,
        zonesLabel: agent.zonesLabel,
        isAvailable: agent.isAvailable,
        isActive: agent.isActive,
        notes: agent.notes,
        activeDeliveries: countMap.get(agent.id) ?? 0,
        fees: agent.fees.map((f) => ({ zoneId: f.zoneId, fee: f.fee })),
        createdAt: agent.createdAt.toISOString(),
      })),
      zones: zones.map((z) => ({ id: z.id, name: z.name, baseFee: z.baseFee, isActive: z.isActive })),
    })
  } catch (error) {
    console.error("GET delivery-agents error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

function parseAgentInput(body: Record<string, unknown>) {
  const name = String(body.name || "").trim()
  const kind = String(body.kind || "MAISON").toUpperCase()
  if (!name) return { error: "Nom du livreur requis" }
  if (!VALID_KINDS.includes(kind)) return { error: "Type de livreur invalide (MAISON ou PARTNER)" }
  if (kind === "PARTNER" && !String(body.companyName || "").trim())
    return { error: "La raison sociale est requise pour un partenaire" }

  const rawFees: AgentFeeInput[] = Array.isArray(body.fees)
    ? (body.fees as { zoneId?: unknown; fee?: unknown }[]).map((f) => ({
        zoneId: String(f?.zoneId || ""),
        fee: Math.max(0, Number(f?.fee) || 0),
      }))
    : []
  const fees = rawFees.filter((f) => f.zoneId)

  return {
    data: {
      name,
      kind,
      userId: body.userId ? String(body.userId) : null,
      companyName: body.companyName ? String(body.companyName).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      vehicle: body.vehicle ? String(body.vehicle).trim() : null,
      plateNumber: body.plateNumber ? String(body.plateNumber).trim() : null,
      zonesLabel: body.zonesLabel ? String(body.zonesLabel).trim() : null,
      isAvailable: body.isAvailable === undefined ? true : Boolean(body.isAvailable),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      notes: body.notes ? String(body.notes) : null,
      fees,
    },
  }
}

export async function POST(req: Request) {
  const forbidden = await requireModuleAccess("livraisons", "create")
  if (forbidden) return forbidden

  try {
    const body = await req.json()
    const parsed = parseAgentInput(body)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const prisma = getPrisma()
    const { fees, ...agentData } = parsed.data

    if (agentData.userId) {
      const user = await prisma.user.findUnique({ where: { id: agentData.userId } })
      if (!user) return NextResponse.json({ error: "Utilisateur maison introuvable" }, { status: 404 })
      const linked = await prisma.deliveryAgent.findUnique({ where: { userId: agentData.userId } })
      if (linked) return NextResponse.json({ error: "Cet utilisateur est déjà lié à un livreur" }, { status: 409 })
    }

    const zoneIds = fees.map((f) => f.zoneId)
    if (zoneIds.length > 0) {
      const zones = await prisma.deliveryZone.findMany({ where: { id: { in: zoneIds } }, select: { id: true } })
      if (zones.length !== new Set(zoneIds).size)
        return NextResponse.json({ error: "Une zone de tarif est introuvable" }, { status: 404 })
    }

    const agent = await prisma.deliveryAgent.create({
      data: {
        ...agentData,
        fees: fees.length > 0 ? { create: fees } : undefined,
      },
      include: { fees: true },
    })
    return NextResponse.json({ agent }, { status: 201 })
  } catch (error) {
    console.error("POST delivery-agents error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
