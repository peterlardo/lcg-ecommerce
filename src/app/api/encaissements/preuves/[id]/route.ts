import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"
import { seesAllB2b, type SessionUser } from "@/lib/commercial"

export const dynamic = "force-dynamic"

/**
 * Justificatif d'un règlement (preuve du virement, scan du chèque), affiché dans le navigateur.
 * Mêmes droits que le journal des encaissements : un commercial ne voit que ceux de ses clients.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL", "COMPTABLE", ...CASHIER_ROLES], [["encaissements"], "view"])
  if (forbidden) return forbidden

  const { id } = await params
  const session = await auth()
  const user = session?.user as SessionUser
  const proof = await getPrisma().paymentProof.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, data: true, payment: { select: { b2bDocument: { select: { client: { select: { commercialId: true } } } } } } },
  })
  if (!proof) return NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 })
  if (!seesAllB2b(user) && !isCashierRole(user?.role) && proof.payment.b2bDocument?.client?.commercialId !== user?.id) {
    return NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 })
  }

  return new NextResponse(Buffer.from(proof.data), {
    headers: {
      "Content-Type": proof.mimeType,
      // affiché dans l'onglet ; le nom sert à l'enregistrement
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(proof.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
