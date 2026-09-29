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

interface ZoneClient {
  id: string
  type: "B2B" | "B2C"
  companyName: string | null
  tradeName: string | null
  contactName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  category: string | null
  latitude: number
  longitude: number
  geoSource: string | null
  geoConfidence: string | null
}

/** Client actif sans coordonnées, proposé à la pose manuelle sur la carte. */
interface MissingClient {
  id: string
  type: "B2B" | "B2C"
  name: string
  category: string | null
  phone: string | null
  address: string | null
  city: string | null
}

/**
 * Les colonnes latitude/longitude de B2BClient n'existent qu'après la
 * migration SQL. Tant qu'elle n'est pas appliquée (ou que le client Prisma
 * n'est pas régénéré), la requête échoue : on bascule alors sur l'ancien
 * modèle Client pour ne pas casser la page.
 */
function isGeoUnavailableError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? ""
  if (name === "PrismaClientValidationError") return true
  // P2021 = table absente, P2022 = colonne absente (migration non appliquée).
  const code = (error as { code?: string } | null)?.code
  if (code === "P2021" || code === "P2009" || code === "P2022") return true
  const message = error instanceof Error ? error.message : String(error ?? "")
  return /column .* does not exist|Unknown argument `latitude`|has no field/i.test(message)
}

async function loadB2BClients(): Promise<{ clients: ZoneClient[]; notice: string | null }> {
  try {
    const rows = await getPrisma().b2BClient.findMany({
      where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
      select: {
        id: true,
        name: true,
        category: true,
        phone: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        geoSource: true,
        geoConfidence: true,
      },
    })
    return {
      notice: null,
      clients: rows.map((c) => ({
        id: c.id,
        type: "B2B" as const,
        companyName: c.name,
        tradeName: null,
        contactName: null,
        firstName: null,
        lastName: null,
        email: null,
        phone: c.phone,
        address: c.address,
        city: c.city,
        category: c.category,
        latitude: c.latitude as number,
        longitude: c.longitude as number,
        geoSource: c.geoSource,
        geoConfidence: c.geoConfidence,
      })),
    }
  } catch (error) {
    if (!isGeoUnavailableError(error)) throw error
    console.warn(
      "GET /api/clients/zone : colonnes géo B2BClient indisponibles, repli sur le modèle Client.",
      error instanceof Error ? error.message : error
    )
    return {
      notice:
        "Coordonnées B2B indisponibles : migration prisma/b2b-geo-migration.sql non appliquée ou client Prisma non régénéré.",
      clients: [],
    }
  }
}

/**
 * Clients actifs dépourvus de coordonnées : ils n'apparaissent pas sur la carte
 * (le GET de la zone filtre sur latitude/longitude non nulles) et sont donc
 * proposés pour une pose manuelle du point.
 */
async function loadMissingClients(): Promise<{
  missing: MissingClient[]
  notice: string | null
}> {
  try {
    const b2b = await getPrisma().b2BClient.findMany({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
      select: {
        id: true,
        name: true,
        category: true,
        phone: true,
        address: true,
        city: true,
      },
      orderBy: { name: "asc" },
      take: 300,
    })

    const others = await getPrisma().client.findMany({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
      select: {
        id: true,
        type: true,
        companyName: true,
        tradeName: true,
        contactName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })

    return {
      notice: null,
      missing: [
        ...b2b.map((c) => ({
          id: c.id,
          type: "B2B" as const,
          name: c.name,
          category: c.category,
          phone: c.phone,
          address: c.address,
          city: c.city,
        })),
        ...others.map((c) => ({
          id: c.id,
          type: c.type,
          name:
            c.companyName ||
            c.tradeName ||
            c.contactName ||
            [c.firstName, c.lastName].filter(Boolean).join(" ") ||
            c.email ||
            "(sans nom)",
          category: null as string | null,
          phone: c.phone,
          address: c.address,
          city: c.city,
        })),
      ],
    }
  } catch (error) {
    if (!isGeoUnavailableError(error)) throw error
    return {
      missing: [],
      notice:
        "Coordonnées indisponibles : migration prisma/b2b-geo-migration.sql non appliquée ou client Prisma non régénéré.",
    }
  }
}

/**
 * Enregistrement d'un point posé à la main sur la carte. B2BClient porte les
 * métadonnées de géocodage, le modèle Client n'a que lat/lng.
 */
export async function PATCH(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const body = (await request.json()) as {
      id?: string
      type?: string
      latitude?: number | null
      longitude?: number | null
    }

    const id = body.id?.trim()
    const type = body.type === "B2C" ? "B2C" : "B2B"
    if (!id) {
      return NextResponse.json({ error: "Client manquant" }, { status: 400 })
    }

    const lat = body.latitude
    const lng = body.longitude
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 })
    }

    if (type === "B2C") {
      const updated = await getPrisma().client.update({
        where: { id },
        data: { latitude: lat, longitude: lng },
        select: { id: true, latitude: true, longitude: true },
      })
      return NextResponse.json({ ok: true, client: updated })
    }

    const updated = await getPrisma().b2BClient.update({
      where: { id },
      data: {
        latitude: lat,
        longitude: lng,
        geoSource: "manuel",
        geoConfidence: "manuel",
        geoVerified: true,
      },
      select: { id: true, latitude: true, longitude: true },
    })

    return NextResponse.json({ ok: true, client: updated })
  } catch (error) {
    // P2025 = enregistrement introuvable.
    const code = (error as { code?: string } | null)?.code
    if (code === "P2025" || (error instanceof Error && /record to (update|find) does not exist/i.test(error.message))) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    }
    console.error("PATCH /api/clients/zone error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const session = await (await import("@/lib/auth")).auth()
    const { searchParams } = new URL(request.url)
    const requestedId = searchParams.get("commercialId")?.trim() || ""
    const typeFilter = searchParams.get("type")?.trim() || ""

    // Clients sans coordonnées : liste de travail pour la pose manuelle des
    // points sur la carte (indépendante du commercial sélectionné).
    if (searchParams.get("missing") === "1") {
      const { missing, notice } = await loadMissingClients()
      return NextResponse.json({ missing, notice })
    }

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
      return NextResponse.json({ zone, clients: [], notice: null })
    }

    // B2BClient = clients B2B, Client = clients non-B2B. Les deux sources
    // alimentent la carte ; le paramètre `type` permet de n'en garder qu'une.
    const wantsB2B = typeFilter !== "B2C"
    const wantsOther = typeFilter !== "B2B"
    const all: ZoneClient[] = []
    const notices: string[] = []

    if (wantsB2B) {
      const b2b = await loadB2BClients()
      all.push(...b2b.clients)
      if (b2b.notice) notices.push(b2b.notice)
    }

    if (wantsOther) {
      const others = (await getPrisma().client.findMany({
        where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
        select: {
          id: true,
          type: true,
          companyName: true,
          tradeName: true,
          contactName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      })) as unknown as ZoneClient[]
      all.push(...others)
    }

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

    return NextResponse.json({
      zone,
      clients: inZone,
      notice: notices.length ? notices.join(" ") : null,
    })
  } catch (error) {
    console.error("GET /api/clients/zone error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
