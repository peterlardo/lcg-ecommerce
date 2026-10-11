import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { coherenceSummary, regulariseStockTx, stockCoherenceTx } from "@/lib/lot-coherence"
import { isLotNumberConflict } from "@/lib/lot-utils"

/** État de cohérence du stock (emplacements, ancien stock global, lots) : lecture pour tout le personnel. */
export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const rows = await getPrisma().$transaction((tx) => stockCoherenceTx(tx))
    return NextResponse.json({ rows, summary: coherenceSummary(rows) })
  } catch (error) {
    console.error("GET lots/coherence error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

/** Régularisation : réservée à l'administrateur, tracée dans le journal d'activité. */
export async function POST() {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const actorId = session?.user?.id ?? null
    const result = await getPrisma().$transaction((tx) => regulariseStockTx(tx, actorId), { timeout: 20000 })

    if (result.createdLots.length > 0 || result.syncedFormats > 0) {
      await logActivity({
        module: "production",
        action: "regularisation",
        entity: "ProductionLot",
        summary: `Régularisation du stock : ${result.createdLots.length} lot(s) créé(s) pour ${result.createdLots.reduce((s, l) => s + l.quantity, 0)} unité(s) sans lot, stock global réaligné sur ${result.syncedFormats} format(s)`,
      })
    }

    return NextResponse.json({
      createdLots: result.createdLots,
      syncedFormats: result.syncedFormats,
      rows: result.rows,
      summary: coherenceSummary(result.rows),
    })
  } catch (error) {
    if (isLotNumberConflict(error)) {
      return NextResponse.json({ error: "Un autre lot vient d'etre cree au meme instant : veuillez reessayer" }, { status: 409 })
    }
    console.error("POST lots/coherence error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
