import { NextResponse } from "next/server"
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-threshold"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess, getUserPointOfSaleIds, saleMovementsFilter, isComptable, b2bOrderScope, seesOnlyOwnOrders, seesAllOrders } from "@/lib/api-auth"
import { creanceLines, creanceSummary, seesAllB2b, b2bClientScope, type SessionUser } from "@/lib/commercial"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function getPeriodRange(period: string, now: Date, fromParam?: string | null, toParam?: string | null) {
  const today = startOfDay(now)
  if (period === "custom" && fromParam && toParam && DAY_RE.test(fromParam) && DAY_RE.test(toParam)) {
    const from = startOfDay(new Date(fromParam + "T00:00:00"))
    const to = startOfDay(new Date(toParam + "T00:00:00"))
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      const [a, b] = from <= to ? [from, to] : [to, from]
      const dayCount = Math.round((b.getTime() - a.getTime()) / 86400000) + 1
      const fmt = (d: Date) => d.toLocaleDateString("fr-FR")
      return { from: a, to: b, label: `Du ${fmt(a)} au ${fmt(b)}`, dayCount }
    }
  }
  switch (period) {
    case "day":
      return { from: today, to: today, label: "Journée", dayCount: 1 }
    case "week": {
      const from = new Date(today)
      from.setDate(today.getDate() - 6)
      return { from, to: today, label: "Semaine", dayCount: 7 }
    }
    case "quarter": {
      const from = new Date(today)
      from.setDate(today.getDate() - 89)
      return { from, to: today, label: "Trimestre", dayCount: 90 }
    }
    case "month":
    default: {
      const from = new Date(today)
      from.setDate(today.getDate() - 29)
      return { from, to: today, label: "Mois", dayCount: 30 }
    }
  }
}

const supplyTypes = ["IN", "PRODUCTION", "TRANSFER_IN", "RETURN"]

// Même règle que /api/reports : la vente entre dans le chiffre d'affaires dès l'encaissement
// ou, au plus tard, quand la commande part en livraison.
const REVENUE_STATUSES = ["OUT_FOR_DELIVERY", "DELIVERED"] as const
const isRevenue = (o: { status: string; paymentStatus?: string | null }) =>
  o.paymentStatus === "PAID" || (REVENUE_STATUSES as readonly string[]).includes(o.status)

const orderSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  total: true,
  source: true,
  pointOfSaleId: true,
  createdAt: true,
  items: { select: { productId: true, quantity: true, total: true, variant: { select: { product: { select: { name: true } } } } } },
} as const

const variantSelect = {
  id: true,
  format: true,
  price: true,
  product: { select: { name: true, category: { select: { name: true } } } },
} as const

const movementSelect = {
  id: true,
  type: true,
  quantity: true,
  reference: true,
  createdAt: true,
  variant: { select: { format: true, product: { select: { name: true } } } },
  pointOfSale: { select: { name: true } },
} as const

const reservationSelect = { id: true, status: true, createdAt: true } as const
const deliverySelect = { id: true, status: true, deliveredAt: true, createdAt: true } as const
const cashSessionSelect = { id: true, status: true, openingBalance: true, closingBalance: true } as const
const lotSelect = { id: true, initialQuantity: true, remainingQuantity: true, status: true } as const

