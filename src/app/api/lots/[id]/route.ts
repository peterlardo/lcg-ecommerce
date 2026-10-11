import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, saleMovementsFilter, isRestrictedOrder } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { LOT_STATUSES } from "@/lib/lot-input"
import { logActivity } from "@/lib/activity"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
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
  const forbidden = await requireManagementAccess()
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

    const updated = await getPrisma().productionLot.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })

    return NextResponse.json({ lot: updated })
  } catch (error) {
    console.error("PATCH lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const lot = await getPrisma().productionLot.findUnique({ where: { id } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }

    // Seul un lot épuisé se supprime : il ne porte plus aucun stock, donc rien ne bouge dans les points de vente.
    // Un lot actif ou expiré a encore du stock : il se corrige par une perte ou un ajustement, pas par une suppression.
    if (lot.status !== "EXHAUSTED" || lot.remainingQuantity > 0) {
      return NextResponse.json({ error: "Seul un lot epuise peut etre supprime" }, { status: 400 })
    }

    // Les allocations du lot partent avec lui. Les mouvements de stock et les lignes de vente sont
    // conservés, simplement détachés du lot : l'historique des ventes et de la production reste complet.
    await getPrisma().productionLot.delete({ where: { id } })

    await logActivity({
      module: "production",
      action: "suppression",
      entity: "ProductionLot",
      entityId: id,
      summary: `Suppression du lot épuisé ${lot.lotNumber} (${lot.initialQuantity} unités produites)`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
