import { getPrisma } from "@/lib/prisma";
import type { PrismaClient, LotAllocation } from "@prisma/client"

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/** Début du jour courant (UTC) : un lot reste utilisable jusqu'à la fin du jour de sa date d'expiration. */
export function startOfToday(): Date {
  const day = new Date()
  day.setUTCHours(0, 0, 0, 0)
  return day
}

/** Passe en « EXPIRED » les lots actifs dont la date d'expiration est dépassée. Renvoie leur nombre. */
export async function expireOverdueLotsTx(tx: TxClient, variantId?: string): Promise<number> {
  const result = await tx.productionLot.updateMany({
    where: { status: "ACTIVE", expiryDate: { lt: startOfToday() }, ...(variantId ? { variantId } : {}) },
    data: { status: "EXPIRED" },
  })
  return result.count
}

/** Sorties qui retirent de la marchandise sans la vendre : elles soldent d'abord les lots expirés ou désactivés. */
const WRITE_OFF_TYPES = new Set(["LOSS", "ADJUSTMENT_OUT"])

/**
 * Prélève une quantité sur les lots d'un format, dans l'ordre demandé :
 * FIFO (plus ancienne production d'abord) ou FEFO (expiration la plus proche d'abord).
 * Un lot expiré n'est jamais vendu ; seule une perte ou un ajustement en moins peut le solder.
 */
async function allocateTx(tx: TxClient, variantId: string, quantity: number, type: string, reference: string | undefined, order: "FIFO" | "FEFO") {
  await expireOverdueLotsTx(tx, variantId)

  const byAge = [{ productionDate: "asc" as const }, { createdAt: "asc" as const }]
  const available = { variantId, remainingQuantity: { gt: 0 } }
  const active = order === "FEFO"
    ? [
        ...(await tx.productionLot.findMany({
          where: { ...available, status: "ACTIVE", expiryDate: { not: null } },
          orderBy: [{ expiryDate: "asc" }, ...byAge],
        })),
        ...(await tx.productionLot.findMany({ where: { ...available, status: "ACTIVE", expiryDate: null }, orderBy: byAge })),
      ]
    : await tx.productionLot.findMany({ where: { ...available, status: "ACTIVE" }, orderBy: byAge })
  // une perte ou un ajustement en moins solde aussi les lots désactivés (non vendus, mais bien en stock)
  const expired = WRITE_OFF_TYPES.has(type)
    ? await tx.productionLot.findMany({ where: { ...available, status: { in: ["EXPIRED", "DISABLED"] } }, orderBy: byAge })
    : []

  let remaining = quantity
  const allocations: { lotId: string; quantity: number; wasActive: boolean }[] = []

  for (const lot of [...expired, ...active]) {
    if (remaining <= 0) break
    const take = Math.min(lot.remainingQuantity, remaining)
    allocations.push({ lotId: lot.id, quantity: take, wasActive: lot.status === "ACTIVE" })
    remaining -= take
  }

  if (remaining > 0) {
    throw new Error(`Stock insuffisant par lots: ${remaining} unites manquantes pour la variante ${variantId}`)
  }

  const created: LotAllocation[] = []
  for (const alloc of allocations) {
    const updated = await tx.productionLot.update({
      where: { id: alloc.lotId },
      data: { remainingQuantity: { decrement: alloc.quantity } },
    })

    // un lot expiré soldé garde son statut « EXPIRED » : c'est son histoire
    if (updated.remainingQuantity <= 0 && alloc.wasActive) {
      await tx.productionLot.update({ where: { id: alloc.lotId }, data: { status: "EXHAUSTED" } })
    }

    const allocation = await tx.lotAllocation.create({
      data: { lotId: alloc.lotId, quantity: alloc.quantity, type, reference },
    })
    created.push(allocation)
  }

  return { allocations: created, totalAllocated: quantity - remaining }
}

export async function allocateStockFIFO(variantId: string, quantity: number, type: string, reference?: string) {
  return allocateStockFIFOTx(getPrisma(), variantId, quantity, type, reference)
}

export async function allocateStockFIFOTx(tx: TxClient, variantId: string, quantity: number, type: string, reference?: string) {
  return allocateTx(tx, variantId, quantity, type, reference, "FIFO")
}

export async function allocateStockFEFO(variantId: string, quantity: number, type: string, reference?: string) {
  return allocateStockFEFOTx(getPrisma(), variantId, quantity, type, reference)
}

export async function allocateStockFEFOTx(tx: TxClient, variantId: string, quantity: number, type: string, reference?: string) {
  return allocateTx(tx, variantId, quantity, type, reference, "FEFO")
}

export async function generateLotNumber(): Promise<string> {
  return generateLotNumberTx(getPrisma())
}

/**
 * Numéro du prochain lot du jour : LOT-AAAAMMJJ-NNN.
 * Le rang suit le plus grand numéro déjà attribué ce jour-là, et non le nombre de lots :
 * après la suppression d'un lot, compter les lots redonnait un numéro déjà pris.
 */
export async function generateLotNumberTx(tx: TxClient): Promise<string> {
  const prefix = `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-`
  const existing = await tx.productionLot.findMany({
    where: { lotNumber: { startsWith: prefix } },
    select: { lotNumber: true },
  })
  const last = existing.reduce((max, lot) => {
    const rank = Number(lot.lotNumber.slice(prefix.length))
    return Number.isInteger(rank) && rank > max ? rank : max
  }, 0)
  return `${prefix}${String(last + 1).padStart(3, "0")}`
}

/**
 * Crée un lot qui couvre du stock déjà entré par ailleurs (entrée directe dans un point de vente,
 * inventaire en plus, régularisation). Le lot seul est créé : les quantités en stock ne changent pas.
 * Sans lot, ce stock serait refusé à la vente (« Stock insuffisant par lots »).
 */
export async function createCoverageLotTx(
  tx: TxClient,
  { variantId, quantity, notes, createdById }: { variantId: string; quantity: number; notes: string; createdById?: string | null },
) {
  return tx.productionLot.create({
    data: {
      lotNumber: await generateLotNumberTx(tx),
      variantId,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      productionDate: new Date(),
      notes,
      createdById: createdById ?? null,
    },
    select: { id: true, lotNumber: true },
  })
}

/** Vrai si l'erreur vient d'un numéro de lot déjà pris (deux créations au même instant). */
export function isLotNumberConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
}
