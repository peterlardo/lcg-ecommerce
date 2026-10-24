import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { expireOverdueLotsTx, startOfToday } from "@/lib/lot-utils"

class LotStockError extends Error {}

/**
 * Correction du stock d'un lot (demande du 2026-10-24) : on saisit la quantité réellement restante dans le lot,
 * le point de vente où se trouve l'écart et un motif. L'écart est appliqué partout à la fois, pour que lots,
 * points de vente et stock global restent d'accord :
 * - le lot (reste, et statut : épuisé à 0, de nouveau actif s'il reprend du stock) ;
 * - le stock du point de vente choisi (c'est lui que voit la caisse) ;
 * - le stock global du format ;
 * - un mouvement ADJUSTMENT_IN / ADJUSTMENT_OUT rattaché au lot, et une allocation « Ajustement » en cas de baisse.
 * Un lot ne peut pas dépasser sa quantité produite ; un lot expiré ne peut que baisser.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"], [["production", "lots"], "edit"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const target = Number(body.quantity)
    const pointOfSaleId = typeof body.pointOfSaleId === "string" ? body.pointOfSaleId : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""
    if (!Number.isInteger(target) || target < 0) {
      return NextResponse.json({ error: "Quantité restante invalide (nombre entier, 0 ou plus)" }, { status: 400 })
    }
    if (!pointOfSaleId) return NextResponse.json({ error: "Choisissez le point de vente concerné" }, { status: 400 })
    if (!reason) return NextResponse.json({ error: "Indiquez le motif de la correction" }, { status: 400 })

    const actorId = (await auth())?.user?.id ?? null

    const result = await getPrisma().$transaction(async (tx) => {
      const before = await tx.productionLot.findUnique({ where: { id }, select: { variantId: true } })
      if (!before) throw new LotStockError("Lot introuvable")
      await expireOverdueLotsTx(tx, before.variantId)

      const lot = await tx.productionLot.findUnique({ where: { id } })
      if (!lot) throw new LotStockError("Lot introuvable")
      if (lot.status === "ARCHIVED") throw new LotStockError("Un lot archivé ne se corrige plus")

      const diff = target - lot.remainingQuantity
      if (diff === 0) throw new LotStockError("La quantité saisie est déjà celle du lot : rien à corriger")
      if (diff > 0 && lot.status === "EXPIRED") {
        throw new LotStockError("Un lot expiré ne peut que baisser : repoussez d'abord sa date de péremption")
      }
      if (target > lot.initialQuantity) {
        throw new LotStockError(`Un lot ne peut pas dépasser sa quantité produite (${lot.initialQuantity}) : faites plutôt une entrée de stock`)
      }

      const pos = await tx.pointOfSale.findUnique({ where: { id: pointOfSaleId }, select: { id: true, name: true } })
      if (!pos) throw new LotStockError("Point de vente introuvable")
      const posStock = await tx.pointOfSaleStock.findUnique({
        where: { pointOfSaleId_variantId: { pointOfSaleId, variantId: lot.variantId } },
      })
      if (diff < 0 && (posStock?.quantity ?? 0) < -diff) {
        throw new LotStockError(`${pos.name} n'a que ${posStock?.quantity ?? 0} unité(s) de ce format : choisissez le point de vente où se trouve l'écart`)
      }
      const variant = await tx.productVariant.findUnique({ where: { id: lot.variantId }, select: { stock: true } })
      if (!variant) throw new LotStockError("Format introuvable")
      if (variant.stock + diff < 0) throw new LotStockError("Le stock global deviendrait négatif")

      // statut : épuisé à 0 ; un lot épuisé qui reprend du stock redevient actif (ou expiré si sa date est passée)
      const expired = lot.expiryDate !== null && lot.expiryDate < startOfToday()
      const status =
        target === 0 && lot.status === "ACTIVE"
          ? "EXHAUSTED"
          : target > 0 && lot.status === "EXHAUSTED"
            ? expired ? "EXPIRED" : "ACTIVE"
            : lot.status

      const reference = `LOT-${lot.lotNumber}`
      await tx.productionLot.update({ where: { id }, data: { remainingQuantity: target, status } })
      await tx.productVariant.update({ where: { id: lot.variantId }, data: { stock: { increment: diff } } })
      await tx.pointOfSaleStock.upsert({
        where: { pointOfSaleId_variantId: { pointOfSaleId, variantId: lot.variantId } },
        update: { quantity: { increment: diff } },
        create: { pointOfSaleId, variantId: lot.variantId, quantity: diff },
      })
      await tx.stockMovement.create({
        data: {
          variantId: lot.variantId,
          type: diff > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          quantity: Math.abs(diff),
          reason: `Correction du lot ${lot.lotNumber} : ${reason}`,
          reference,
          pointOfSaleId,
          lotId: id,
          userId: actorId,
        },
      })
      if (diff < 0) {
        await tx.lotAllocation.create({ data: { lotId: id, quantity: -diff, type: "ADJUSTMENT", reference } })
      }
      return { lot, diff, target, status, posName: pos.name }
    })

    await logActivity({
      module: "production",
      action: "Correction de stock",
      entity: "ProductionLot",
      entityId: id,
      summary: `Lot ${result.lot.lotNumber} : ${result.lot.remainingQuantity} → ${result.target} (${result.diff > 0 ? "+" : ""}${result.diff}, ${result.posName}) — ${reason}`,
    })

    return NextResponse.json({ ok: true, remainingQuantity: result.target, status: result.status, diff: result.diff })
  } catch (error) {
    if (error instanceof LotStockError) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes("introuvable") ? 404 : 400 })
    }
    console.error("POST lot stock error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
