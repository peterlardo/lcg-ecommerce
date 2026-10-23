import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { removeExpiredLotsTx } from "@/lib/lot-expired"

export const maxDuration = 60

/**
 * Nettoie les formats dont tous les lots sont inutilisables (aucun lot actif) :
 * - retire les lots expirés restants : archivés s'ils ont servi à des ventes ou des mouvements, effacés sinon ;
 * - retire du stock des points de vente les unités que plus aucun lot ne couvre
 *   (colonne « Sans lot »), avec un mouvement ADJUSTMENT_OUT pour la traçabilité.
 * Le stock global est ramené au stock restant couvert par des lots.
 */
export async function POST(req: Request) {
  const guard = await requireManagementAccess(undefined, [["production", "lots"], "delete"])
  if (guard) return guard

  try {
    const body = await req.json().catch(() => ({}))
    const variantIds = Array.isArray(body.variantIds) ? body.variantIds.filter((v: unknown) => typeof v === "string") : []

    if (variantIds.length === 0) {
      return NextResponse.json({ error: "Aucun format sélectionné" }, { status: 400 })
    }

    const prisma = getPrisma()

    const result = await prisma.$transaction(
      async (tx) => {
        const expired = await tx.productionLot.findMany({
          where: { variantId: { in: variantIds }, status: "EXPIRED", remainingQuantity: { gt: 0 } },
          select: { id: true },
        })
        // Un lot cité par des ventes, des mouvements ou des allocations est archivé (choix de l'utilisateur,
        // 2026-10-23 : garder l'historique des ventes) ; seuls les lots sans historique sont effacés.
        const retired = await removeExpiredLotsTx(tx, expired.map((l) => l.id))
        const lots = [
          ...retired.deleted.map((l) => ({ ...l, archived: false })),
          ...retired.archived.map((l) => ({ ...l, archived: true })),
        ]

        const removed: { variantId: string; units: number }[] = []

        for (const variantId of variantIds) {
          const [activeLots, locations, variant] = await Promise.all([
            tx.productionLot.aggregate({
              where: { variantId, status: "ACTIVE", remainingQuantity: { gt: 0 } },
              _sum: { remainingQuantity: true },
            }),
            tx.pointOfSaleStock.aggregate({ where: { variantId }, _sum: { quantity: true } }),
            tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } }),
          ])
          if (!variant) continue

          const covered = activeLots._sum.remainingQuantity ?? 0
          const locationStock = locations._sum.quantity ?? 0
          // règle métier : on ne touche qu'aux formats sans AUCUN lot actif
          if (covered > 0) continue
          const units = Math.max(0, locationStock)
          if (units === 0) continue

          await tx.pointOfSaleStock.deleteMany({ where: { variantId } })
          await tx.productVariant.update({ where: { id: variantId }, data: { stock: Math.max(0, variant.stock - units) } })

          await tx.stockMovement.create({
            data: {
              variantId,
              type: "ADJUSTMENT_OUT",
              quantity: units,
              reason: "Suppression du stock sans lot (cohérence)",
              reference: `SANSSLOT-${Date.now()}-${variantId.slice(-6)}`,
            },
          })
          removed.push({ variantId, units })
        }

        return { deleted: lots.length, removed, lots }
      },
      { timeout: 30000, maxWait: 10000 },
    )

    for (const lot of result.lots) {
      await logActivity({
        module: "production",
        action: lot.archived ? "archivage" : "suppression",
        entity: "ProductionLot",
        entityId: lot.id,
        summary: `${lot.archived ? "Archivage (lié à des ventes ou mouvements)" : "Suppression"} du lot périmé ${lot.lotNumber} (${lot.initialQuantity} unités produites, reste ${lot.remainingQuantity}) - nettoyé depuis onglet Cohérence (SANS LOT)`,
      })
    }
    const removedUnits = result.removed.reduce((s, r) => s + r.units, 0)
    if (removedUnits > 0) {
      await logActivity({
        module: "production",
        action: "suppression",
        entity: "StockMovement",
        summary: `Suppression de ${removedUnits} unité(s) de stock sans lot sur ${result.removed.length} format(s) - onglet Cohérence`,
      })
    }

    // « deleted » : lots retirés de la liste (effacés ou archivés), comme l'attend l'écran
    return NextResponse.json({ ok: true, deleted: result.deleted, archived: result.lots.filter((l) => l.archived).length, removedUnits, removed: result.removed })
  } catch (error) {
    console.error("POST lots/expired-cleanup error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
