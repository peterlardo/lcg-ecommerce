import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { nextDocumentReference } from "@/lib/b2b"
import { auth } from "@/lib/auth"
import { COMPTOIR_CODE, consumePointOfSaleStockTx, ensureOperationalStockLocations } from "@/lib/stock-service"

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
    include: { items: { include: { productVariant: true } }, client: true },
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
  return NextResponse.json({ document: doc })
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
    if (doc.status !== "DRAFT") {
      return NextResponse.json({ error: "Seuls les brouillons sont modifiables" }, { status: 400 })
    }
    const items = Array.isArray(body.items) ? body.items : null
    if (items && items.length === 0) {
      return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 })
    }
    const discount = body.discount !== undefined ? Math.max(0, Number(body.discount) || 0) : doc.discount
    const notes = body.notes !== undefined ? String(body.notes) : doc.notes

    const updated = await prisma.$transaction(async (tx) => {
      const newItems = items
        ? items.map((i) => {
            const item = i as { productVariantId?: unknown; quantity?: unknown; unitPrice?: unknown }
            return {
              productVariantId: String(item.productVariantId ?? ""),
              quantity: Math.max(1, Number(item.quantity) || 1),
              unitPrice: Math.max(0, Number(item.unitPrice) || 0),
            }
          })
        : null
      if (newItems && newItems.some((i) => !i.productVariantId)) {
        throw new Error("Article sans produit")
      }
      if (newItems) await tx.b2bDocumentItem.deleteMany({ where: { documentId: id } })
      const subtotal = newItems ? newItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) : doc.subtotal

      await tx.b2bDocument.update({
        where: { id },
        data: {
          ...(newItems
            ? {
                subtotal,
                total: Math.max(0, subtotal - discount),
                items: { create: newItems.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity })) },
              }
            : discount !== doc.discount
              ? { discount, total: Math.max(0, doc.subtotal - discount) }
              : {}),
          ...(notes !== doc.notes ? { notes } : {}),
        },
      })
      return tx.b2bDocument.findUnique({
        where: { id },
        include: { client: true, items: { include: { productVariant: true } } },
      })
    })
    await logActivity({ module: "b2b", action: "update", entity: "B2bDocument", entityId: id, summary: `Modification ${doc.reference}` })
    return NextResponse.json({ document: updated })
  }

  const action = String(body.action)

  if (action === "cancel") {
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

  if (action === "reject") {
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
    const target = String(body.target ?? "")
    const nextType: Record<string, string> = {
      "DEVIS": target || "COMMANDE",
      "COMMANDE": target || "LIVRAISON",
      "LIVRAISON": target || "FACTURE",
    }
    const toType = nextType[doc.type]
    if (!toType) return NextResponse.json({ error: "Impossible de transformer ce statut" }, { status: 400 })
    if (doc.status !== "CONFIRMED" && doc.status !== "DRAFT") {
      return NextResponse.json({ error: "Le document doit être CONFIRMED pour être transformé" }, { status: 400 })
    }
    if (doc.items.some((i) => !i.productVariantId)) {
      return NextResponse.json({ error: "Un article est sans produit" }, { status: 400 })
    }

    try {
      const stockLocations = await ensureOperationalStockLocations()
      const pointOfSaleId = stockLocations.find((l) => l.code === COMPTOIR_CODE)?.id

      const created = await prisma.$transaction(async (tx) => {
        const reference = await nextDocumentReference(tx, REF_PREFIX[toType] as "BC" | "BL" | "FAC")
        // La LIVRAISON débite le stock physique du Comptoir (même helper que la
        // vente). Stock insuffisant → exception → rollback → 400.
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
            createdById: selfId,
            items: {
              create: doc.items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
            },
          },
          include: { client: true, items: { include: { productVariant: true } } },
        })

        await tx.b2bDocument.update({
          where: { id },
          data: { status: doc.type === "LIVRAISON" ? "DELIVERED" : "CONFIRMED" },
        })

        await logActivity({
          module: "b2b",
          action: "transform",
          entity: "B2bDocument",
          entityId: created.id,
          summary: `Transformation ${doc.reference} → ${created.reference}`,
        })
        return created
      })

      return NextResponse.json({ document: created }, { status: 201 })
    } catch (error) {
      if (isP2002(error)) {
        return NextResponse.json({ error: "Référence en collision, réessayez" }, { status: 409 })
      }
      const message = error instanceof Error ? error.message : ""
      if (message.includes("Stock insuffisant") || message === "Moyen de stockage requis") {
        return NextResponse.json({ error: "Stock insuffisant" }, { status: 400 })
      }
      console.error("transform b2b-document error:", error)
      return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
}