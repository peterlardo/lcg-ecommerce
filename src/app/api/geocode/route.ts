import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { geocodeAddressDetailed } from "@/lib/geocode"

const MISSING_KEY_ERROR =
  "Géocodage indisponible : GOOGLE_MAPS_API_KEY est vide dans .env. Activez l'API « Geocoding API » sur le projet Cloud puis renseignez la clé."

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: MISSING_KEY_ERROR }, { status: 503 })
  }

  let address = ""
  try {
    const body = await req.json()
    address = typeof body?.address === "string" ? body.address.trim() : ""
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  if (!address) {
    return NextResponse.json({ error: "Adresse vide" }, { status: 400 })
  }
  if (address.length > 200) {
    return NextResponse.json({ error: "Adresse trop longue" }, { status: 400 })
  }

  try {
    const outcome = await geocodeAddressDetailed(address)
    if (outcome.ok) {
      return NextResponse.json({
        lat: outcome.point.lat,
        lng: outcome.point.lng,
        address,
      })
    }
    // 404 = recherche légitime sans résultat ; 502 = l'API Google répond en
    // erreur (API non activée, quota, clé restreinte à une autre API...).
    const status = outcome.reason === "no-result" ? 404 : 502
    return NextResponse.json({ error: outcome.message }, { status })
  } catch (error) {
    console.error("POST /api/geocode error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
