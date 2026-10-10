import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { CASHIER_ROLES } from "@/lib/permissions"

// Liste des caissières actives : l'opérateur d'accueil n'a pas accès à
// /api/utilisateurs (réservé à l'admin), il a besoin de cette liste pour
// choisir la caissière à qui transmettre une commande.
export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "OPERATEUR_ACCUEIL"])
  if (forbidden) return forbidden

  try {
    const cashiers = await getPrisma().user.findMany({
      where: { isActive: true, role: { in: CASHIER_ROLES } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(cashiers)
  } catch (error) {
    console.error("GET cashiers error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
