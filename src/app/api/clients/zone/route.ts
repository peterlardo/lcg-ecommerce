import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"

const EARTH_RADIUS_KM = 6371

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const session = await (await import("@/lib/auth")).auth()
    const { searchParams } = new URL(request.url)
    const requestedId = searchParams.get("commercialId")?.trim() || ""
    const typeFilter = searchParams.get("type")?.trim() || ""

    const commercialId =
      requestedId ||
      (session?.user?.role === "COMMERCIAL" ? session.user.id : "")

    if (!commercialId) {
      return NextResponse.json(
        { error: "Commercial non spécifié" },
        { status: 400 }
      )
    }

    const commercial = await getPrisma().user.findUnique({
      where: { id: commercialId },
      select: {
        id: true,
        name: true,
        email: true,
        operationZone: true,
        zoneLat: true,
        zoneLng: true,
        zoneRadiusKm: true,
      },
    })

    if (!commercial) {
      return NextResponse.json({ error: "Commercial introuvable" }, { status: 404 })
    }

    const zone = {
      name: commercial.operationZone || null,
      lat: commercial.zoneLat ?? null,
      lng: commercial.zoneLng ?? null,
      radiusKm: commercial.zoneRadiusKm ?? 10,
    }

    if (zone.lat === null || zone.lng === null) {
      return NextResponse.json({ zone, clients: [] })
    }

    const whereFilter: Record<string, unknown> = { latitude: { not: null }, longitude: { not: null } }
    if (typeFilter === "B2B" || typeFilter === "B2C") {
      whereFilter.type = typeFilter
    }

    const all = await getPrisma().client.findMany({
      where: whereFilter,
      include: { commercial: { select: { id: true, name: true, email: true } } },
    })

    const inZone = all
      .map((c) => {
        const distance = haversine(
          zone.lat as number,
          zone.lng as number,
          c.latitude as number,
          c.longitude as number
        )
        return { ...c, distanceKm: Math.round(distance * 10) / 10 }
      })
      .filter((c) => c.distanceKm <= (zone.radiusKm as number))
      .sort((a, b) => a.distanceKm - b.distanceKm)

    return NextResponse.json({ zone, clients: inZone })
  } catch (error) {
    console.error("GET /api/clients/zone error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
