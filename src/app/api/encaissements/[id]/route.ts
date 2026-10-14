import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"
import { DEFAULT_PAYMENT_TERMS_DAYS, INVOICE_CREDITS, invoiceSituation, seesAllB2b, type SessionUser } from "@/lib/commercial"
import { RECEIPT_METHODS, type ReceiptMethod } from "@/lib/payment-methods"

export const dynamic = "force-dynamic"

// Règlement et relance d'une facture B2B (portage de endpoints/encaissements.php de lcgapp3,
// partie « documents »). `id` est l'identifiant de la facture.

const ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE", ...CASHIER_ROLES]
const CHANNELS = ["WHATSAPP", "SMS", "PHONE"]

/** La facture, si elle est dans la portée de l'utilisateur ; sinon null (un commercial ne touche que ses clients). */
async function invoiceInScope(id: string, user: SessionUser) {
  const doc = await getPrisma().b2bDocument.findUnique({
    where: { id },
    select: {
      id: true, reference: true, type: true, status: true, total: true, createdAt: true,
      client: { select: { commercialId: true, b2bContracts: { where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" }, take: 1, select: { paymentTermsDays: true } } } },
      payments: { select: { amount: true, validationStatus: true } },
      children: INVOICE_CREDITS,
    },
  })
  if (!doc) return null
  if (!seesAllB2b(user) && !isCashierRole(user?.role) && doc.client?.commercialId !== user?.id) return null
  return doc
}

/** Enregistre un règlement, total ou partiel, sur une facture émise. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const user = session?.user as SessionUser
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
    const method = String(body.method || "CASH_ON_DELIVERY").toUpperCase()
    if (!(RECEIPT_METHODS as readonly string[]).includes(method)) return NextResponse.json({ error: "Moyen de règlement invalide" }, { status: 400 })

    const doc = await invoiceInScope(id, user)
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    if (doc.type !== "FACTURE" || doc.status !== "INVOICED") {
      return NextResponse.json({ error: "Ce document ne peut pas être encaissé" }, { status: 400 })
    }

    // solde encaissable : total − avoirs − règlements validés − règlements en attente
    const situation = invoiceSituation(doc.total, doc.payments, doc.children)
    if (amount > situation.open + 0.01) return NextResponse.json({ error: "Montant supérieur au solde" }, { status: 400 })

    // L'administrateur et la caisse encaissent directement ; le règlement saisi par un commercial attend leur validation.
    const direct = user?.role === "ADMIN" || isCashierRole(user?.role)
    const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
    const notes = clean(body.notes, 500)
    const reference = clean(body.reference, 120)
    const now = new Date()
    const payment = await getPrisma().customerPayment.create({
      data: {
        b2bDocumentId: id,
        amount,
        method: method as ReceiptMethod,
        reference,
        notes,
        receivedById: user?.id ?? null,
        validationStatus: direct ? "VALIDATED" : "PENDING",
        validatedById: direct ? user?.id ?? null : null,
        validatedAt: direct ? now : null,
      },
    })
    await logActivity({
      module: "encaissements",
      action: "Règlement",
      entity: "b2bDocument",
      entityId: id,
      summary: `Règlement de ${amount} sur la facture ${doc.reference}${reference ? ` (réf. ${reference})` : ""}${direct ? "" : " (à valider)"}`,
    })

    return NextResponse.json(
      { id: payment.id, balance: Math.round((situation.open - amount) * 100) / 100, validationStatus: payment.validationStatus },
      { status: 201 },
    )
  } catch (error) {
    console.error("POST encaissements error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

/** Relance du client (`action: "reminder"`) ou validation des règlements en attente (`action: "validate"`). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const user = session?.user as SessionUser
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || "")
    if (action !== "reminder" && action !== "validate") return NextResponse.json({ error: "Action invalide" }, { status: 400 })

    const doc = await invoiceInScope(id, user)
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })

    if (action === "reminder") {
      const channel = CHANNELS.includes(String(body.channel || "").toUpperCase()) ? String(body.channel).toUpperCase() : "WHATSAPP"
      const days = Math.max(0, doc.client?.b2bContracts[0]?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS)
      const overdue = doc.createdAt.getTime() + days * 24 * 60 * 60 * 1000 < Date.now()
      const reminder = await getPrisma().paymentReminder.create({
        data: {
          b2bDocumentId: id,
          type: overdue ? "OVERDUE" : "PAYMENT_DUE",
          channel,
          sentAt: new Date(),
          notes: typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 500) : null,
          createdById: user?.id ?? null,
        },
      })
      await logActivity({ module: "encaissements", action: "Relance", entity: "b2bDocument", entityId: id, summary: `Relance de la facture ${doc.reference}` })
      return NextResponse.json({ id: reminder.id }, { status: 201 })
    }

    if (user?.role !== "ADMIN" && !isCashierRole(user?.role)) {
      return NextResponse.json({ error: "Seuls l'administrateur et la caisse peuvent valider un encaissement" }, { status: 403 })
    }
    const { count } = await getPrisma().customerPayment.updateMany({
      where: { b2bDocumentId: id, validationStatus: "PENDING" },
      data: { validationStatus: "VALIDATED", validatedById: user?.id ?? null, validatedAt: new Date() },
    })
    if (count === 0) {
      const already = doc.payments.some((p) => p.validationStatus === "VALIDATED")
      return NextResponse.json({ error: already ? "Encaissement déjà validé" : "Aucun encaissement en attente" }, { status: already ? 409 : 404 })
    }
    await logActivity({ module: "encaissements", action: "Validation", entity: "b2bDocument", entityId: id, summary: `Règlements de la facture ${doc.reference} validés` })
    return NextResponse.json({ validated: count })
  } catch (error) {
    console.error("PUT encaissements error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
