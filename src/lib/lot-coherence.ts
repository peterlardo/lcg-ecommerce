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
  /** Stock global sans point de vente (ex. saisi à la création du produit) : invisible en caisse. */
  unlocated: number
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
      unlocated: Math.max(0, v.stock - locationStock),
    }
  })
}

export const COMPTOIR_PLACEMENT_NOTE = "Stock hors point de vente placé au Comptoir LCG"

/**
 * Place au Comptoir LCG le stock global qui n'est dans aucun point de vente (stock saisi à la
 * création du produit, ancienne entrée sans emplacement) : il devient vendable en caisse.
 * Le stock global ne change pas, on ne fait que lui donner un emplacement, couvert par un lot.
 */
export async function placeUnlocatedStockTx(
  tx: TxClient,
  { variantId, comptoirId, actorId, reason }: { variantId: string; comptoirId: string; actorId: string | null; reason?: string },
) {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } })
  if (!variant) return { placed: 0, lotNumber: null }
  const [located, lots] = await Promise.all([
    tx.pointOfSaleStock.aggregate({ where: { variantId }, _sum: { quantity: true } }),
    tx.productionLot.aggregate({
      where: { variantId, status: { in: ["ACTIVE", "EXPIRED"] }, remainingQuantity: { gt: 0 } },
      _sum: { remainingQuantity: true },
    }),
  ])
  const locationStock = located._sum.quantity ?? 0
  const placed = variant.stock - locationStock
  if (placed <= 0) return { placed: 0, lotNumber: null }

  const note = reason || COMPTOIR_PLACEMENT_NOTE
  // le lot couvre ce qui, une fois placé, ne serait couvert par aucun lot
  const toCover = Math.min(placed, Math.max(0, locationStock + placed - (lots._sum.remainingQuantity ?? 0)))
  const lot = toCover > 0 ? await createCoverageLotTx(tx, { variantId, quantity: toCover, notes: note, createdById: actorId }) : null

  await tx.pointOfSaleStock.upsert({
    where: { pointOfSaleId_variantId: { pointOfSaleId: comptoirId, variantId } },
    update: { quantity: { increment: placed } },
    create: { pointOfSaleId: comptoirId, variantId, quantity: placed },
  })
  await tx.stockMovement.create({
    data: {
      variantId,
      type: "ADJUSTMENT_IN",
      quantity: placed,
      reason: note,
      reference: lot?.lotNumber ?? `PLACEMENT-${Date.now()}`,
      pointOfSaleId: comptoirId,
      lotId: lot?.id ?? null,
      userId: actorId,
    },
  })
  return { placed, lotNumber: lot?.lotNumber ?? null }
}

/** Retire le stock hors point de vente qui n'existe pas réellement : le stock global redescend au total des points de vente. */
export async function dropUnlocatedStockTx(tx: TxClient, { variantId, actorId }: { variantId: string; actorId: string | null }) {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } })
  if (!variant) return { dropped: 0 }
  const located = await tx.pointOfSaleStock.aggregate({ where: { variantId }, _sum: { quantity: true } })
  const locationStock = located._sum.quantity ?? 0
  const dropped = variant.stock - locationStock
  if (dropped <= 0) return { dropped: 0 }
  await tx.productVariant.update({ where: { id: variantId }, data: { stock: locationStock } })
  await tx.stockMovement.create({
    data: { variantId, type: "ADJUSTMENT_OUT", quantity: dropped, reason: "Stock hors point de vente retiré (inexistant)", reference: `RETRAIT-${Date.now()}`, userId: actorId },
  })
  return { dropped }
}

export function coherenceSummary(rows: CoherenceRow[]) {
  const uncovered = rows.filter((r) => r.uncovered > 0)
  // un stock global au-dessus des points de vente est du stock hors point de vente : traité à part
  const gaps = rows.filter((r) => r.globalGap < 0)
  const excess = rows.filter((r) => r.excess > 0)
  const expired = rows.filter((r) => r.expiredLots > 0)
  const unlocated = rows.filter((r) => r.unlocated > 0)
  return {
    unlocatedFormats: unlocated.length,
    unlocatedUnits: unlocated.reduce((s, r) => s + r.unlocated, 0),
    uncoveredFormats: uncovered.length,
    uncoveredUnits: uncovered.reduce((s, r) => s + r.uncovered, 0),
    globalGapFormats: gaps.length,
    excessFormats: excess.length,
    excessUnits: excess.reduce((s, r) => s + r.excess, 0),
    expiredFormats: expired.length,
    expiredUnits: expired.reduce((s, r) => s + r.expiredLots, 0),
    /** Nombre de formats que la régularisation peut corriger. */
    fixable: rows.filter((r) => r.uncovered > 0 || r.globalGap < 0).length,
  }
}

/**
 * Régularisation : un lot couvre le stock présent sans lot, et l'ancien stock global, s'il est en
 * dessous, est réaligné sur le stock des emplacements. Aucune quantité ne change dans les points de
 * vente. Un stock global au-dessus (stock hors point de vente) n'est jamais baissé ici : il se place
 * au Comptoir ou se retire format par format (placeUnlocatedStockTx / dropUnlocatedStockTx).
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
    if (row.globalGap < 0) {
      await tx.productVariant.update({ where: { id: row.variantId }, data: { stock: row.locationStock } })
      syncedFormats++
    }
  }

  return { createdLots, syncedFormats, rows: await stockCoherenceTx(tx) }
}
