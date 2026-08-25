import { getPrisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client"

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

export async function allocateStockFIFO(variantId: string, quantity: number, type: string, reference?: string) {
  return allocateStockFIFOTx(getPrisma(), variantId, quantity, type, reference)
}

export async function allocateStockFIFOTx(tx: TxClient, variantId: string, quantity: number, type: string, reference?: string) {
  const lots = await tx.productionLot.findMany({
    where: { variantId, status: "ACTIVE", remainingQuantity: { gt: 0 } },
    orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
  })

  let remaining = quantity
  const allocations: { lotId: string; quantity: number }[] = []

  for (const lot of lots) {
    if (remaining <= 0) break
    const take = Math.min(lot.remainingQuantity, remaining)
    allocations.push({ lotId: lot.id, quantity: take })
    remaining -= take
  }

  if (remaining > 0) {
    throw new Error(`Stock insuffisant par lots: ${remaining} unites manquantes pour la variante ${variantId}`)
  }

  const created: any[] = []
  for (const alloc of allocations) {
    await tx.productionLot.update({
      where: { id: alloc.lotId },
      data: { remainingQuantity: { decrement: alloc.quantity } },
    })

    const lot = await tx.productionLot.findUnique({ where: { id: alloc.lotId } })
    if (lot && lot.remainingQuantity <= 0) {
      await tx.productionLot.update({ where: { id: alloc.lotId }, data: { status: "EXHAUSTED" } })
    }

    const allocation = await tx.lotAllocation.create({
      data: { lotId: alloc.lotId, quantity: alloc.quantity, type, reference },
    })
    created.push(allocation)
  }

  return { allocations: created, totalAllocated: quantity - remaining }
}

export async function allocateStockFEFO(variantId: string, quantity: number, type: string, reference?: string) {
  return allocateStockFEFOTx(getPrisma(), variantId, quantity, type, reference)
}

export async function allocateStockFEFOTx(tx: TxClient, variantId: string, quantity: number, type: string, reference?: string) {
  const lots = await tx.productionLot.findMany({
    where: { variantId, status: "ACTIVE", remainingQuantity: { gt: 0 }, expiryDate: { not: null } },
    orderBy: [{ expiryDate: "asc" }, { productionDate: "asc" }, { createdAt: "asc" }],
  })

  const lotsWithoutExpiry = await tx.productionLot.findMany({
    where: { variantId, status: "ACTIVE", remainingQuantity: { gt: 0 }, expiryDate: null },
    orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
  })

  const allLots = [...lots, ...lotsWithoutExpiry]

  let remaining = quantity
  const allocations: { lotId: string; quantity: number }[] = []

  for (const lot of allLots) {
    if (remaining <= 0) break
    const take = Math.min(lot.remainingQuantity, remaining)
    allocations.push({ lotId: lot.id, quantity: take })
    remaining -= take
  }

  if (remaining > 0) {
    throw new Error(`Stock insuffisant par lots: ${remaining} unites manquantes`)
  }

  const created: any[] = []
  for (const alloc of allocations) {
    await tx.productionLot.update({
      where: { id: alloc.lotId },
      data: { remainingQuantity: { decrement: alloc.quantity } },
    })

    const lot = await tx.productionLot.findUnique({ where: { id: alloc.lotId } })
    if (lot && lot.remainingQuantity <= 0) {
      await tx.productionLot.update({ where: { id: alloc.lotId }, data: { status: "EXHAUSTED" } })
    }

    const allocation = await tx.lotAllocation.create({
      data: { lotId: alloc.lotId, quantity: alloc.quantity, type, reference },
    })
    created.push(allocation)
  }

  return { allocations: created, totalAllocated: quantity - remaining }
}

export async function generateLotNumber(): Promise<string> {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
  const count = await getPrisma().productionLot.count({
    where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
  })
  const seq = String(count + 1).padStart(3, "0")
  return `LOT-${dateStr}-${seq}`
}

export async function generateLotNumberTx(tx: TxClient): Promise<string> {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
  const count = await tx.productionLot.count({
    where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
  })
  const seq = String(count + 1).padStart(3, "0")
  return `LOT-${dateStr}-${seq}`
}
