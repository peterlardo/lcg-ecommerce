import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { buildDevisToken } from "@/lib/b2b"
import { auth } from "@/lib/auth"
import { seesAllB2b, type SessionUser } from "@/lib/commercial"

export const dynamic = "force-dynamic"

const ALLOWED = ["ADMIN", "COMMERCIAL"]

/**
 * Lien de partage d'un devis : le commercial envoie au client une adresse publique
 * (sans compte) pour consulter le devis. Le jeton est dérivé de la référence et du
 * secret serveur — rien à stocker en base, et le lien redevient invalide si le
 * secret change. Seul un devis non annulé dispose d'un lien.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const doc = await getPrisma().b2bDocument.findUnique({
    where: { id },
    select: { reference: true, type: true, status: true, client: { select: { commercialId: true } } },
  })
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 })
  if (session.user.role !== "ADMIN" && !seesAllB2b(session.user as SessionUser) && doc.client?.commercialId !== session.user.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }
  if (doc.type !== "DEVIS") return NextResponse.json({ error: "Seul un devis dispose d'un lien de partage" }, { status: 400 })
  if (doc.status === "CANCELLED") return NextResponse.json({ error: "Ce devis a été annulé" }, { status: 400 })

  const secret = process.env.NEXTAUTH_SECRET || ""
  if (!secret) return NextResponse.json({ error: "Configuration serveur incomplète" }, { status: 500 })

  const token = buildDevisToken(doc.reference, secret)
  return NextResponse.json({ path: `/partage/devis/${doc.reference}/${token}`, reference: doc.reference })
}
