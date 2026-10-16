import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { commercialPointsOfSale } from "@/lib/settings"

export const dynamic = "force-dynamic"

/**
 * Points de vente où les commerciaux et le responsable commercial enregistrent leurs commandes
 * (réglage « Points de vente des commerciaux » de l'écran Paramètres) : liste du formulaire de commande.
 */
export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    return NextResponse.json({ points: await commercialPointsOfSale() })
  } catch (error) {
    console.error("GET points-de-vente/commerciaux error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
