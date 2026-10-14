import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { nextDocumentReference } from "@/lib/b2b"
import { INVOICE_CREDITS, invoiceSituation } from "@/lib/commercial"
import { formatPrice } from "@/lib/utils"

export const dynamic = "force-dynamic"

class CreditRuleError extends Error {}

function isP2002(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
}

/**
 * Avoir sur une facture émise : `{ amount, reason }`. Annule tout ou partie de ce qui reste dû.
 * La part déjà réglée (ou en attente de validation) ne peut pas être annulée ainsi : c'est un remboursement,
 * à traiter à part. Le stock n'est pas modifié (un retour de marchandise se saisit dans Stock).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMPTABLE"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const amount = Math.round(Number(body.amount) * 100) / 100
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : ""
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
    if (!reason) return NextResponse.json({ error: "Le motif de l'avoir est obligatoire" }, { status: 400 })

    const prisma = getPrisma()
    const created = await prisma.$transaction(async (tx) => {
      // facture verrouillée le temps du calcul : deux avoirs simultanés ne peuvent pas dépasser le dû
      await tx.$queryRaw`SELECT id FROM "B2bDocument" WHERE id = ${id} FOR UPDATE`
      const invoice = await tx.b2bDocument.findUnique({
        where: { id },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          payments: { select: { amount: true, validationStatus: true } },
          children: INVOICE_CREDITS,
        },
      })
      if (!invoice) throw new CreditRuleError("Facture introuvable")
      if (invoice.type !== "FACTURE" || invoice.status !== "INVOICED") throw new CreditRuleError("Un avoir ne s'établit que sur une facture émise")

      const situation = invoiceSituation(invoice.total, invoice.payments, invoice.children)
      if (amount > situation.open + 0.01) {
        throw new CreditRuleError(
          situation.open <= 0.005
            ? "Plus rien à annuler sur cette facture : elle est réglée ou déjà couverte par des avoirs"
            : `Au plus ${formatPrice(situation.open)} : la part réglée ou en attente de validation ne s'annule pas par un avoir`,
        )
      }

      const reference = await nextDocumentReference(tx, "AV")
      // avoir total sur une facture sans aucun règlement ni avoir : il reprend les lignes de la facture
      const full = situation.credited === 0 && situation.paid === 0 && situation.pending === 0 && Math.abs(amount - invoice.total) <= 0.01
      return tx.b2bDocument.create({
        data: {
          type: "AVOIR",
          reference,
          status: "INVOICED",
          clientId: invoice.clientId,
          parentId: invoice.id,
          subtotal: full ? invoice.subtotal : amount,
          discount: full ? invoice.discount : 0,
          total: amount,
          notes: reason,
          invoicedAt: new Date(),
          createdById: session?.user?.id ?? null,
          ...(full
            ? { items: { create: invoice.items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })) } }
            : {}),
        },
        select: { id: true, reference: true, total: true, parent: { select: { reference: true } } },
      })
    })

    // hors transaction : le journal ouvre sa propre connexion
    await logActivity({
      module: "b2b",
      action: "Avoir",
      entity: "B2bDocument",
      entityId: created.id,
      summary: `Avoir ${created.reference} de ${formatPrice(created.total)} sur la facture ${created.parent?.reference ?? ""} : ${reason}`,
    })
    return NextResponse.json({ document: created }, { status: 201 })
  } catch (error) {
    if (error instanceof CreditRuleError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Facture introuvable" ? 404 : 400 })
    }
    if (isP2002(error)) return NextResponse.json({ error: "Référence en collision, réessayez" }, { status: 409 })
    console.error("POST avoir error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
