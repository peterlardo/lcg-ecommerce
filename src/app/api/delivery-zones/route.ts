import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess, requireModuleAccess } from "@/lib/api-auth"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const zones = await getPrisma().deliveryZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { deliveries: true, agentFees: true } } },
    })
    return NextResponse.json({
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        baseFee: z.baseFee,
        isActive: z.isActive,
        sortOrder: z.sortOrder,
        deliveries: z._count.deliveries,
        agents: z._count.agentFees,
      })),
    })
  } catch (error) {
    console.error("GET delivery-zones error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const forbidden = await requireModuleAccess("livraisons", "create")
  if (forbidden) return forbidden

  try {
    const body = await req.json()
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Nom de zone requis" }, { status: 400 })

    const baseFee = Math.max(0, Number(body.baseFee) || 0)
    const existing = await getPrisma().deliveryZone.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ error: "Une zone porte déjà ce nom" }, { status: 409 })

    const zone = await getPrisma().deliveryZone.create({
      data: {
        name,
        baseFee,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        sortOrder: Number(body.sortOrder) || 0,
      },
    })
    return NextResponse.json({ zone }, { status: 201 })
  } catch (error) {
    console.error("POST delivery-zones error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
