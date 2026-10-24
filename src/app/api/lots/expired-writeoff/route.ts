import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { expireOverdueLotsTx } from "@/lib/lot-utils"
import { removeExpiredLotsTx } from "@/lib/lot-expired"

export const maxDuration = 60

/**
 * Onglet Cohérence, « Retirer les périmés » (demande du 2026-10-24) : pour chaque format désigné
 * (variantIds : tous ses lots périmés) ou chaque lot coché dans la liste des lots périmés (lotIds),
 * - le reste des lots périmés sort du stock (points de vente et stock global), mouvement ADJUSTMENT_OUT tracé ;
 *   on ne sort que les unités que les lots actifs ne couvrent pas (stock présent − lots actifs), au plus le
 *   reste des lots périmés, en commençant par le point de vente qui en a le plus ;
 * - les lots périmés sont retirés : archivés s'ils ont un historique, effacés sinon (removeExpiredLotsTx).
 * Les lots actifs et le stock qu'ils couvrent ne changent pas.
 */
export async function POST(req: Request) {
  const guard = await requireManagementAccess(undefined, [["production", "lots"], "delete"])
  if (guard) return guard

  try {
    const body = await req.json().catch(() => ({}))
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === "string") : [])
    const variantIds = strings(body.variantIds)
    // lotIds : lots périmés choisis un par un (liste de l'onglet Cohérence), même ceux dont le reste est nul
    const lotIds = strings(body.lotIds)
    if (variantIds.length === 0 && lotIds.length === 0) return NextResponse.json({ error: "Aucun lot sélectionné" }, { status: 400 })
    const actorId = (await auth())?.user?.id ?? null

    const result = await getPrisma().$transaction(
      async (tx) => {
        await expireOverdueLotsTx(tx)
        const formats: { variantId: string; label: string; units: number; lots: number; archived: number }[] = []

        const selected = await tx.productionLot.findMany({
          where: { status: "EXPIRED", OR: [{ variantId: { in: variantIds } }, { id: { in: lotIds } }] },
          select: { id: true, variantId: true, remainingQuantity: true },
        })
        const byVariant = new Map<string, typeof selected>()
        for (const lot of selected) byVariant.set(lot.variantId, [...(byVariant.get(lot.variantId) ?? []), lot])

        for (const [variantId, expiredLots] of byVariant) {
          const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: { stock: true, format: true, product: { select: { name: true } } },
          })
          if (!variant) continue

          const [active, otherExpired, stocks] = await Promise.all([
            tx.productionLot.aggregate({ where: { variantId, status: "ACTIVE", remainingQuantity: { gt: 0 } }, _sum: { remainingQuantity: true } }),
            // les lots périmés non choisis gardent le stock qu'ils couvrent
            tx.productionLot.aggregate({
              where: { variantId, status: "EXPIRED", remainingQuantity: { gt: 0 }, id: { notIn: expiredLots.map((l) => l.id) } },
              _sum: { remainingQuantity: true },
            }),
            tx.pointOfSaleStock.findMany({ where: { variantId, quantity: { gt: 0 } }, orderBy: { quantity: "desc" } }),
          ])
          const expiredUnits = expiredLots.reduce((s, l) => s + Math.max(0, l.remainingQuantity), 0)
          const present = stocks.reduce((s, p) => s + p.quantity, 0)
          const covered = (active._sum.remainingQuantity ?? 0) + (otherExpired._sum.remainingQuantity ?? 0)
          const units = Math.min(expiredUnits, Math.max(0, present - covered))

          // sortie du stock, point de vente par point de vente (le plus fourni d'abord)
          let left = units
          for (const ps of stocks) {
            if (left <= 0) break
            const take = Math.min(ps.quantity, left)
            await tx.pointOfSaleStock.update({ where: { id: ps.id }, data: { quantity: { decrement: take } } })
            await tx.stockMovement.create({
              data: {
                variantId,
                type: "ADJUSTMENT_OUT",
                quantity: take,
                reason: "Lots périmés retirés (cohérence)",
                reference: `PERIMES-${Date.now()}-${variantId.slice(-6)}`,
                pointOfSaleId: ps.pointOfSaleId,
                userId: actorId,
              },
            })
            left -= take
          }
          if (units > 0) {
            await tx.productVariant.update({ where: { id: variantId }, data: { stock: Math.max(0, variant.stock - units) } })
          }

          const retired = await removeExpiredLotsTx(tx, expiredLots.map((l) => l.id))
          formats.push({
            variantId,
            label: `${variant.product.name} · ${variant.format}`,
            units,
            lots: retired.deleted.length + retired.archived.length,
            archived: retired.archived.length,
          })
        }
        return formats
      },
      { timeout: 30000, maxWait: 10000 },
    )

    const units = result.reduce((s, f) => s + f.units, 0)
    const lots = result.reduce((s, f) => s + f.lots, 0)
    if (lots > 0 || units > 0) {
      await logActivity({
        module: "production",
        action: "suppression",
        entity: "ProductionLot",
        summary: `Lots périmés retirés (onglet Cohérence) : ${lots} lot(s), ${units} unité(s) sorties du stock — ${result.map((f) => `${f.label} (${f.lots} lot(s), ${f.units} u.)`).join(", ")}`,
      })
    }
    return NextResponse.json({ ok: true, lots, units, archived: result.reduce((s, f) => s + f.archived, 0), formats: result })
  } catch (error) {
    console.error("POST lots/expired-writeoff error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
