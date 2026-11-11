import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { isCashierRole } from "@/lib/permissions"
import { creanceAging, creanceByClient, creanceLines, creanceSummary, type CreanceClientType, type SessionUser } from "@/lib/commercial"
import { seesAllOrders } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

/** Lecture : gestionnaires + responsable comptable (gestion des factures B2B). */
const READ_ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE"]

/** Créances B2B + clients ordinaires : factures émises non soldées (portée) et commandes impayées. */
export async function GET() {
  const forbidden = await requireManagementAccess(READ_ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const user = session?.user as SessionUser
    const now = new Date()
    const all = await creanceLines(user, now)
    const showOrdinary = seesAllOrders(user?.role)
    const creances = showOrdinary ? all : all.filter((c) => c.kind === "b2b")
    const typeCounts = creances.reduce((acc, c) => {
      acc[c.clientType] = (acc[c.clientType] || 0) + 1
      return acc
    }, {} as Record<CreanceClientType, number>)
    return NextResponse.json({
      creances,
      count: creances.length,
      // total � recouvrer : identique � summary.totalBalance (m�mes arrondis)
      total: Math.round(creances.reduce((s, c) => s + Math.max(0, c.balance), 0) * 100) / 100,
      // seuls l'administrateur et la caisse valident un r�glement saisi par un commercial
      canValidate: user?.role === "ADMIN" || isCashierRole(user?.role),
      // vue de recouvrement (sous-projet A) : calcul�e sur les m�mes lignes, jamais en SQL
      summary: creanceSummary(creances, now),
      aging: creanceAging(creances, now),
      byClient: creanceByClient(creances, now),
      kindCounts: {
        b2b: all.filter((c) => c.kind === "b2b").length,
        order: showOrdinary ? all.filter((c) => c.kind === "order").length : 0,
      },
      typeCounts,
    })
  } catch (error) {
    console.error("GET commercial/creances error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