/** Rapport GLOBAL : synthèse consolidée de tous les processus sur la période choisie. */
export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(
    ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMMERCIAL", "COMPTABLE", "OPERATEUR_ACCUEIL"],
    [["rapports"]],
  )
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month"
    const posParam = searchParams.get("pos") || "all"
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const session = await auth()
    const sessionUser = session?.user as SessionUser
    const role = sessionUser?.role
    const selfId = sessionUser?.id

    const prisma = getPrisma()
    const posFilter = await getUserPointOfSaleIds()
    const allowedPosIds = posFilter?.posIds ?? null

    const pointsOfSale = await prisma.pointOfSale.findMany({
      where: { isActive: true, ...(allowedPosIds !== null ? { id: { in: allowedPosIds } } : {}) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    })
    const selectedPos = pointsOfSale.find((p) => p.id === posParam) ?? null
    const posIds = selectedPos ? [selectedPos.id] : allowedPosIds
    const posClause = posIds !== null ? { pointOfSaleId: { in: posIds.length > 0 ? posIds : [] } } : null
    const stockPosIds = selectedPos ? [selectedPos.id] : pointsOfSale.map((p) => p.id)

    const ownScope = { OR: [{ NOT: { notes: { startsWith: "Vente comptoir" } } }, { userId: selfId }] }
    const b2bOnly = isComptable(role)
    const b2bScope = b2bOrderScope(role)

    const orderScope = b2bOnly
      ? (posClause ?? {})
      : seesAllOrders(role)
        ? (posClause ?? {})
        : seesOnlyOwnOrders(role)
          ? { OR: [{ userId: selfId }, { cashierId: selfId }] }
          : { AND: [...(posClause ? [posClause] : []), ownScope] }

    const movementFilter = {
      ...saleMovementsFilter(role, selfId),
      ...(selectedPos ? { pointOfSaleId: selectedPos.id } : {}),
    }

    const now = new Date()
    const { from: periodFrom, to: periodTo, label: periodLabel } = getPeriodRange(period, now, fromParam, toParam)
    const periodEnd = new Date(periodTo)
    periodEnd.setHours(23, 59, 59, 999)

    // Base commande commune : période + portée. Les commandes B2B comptables sont bornées au périmètre B2B.
    const orderWhere = b2bOnly
      ? { AND: [{ createdAt: { gte: periodFrom, lte: periodEnd } }, b2bScope] }
      : { AND: [{ createdAt: { gte: periodFrom, lte: periodEnd } }, orderScope] }

    const [ordersRaw, variantsRaw, movements, reservations, deliveries, cashSessions, lots] = await Promise.all([
      prisma.order.findMany({ where: orderWhere, select: orderSelect, orderBy: { createdAt: "asc" } }),
      prisma.productVariant.findMany({ select: variantSelect }),
      prisma.stockMovement.findMany({ where: { AND: [{ createdAt: { gte: periodFrom, lte: periodEnd } }, movementFilter] }, select: movementSelect, orderBy: { createdAt: "desc" } }),
      prisma.reservation.findMany({ where: { AND: [{ createdAt: { gte: periodFrom, lte: periodEnd } }, ...(posIds !== null ? [{ pointOfSaleId: { in: posIds.length > 0 ? posIds : [] } }] : [])] }, select: reservationSelect, orderBy: { createdAt: "desc" } }),
      prisma.delivery.findMany({ where: { AND: [{ createdAt: { gte: periodFrom, lte: periodEnd } }, ...(selectedPos ? [{ order: { pointOfSaleId: selectedPos.id } }] : [])] }, select: deliverySelect, orderBy: { createdAt: "desc" } }),
      prisma.cashSession.findMany({ where: { AND: [{ openedAt: { gte: periodFrom, lte: periodEnd } }, ...(posIds !== null ? [{ pointOfSaleId: { in: posIds.length > 0 ? posIds : [] } }] : [])] }, select: cashSessionSelect, orderBy: { openedAt: "desc" } }),
      prisma.productionLot.findMany({ where: { createdAt: { gte: periodFrom, lte: periodEnd } }, select: lotSelect, orderBy: { createdAt: "desc" } }),
    ])

    // Stock réel = stock physique du point de vente (somme PointOfSaleStock), pas ProductVariant.stock.
    const posStocks = await prisma.pointOfSaleStock.findMany({
      where: { pointOfSaleId: { in: pointsOfSale.map((p) => p.id) } },
      select: { variantId: true, pointOfSaleId: true, quantity: true },
    })
    const stockOf = (variantId: string, ids: string[]) =>
      posStocks.filter((s) => s.variantId === variantId && ids.includes(s.pointOfSaleId)).reduce((sum, s) => sum + s.quantity, 0)
    const variants = variantsRaw.map((v) => ({ ...v, stock: stockOf(v.id, stockPosIds) }))

    // --- Ventes / commandes ---
    const active = ordersRaw.filter((o) => o.status !== "CANCELLED")
    const revenueOrders = active.filter(isRevenue)
    const cancelledOrders = ordersRaw.length - active.length
    const revenue = revenueOrders.reduce((s, o) => s + o.total, 0)
    const items = revenueOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0)

    const paymentMap = new Map<string, { method: string; total: number; count: number }>()
    for (const o of revenueOrders) {
      const method = o.paymentMethod ?? "AUTRE"
      const cur = paymentMap.get(method) ?? { method, total: 0, count: 0 }
      cur.total += o.total
      cur.count += 1
      paymentMap.set(method, cur)
    }
    const paymentBreakdown = Array.from(paymentMap.values()).sort((a, b) => b.total - a.total)

    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const o of revenueOrders) {
      for (const item of o.items) {
        const name = item.variant?.product?.name ?? "Produit"
        const cur = productMap.get(item.productId) ?? { name, quantity: 0, revenue: 0 }
        cur.quantity += item.quantity
        cur.revenue += item.total
        productMap.set(item.productId, cur)
      }
    }
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10)

    const ordersByStatus = ["PENDING", "SENT_TO_CASHIER", "CONFIRMED", "PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]
      .map((status) => {
        const filtered = ordersRaw.filter((o) => o.status === status)
        return { status, count: filtered.length, total: filtered.reduce((s, o) => s + o.total, 0) }
      })
      .filter((s) => s.count > 0)

    const byPointOfSale = pointsOfSale.map((p) => {
      const posOrders = revenueOrders.filter((o) => o.pointOfSaleId === p.id)
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        revenue: posOrders.reduce((s, o) => s + o.total, 0),
        orders: posOrders.length,
        stockUnits: posStocks.filter((s) => s.pointOfSaleId === p.id).reduce((sum, s) => sum + s.quantity, 0),
      }
    })

    // --- Stocks ---
    const stockAlerts = variants
      .filter((v) => v.stock <= LOW_STOCK_THRESHOLD)
      .map((v) => ({ variantId: v.id, productName: v.product.name, format: v.format, stock: v.stock, categoryName: v.product.category?.name ?? "Sans categorie" }))
      .sort((a, b) => a.stock - b.stock)
    const stockByCategory = Array.from(
      variants.reduce((map, v) => {
        const cat = v.product.category?.name ?? "Sans categorie"
        const cur = map.get(cat) ?? { name: cat, totalStock: 0, variants: 0 }
        cur.totalStock += v.stock
        cur.variants++
        map.set(cat, cur)
        return map
      }, new Map<string, { name: string; totalStock: number; variants: number }>()),
    ).map(([, v]) => v)

    // --- Approvisionnements / production ---
    const countedMovements = selectedPos ? movements : movements.filter((m) => !(m.type === "PRODUCTION" && m.pointOfSale))
    const supplyMovements = countedMovements.filter((m) => supplyTypes.includes(m.type))
    const supplyByType = supplyTypes.map((type) => {
      const filtered = supplyMovements.filter((m) => m.type === type)
      return { type, quantity: filtered.reduce((s, m) => s + m.quantity, 0), count: filtered.length }
    })
    const supply = {
      inbound: movements.filter((m) => ["IN", "RETURN"].includes(m.type)).reduce((s, m) => s + m.quantity, 0),
      produced: countedMovements.filter((m) => m.type === "PRODUCTION").reduce((s, m) => s + m.quantity, 0),
      loss: movements.filter((m) => m.type === "LOSS").reduce((s, m) => s + m.quantity, 0),
      adjustOut: movements.filter((m) => m.type === "ADJUSTMENT_OUT").reduce((s, m) => s + m.quantity, 0),
    }
    const production = {
      totalProduced: supply.produced,
      productionCount: countedMovements.filter((m) => m.type === "PRODUCTION").length,
      totalIn: supply.inbound,
      totalLoss: supply.loss,
      totalAdjustOut: supply.adjustOut,
    }
    const lotsSummary = {
      totalLots: lots.length,
      activeLots: lots.filter((l) => l.status === "ACTIVE").length,
      totalRemaining: lots.reduce((s, l) => s + l.remainingQuantity, 0),
      totalProduced: lots.reduce((s, l) => s + l.initialQuantity, 0),
    }

    // --- Pré-commandes (réservations) ---
    const reservations_kpi = {
      total: reservations.length,
      pending: reservations.filter((r) => r.status === "PENDING").length,
      confirmed: reservations.filter((r) => r.status === "CONFIRMED").length,
      cancelled: reservations.filter((r) => r.status === "CANCELLED").length,
    }

    // --- Livraisons ---
    const deliveries_kpi = {
      total: deliveries.length,
      inProgress: deliveries.filter((d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)).length,
      delivered: deliveries.filter((d) => d.status === "DELIVERED").length,
    }

    // --- Caisse ---
    const closedSessions = cashSessions.filter((s) => s.closingBalance !== null)
    const cash = {
      sessions: cashSessions.length,
      open: cashSessions.filter((s) => s.status === "OPEN").length,
      closed: cashSessions.filter((s) => s.status === "CLOSED").length,
      totalOpening: cashSessions.reduce((s, c) => s + c.openingBalance, 0),
      totalClosing: closedSessions.reduce((s, c) => s + (c.closingBalance ?? 0), 0),
      totalGap:
        closedSessions.reduce((s, c) => s + (c.closingBalance ?? 0), 0) - closedSessions.reduce((s, c) => s + c.openingBalance, 0),
    }

    // --- Commercial B2B (documents + créances) ---
    const docScope = seesAllB2b(sessionUser) ? {} : { client: b2bClientScope(sessionUser) }
    const b2bGroups = await prisma.b2bDocument.groupBy({
      by: ["type"],
      where: { AND: [{ createdAt: { gte: periodFrom, lte: periodEnd } }, docScope] },
      _count: { _all: true },
      _sum: { total: true },
    })
    const documents = b2bGroups.map((g) => ({ type: g.type as string, count: g._count._all, total: g._sum.total ?? 0 }))
    const docCount = (type: string) => documents.find((d) => d.type === type)?.count ?? 0
    const creances = await creanceLines(sessionUser, now)
    const creanceSum = creanceSummary(creances, now)
    const b2b = {
      devis: docCount("DEVIS"),
      commandes: docCount("COMMANDE"),
      factures: docCount("FACTURE"),
      documents,
      creanceTotal: creanceSum.totalBalance,
      creanceOverdue: creanceSum.overdueBalance,
      debtorClients: creanceSum.debtorClients,
      openInvoices: creanceSum.openInvoices,
    }

    return NextResponse.json({
      period,
      periodLabel,
      from: periodFrom.toISOString(),
      to: periodEnd.toISOString(),
      generatedAt: now.toISOString(),
      pointsOfSale: pointsOfSale.map((p) => ({ id: p.id, name: p.name })),
      selectedPos: selectedPos ? { id: selectedPos.id, name: selectedPos.name } : null,
      kpi: {
        revenue,
        orders: active.length,
        paidOrders: revenueOrders.length,
        cancelledOrders,
        items,
        avgOrder: revenueOrders.length ? Math.round(revenue / revenueOrders.length) : 0,
      },
      paymentBreakdown,
      topProducts,
      ordersByStatus,
      byPointOfSale,
      stock: {
        units: variants.reduce((s, v) => s + v.stock, 0),
        variants: variants.length,
        lowStock: stockAlerts.filter((i) => i.stock > 0).length,
        outOfStock: stockAlerts.filter((i) => i.stock <= 0).length,
      },
      stockAlerts,
      stockByCategory,
      supply,
      supplyByType,
      production,
      lots: lotsSummary,
      reservations: reservations_kpi,
      deliveries: deliveries_kpi,
      cash,
      b2b,
    })
  } catch (error) {
    console.error("GET reports/global error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
