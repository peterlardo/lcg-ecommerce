import { getPrisma } from "@/lib/prisma";
import { getOrCreateComptoir, COMPTOIR_CODE } from "@/lib/comptoir";
import { allocateStockFIFOTx, generateLotNumberTx } from "@/lib/lot-utils";
import type { PrismaClient } from "@prisma/client";

export { COMPTOIR_CODE, getOrCreateComptoir } from "@/lib/comptoir";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const STOCK_MOBILE_CODE = "PDV-STOCK-MOBILE";

export const OPERATIONAL_STOCK_CODES = [COMPTOIR_CODE, STOCK_MOBILE_CODE];

// ---------------------------------------------------------------------------
// Location bootstrapping
// ---------------------------------------------------------------------------

export async function getOrCreateStockMobile() {
  return getPrisma().pointOfSale.upsert({
    where: { code: STOCK_MOBILE_CODE },
    update: {},
    create: {
      name: "Stock Mobile (Véhicule livraison)",
      code: STOCK_MOBILE_CODE,
      type: "VEHICLE",
      address: "Véhicule de livraison LCG",
      city: "Brazzaville",
      plateNumber: null,
      isActive: true,
    },
  });
}

// ---------------------------------------------------------------------------
// In-memory cache for operational locations (avoids DB upserts on every request)
// ---------------------------------------------------------------------------

let cachedLocations: { id: string; name: string; code: string; type: string }[] | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000 // 1 minute

export async function fetchCachedLocations() {
  if (cachedLocations && Date.now() - cachedAt < CACHE_TTL_MS) return cachedLocations
  const rows = await getPrisma().pointOfSale.findMany({
    where: { code: { in: OPERATIONAL_STOCK_CODES } },
    select: { id: true, name: true, code: true, type: true },
  })
  cachedLocations = rows
  cachedAt = Date.now()
  return rows
}

export async function ensureOperationalStockLocations() {
  const existing = await fetchCachedLocations()
  if (existing.length === 2) return existing

  const [comptoir, stockMobile] = await Promise.all([
    getOrCreateComptoir(),
    getOrCreateStockMobile(),
  ])

  await ensurePointOfSaleStockRows([comptoir.id, stockMobile.id])

  cachedLocations = null
  return fetchCachedLocations()
}

// ---------------------------------------------------------------------------
// Ensure PointOfSaleStock rows exist for all variants at given POS (batch)
// ---------------------------------------------------------------------------

export async function ensurePointOfSaleStockRows(posIds: string[]) {
  const variants = await getPrisma().productVariant.findMany({ select: { id: true } })
  if (variants.length === 0 || posIds.length === 0) return

  const rows = posIds.flatMap((posId) =>
    variants.map((v) => ({ pointOfSaleId: posId, variantId: v.id, quantity: 0 }))
  )

  await getPrisma().pointOfSaleStock.createMany({ data: rows, skipDuplicates: true })
}

// ---------------------------------------------------------------------------
// Consume stock from a Point of Sale (atomic: POS stock + global stock + movement + FIFO)
// ---------------------------------------------------------------------------

interface ConsumeStockParams {
  variantId: string;
  pointOfSaleId: string;
  quantity: number;
  type: string;
  reason: string;
  reference: string;
}

export async function consumePointOfSaleStockTx(
  tx: TxClient,
  { variantId, pointOfSaleId, quantity, type, reason, reference }: ConsumeStockParams,
) {
  // Decrement POS stock
  const posStock = await tx.pointOfSaleStock.findUnique({
    where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
  });

  if (!posStock || posStock.quantity < quantity) {
    throw new Error(
      `Stock insuffisant au point de vente: disponible ${posStock?.quantity ?? 0}, demandé ${quantity}`,
    );
  }

  await tx.pointOfSaleStock.update({
    where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
    data: { quantity: { decrement: quantity } },
  });

  // Decrement global stock
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stock: { decrement: quantity } },
  });

  // Create stock movement
  await tx.stockMovement.create({
    data: {
      variantId,
      type,
      quantity,
      reason,
      reference,
      pointOfSaleId,
    },
  });

  // FIFO lot allocation
  const fifoResult = await allocateStockFIFOTx(tx, variantId, quantity, type, reference);

  return fifoResult;
}

// ---------------------------------------------------------------------------
// Restock a Point of Sale (cancellation / return)
// ---------------------------------------------------------------------------

interface RestockParams {
  variantId: string;
  pointOfSaleId: string;
  quantity: number;
  type: string;
  reason: string;
  reference: string;
}

