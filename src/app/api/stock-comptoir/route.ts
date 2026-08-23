import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { allocateStockFIFOTx, generateLotNumberTx } from "@/lib/lot-utils"

export const dynamic = "force-dynamic"

const COMPTOIR_CODE = "PDV-COMPTOIR"

async function getOrCreateComptoir() {
  return prisma.pointOfSale.upsert({
    where: { code: COMPTOIR_CODE },
    update: {},
    create: {
      name: "Comptoir LCG",
      code: COMPTOIR_CODE,
      address: "Dépôt central LCG",
      city: "Brazzaville",
      isActive: true,
    },
  })
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x }

export async function GET(request: Request) {
  const denied = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") === "mois" ? "mois" : searchParams.get("period") === "jour" ? "jour" : "semaine"

    const comptoir = await getOrCreateComptoir()
    const now = new Date()
    const monthStart = startOfMonth(now)
    const weekStart = startOfWeek(now)
    const todayStart = startOfDay(now)

    const [stocks, variants, salesOrders, movements] = await Promise.all([
      prisma.pointOfSaleStock.findMany({
        where: { pointOfSaleId: comptoir.id },
        include: { variant: { include: { product: true } } },
        orderBy: [{ variant: { product: { name: "asc" } } }, { variant: { format: "asc" } }],
      }),
      prisma.productVariant.findMany({
        include: { product: true },
        orderBy: [{ product: { name: "asc" } }, { format: "asc" }],
      }),
      prisma.order.findMany({
        where: {
          pointOfSaleId: comptoir.id,
          notes: { startsWith: "Vente comptoir" },
          status: { notIn: ["CANCELLED"] },
          createdAt: { gte: monthStart },
        },
        select: { total: true, createdAt: true, items: true },
      }),
      prisma.stockMovement.findMany({
        where: { pointOfSaleId: comptoir.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { variant: { include: { product: true } } },
      }),
    ])

    const sumRange = (from: Date) =>
      salesOrders
        .filter((o) => o.createdAt >= from)
        .reduce((s, o) => ({ revenue: s.revenue + o.total, count: s.count + 1 }), { revenue: 0, count: 0 })

    const stats = {
      today: sumRange(todayStart),
      week: sumRange(weekStart),
      month: sumRange(monthStart),
      stockUnits: stocks.reduce((s, r) => s + r.quantity, 0),
      stockValue: stocks.reduce((s, r) => s + r.quantity * r.variant.price, 0),
    }

    let chartFrom = period === "mois" ? monthStart : period === "semaine" ? weekStart : todayStart
    if (period === "semaine") chartFrom = new Date(weekStart)
    const buckets: Record<string, { label: string; ventes: number; revenu: number }> = {}

    if (period === "jour") {
      for (let h = 0; h < 24; h++) buckets[String(h)] = { label: `${String(h).padStart(2, "0")}h`, ventes: 0, revenu: 0 }
    } else {
      const cursor = new Date(chartFrom)
      while (cursor <= now || (period === "semaine" && cursor < new Date(weekStart.getTime() + 7 * 86400000))) {
        const key = cursor.toISOString().slice(0, 10)
        buckets[key] = { label: cursor.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" }), ventes: 0, revenu: 0 }
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const topMap: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const o of salesOrders.filter((o) => o.createdAt >= chartFrom)) {
      const bucketKey = period === "jour" ? String(new Date(o.createdAt).getHours()) : new Date(o.createdAt).toISOString().slice(0, 10)
      if (buckets[bucketKey]) {
        buckets[bucketKey].ventes += 1
        buckets[bucketKey].revenu += o.total
      }
      for (const item of o.items as { name?: string; quantity: number; total: number }[]) {
        const name = item.name ?? "Article"
        if (!topMap[name]) topMap[name] = { name, quantity: 0, revenue: 0 }
        topMap[name].quantity += item.quantity
        topMap[name].revenue += item.total
      }
    }

    const chartData = Object.keys(buckets).sort().map((k) => ({ ...buckets[k], key: k }))
    const topProducts = Object.values(topMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5)

    return NextResponse.json({
      pos: { id: comptoir.id, name: comptoir.name, code: comptoir.code, isActive: comptoir.isActive },
      stocks: stocks.map((r) => ({
        id: r.id,
        variantId: r.variantId,
        quantity: r.quantity,
        updatedAt: r.updatedAt,
        productName: r.variant.product.name,
        format: r.variant.format,
        price: r.variant.price,
        centralStock: r.variant.stock,
      })),
      variants: variants.map((v) => ({
        id: v.id,
        label: `${v.product.name} ${v.format}`,
        price: v.price,
        centralStock: v.stock,
      })),
      stats,
      chartData,
      topProducts,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        reference: m.reference,
        productName: m.variant?.product?.name ?? null,
        format: m.variant?.format ?? null,
        createdAt: m.createdAt,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (denied) return denied

  try {
    const body = await request.json()
    const variantId = String(body.variantId || "")
    const quantity = Number(body.quantity)
    const mode = body.mode === "SET" ? "SET" : "ADD"
    const reason = body.reason ? String(body.reason) : null

    if (!variantId) return NextResponse.json({ error: "Variante requise" }, { status: 400 })
    if (!Number.isFinite(quantity)) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 })

    const comptoir = await getOrCreateComptoir()
    const reference = `COMPTOIR-${Date.now()}`

    const result = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
      if (!variant) throw new Error("Variante introuvable")

      const current = await tx.pointOfSaleStock.findUnique({
        where: { pointOfSaleId_variantId: { pointOfSaleId: comptoir.id, variantId } },
      })

      if (mode === "SET") {
        const target = Math.max(0, Math.round(quantity))
        const delta = target - (current?.quantity ?? 0)

        await tx.pointOfSaleStock.upsert({
          where: { pointOfSaleId_variantId: { pointOfSaleId: comptoir.id, variantId } },
          update: { quantity: target },
          create: { pointOfSaleId: comptoir.id, variantId, quantity: target },
        })

        if (delta > 0) {
          // Le stock ajouté doit être couvert par un lot pour garder la traçabilité FIFO
          await tx.productionLot.create({
            data: {
              lotNumber: await generateLotNumberTx(tx),
              variantId,
              initialQuantity: delta,
              remainingQuantity: delta,
              notes: reason || "Ajustement comptoir (définition)",
            },
          })
          await tx.stockMovement.create({
            data: {
              variantId,
              pointOfSaleId: comptoir.id,
              type: "ADJUSTMENT_IN",
              quantity: delta,
              reason: reason || "Définition manuelle du stock comptoir",
              reference,
            },
          })
        } else if (delta < 0) {
          // Stock retiré : allouer les lots correspondants, bloquant si couverture insuffisante
          await allocateStockFIFOTx(tx, variantId, Math.abs(delta), "ADJUSTMENT_OUT", reference)
          await tx.stockMovement.create({
            data: {
              variantId,
              pointOfSaleId: comptoir.id,
              type: "ADJUSTMENT_OUT",
              quantity: Math.abs(delta),
              reason: reason || "Définition manuelle du stock comptoir",
              reference,
            },
          })
        }
        return { delta, comptoirQuantity: target }
      }

      // mode ADD : approvisionnement depuis le stock central
      const qty = Math.round(quantity)
      if (qty <= 0) throw new Error("Quantité doit être positive")
      if (variant.stock < qty) throw new Error(`Stock central insuffisant (disponible: ${variant.stock}, demandé: ${qty})`)

      await tx.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: qty } } })
      await tx.stockMovement.create({
        data: { variantId, type: "TRANSFER_OUT", quantity: qty, reason: reason || "Approvisionnement comptoir", reference },
      })

      await allocateStockFIFOTx(tx, variantId, qty, "TRANSFER", reference)

      const updated = await tx.pointOfSaleStock.upsert({
        where: { pointOfSaleId_variantId: { pointOfSaleId: comptoir.id, variantId } },
        update: { quantity: { increment: qty } },
        create: { pointOfSaleId: comptoir.id, variantId, quantity: qty },
      })

      await tx.stockMovement.create({
        data: { variantId, pointOfSaleId: comptoir.id, type: "IN", quantity: qty, reason: reason || "Approvisionnement comptoir", reference },
      })

      return { delta: qty, comptoirQuantity: updated.quantity }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error.message || "Erreur serveur"
    const status = message.includes("insuffisant") || message.includes("introuvable") || message.includes("invalide") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
