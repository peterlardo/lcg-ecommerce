import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, saleMovementsFilter, isRestrictedOrder } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { LOT_STATUSES } from "@/lib/lot-input"
import { logActivity } from "@/lib/activity"
import { startOfToday } from "@/lib/lot-utils"
import { removeExpiredLotsTx } from "@/lib/lot-expired"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(undefined, [["production", "lots", "tracabilite"], "view"])
  if (forbidden) return forbidden

  const { id } = await params
  const lot = await getPrisma().productionLot.findUnique({
    where: { id },
    include: {
      variant: { include: { product: { include: { category: true } } } },
      createdBy: { select: { name: true, email: true } },
      allocations: { orderBy: { createdAt: "desc" } },
      stockMovements: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!lot) {
    return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  }

  const session = await auth()
  const role = session?.user?.role
  const selfId = session?.user?.id
  const movements = await getPrisma().stockMovement.findMany({
    where: { lotId: id, pointOfSaleId: { not: null }, AND: [saleMovementsFilter(role, selfId)] },
    select: { reference: true, pointOfSaleId: true },
  })

  const posIds = [...new Set(movements.map((m) => m.pointOfSaleId!).filter(Boolean))]
  const posList = posIds.length > 0
    ? await getPrisma().pointOfSale.findMany({ where: { id: { in: posIds } }, select: { id: true, name: true, code: true } })
    : []
  const posMap = new Map(posList.map((p) => [p.id, { name: p.name, code: p.code }]))

  const refToPos = new Map<string, { name: string; code: string }>()
  for (const m of movements) {
    if (m.reference && m.pointOfSaleId) {
      const pos = posMap.get(m.pointOfSaleId)
      if (pos && !refToPos.has(m.reference)) refToPos.set(m.reference, pos)
    }
  }

  const orderRefs = lot.allocations
    .filter((a) => a.type === "SALE" && a.reference)
    .map((a) => a.reference!)
  const orders = orderRefs.length > 0
    ? await getPrisma().order.findMany({
        where: { orderNumber: { in: [...new Set(orderRefs)] } },
        select: { orderNumber: true, notes: true, userId: true, pointOfSale: { select: { name: true, code: true } } },
      })
    : []
  const orderPosMap = new Map(orders.filter((o) => o.pointOfSale).map((o) => [o.orderNumber, o.pointOfSale!]))
  const orderByNumber = new Map(orders.map((o) => [o.orderNumber, o]))

  const enrichedAllocations = lot.allocations
    .filter((a) => {
      if (a.type !== "SALE" || !a.reference) return true
      const order = orderByNumber.get(a.reference)
      if (!order) return true
      return !isRestrictedOrder(order, role, selfId)
    })
    .map((a) => {
    let pointOfSale: { name: string; code: string } | null = null
    if (a.type === "SALE" && a.reference) {
      pointOfSale = orderPosMap.get(a.reference) ?? null
    } else if (a.type === "TRANSFER" && a.reference) {
      pointOfSale = refToPos.get(a.reference) ?? null
    }
    return { ...a, pointOfSale }
  })

  return NextResponse.json({ lot: { ...lot, allocations: enrichedAllocations } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(undefined, [["production", "lots"], "edit"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const body = await req.json()
    const { status, expiryDate, notes } = body

    const lot = await getPrisma().productionLot.findUnique({ where: { id } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }
    if (status && !LOT_STATUSES.includes(String(status))) {
      return NextResponse.json({ error: "Statut de lot inconnu" }, { status: 400 })
    }

    const newExpiry = expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : undefined
    if (newExpiry && Number.isNaN(newExpiry.getTime())) {
      return NextResponse.json({ error: "Date de péremption invalide" }, { status: 400 })
    }
    // Repousser la péremption d'un lot expiré (aujourd'hui ou plus tard, ou sans date) le rend de
    // nouveau vendable ; sans cela, il restait « expiré » et la caisse refusait toujours la vente.
    const reactivated = !status && newExpiry !== undefined && lot.status === "EXPIRED" && lot.remainingQuantity > 0
      && (newExpiry === null || newExpiry >= startOfToday())

    const updated = await getPrisma().productionLot.update({
      where: { id },
      data: {
        ...(status ? { status } : reactivated ? { status: "ACTIVE" } : {}),
        ...(newExpiry !== undefined ? { expiryDate: newExpiry } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })
    if (reactivated) {
      await logActivity({ module: "production", action: "Réactivation", entity: "ProductionLot", entityId: id, summary: `Lot ${lot.lotNumber} de nouveau vendable : péremption repoussée` })
    }

    return NextResponse.json({ lot: updated, reactivated })
  } catch (error) {
    console.error("PATCH lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(undefined, [["production", "lots"], "delete"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const lot = await getPrisma().productionLot.findUnique({ where: { id } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }

    // Se suppriment : un lot épuisé (plus aucun stock), et un lot expiré (il n'est plus vendable).
    // Un lot actif se corrige par une perte ou un ajustement, pas par une suppression.
    // Supprimer un lot ne change aucune quantité dans les points de vente.
    const exhausted = lot.status === "EXHAUSTED" && lot.remainingQuantity <= 0
    if (!exhausted && lot.status !== "EXPIRED") {
      return NextResponse.json({ error: "Seul un lot épuisé ou expiré peut être supprimé" }, { status: 400 })
    }

    // Lot épuisé : ses allocations partent avec lui. Les mouvements de stock et les lignes de vente sont
    // conservés, simplement détachés du lot : l'historique des ventes et de la production reste complet.
    // Lot expiré : même règle que « Supprimer les lots périmés » (archivé s'il a un historique).
    let archived = false
    if (exhausted) {
      await getPrisma().productionLot.delete({ where: { id } })
    } else {
      const result = await getPrisma().$transaction((tx) => removeExpiredLotsTx(tx, [id]))
      archived = result.archived.length > 0
    }

    await logActivity({
      module: "production",
      action: "suppression",
      entity: "ProductionLot",
      entityId: id,
      summary: exhausted
        ? `Suppression du lot épuisé ${lot.lotNumber} (${lot.initialQuantity} unités produites)`
        : `${archived ? "Archivage" : "Suppression"} du lot expiré ${lot.lotNumber} (${lot.initialQuantity} unités produites, reste ${lot.remainingQuantity})`,
    })

    return NextResponse.json({ ok: true, archived })
  } catch (error) {
    console.error("DELETE lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
