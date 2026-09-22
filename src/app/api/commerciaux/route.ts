import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const commerciaux = await getPrisma().user.findMany({
      where: { role: { in: ["COMMERCIAL", "ADMIN"] }, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        operationZone: true,
        zoneLat: true,
        zoneLng: true,
        zoneRadiusKm: true,
      },
    })

    return NextResponse.json(commerciaux)
  } catch (error) {
    console.error("GET /api/commerciaux error:", error)
    return NextResponse.json(
      { error: "Erreur lors du chargement des commerciaux" },
      { status: 500 }
    )
  }
}
