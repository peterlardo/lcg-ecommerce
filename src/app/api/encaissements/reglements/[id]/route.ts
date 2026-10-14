import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"
import { formatPrice } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * Décision sur UN règlement en attente : `{ action: "validate" }` ou `{ action: "reject", reason }`.
 * Réservé à l'administrateur et à la caisse. Un règlement refusé ne compte plus dans le solde de la facture.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", ...CASHIER_ROLES])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const user = session?.user
    if (user?.role !== "ADMIN" && !isCashierRole(user?.role)) {
      return NextResponse.json({ error: "Seuls l'administrateur et la caisse peuvent valider un encaissement" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || "")
    if (action !== "validate" && action !== "reject") return NextResponse.json({ error: "Action invalide" }, { status: 400 })
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : ""
    if (action === "reject" && !reason) return NextResponse.json({ error: "Le motif du refus est obligatoire" }, { status: 400 })

    // décision posée seulement si le règlement est encore en attente : deux clics simultanés n'en font qu'une
    const { count } = await getPrisma().customerPayment.updateMany({
      where: { id, validationStatus: "PENDING" },
      data:
        action === "validate"
          ? { validationStatus: "VALIDATED", validatedById: user?.id ?? null, validatedAt: new Date() }
          : { validationStatus: "REJECTED", validatedById: user?.id ?? null, validatedAt: new Date(), rejectReason: reason },
    })
    const payment = await getPrisma().customerPayment.findUnique({
      where: { id },
      select: { amount: true, validationStatus: true, b2bDocumentId: true, b2bDocument: { select: { reference: true } } },
    })
    if (!payment) return NextResponse.json({ error: "Règlement introuvable" }, { status: 404 })
    if (count === 0) return NextResponse.json({ error: "Ce règlement a déjà été traité" }, { status: 409 })

    await logActivity({
      module: "encaissements",
      action: action === "validate" ? "Validation" : "Refus",
      entity: "customerPayment",
      entityId: id,
      summary: `Règlement de ${formatPrice(payment.amount)} sur ${payment.b2bDocument?.reference ?? "une facture"} ${action === "validate" ? "validé" : `refusé : ${reason}`}`,
    })
    return NextResponse.json({ id, validationStatus: payment.validationStatus })
  } catch (error) {
    console.error("PATCH encaissements/reglements error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
