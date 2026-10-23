import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"
import { DEFAULT_PAYMENT_TERMS_DAYS, INVOICE_CREDITS, invoiceSituation, seesAllB2b, type SessionUser } from "@/lib/commercial"
import { PROOF_MAX_BYTES, PROOF_REQUIRED, PROOF_TYPES, RECEIPT_METHODS, REFERENCE_REQUIRED, type ReceiptMethod } from "@/lib/payment-methods"

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
      promises: { select: { amount: true, status: true } },
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
    // formulaire avec justificatif (multipart) ou simple JSON
    let body: Record<string, unknown> = {}
    const proofFiles: File[] = []
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData()
      for (const [key, value] of form.entries()) {
        if (key === "proof" && typeof value !== "string") proofFiles.push(value)
        else if (typeof value === "string") body[key] = value
      }
    } else {
      body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    }

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
    const method = String(body.method || "CASH_ON_DELIVERY").toUpperCase()
    if (!(RECEIPT_METHODS as readonly string[]).includes(method)) return NextResponse.json({ error: "Moyen de règlement invalide" }, { status: 400 })

    // Virement et chèque : référence et justificatif obligatoires (banque émettrice pour un chèque).
    const files = proofFiles.filter((f) => f.size > 0).slice(0, 3)
    if (PROOF_REQUIRED.includes(method)) {
      const what = method === "CHEQUE" ? "le scan du chèque" : "la preuve du virement"
      if (files.length === 0) return NextResponse.json({ error: `Joignez ${what} (photo ou PDF)` }, { status: 400 })
    }
    for (const f of files) {
      if (!PROOF_TYPES.includes(f.type)) return NextResponse.json({ error: "Justificatif : photo (JPEG, PNG, WebP) ou PDF uniquement" }, { status: 400 })
      if (f.size > PROOF_MAX_BYTES) return NextResponse.json({ error: "Justificatif trop lourd (4 Mo au plus)" }, { status: 400 })
    }
    if (REFERENCE_REQUIRED.includes(method) && !(typeof body.reference === "string" && body.reference.trim())) {
      return NextResponse.json({ error: method === "CHEQUE" ? "Indiquez le n° du chèque" : "Indiquez le n° ou la référence du virement" }, { status: 400 })
    }
    if (method === "CHEQUE" && !(typeof body.bank === "string" && body.bank.trim())) {
      return NextResponse.json({ error: "Indiquez la banque émettrice du chèque" }, { status: 400 })
    }

    const doc = await invoiceInScope(id, user)
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    if (doc.type !== "FACTURE" || doc.status !== "INVOICED") {
      return NextResponse.json({ error: "Ce document ne peut pas être encaissé" }, { status: 400 })
    }

    // solde encaissable : total − avoirs − règlements validés − règlements en attente
    const situation = invoiceSituation(doc.total, doc.payments, doc.children)
    if (amount > situation.open + 0.01) return NextResponse.json({ error: "Montant supérieur au solde" }, { status: 400 })

    // Tout règlement encaissé (espèces, Mobile Money, carte) crédite immédiatement la facture, quel que soit le compte.
    // Virement et chèque attendent la validation : l'argent n'est acquis qu'une fois le virement reçu ou le chèque encaissé.
    const direct = !PROOF_REQUIRED.includes(method)
    const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
    const notes = clean(body.notes, 500)
    const reference = clean(body.reference, 120)
    const bank = method === "CHEQUE" ? clean(body.bank, 120) : null
    const proofs = await Promise.all(files.map(async (f) => ({
      fileName: f.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "justificatif",
      mimeType: f.type,
      size: f.size,
      data: new Uint8Array(await f.arrayBuffer()),
      uploadedById: user?.id ?? null,
    })))
    const now = new Date()
    const payment = await getPrisma().customerPayment.create({
      data: {
        b2bDocumentId: id,
        amount,
        method: method as ReceiptMethod,
        reference,
        bank,
        notes,
        receivedById: user?.id ?? null,
        validationStatus: direct ? "VALIDATED" : "PENDING",
        validatedById: direct ? user?.id ?? null : null,
        validatedAt: direct ? now : null,
        ...(proofs.length > 0 ? { proofs: { create: proofs } } : {}),
      },
    })
    await logActivity({
      module: "encaissements",
      action: "Règlement",
      entity: "b2bDocument",
      entityId: id,
      summary: `Règlement de ${amount} sur la facture ${doc.reference}${reference ? ` (réf. ${reference})` : ""}${proofs.length ? `, ${proofs.length} justificatif(s)` : ""}${direct ? "" : " (à valider)"}`,
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

/** Relance du client (`action: "reminder"`), promesse de paiement (`action: "promise"`) ou validation des règlements en attente (`action: "validate"`). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const user = session?.user as SessionUser
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || "")
    if (action !== "reminder" && action !== "validate" && action !== "promise") return NextResponse.json({ error: "Action invalide" }, { status: 400 })

    const doc = await invoiceInScope(id, user)
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })

    if (action === "promise") {
      if (doc.type !== "FACTURE" || doc.status !== "INVOICED") {
        return NextResponse.json({ error: "Seule une facture émise accepte une promesse de paiement" }, { status: 400 })
      }
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
      const dueDate = new Date(typeof body.dueDate === "string" ? body.dueDate : "")
      if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "Date d'échéance invalide" }, { status: 400 })
      const situation = invoiceSituation(doc.total, doc.payments, doc.children)
      const promised = doc.promises.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0)
      const available = Math.round((situation.open - promised) * 100) / 100
      if (amount > available + 0.01) {
        return NextResponse.json({ error: `Le montant dépasse le reste à recouvrer (${available.toFixed(0)} FCFA)` }, { status: 400 })
      }
      const promise = await getPrisma().paymentPromise.create({
        data: {
          b2bDocumentId: id,
          amount: Math.round(amount * 100) / 100,
          dueDate,
          status: "PENDING",
          notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null,
          createdById: user?.id ?? null,
        },
      })
      await logActivity({ module: "encaissements", action: "Promesse", entity: "b2bDocument", entityId: id, summary: `Promesse de paiement sur la facture ${doc.reference}` })
      return NextResponse.json({ id: promise.id }, { status: 201 })
    }

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
