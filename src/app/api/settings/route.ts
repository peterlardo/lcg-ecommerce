import { NextResponse } from "next/server"
import { requireManagementAccess, requireModuleAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { getSettings, saveSection, type SettingsSection } from "@/lib/settings"

export const dynamic = "force-dynamic"

/** Noms de rubrique envoyés par l'écran Paramètres (français) ou par leur nom en base. */
const SECTION_ALIASES: Record<string, SettingsSection> = {
  generaux: "general", general: "general",
  livraison: "delivery", delivery: "delivery",
  paiement: "payment", payment: "payment",
  notifications: "notifications",
  reglement: "bank", bank: "bank",
}

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    return NextResponse.json(await getSettings())
  } catch (error) {
    console.error("GET settings error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

/**
 * Enregistre une rubrique : `{ section, data: { <rubrique>: {...} } }` (forme envoyée par l'écran)
 * ou `{ section, value: {...} }`.
 */
export async function POST(req: Request) {
  const forbidden = await requireModuleAccess("parametres", "edit")
  if (forbidden) return forbidden

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const section = SECTION_ALIASES[String(body?.section ?? "")]
    if (!body || !section) return NextResponse.json({ error: "Rubrique inconnue" }, { status: 400 })

    const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null
    const raw = body.value ?? data?.[section] ?? data
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Valeurs manquantes" }, { status: 400 })

    const session = await auth()
    const value = await saveSection(section, raw, session?.user?.id ?? null)
    await logActivity({ module: "parametres", action: "Modification", entity: "appSetting", entityId: section, summary: `Paramètres « ${section} » enregistrés` })
    return NextResponse.json({ ok: true, section, value })
  } catch (error) {
    console.error("POST settings error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