export async function restockPointOfSaleStockTx(
  tx: TxClient,
  { variantId, pointOfSaleId, quantity, type, reason, reference }: RestockParams,
) {
  // Ensure POS stock row exists
  await tx.pointOfSaleStock.upsert({
    where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
    update: { quantity: { increment: quantity } },
    create: { pointOfSaleId, variantId, quantity },
  });

  // Increment global stock
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stock: { increment: quantity } },
  });

  // Create stock movement
  await tx.stockMovement.create({
    data: {
      variantId,
      type,
      quantity,
      reason,
      reference,
      pointOfSaleId,
    },
  });
}

// ---------------------------------------------------------------------------
// Transfer stock between two Points of Sale (atomic)
// ---------------------------------------------------------------------------

interface TransferStockParams {
  sourcePointOfSaleId: string;
  destinationPointOfSaleId: string;
  variantId: string;
  quantity: number;
  reason: string;
  reference: string;
}

export async function transferPointOfSaleStockTx(
  tx: TxClient,
  {
    sourcePointOfSaleId,
    destinationPointOfSaleId,
    variantId,
    quantity,
    reason,
    reference,
  }: TransferStockParams,
) {
  // Check source stock
  const sourceStock = await tx.pointOfSaleStock.findUnique({
    where: { pointOfSaleId_variantId: { pointOfSaleId: sourcePointOfSaleId, variantId } },
  });

  if (!sourceStock || sourceStock.quantity < quantity) {
    throw new Error(
      `Stock insuffisant à la source: disponible ${sourceStock?.quantity ?? 0}, demandé ${quantity}`,
    );
  }

  // Decrement source POS
  await tx.pointOfSaleStock.update({
    where: { pointOfSaleId_variantId: { pointOfSaleId: sourcePointOfSaleId, variantId } },
    data: { quantity: { decrement: quantity } },
  });

  // Increment destination POS
  await tx.pointOfSaleStock.upsert({
    where: { pointOfSaleId_variantId: { pointOfSaleId: destinationPointOfSaleId, variantId } },
    update: { quantity: { increment: quantity } },
    create: { pointOfSaleId: destinationPointOfSaleId, variantId, quantity },
  });

  // Create TRANSFER_OUT movement at source
  await tx.stockMovement.create({
    data: {
      variantId,
      type: "TRANSFER_OUT",
      quantity,
      reason,
      reference,
      pointOfSaleId: sourcePointOfSaleId,
    },
  });

  // Create TRANSFER_IN movement at destination
  await tx.stockMovement.create({
    data: {
      variantId,
      type: "TRANSFER_IN",
      quantity,
      reason,
      reference,
      pointOfSaleId: destinationPointOfSaleId,
    },
  });

  // Global stock is NOT changed during POS-to-POS transfer
  // (the stock stays within the system, just moves between locations)
}

// ---------------------------------------------------------------------------
// Create stock at a specific POS location (production replenishment / adjustment)
// ---------------------------------------------------------------------------

interface CreateProductionLocationParams {
  variantId: string;
  quantity: number;
  pointOfSaleId: string;
  movementType: string;
  reason: string;
  reference: string;
  notes: string;
}

export async function createProductionForLocationTx(
  tx: TxClient,
  {
    variantId,
    quantity,
    pointOfSaleId,
    movementType,
    reason,
    reference,
    notes,
  }: CreateProductionLocationParams,
) {
  // Create a production lot for traceability
  const lotNumber = await generateLotNumberTx(tx);

  const lot = await tx.productionLot.create({
    data: {
      lotNumber,
      variantId,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      productionDate: new Date(),
      status: "ACTIVE",
      notes: notes || reason,
    },
  });

  // Increment global stock
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stock: { increment: quantity } },
  });

  // Increment POS stock
  await tx.pointOfSaleStock.upsert({
    where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
    update: { quantity: { increment: quantity } },
    create: { pointOfSaleId, variantId, quantity },
  });

  // Create stock movement linked to lot and POS
  await tx.stockMovement.create({
    data: {
      variantId,
      type: movementType,
      quantity,
      reason,
      reference,
      pointOfSaleId,
      lotId: lot.id,
    },
  });

  return lot;
}

// ---------------------------------------------------------------------------
// Restore lot allocations by reference (cancellation undo)
// ---------------------------------------------------------------------------

export async function restoreLotAllocationsByReferenceTx(
  tx: TxClient,
  reference: string,
) {
  const allocations = await tx.lotAllocation.findMany({
    where: { reference },
  });

  for (const alloc of allocations) {
    // Restore remainingQuantity on the lot
    await tx.productionLot.update({
      where: { id: alloc.lotId },
      data: {
        remainingQuantity: { increment: alloc.quantity },
        status: "ACTIVE",
      },
    });

    // Delete the allocation record
    await tx.lotAllocation.delete({ where: { id: alloc.id } });
  }
}
