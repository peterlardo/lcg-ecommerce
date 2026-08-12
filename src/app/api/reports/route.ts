import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function dayKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

function shortDay(date: Date) {
  return date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")
}

function daysArray(from: Date, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    return d
  })
}

function getPeriodRange(period: string, now: Date) {
  const today = startOfDay(now)
  switch (period) {
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

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month"

    const posFilter = await getUserPointOfSaleIds()
    const posIds = posFilter?.posIds ?? null

    const now = new Date()
    const todayStart = startOfDay(now)
    const { from: periodFrom, dayCount } = getPeriodRange(period, now)

    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(todayStart.getDate() - 6)

    const orderPosFilter = posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : {}

    const [recentOrders, allOrders, variants, movements, reservations, deliveries, cashSessions, lots] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, ...orderPosFilter },
        include: { items: { include: { variant: { include: { product: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: periodFrom }, ...orderPosFilter },
        include: { items: { include: { variant: { include: { product: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.productVariant.findMany({ include: { product: { include: { category: true } } } }),
      prisma.stockMovement.findMany({
        where: { createdAt: { gte: periodFrom } },
        include: { variant: { include: { product: true } }, pointOfSale: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reservation.findMany({ where: posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : {}, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.delivery.findMany({ include: { order: true }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.cashSession.findMany({
        where: { openedAt: { gte: periodFrom }, ...(posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : {}) },
        include: { pointOfSale: { select: { name: true, code: true } } },
        orderBy: { openedAt: "desc" },
      }),
      prisma.productionLot.findMany({
        include: {
          variant: { include: { product: { include: { category: true } } } },
          _count: { select: { allocations: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ])

    const activeRecent = recentOrders.filter((o) => o.status !== "CANCELLED")
    const activeRecentDelivered = activeRecent.filter((o) => ["OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status))
    const activeAll = allOrders.filter((o) => o.status !== "CANCELLED")
    const activeAllDelivered = activeAll.filter((o) => ["OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status))
    const todayOrders = activeRecent.filter((o) => o.createdAt >= todayStart)
    const todayOrdersDelivered = activeRecentDelivered.filter((o) => o.createdAt >= todayStart)

    const revenue7 = activeRecentDelivered.reduce((s, o) => s + o.total, 0)
    const revenue30 = activeAllDelivered.reduce((s, o) => s + o.total, 0)
    const todayRevenue = todayOrdersDelivered.reduce((s, o) => s + o.total, 0)
    const cashExpected = todayOrders.filter((o) => o.paymentMethod === "CASH_ON_DELIVERY" && o.paymentStatus === "PAID").reduce((s, o) => s + o.total, 0)

    const daily7 = daysArray(sevenDaysAgo, 7).map((date) => {
      const key = dayKey(date)
      const dayOrders = activeRecentDelivered.filter((o) => dayKey(o.createdAt) === key)
      return { name: shortDay(date), date: key, revenu: dayOrders.reduce((s, o) => s + o.total, 0), commandes: dayOrders.length }
    })

    const daily30 = daysArray(periodFrom, dayCount).map((date) => {
      const key = dayKey(date)
      const dayOrders = activeAllDelivered.filter((o) => dayKey(o.createdAt) === key)
      return { name: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), date: key, revenu: dayOrders.reduce((s, o) => s + o.total, 0), commandes: dayOrders.length }
    })

    const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const order of activeRecentDelivered) {
      for (const item of order.items) {
        const name = item.variant?.product?.name ?? "Produit"
        const cur = productTotals.get(item.productId) ?? { name, quantity: 0, revenue: 0 }
        cur.quantity += item.quantity
        cur.revenue += item.total
        productTotals.set(item.productId, cur)
      }
    }
    const topProducts = Array.from(productTotals.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10)

    const paymentBreakdown = ["CASH_ON_DELIVERY", "MOBILE_MONEY", "CARD"].map((method) => ({
      method,
      total: todayOrdersDelivered.filter((o) => o.paymentMethod === method).reduce((s, o) => s + o.total, 0),
      count: todayOrdersDelivered.filter((o) => o.paymentMethod === method).length,
    }))

    const paymentBreakdown30 = ["CASH_ON_DELIVERY", "MOBILE_MONEY", "CARD"].map((method) => ({
      method,
      total: activeAllDelivered.filter((o) => o.paymentMethod === method).reduce((s, o) => s + o.total, 0),
      count: activeAllDelivered.filter((o) => o.paymentMethod === method).length,
    }))

    const stockAlerts = variants.filter((v) => v.stock <= 20).map((v) => ({
      variantId: v.id, productName: v.product.name, format: v.format, stock: v.stock, categoryName: v.product.category?.name ?? "Sans categorie",
    })).sort((a, b) => a.stock - b.stock)

    const stockByCategory = Array.from(
      variants.reduce((map, v) => {
        const cat = v.product.category?.name ?? "Sans categorie"
        const cur = map.get(cat) ?? { name: cat, totalStock: 0, variants: 0 }
        cur.totalStock += v.stock
        cur.variants++
        map.set(cat, cur)
        return map
      }, new Map<string, { name: string; totalStock: number; variants: number }>())
    ).map(([, v]) => v)

    const allStockVariants = variants.map((v) => ({
      productName: v.product.name, format: v.format, stock: v.stock, price: v.price, categoryName: v.product.category?.name ?? "Sans categorie",
    })).sort((a, b) => a.stock - b.stock)

    const salesByDay = daily30.map((d) => ({ ...d, ventes: activeAllDelivered.filter((o) => dayKey(o.createdAt) === d.date).reduce((s, o) => s + o.total, 0) }))

    const supplyMovements = movements.filter((m) => supplyTypes.includes(m.type))
    const supplyByDay = daysArray(periodFrom, dayCount).map((date) => {
      const key = dayKey(date)
      const dayM = supplyMovements.filter((m) => dayKey(m.createdAt) === key)
      return { name: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), date: key, quantity: dayM.reduce((s, m) => s + m.quantity, 0) }
    })

    const supplyByType = supplyTypes.map((type) => {
      const filtered = supplyMovements.filter((m) => m.type === type)
      return { type, quantity: filtered.reduce((s, m) => s + m.quantity, 0), count: filtered.length }
    })

    const ordersByStatus = ["PENDING", "CONFIRMED", "PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].map((status) => {
      const filtered = activeAll.filter((o) => o.status === status)
      return { status, count: filtered.length, total: filtered.reduce((s, o) => s + o.total, 0) }
    }).filter((s) => s.count > 0)

    const ordersByDay = daysArray(periodFrom, dayCount).map((date) => {
      const key = dayKey(date)
      const dayOrders = activeAllDelivered.filter((o) => dayKey(o.createdAt) === key)
      return { name: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), date: key, commandes: dayOrders.length, revenu: dayOrders.reduce((s, o) => s + o.total, 0) }
    })

    const reservationsByStatus = {
      pending: reservations.filter((r) => r.status === "PENDING").length,
      confirmed: reservations.filter((r) => r.status === "CONFIRMED").length,
      cancelled: reservations.filter((r) => r.status === "CANCELLED").length,
      total: reservations.length,
    }

    const reservationsByDay = daysArray(periodFrom, dayCount).map((date) => {
      const key = dayKey(date)
      return { name: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), date: key, reservations: reservations.filter((r) => dayKey(r.createdAt) === key).length }
    })

    const productionByDay = daysArray(periodFrom, dayCount).map((date) => {
      const key = dayKey(date)
      return { name: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), date: key, quantity: movements.filter((m) => m.type === "PRODUCTION" && dayKey(m.createdAt) === key).reduce((s, m) => s + m.quantity, 0) }
    })

    const productionSummary = {
      totalProduced: movements.filter((m) => m.type === "PRODUCTION").reduce((s, m) => s + m.quantity, 0),
      productionCount: movements.filter((m) => m.type === "PRODUCTION").length,
      totalIn: movements.filter((m) => ["IN", "RETURN"].includes(m.type)).reduce((s, m) => s + m.quantity, 0),
      totalLoss: movements.filter((m) => m.type === "LOSS").reduce((s, m) => s + m.quantity, 0),
      totalAdjustOut: movements.filter((m) => m.type === "ADJUSTMENT_OUT").reduce((s, m) => s + m.quantity, 0),
    }

    const cashSessionsByDay = daysArray(periodFrom, dayCount).map((date) => {
      const key = dayKey(date)
      const daySessions = cashSessions.filter((s) => dayKey(s.openedAt) === key)
      const totalOpening = daySessions.reduce((sum, s) => sum + s.openingBalance, 0)
      const closedSessions = daySessions.filter((s) => s.closingBalance !== null)
      const totalClosing = closedSessions.reduce((sum, s) => sum + (s.closingBalance ?? 0), 0)
      return { name: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), date: key, sessions: daySessions.length, openingTotal: totalOpening, closingTotal: closedSessions.length > 0 ? totalClosing : null, gap: closedSessions.length > 0 ? totalClosing - totalOpening : null }
    })

    const cashSessionsSummary = {
      totalSessions: cashSessions.length,
      openSessions: cashSessions.filter((s) => s.status === "OPEN").length,
      closedSessions: cashSessions.filter((s) => s.status === "CLOSED").length,
      totalOpening: cashSessions.reduce((sum, s) => sum + s.openingBalance, 0),
      totalClosing: cashSessions.filter((s) => s.closingBalance !== null).reduce((sum, s) => sum + (s.closingBalance ?? 0), 0),
    }

    const recentMovements = movements.slice(0, 50).map((m) => ({
      id: m.id, type: m.type, quantity: m.quantity, reason: m.reason ?? "", reference: m.reference ?? "",
      productName: m.variant.product.name, format: m.variant.format, pointOfSale: m.pointOfSale?.name ?? null, createdAt: m.createdAt.toISOString(),
    }))

    return NextResponse.json({
      period,
      periodLabel: getPeriodRange(period, now).label,
      summary: {
        revenue7, revenue30, todayRevenue, orders7: activeRecent.length, orders30: activeAll.length, todayOrders: todayOrders.length,
        avgOrder: activeAllDelivered.length ? Math.round(revenue30 / activeAllDelivered.length) : 0, topProduct: topProducts[0]?.name ?? "-",
        stockUnits: variants.reduce((s, v) => s + v.stock, 0), totalVariants: variants.length,
        lowStock: stockAlerts.filter((i) => i.stock > 0).length, outOfStock: stockAlerts.filter((i) => i.stock <= 0).length,
        pendingReservations: reservations.filter((r) => r.status === "PENDING").length,
        totalReservations: reservations.length,
        deliveriesInProgress: deliveries.filter((d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)).length,
        totalDeliveries: deliveries.length,
        deliveredToday: deliveries.filter((d) => d.status === "DELIVERED" && d.deliveredAt && d.deliveredAt >= todayStart).length,
        cashExpected, cashGap: 0,
        totalProduced: productionSummary.totalProduced, totalLoss: productionSummary.totalLoss,
      },
      daily7, daily30, salesByDay, topProducts, paymentBreakdown, paymentBreakdown30,
      stockAlerts, stockByCategory, allStockVariants,
      supplyByDay, supplyByType, supplyMovements: recentMovements.filter((m) => supplyTypes.includes(m.type)),
      ordersByStatus, ordersByDay,
      reservationsByStatus, reservationsByDay, reservations: reservations.map((r) => ({ id: r.id, client: r.client, type: r.type, date: r.date, heure: r.heure, status: r.status })),
      productionByDay, productionSummary, productionMovements: recentMovements.filter((m) => m.type === "PRODUCTION"),
      lots: lots.map((l) => ({
        id: l.id, lotNumber: l.lotNumber, initialQuantity: l.initialQuantity, remainingQuantity: l.remainingQuantity,
        productionDate: l.productionDate.toISOString(), expiryDate: l.expiryDate?.toISOString() ?? null,
        status: l.status, notes: l.notes, createdAt: l.createdAt.toISOString(),
        productName: l.variant.product.name, format: l.variant.format,
        categoryName: l.variant.product.category?.name ?? null,
        allocationCount: l._count.allocations,
      })),
      lotSummary: {
        totalLots: lots.length,
        activeLots: lots.filter((l) => l.status === "ACTIVE").length,
        totalRemaining: lots.reduce((s, l) => s + l.remainingQuantity, 0),
        totalProduced: lots.reduce((s, l) => s + l.initialQuantity, 0),
      },
      cashSessionsByDay, cashSessionsSummary,
      recentMovements,
      deliveries: deliveries.map((d) => ({ id: d.id, orderNumber: d.order?.orderNumber ?? "", customer: d.order?.customerName ?? "Client", status: d.status, address: d.address })),
    })
  } catch (error) {
    console.error("GET reports error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
