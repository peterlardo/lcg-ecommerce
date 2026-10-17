import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { isCashierRole } from "@/lib/permissions"
import { creanceAging, creanceByClient, creanceLines, creanceSummary, type SessionUser } from "@/lib/commercial"

export const dynamic = "force-dynamic"

/** Lecture : gestionnaires + responsable comptable (gestion des factures B2B). */
const READ_ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE"]

/** Créances B2B : factures émises non soldées de la portée (tout le portefeuille, ou les clients du commercial). */
export async function GET() {
  const forbidden = await requireManagementAccess(READ_ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const user = session?.user as SessionUser
    const now = new Date()
    const creances = await creanceLines(user, now)
    return NextResponse.json({
      creances,
      count: creances.length,
      // total à recouvrer : identique à summary.totalBalance (mêmes arrondis)
      total: Math.round(creances.reduce((s, c) => s + Math.max(0, c.balance), 0) * 100) / 100,
      // seuls l'administrateur et la caisse valident un règlement saisi par un commercial
      canValidate: user?.role === "ADMIN" || isCashierRole(user?.role),
      // vue de recouvrement (sous-projet A) : calculée sur les mêmes lignes, jamais en SQL
      summary: creanceSummary(creances, now),
      aging: creanceAging(creances, now),
      byClient: creanceByClient(creances, now),
    })
  } catch (error) {
    console.error("GET commercial/creances error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
