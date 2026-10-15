import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { applicableContract, LISTED_DOC_TYPES, nextDocumentReference } from "@/lib/b2b"
import { contractDiscount } from "@/lib/b2b-contract"
import { auth } from "@/lib/auth"
import { clientDisplayName, seesAllB2b, type SessionUser } from "@/lib/commercial"

export const dynamic = "force-dynamic"

const ALLOWED = ["ADMIN", "COMMERCIAL"]

const REF_PREFIX: Record<string, string> = {
  DEVIS: "DEV",
  COMMANDE: "BC",
  LIVRAISON: "BL",
  FACTURE: "FAC",
}

/** Documents qui se saisissent ; les autres naissent du document précédent de la chaîne. */
const CREATABLE_TYPES = ["DEVIS", "COMMANDE"]

const DOCUMENT_STATUSES =["DRAFT", "SENT", "CONFIRMED", "REJECTED", "DELIVERED", "INVOICED", "CANCELLED"]

/** Devis qu'on peut encore reprendre dans un bon de commande : ni refusé, ni annulé, ni déjà transformé. */
const OPEN_QUOTE_STATUSES = ["DRAFT", "SENT", "CONFIRMED"] as const

class QuoteAlreadyUsedError extends Error {}

function isP2002(error: unknown): error is { code: string } {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
}

