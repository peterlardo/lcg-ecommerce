import type { PrismaClient } from "@prisma/client"
import { createCoverageLotTx, expireOverdueLotsTx } from "@/lib/lot-utils"

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/**
 * Cohérence du stock d'un format entre ses trois sources :
 * - le stock des emplacements (PointOfSaleStock), qui fait foi : c'est lui que les ventes contrôlent ;
 * - l'ancien stock global (ProductVariant.stock), qui doit lui être égal ;
 * - le reste des lots (actifs ou expirés), qui doit le couvrir : une vente est refusée
 *   (« Stock insuffisant par lots ») dès que les lots actifs ne couvrent plus la quantité.
 */
export interface CoherenceRow {
  variantId: string
  productName: string
  format: string
  globalStock: number
  locationStock: number
  hasLocationStock: boolean
  activeLots: number
  expiredLots: number
  /** Stock présent sans aucun lot : invendable tant qu'un lot ne le couvre pas. */
  uncovered: number
  /** Reste des lots supérieur au stock présent : à vérifier par un inventaire. */
  excess: number
  /** Écart de l'ancien stock global par rapport au stock des emplacements. */
  globalGap: number
}

export const REGULARISATION_NOTE = "Régularisation : stock présent sans lot"

export async function stockCoherenceTx(tx: TxClient): Promise<CoherenceRow[]> {
  await expireOverdueLotsTx(tx)

  const [variants, locations, lots] = await Promise.all([
    tx.productVariant.findMany({
      select: { id: true, format: true, stock: true, product: { select: { name: true } } },
      orderBy: [{ product: { name: "asc" } }, { format: "asc" }],
    }),
    tx.pointOfSaleStock.groupBy({ by: ["variantId"], _sum: { quantity: true }, _count: { _all: true } }),
    tx.productionLot.groupBy({
      by: ["variantId", "status"],
      where: { status: { in: ["ACTIVE", "EXPIRED"] }, remainingQuantity: { gt: 0 } },
      _sum: { remainingQuantity: true },
    }),
  ])

  const locationOf = new Map(locations.map((l) => [l.variantId, l]))
  const lotsOf = (variantId: string, status: string) =>
    lots.find((l) => l.variantId === variantId && l.status === status)?._sum.remainingQuantity ?? 0

  return variants.map((v) => {
    const location = locationOf.get(v.id)
    const hasLocationStock = (location?._count._all ?? 0) > 0
    const locationStock = location?._sum.quantity ?? 0
    const activeLots = lotsOf(v.id, "ACTIVE")
    const expiredLots = lotsOf(v.id, "EXPIRED")
    const covered = activeLots + expiredLots
    return {
      variantId: v.id,
      productName: v.product.name,
      format: v.format,
      globalStock: v.stock,
      locationStock,
      hasLocationStock,
      activeLots,
      expiredLots,
      uncovered: Math.max(0, locationStock - covered),
      excess: Math.max(0, covered - locationStock),
      // sans aucun emplacement connu, le stock global reste la seule information : on n'y touche pas
      globalGap: hasLocationStock ? v.stock - locationStock : 0,
    }
  })
}

export function coherenceSummary(rows: CoherenceRow[]) {
  const uncovered = rows.filter((r) => r.uncovered > 0)
  const gaps = rows.filter((r) => r.globalGap !== 0)
  const excess = rows.filter((r) => r.excess > 0)
  const expired = rows.filter((r) => r.expiredLots > 0)
  return {
    uncoveredFormats: uncovered.length,
    uncoveredUnits: uncovered.reduce((s, r) => s + r.uncovered, 0),
    globalGapFormats: gaps.length,
    excessFormats: excess.length,
    excessUnits: excess.reduce((s, r) => s + r.excess, 0),
    expiredFormats: expired.length,
    expiredUnits: expired.reduce((s, r) => s + r.expiredLots, 0),
    /** Nombre de formats que la régularisation peut corriger. */
    fixable: rows.filter((r) => r.uncovered > 0 || r.globalGap !== 0).length,
  }
}

/**
 * Régularisation : un lot couvre le stock présent sans lot, et l'ancien stock global est réaligné
 * sur le stock des emplacements. Aucune quantité en stock ne change dans les points de vente.
 */
export async function regulariseStockTx(tx: TxClient, actorId: string | null) {
  const rows = await stockCoherenceTx(tx)
  const createdLots: { lotNumber: string; variantId: string; quantity: number }[] = []
  let syncedFormats = 0

  for (const row of rows) {
    if (row.uncovered > 0) {
      const lot = await createCoverageLotTx(tx, {
        variantId: row.variantId,
        quantity: row.uncovered,
        notes: REGULARISATION_NOTE,
        createdById: actorId,
      })
      createdLots.push({ lotNumber: lot.lotNumber, variantId: row.variantId, quantity: row.uncovered })
    }
    if (row.globalGap !== 0) {
      await tx.productVariant.update({ where: { id: row.variantId }, data: { stock: row.locationStock } })
      syncedFormats++
    }
  }

  return { createdLots, syncedFormats, rows: await stockCoherenceTx(tx) }
}
