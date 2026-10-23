import type { Prisma, PrismaClient } from "@prisma/client"
import { expireOverdueLotsTx } from "@/lib/lot-utils"

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/**
 * Lot périmé retiré des listes mais gardé en base : les ventes, les mouvements de stock et la
 * traçabilité continuent de citer son numéro. Il ne se vend pas et ne couvre plus aucun stock.
 */
export const ARCHIVED_LOT_STATUS = "ARCHIVED"

const expiredLotSelect = {
  id: true,
  lotNumber: true,
  initialQuantity: true,
  remainingQuantity: true,
  expiryDate: true,
  variant: { select: { format: true, product: { select: { name: true } } } },
  _count: { select: { orderItems: true, stockMovements: true, allocations: true } },
} satisfies Prisma.ProductionLotSelect

export interface ExpiredLot {
  id: string
  lotNumber: string
  productName: string
  format: string
  initialQuantity: number
  remainingQuantity: number
  expiryDate: Date | null
  /** Des ventes, des mouvements de stock ou des allocations le citent : il sera archivé, pas effacé. */
  hasHistory: boolean
}

/** Lots périmés (statut « EXPIRED », après bascule de ceux dont la date est passée), les plus anciens d'abord. */
export async function expiredLotsTx(tx: TxClient, ids?: string[]): Promise<ExpiredLot[]> {
  await expireOverdueLotsTx(tx)
  const lots = await tx.productionLot.findMany({
    where: { status: "EXPIRED", ...(ids ? { id: { in: ids } } : {}) },
    select: expiredLotSelect,
    orderBy: [{ expiryDate: "asc" }, { lotNumber: "asc" }],
  })
  return lots.map((lot) => ({
    id: lot.id,
    lotNumber: lot.lotNumber,
    productName: lot.variant.product.name,
    format: lot.variant.format,
    initialQuantity: lot.initialQuantity,
    remainingQuantity: lot.remainingQuantity,
    expiryDate: lot.expiryDate,
    hasHistory: lot._count.orderItems + lot._count.stockMovements + lot._count.allocations > 0,
  }))
}

/**
 * Retire des lots périmés, parmi ceux désignés qui le sont encore au moment de l'appel.
 * Un lot sans aucun historique est supprimé ; un lot que des ventes, des mouvements ou des allocations
 * citent est archivé, pour que l'historique garde son numéro de lot (choix de l'utilisateur, 2026-10-23).
 * Le stock des points de vente ne change pas.
 */
export async function removeExpiredLotsTx(tx: TxClient, ids: string[]) {
  const lots = await expiredLotsTx(tx, ids)
  const targetIds = lots.map((l) => l.id)
  if (targetIds.length === 0) return { deleted: [] as ExpiredLot[], archived: [] as ExpiredLot[] }

  // Le filtre « aucun historique » est rejoué à l'écriture : un lot cité entre-temps est archivé, jamais effacé.
  const deletable = await tx.productionLot.findMany({
    where: { id: { in: targetIds }, status: "EXPIRED", orderItems: { none: {} }, stockMovements: { none: {} }, allocations: { none: {} } },
    select: { id: true },
  })
  const deletableIds = new Set(deletable.map((l) => l.id))
  if (deletableIds.size > 0) {
    await tx.productionLot.deleteMany({ where: { id: { in: [...deletableIds] } } })
  }
  const archivedIds = targetIds.filter((id) => !deletableIds.has(id))
  if (archivedIds.length > 0) {
    await tx.productionLot.updateMany({ where: { id: { in: archivedIds }, status: "EXPIRED" }, data: { status: ARCHIVED_LOT_STATUS } })
  }

  return {
    deleted: lots.filter((l) => deletableIds.has(l.id)),
    archived: lots.filter((l) => !deletableIds.has(l.id)),
  }
}