export async function GET(req: Request) {
  // lecture ouverte au comptable (factures, avoirs) ; création et actions restent aux commerciaux et à l'administrateur
  const forbidden = await requireManagementAccess([...ALLOWED, "COMPTABLE"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const selfId = session?.user?.id
    const seesAll = seesAllB2b(session?.user as SessionUser)

    const url = new URL(req.url)
    const type = url.searchParams.get("type")?.toUpperCase() ?? ""
    const status = url.searchParams.get("status")?.toUpperCase() ?? ""
    const q = url.searchParams.get("q")?.trim()
    const page = url.searchParams.get("page") === null ? 1 : Number(url.searchParams.get("page"))
    // « available=1 » : devis encore disponibles pour un bon de commande (liste du formulaire, sans pagination utile)
    const available = url.searchParams.get("available") === "1"
    const perPage = available ? 200 : 20

    if (type && !LISTED_DOC_TYPES.includes(type as (typeof LISTED_DOC_TYPES)[number])) {
      return NextResponse.json({ error: "Type de document invalide" }, { status: 400 })
    }
    if (status && !DOCUMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut de document invalide" }, { status: 400 })
    }
    if (!Number.isFinite(page) || !Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: "Paramètre page invalide" }, { status: 400 })
    }

    const where: Prisma.B2bDocumentWhereInput = {}
    if (type) where.type = type as Prisma.B2bDocumentWhereInput["type"]
    if (status) where.status = status as string as Prisma.B2bDocumentWhereInput["status"]
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { client: { is: { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { tradeName: { contains: q, mode: "insensitive" } }] } } },
      ]
    }
    // administrateur, comptable, responsable commercial : tout ; un commercial : ses clients
    if (!seesAll) {
      where.client = { is: { commercialId: selfId } }
    }
    if (available) {
      where.type = "DEVIS"
      if (!status) where.status = { in: [...OPEN_QUOTE_STATUSES] }
      where.children = { none: { status: { not: "CANCELLED" } } }
    }

    if (available) {
      // liste du formulaire de bon de commande : une seule requête, articles compris, pour que le devis
      // choisi remplisse le formulaire sans nouvel aller-retour vers le serveur
      const quotes = await getPrisma().b2bDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: perPage,
        select: {
          id: true, reference: true, status: true, clientId: true, total: true, discount: true, notes: true, validUntil: true, createdAt: true,
          deliveryTerms: true, requestedDeliveryDate: true,
          client: { select: { companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } },
          items: { select: { productVariantId: true, quantity: true, unitPrice: true }, orderBy: { createdAt: "asc" } },
        },
      })
      return NextResponse.json({ documents: quotes.map(({ client, ...q }) => ({ ...q, clientName: clientDisplayName(client) })), total: quotes.length })
    }

    const [documents, counts, total] = await Promise.all([
      getPrisma().b2bDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: perPage,
        skip: (page - 1) * perPage,
        include: {
          client: { select: { id: true, companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } },
          parent: { select: { id: true, reference: true, type: true } },
          // document suivant de la chaîne (devis -> commande -> livraison -> facture), s'il existe
          children: { where: { status: { not: "CANCELLED" } }, select: { id: true, reference: true, type: true, total: true } },
          _count: { select: { items: true } },
          // factures : règlements validés, pour afficher « payée / reste à payer » dans la liste
          payments: { where: { validationStatus: "VALIDATED" }, select: { amount: true } },
        },
      }),
      // Même portée que la liste : un COMMERCIAL ne voit PAS l'agrégat global.
      getPrisma().b2bDocument.groupBy({ by: ["type"], where, _count: { _all: true } }),
      getPrisma().b2bDocument.count({ where }),
    ])

    return NextResponse.json({
      documents: documents.map(({ payments, ...d }) => ({
        ...d,
        clientName: clientDisplayName(d.client),
        paid: Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100,
        // factures : avoirs émis, déduits du reste à payer
        credited: Math.round(d.children.filter((c) => c.type === "AVOIR").reduce((s, c) => s + c.total, 0) * 100) / 100,
      })),
      counts,
      total,
      page,
      perPage,
      types: LISTED_DOC_TYPES,
    })
  } catch (error) {
    console.error("GET b2b-documents error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const selfId = session?.user?.id
    if (!selfId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
    }

    const docType = String(body.type ?? "").toUpperCase()
    // Chaîne de vente : devis → bon de commande → facture → bon de livraison. Seuls le devis et le bon de
    // commande se saisissent ; la facture naît du bon de commande, le bon de livraison de la facture payée.
    if (!CREATABLE_TYPES.includes(docType)) {
      return NextResponse.json({ error: docType === "FACTURE" || docType === "LIVRAISON" ? "Une facture se crée depuis son bon de commande, un bon de livraison depuis sa facture payée" : "Type de document invalide" }, { status: 400 })
    }
    // le bon de commande naît toujours d'un devis : c'est le devis qui donne le client
    if (docType === "COMMANDE" && !body.parentId) {
      return NextResponse.json({ error: "Un bon de commande se crée à partir d'un devis : choisissez le devis" }, { status: 400 })
    }
    if (body.parentId && docType !== "COMMANDE") return NextResponse.json({ error: "Seul un bon de commande se crée à partir d'un devis" }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 })
    }

    const prisma = getPrisma()
    // bon de commande : le client est celui du devis, quoi que l'écran envoie
    let clientIdWanted = body.clientId ? String(body.clientId) : ""
    if (body.parentId) {
      const source = await prisma.b2bDocument.findUnique({ where: { id: String(body.parentId) }, select: { clientId: true, type: true } })
      if (!source || source.type !== "DEVIS" || !source.clientId) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
      clientIdWanted = source.clientId
    }
    if (!clientIdWanted) return NextResponse.json({ error: "Choisissez un client B2B" }, { status: 400 })
    const client = await prisma.client.findFirst({ where: { id: clientIdWanted, type: "B2B" } })
    if (!client) return NextResponse.json({ error: "Client B2B introuvable" }, { status: 404 })
    if (!seesAllB2b(session?.user as SessionUser) && session?.user?.role !== "ADMIN" && client.commercialId !== selfId) {
      return NextResponse.json({ error: "Ce client B2B ne vous est pas affecté" }, { status: 403 })
    }

    const rawItems = body.items.map((i) => {
      const item = i as { productVariantId?: unknown; quantity?: unknown; unitPrice?: unknown }
      const priced = item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== ""
      return {
        productVariantId: String(item.productVariantId ?? ""),
        quantity: Number(item.quantity),
        // sans prix saisi : tarif du contrat du client, à défaut prix catalogue (voir plus bas)
        unitPrice: priced ? Number(item.unitPrice) : null,
      }
    })
    if (rawItems.some((i) => !i.productVariantId)) {
      return NextResponse.json({ error: "Article sans produit" }, { status: 400 })
    }
    if (rawItems.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
      return NextResponse.json({ error: "Les quantités doivent être des nombres entiers" }, { status: 400 })
    }
    if (rawItems.some((i) => i.unitPrice !== null && (!Number.isFinite(i.unitPrice) || i.unitPrice < 0))) {
      return NextResponse.json({ error: "Prix unitaire invalide" }, { status: 400 })
    }
    const variantIds = [...new Set(rawItems.map((i) => i.productVariantId))]
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, price: true } })
    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 400 })
    }
    // Contrat applicable du client : ses prix négociés et sa remise s'appliquent quand rien n'est saisi.
    const contract = await applicableContract(prisma, client.id)
    const negotiated = new Map((contract?.items ?? []).map((i) => [i.productVariantId, i.unitPrice]))
    const catalogue = new Map(variants.map((v) => [v.id, v.price]))
    const items = rawItems.map((i) => ({
      ...i,
      unitPrice: i.unitPrice ?? negotiated.get(i.productVariantId) ?? catalogue.get(i.productVariantId) ?? 0,
    }))
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    // Remise : celle saisie si le champ est renseigné, sinon celle du contrat (sur les lignes sans prix négocié).
    const autoDiscount = body.discount === undefined || body.discount === null || body.discount === ""
    const discount = autoDiscount
      ? contractDiscount(contract?.discountPercent, items.map((i) => ({ productVariantId: i.productVariantId, lineTotal: i.unitPrice * i.quantity })), new Set(negotiated.keys()))
      : Number(body.discount)
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
      return NextResponse.json({ error: "Remise invalide" }, { status: 400 })
    }
    const notes = body.notes ? String(body.notes).slice(0, 2000) : null

    // Livraison souhaitée : lieu et conditions (texte libre), date (pas dans le passé, jour de Brazzaville)
    const deliveryTerms = body.deliveryTerms ? String(body.deliveryTerms).trim().slice(0, 500) || null : null
    let requestedDeliveryDate: Date | null = null
    if (body.requestedDeliveryDate) {
      requestedDeliveryDate = new Date(String(body.requestedDeliveryDate))
      if (Number.isNaN(requestedDeliveryDate.getTime())) return NextResponse.json({ error: "Date de livraison invalide" }, { status: 400 })
      const day = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
      if (day(requestedDeliveryDate) < day(new Date())) return NextResponse.json({ error: "La date de livraison souhaitée est déjà passée" }, { status: 400 })
    }

    // Bon de commande repris d'un devis : même client, devis encore ouvert et pas déjà transformé.
    let parent: { id: string; reference: string } | null = null
    if (body.parentId) {
      const quote = await prisma.b2bDocument.findUnique({
        where: { id: String(body.parentId) },
        select: { id: true, reference: true, type: true, status: true, clientId: true, _count: { select: { children: { where: { status: { not: "CANCELLED" } } } } } },
      })
      if (!quote || quote.type !== "DEVIS") return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
      if (quote.clientId !== client.id) return NextResponse.json({ error: "Ce devis est celui d'un autre client" }, { status: 400 })
      if (!(OPEN_QUOTE_STATUSES as readonly string[]).includes(quote.status)) return NextResponse.json({ error: "Ce devis est refusé ou annulé" }, { status: 400 })
      if (quote._count.children > 0) return NextResponse.json({ error: `Le devis ${quote.reference} a déjà son bon de commande` }, { status: 400 })
      parent = { id: quote.id, reference: quote.reference }
    }
    // un devis porte une date de validité (30 jours par défaut)
    const validUntilRaw = body.validUntil ? new Date(String(body.validUntil)) : null
    if (validUntilRaw && Number.isNaN(validUntilRaw.getTime())) {
      return NextResponse.json({ error: "Date de validité invalide" }, { status: 400 })
    }
    const validUntil = docType === "DEVIS" ? validUntilRaw ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null

    // nextDocumentReference est count+1 : en cas de course (P2002), on régénère
    // la référence et on réessaie, sans bloquer.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const document = await prisma.$transaction(async (tx) => {
          // revérifié dans la transaction : deux commandes du même devis ne doivent pas passer ensemble
          if (parent && (await tx.b2bDocument.count({ where: { parentId: parent.id, status: { not: "CANCELLED" } } })) > 0) {
            throw new QuoteAlreadyUsedError()
          }
          const reference = await nextDocumentReference(tx, REF_PREFIX[docType] as "DEV" | "BC" | "BL" | "FAC")
          const created = await tx.b2bDocument.create({
            data: {
              type: docType as Prisma.B2bDocumentCreateInput["type"],
              reference,
              clientId: client.id,
              ...(parent ? { parentId: parent.id } : {}),
              status: "DRAFT",
              subtotal,
              discount,
              total: Math.max(0, subtotal - discount),
              notes,
              validUntil,
              deliveryTerms,
              requestedDeliveryDate,
              createdById: selfId,
              items: {
                create: items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity })),
              },
            },
            include: { client: true, items: { include: { productVariant: true } } },
          })
          // le devis repris est accepté par le client
          if (parent) await tx.b2bDocument.update({ where: { id: parent.id }, data: { status: "CONFIRMED" } })
          return created
        })
        await logActivity({
          module: "b2b",
          action: "create",
          entity: "B2bDocument",
          entityId: document.id,
          summary: `Création ${document.type} ${document.reference}${parent ? ` à partir de ${parent.reference}` : ""}`,
        })
        return NextResponse.json({ document, contractDiscount: autoDiscount && discount > 0 }, { status: 201 })
      } catch (error) {
        if (isP2002(error) && attempt < 2) continue
        if (error instanceof QuoteAlreadyUsedError) {
          return NextResponse.json({ error: `Le devis ${parent?.reference} a déjà son bon de commande` }, { status: 400 })
        }
        throw error
      }
    }
    return NextResponse.json({ error: "Référence en collision, réessayez" }, { status: 409 })
  } catch (error) {
    console.error("POST b2b-documents error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}