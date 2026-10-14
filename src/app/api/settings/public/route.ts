import { NextResponse } from "next/server"
import { getSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

/** Réglages utiles à la boutique (frais de livraison, coordonnées) : lisibles sans connexion. */
export async function GET() {
  try {
    const { general, delivery, payment } = await getSettings()
    return NextResponse.json({ general, delivery, payment })
  } catch (error) {
    console.error("GET settings/public error:", error)
    // sans réglages lisibles, la boutique garde ses valeurs par défaut (livraison gratuite)
    return NextResponse.json({ general: {}, delivery: {}, payment: {} })
  }
}
