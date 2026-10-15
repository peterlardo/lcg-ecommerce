import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { nextDocumentReference } from "@/lib/b2b"
import { auth } from "@/lib/auth"
import { COMPTOIR_CODE, consumePointOfSaleStockTx, ensureOperationalStockLocations } from "@/lib/stock-service"
import { DEFAULT_PAYMENT_TERMS_DAYS, invoiceSituation } from "@/lib/commercial"
import { formatPrice } from "@/lib/utils"
import { documentCompany, getSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

const ALLOWED = ["ADMIN", "COMMERCIAL"]

const REF_PREFIX: Record<string, string> = {
  COMMANDE: "BC",
  LIVRAISON: "BL",
  FACTURE: "FAC",
}

function isP2002(error: unknown): error is { code: string } {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
}

async function getDocOrNull(id: string, userId: string, role: string, supervisesB2b: boolean) {
  const doc = await getPrisma().b2bDocument.findUnique({
    where: { id },
    include: {
      items: { include: { productVariant: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } },
      client: true,
      parent: { select: { id: true, reference: true, type: true, deliveredAt: true, createdAt: true } },
      children: { where: { status: { not: "CANCELLED" } }, select: { id: true, reference: true, type: true, total: true, createdAt: true, notes: true } },
    },
  })
  if (!doc) return { doc: null, status: 404 as const }
  if (role !== "ADMIN" && !supervisesB2b && doc.client?.commercialId !== userId) {
    return { doc: null, status: 403 as const }
  }
  return { doc, status: 200 as const }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const { doc, status } = await getDocOrNull(
    id,
    session.user.id,
    session.user.role,
    (session.user as { supervisesB2b?: boolean }).supervisesB2b === true
  )
  if (!doc) return NextResponse.json({ error: status === 404 ? "Introuvable" : "Non autorisé" }, { status })

  // Facture : échéance (délai du contrat actif du client, 30 jours à défaut — même règle que les créances)
  // et état du paiement (seuls les règlements validés comptent comme payés ; les avoirs réduisent le dû).
  const [contract, payments, settings] = await Promise.all([
    doc.type === "FACTURE" && doc.clientId
      ? getPrisma().b2bContract.findFirst({ where: { clientId: doc.clientId, status: "ACTIVE" }, orderBy: { startsAt: "desc" }, select: { paymentTermsDays: true } })
      : null,
    doc.type === "FACTURE"
      ? getPrisma().customerPayment.findMany({
          where: { b2bDocumentId: doc.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, amount: true, method: true, reference: true, validationStatus: true, rejectReason: true, notes: true, receivedById: true, createdAt: true },
        })
      : [],
    getSettings(),
  ])

  // qui a établi le document, le commercial attitré du client, et qui a saisi chaque règlement
  const people = await getPrisma().user.findMany({
    where: { id: { in: [doc.createdById, doc.client?.commercialId, ...payments.map((p) => p.receivedById)].filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true },
  })
  const nameOf = (userId: string | null | undefined) => people.find((p) => p.id === userId)?.name ?? null

  let invoice = null
  if (doc.type === "FACTURE") {
    const termsDays = Math.max(0, contract?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS)
    const issuedAt = doc.invoicedAt ?? doc.createdAt
    const dueDate = new Date(issuedAt.getTime() + termsDays * 24 * 60 * 60 * 1000)
    const credits = doc.children.filter((c) => c.type === "AVOIR")
    const situation = invoiceSituation(doc.total, payments, credits)
    const { balance, paid } = situation
    invoice = {
      termsDays,
      fromContract: Boolean(contract),
      dueDate: dueDate.toISOString(),
      credited: situation.credited,
      paid,
      pending: situation.pending,
      balance,
      /** ce qu'un avoir peut encore annuler : ni la part réglée, ni celle en attente de validation */
      creditable: situation.open,
      paymentStatus:
        doc.status === "CANCELLED" || (situation.credited > 0 && situation.due <= 0.005)
          ? "CANCELLED"
          : balance <= 0.005 ? "PAID" : paid > 0 || situation.credited > 0 ? "PARTIAL" : "UNPAID",
      overdue: balance > 0.005 && dueDate < new Date(),
      credits: credits.map((c) => ({ id: c.id, reference: c.reference, total: c.total, reason: c.notes, createdAt: c.createdAt.toISOString() })),
      payments: payments.map(({ receivedById, ...p }) => ({ ...p, receivedBy: nameOf(receivedById), createdAt: p.createdAt.toISOString() })),
    }
  }

  const role = session.user.role
  return NextResponse.json({
    document: doc,
    invoice,
    createdByName: nameOf(doc.createdById),
    commercialName: nameOf(doc.client?.commercialId),
    // en-tête, pied et coordonnées de règlement : ceux de l'écran Paramètres
    company: documentCompany(settings.general),
    bank: doc.type === "FACTURE" ? settings.bank : null,
    // un avoir est une écriture comptable : administrateur seulement à l'écran (le comptable passe par l'API)
    canCredit: role === "ADMIN" && doc.type === "FACTURE" && doc.status === "INVOICED",
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  const session = await auth()
  const selfId = session?.user?.id
  const role = session?.user?.role
  if (!selfId || !role) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const { doc, status } = await getDocOrNull(
    id,
    selfId,
    role,
    (session?.user as { supervisesB2b?: boolean }).supervisesB2b === true
  )
  if (!doc) return NextResponse.json({ error: status === 404 ? "Introuvable" : "Non autorisé" }, { status })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  const prisma = getPrisma()

  // Mise à jour des lignes (brouillons uniquement) : { items?, discount?, notes? }
  if (!body.action) {
    try {
      if (doc.status !== "DRAFT") {
        return NextResponse.json({ error: "Seuls les brouillons sont modifiables" }, { status: 400 })
      }
      const items = Array.isArray(body.items) ? body.items : null
      if (items && items.length === 0) {
        return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 })
      }
      let newItems: { productVariantId: string; quantity: number; unitPrice: number }[] | null = null
      if (items) {
        const mapped = items.map((i) => {
          const item = i as { productVariantId?: unknown; quantity?: unknown; unitPrice?: unknown }
          const productVariantId = String(item.productVariantId ?? "")
          if (!productVariantId) return { error: "Article sans produit" }
          const quantity = Number(item.quantity ?? 1)
          // Garde stricte >= 1 : évite qu'une quantité 0 < q < 1 (ex. 0.5) passe
          // puis soit arrondie à 0 par Math.floor → ligne à quantité 0.
          if (!Number.isFinite(quantity) || quantity < 1) return { error: "Quantité invalide" }
          const unitPrice = Number(item.unitPrice ?? 0)
          if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Prix unitaire invalide" }
          return { productVariantId, quantity: Math.floor(quantity), unitPrice }
        })
        const bad = mapped.find((m) => "error" in m)
        if (bad) return NextResponse.json({ error: bad.error }, { status: 400 })
        newItems = mapped as { productVariantId: string; quantity: number; unitPrice: number }[]
      }
      const discount = body.discount !== undefined ? Math.max(0, Number(body.discount) || 0) : doc.discount
      const notes = body.notes !== undefined ? String(body.notes).slice(0, 2000) : doc.notes
      // mêmes champs que le formulaire de création : validité du devis, livraison souhaitée
      const extra: { validUntil?: Date | null; deliveryTerms?: string | null; requestedDeliveryDate?: Date | null } = {}
      if (body.validUntil !== undefined && doc.type === "DEVIS") {
        const d = body.validUntil ? new Date(String(body.validUntil)) : null
        if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: "Date de validité invalide" }, { status: 400 })
        extra.validUntil = d
      }
      if (body.deliveryTerms !== undefined) extra.deliveryTerms = String(body.deliveryTerms ?? "").trim().slice(0, 500) || null
      if (body.requestedDeliveryDate !== undefined) {
        const d = body.requestedDeliveryDate ? new Date(String(body.requestedDeliveryDate)) : null
        if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: "Date de livraison invalide" }, { status: 400 })
        const day = (x: Date) => new Date(x.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
        if (d && day(d) < day(new Date())) return NextResponse.json({ error: "La date de livraison souhaitée est déjà passée" }, { status: 400 })
        extra.requestedDeliveryDate = d
      }

      const newSubtotal = newItems ? newItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) : doc.subtotal
      if (discount > newSubtotal) return NextResponse.json({ error: "La remise ne peut pas dépasser le total" }, { status: 400 })

      const updated = await prisma.$transaction(async (tx) => {
        if (newItems) await tx.b2bDocumentItem.deleteMany({ where: { documentId: id } })

        await tx.b2bDocument.update({
          where: { id },
          data: {
            // remise toujours enregistrée avec le total qu'elle produit (avant : perdue quand les lignes changeaient)
            subtotal: newSubtotal,
            discount,
            total: Math.max(0, newSubtotal - discount),
            ...(newItems
              ? { items: { create: newItems.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity })) } }
              : {}),
            ...(notes !== doc.notes ? { notes } : {}),
            ...extra,
          },
        })
        return tx.b2bDocument.findUnique({
          where: { id },
          include: { client: true, items: { include: { productVariant: true } } },
        })
      })
      await logActivity({ module: "b2b", action: "update", entity: "B2bDocument", entityId: id, summary: `Modification ${doc.reference}` })
      return NextResponse.json({ document: updated })
    } catch (error) {
      console.error("update b2b-document error:", error)
      return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
    }
  }

  const action = String(body.action)

  // Rejet/annulation réservés aux documents non engagés (brouillon ou envoyé).
  const REJECTABLE = ["DRAFT", "SENT"]

  if (action === "cancel") {
    if (!REJECTABLE.includes(doc.status)) {
      return NextResponse.json({ error: "Ce document ne peut pas être annulé" }, { status: 400 })
    }
    if (!body.cancelReason) {
      return NextResponse.json({ error: "Le motif d'annulation est obligatoire" }, { status: 400 })
    }
    const updated = await prisma.b2bDocument.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: selfId, cancelReason: String(body.cancelReason) },
    })
    await logActivity({ module: "b2b", action: "cancel", entity: "B2bDocument", entityId: id, summary: `Annulation ${updated.reference}` })
    return NextResponse.json({ document: updated })
  }

  // Brouillon remis au client : le document passe à « envoyé » et n'est plus modifiable.
  if (action === "send") {
    if (doc.status !== "DRAFT") {
      return NextResponse.json({ error: "Seul un brouillon peut être envoyé" }, { status: 400 })
    }
    const updated = await prisma.b2bDocument.update({ where: { id }, data: { status: "SENT" } })
    await logActivity({ module: "b2b", action: "send", entity: "B2bDocument", entityId: id, summary: `Envoi ${updated.reference}` })
    return NextResponse.json({ document: updated })
  }

  if (action === "reject") {
    if (!REJECTABLE.includes(doc.status)) {
      return NextResponse.json({ error: "Ce document ne peut pas être rejeté" }, { status: 400 })
    }
    const updated = await prisma.b2bDocument.update({
      where: { id },
      data: { status: "REJECTED" },
    })
    await logActivity({ module: "b2b", action: "reject", entity: "B2bDocument", entityId: id, summary: `Rejet ${updated.reference}` })
    return NextResponse.json({ document: updated })
  }

  if (action === "confirm") {
    if (doc.status === "CANCELLED" || doc.status === "REJECTED" || doc.status === "INVOICED") {
      return NextResponse.json({ error: "Ce document ne peut pas être confirmé" }, { status: 400 })
    }
    const updated = await prisma.b2bDocument.update({
      where: { id },
      data: { status: "CONFIRMED", receivedAt: new Date() },
    })
    await logActivity({ module: "b2b", action: "confirm", entity: "B2bDocument", entityId: id, summary: `Confirmation ${updated.reference}` })
    return NextResponse.json({ document: updated })
  }

  if (action === "transform") {
    // La cible se dérive TOUJOURS du type du document : le client ne choisit
    // jamais la cible (un body.target éventuel est ignoré).
    // Chaîne de vente : devis → bon de commande → facture → bon de livraison (facture entièrement payée).
    // Un bon de livraison de l'ancienne chaîne (établi depuis une commande) se facture encore.
    const legacyDelivery = doc.type === "LIVRAISON" && doc.parent?.type === "COMMANDE"
    const toType = ({ DEVIS: "COMMANDE", COMMANDE: "FACTURE", FACTURE: "LIVRAISON" } as Record<string, string>)[doc.type] ?? (legacyDelivery ? "FACTURE" : undefined)
    if (!toType) return NextResponse.json({ error: "Ce document est le dernier de la chaîne" }, { status: 400 })
    // Un document déjà transformé (document suivant non annulé) ne peut pas l'être une seconde fois :
    // pas de double sortie de stock ni de double facture. Les avoirs d'une facture ne comptent pas.
    const alreadyTransformed = await prisma.b2bDocument.count({
      where: { parentId: doc.id, type: toType as "COMMANDE" | "FACTURE" | "LIVRAISON", status: { not: "CANCELLED" } },
    })
    if (alreadyTransformed > 0) {
      const already = { COMMANDE: "son bon de commande", FACTURE: "sa facture", LIVRAISON: "son bon de livraison" }[toType] ?? "son document suivant"
      return NextResponse.json({ error: `${doc.reference} a déjà ${already}` }, { status: 400 })
    }
    if (doc.type === "FACTURE") {
      if (doc.status !== "INVOICED") return NextResponse.json({ error: "Cette facture n'est pas émise" }, { status: 400 })
      // le bon de livraison suit le paiement complet de la facture (règlements validés, avoirs déduits)
      const payments = await prisma.customerPayment.findMany({ where: { b2bDocumentId: doc.id }, select: { amount: true, validationStatus: true } })
      const situation = invoiceSituation(doc.total, payments, doc.children.filter((c) => c.type === "AVOIR"))
      if (situation.due <= 0.005) return NextResponse.json({ error: "Facture annulée par avoir : rien à livrer" }, { status: 400 })
      if (situation.balance > 0.005) {
        return NextResponse.json({ error: `Le bon de livraison s'établit une fois la facture payée : il reste ${formatPrice(situation.balance)} à encaisser${situation.pending > 0 ? " (ou à valider)" : ""}` }, { status: 400 })
      }
    } else if (doc.status !== "CONFIRMED" && doc.status !== "DRAFT" && doc.status !== "SENT") {
      // un document envoyé au client se transforme aussi (même règle que le formulaire de bon de commande)
      return NextResponse.json({ error: "Le document doit être en brouillon, envoyé ou confirmé pour être transformé" }, { status: 400 })
    }
    if (doc.items.some((i) => !i.productVariantId)) {
      return NextResponse.json({ error: "Un article est sans produit" }, { status: 400 })
    }

    try {
      const stockLocations = await ensureOperationalStockLocations()
      const pointOfSaleId = stockLocations.find((l) => l.code === COMPTOIR_CODE)?.id

      const created = await prisma.$transaction(async (tx) => {
        const reference = await nextDocumentReference(tx, REF_PREFIX[toType] as "BC" | "BL" | "FAC")
        // Le bon de LIVRAISON débite le stock physique du Comptoir (même helper que la
        // vente) : la marchandise part. Stock insuffisant → exception → rollback → 400.
        if (toType === "LIVRAISON") {
          if (!pointOfSaleId) throw new Error("Moyen de stockage requis")
          for (const item of doc.items) {
            await consumePointOfSaleStockTx(tx, {
              variantId: item.productVariantId!,
              pointOfSaleId,
              quantity: item.quantity,
              type: "SALE",
              reason: `Livraison B2B ${doc.reference}`,
              reference,
              userId: selfId,
            })
          }
        }

        const created = await tx.b2bDocument.create({
          data: {
            type: toType as "COMMANDE" | "LIVRAISON" | "FACTURE",
            reference,
            clientId: doc.clientId,
            parentId: doc.id,
            status: toType === "FACTURE" ? "INVOICED" : "DRAFT",
            subtotal: doc.subtotal,
            discount: doc.discount,
            total: doc.total,
            notes: doc.notes,
            deliveryTerms: doc.deliveryTerms,
            requestedDeliveryDate: doc.requestedDeliveryDate,
            createdById: selfId,
            ...(toType === "LIVRAISON" ? { deliveredAt: new Date() } : {}),
            ...(toType === "FACTURE" ? { invoicedAt: new Date() } : {}),
            items: {
              create: doc.items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
            },
          },
          include: { client: true, items: { include: { productVariant: true } } },
        })

        // Document d'origine : devis accepté (CONFIRMED), commande facturée (INVOICED), ancien bon de
        // livraison facturé (DELIVERED). La facture reste émise (INVOICED) : on note seulement sa livraison.
        await tx.b2bDocument.update({
          where: { id },
          data:
            doc.type === "FACTURE" ? { deliveredAt: new Date() }
            : doc.type === "LIVRAISON" ? { status: "DELIVERED" }
            : doc.type === "COMMANDE" ? { status: "INVOICED" }
            : { status: "CONFIRMED" },
        })

        return created
      })

      // Hors transaction : le journal ouvre sa propre connexion, et attendrait indéfiniment
      // celle que la transaction occupe si le serveur n'en a plus de libre.
      await logActivity({
        module: "b2b",
        action: "transform",
        entity: "B2bDocument",
        entityId: created.id,
        summary: `Transformation ${doc.reference} → ${created.reference}`,
      })

      return NextResponse.json({ document: created }, { status: 201 })
    } catch (error) {
      if (isP2002(error)) {
        return NextResponse.json({ error: "Référence en collision, réessayez" }, { status: 409 })
      }
      const message = error instanceof Error ? error.message : ""
      if (message.includes("Stock insuffisant")) {
        // le message du stock nomme le produit et les quantités : on le transmet tel quel
        return NextResponse.json({ error: `${message.slice(0, 300)}. Le bon de livraison n'a pas été créé.` }, { status: 400 })
      }
      if (message === "Moyen de stockage requis") {
        return NextResponse.json({ error: "Stock du comptoir introuvable : le bon de livraison n'a pas été créé" }, { status: 400 })
      }
      console.error("transform b2b-document error:", error)
      return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
}