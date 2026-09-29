import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"

export async function GET() {
  try {
    const prisma = getPrisma()
    const [zones, agents] = await Promise.all([
      prisma.deliveryZone.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, baseFee: true },
      }),
      prisma.deliveryAgent.findMany({
        where: { isActive: true, isAvailable: true },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          kind: true,
          companyName: true,
          phone: true,
          vehicle: true,
          plateNumber: true,
          zonesLabel: true,
          fees: { select: { zoneId: true, fee: true } },
        },
      }),
    ])

    return NextResponse.json({
      zones,
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        kind: agent.kind,
        companyName: agent.companyName,
        phone: agent.phone,
        vehicle: agent.vehicle,
        plateNumber: agent.plateNumber,
        zonesLabel: agent.zonesLabel,
        fees: Object.fromEntries(agent.fees.map((f) => [f.zoneId, f.fee])),
      })),
    })
  } catch (error) {
    console.error("GET delivery-options error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
