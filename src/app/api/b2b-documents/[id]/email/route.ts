import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { clientDisplayName, DEFAULT_PAYMENT_TERMS_DAYS, INVOICE_CREDITS, invoiceSituation } from "@/lib/commercial"
import { documentCompany, getSettings } from "@/lib/settings"
import { buildDocumentMail } from "@/lib/b2b-document-mail"
import { documentMailMessage, documentMailSubjectFor } from "@/lib/b2b-document-mail-text"
import { sendPreparedEmail } from "@/lib/mailer"

export const dynamic = "force-dynamic"

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

/**
 * Envoie le document au client par e-mail : `{ to?, message? }` (adresse du client par défaut).
 * Un brouillon envoyé passe à « envoyé », comme avec le bouton « Envoyé au client ».
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const session = await auth()
    const user = session?.user as { id?: string; role?: string; supervisesB2b?: boolean } | undefined
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const prisma = getPrisma()
    const doc = await prisma.b2bDocument.findUnique({
      where: { id },
      include: {
        client: true,
        parent: { select: { reference: true } },
        items: { include: { productVariant: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } },
        payments: { select: { amount: true, validationStatus: true } },
        children: INVOICE_CREDITS,
      },
    })
    // même portée que la fiche du document : un commercial n'envoie que les documents de ses clients
    if (!doc || (user?.role !== "ADMIN" && user?.supervisesB2b !== true && doc.client?.commercialId !== user?.id)) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
    }
    if (doc.status === "CANCELLED" || doc.status === "REJECTED") return NextResponse.json({ error: "Un document annulé ou refusé ne s'envoie pas" }, { status: 400 })

    const to = (typeof body.to === "string" && body.to.trim() ? body.to.trim() : doc.client?.email ?? "").slice(0, 160)
    if (!to) return NextResponse.json({ error: "Le client n'a pas d'adresse e-mail : saisissez-en une" }, { status: 400 })
    if (!EMAIL.test(to)) return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 })
    const message = typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1000) : null

    const settings = await getSettings()
    let invoice = null
    if (doc.type === "FACTURE") {
      const contract = doc.clientId
        ? await prisma.b2bContract.findFirst({ where: { clientId: doc.clientId, status: "ACTIVE" }, orderBy: { startsAt: "desc" }, select: { paymentTermsDays: true } })
        : null
      const days = Math.max(0, contract?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS)
      const situation = invoiceSituation(doc.total, doc.payments, doc.children)
      invoice = { dueDate: new Date((doc.invoicedAt ?? doc.createdAt).getTime() + days * 24 * 60 * 60 * 1000), credited: situation.credited, paid: situation.paid, balance: situation.balance }
    }

    const company = documentCompany(settings.general)
    // texte propre au type de document : celui saisi à l'écran, à défaut le texte type
    const textInput = {
      type: doc.type,
      reference: doc.reference,
      total: doc.total,
      companyName: company.name,
      validUntil: doc.type === "DEVIS" ? doc.validUntil : null,
      requestedDeliveryDate: doc.requestedDeliveryDate,
      dueDate: invoice?.dueDate ?? null,
      balance: invoice?.balance ?? null,
      parentReference: doc.parent?.reference ?? null,
    }
    const mail = {
      type: doc.type,
      reference: doc.reference,
      issuedAt: doc.invoicedAt ?? doc.createdAt,
      clientName: clientDisplayName(doc.client),
      company,
      items: doc.items.map((i) => ({
        label: i.productVariant ? `${i.productVariant.product.name} — ${i.productVariant.format}` : "Article retiré du catalogue",
        quantity: i.quantity,
        unit: i.productVariant?.unit ?? null,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      subtotal: doc.subtotal,
      discount: doc.discount,
      total: doc.total,
      notes: doc.notes,
      validUntil: doc.type === "DEVIS" ? doc.validUntil : null,
      invoice,
      parentReference: doc.parent?.reference ?? null,
      bank: settings.bank,
      message: message ?? documentMailMessage(textInput),
    }

    try {
      await sendPreparedEmail({ to, subject: documentMailSubjectFor(textInput), html: buildDocumentMail(mail), fromName: company.name })
    } catch (error) {
      console.error("envoi document B2B par e-mail :", error)
      return NextResponse.json({ error: "L'e-mail n'a pas pu partir (messagerie indisponible). Rien n'a été modifié." }, { status: 502 })
    }

    const markSent = doc.status === "DRAFT"
    await prisma.b2bDocument.update({ where: { id }, data: { emailedAt: new Date(), emailedTo: to, ...(markSent ? { status: "SENT" } : {}) } })
    await logActivity({ module: "b2b", action: "Envoi par e-mail", entity: "B2bDocument", entityId: id, summary: `${doc.reference} envoyé par e-mail à ${to}` })
    return NextResponse.json({ sent: true, to, status: markSent ? "SENT" : doc.status })
  } catch (error) {
    console.error("POST b2b-document email error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
