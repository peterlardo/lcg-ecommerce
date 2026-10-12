import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { isCashierRole } from "@/lib/permissions"
import { creanceLines, type SessionUser } from "@/lib/commercial"

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
    const creances = await creanceLines(user)
    return NextResponse.json({
      creances,
      count: creances.length,
      total: Math.round(creances.reduce((s, c) => s + Math.max(0, c.balance), 0) * 100) / 100,
      // seuls l'administrateur et la caisse valident un règlement saisi par un commercial
      canValidate: user?.role === "ADMIN" || isCashierRole(user?.role),
    })
  } catch (error) {
    console.error("GET commercial/creances error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
