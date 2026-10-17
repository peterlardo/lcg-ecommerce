import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  requireManagementAccess,
  getUserPointOfSaleIds,
  seesOnlyOwnOrders,
  seesAllOrders,
  isComptable,
  b2bOrderScope,
} from "@/lib/api-auth"

const REVENUE_STATUSES = ["OUT_FOR_DELIVERY", "DELIVERED"]
const isRevenue = (o: { paymentStatus: string; status: string }) =>
  o.paymentStatus === "PAID" || REVENUE_STATUSES.includes(o.status)

const startOfDay = (d: Date) => {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

const label = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(
    ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMMERCIAL", "COMPTABLE", "OPERATEUR_ACCUEIL"],
    [["rapports"]],
  )
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const dateParam = (searchParams.get("date") || "").trim()
    let dayStart = startOfDay(new Date())
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = new Date(`${dateParam}T00:00:00`)
      if (!Number.isNaN(parsed.getTime())) dayStart = parsed
    }
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    const session = await auth()
    const role = session?.user?.role
    const selfId = session!.user!.id

    const posFilter = await getUserPointOfSaleIds()
    const allowedPosIds = posFilter?.posIds ?? null

    const pointsOfSale = await getPrisma().pointOfSale.findMany({
      where: {
        isActive: true,
        ...(allowedPosIds !== null ? { id: { in: allowedPosIds } } : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    })

    const posParam = searchParams.get("pos") || "all"
    const selectedPos = pointsOfSale.find((p) => p.id === posParam) ?? null
    const posIds = selectedPos ? [selectedPos.id] : allowedPosIds
    const posClause: Prisma.OrderWhereInput | null =
      posIds !== null
        ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } }
        : null

    const ownScope: Prisma.OrderWhereInput = {
      OR: [{ NOT: { notes: { startsWith: "Vente comptoir" } } }, { userId: selfId }],
    }
    const b2bOnly = isComptable(role)
    const b2bScope = b2bOrderScope(role)

    const orderPosFilter: Prisma.OrderWhereInput = b2bOnly
      ? (b2bScope as Prisma.OrderWhereInput)
      : seesAllOrders(role)
        ? (posClause ?? {})
        : seesOnlyOwnOrders(role)
          ? { OR: [{ userId: selfId }, { cashierId: selfId }] }
          : { AND: [...(posClause ? [posClause] : []), ownScope] }

    const orders = await getPrisma().order.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd }, ...orderPosFilter },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        customerName: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        source: true,
        pointOfSaleId: true,
        pointOfSale: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            quantity: true,
            total: true,
            product: { select: { name: true } },
            variant: { select: { format: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const cashSessions = await getPrisma().cashSession.findMany({
      where: {
        openedAt: { gte: dayStart, lte: dayEnd },
        ...(posIds !== null
          ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } }
          : {}),
      },
      select: {
        id: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        closingBalance: true,
        reportReference: true,
        pointOfSale: { select: { name: true } },
        openedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { openedAt: "asc" },
    })

    const active = orders.filter((o) => o.status !== "CANCELLED")
    const revenueOrders = active.filter(isRevenue)

    const itemsOf = (o: (typeof orders)[number]) =>
      o.items.reduce((s, it) => s + it.quantity, 0)

    const revenue = revenueOrders.reduce((s, o) => s + o.total, 0)
    const items = revenueOrders.reduce((s, o) => s + itemsOf(o), 0)

    const paymentMap = new Map<string, { method: string; count: number; amount: number }>()
    for (const o of revenueOrders) {
      const method = o.paymentMethod ?? "UNKNOWN"
      const entry = paymentMap.get(method) ?? { method, count: 0, amount: 0 }
      entry.count += 1
      entry.amount += o.total
      paymentMap.set(method, entry)
    }
    const paymentBreakdown = [...paymentMap.values()].sort((a, b) => b.amount - a.amount)

    const statusMap = new Map<string, { status: string; count: number; total: number }>()
    for (const o of active) {
      const entry = statusMap.get(o.status) ?? { status: o.status, count: 0, total: 0 }
      entry.count += 1
      entry.total += o.total
      statusMap.set(o.status, entry)
    }
    const ordersByStatus = [...statusMap.values()].sort((a, b) => b.count - a.count)

    const productMap = new Map<string, { name: string; quantity: number; amount: number }>()
    for (const o of revenueOrders) {
      for (const it of o.items) {
        const name = it.product?.name ?? "—"
        const entry = productMap.get(name) ?? { name, quantity: 0, amount: 0 }
        entry.quantity += it.quantity
        entry.amount += it.total
        productMap.set(name, entry)
      }
    }
    const topProducts = [...productMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    const posMap = new Map<string, { id: string; name: string; revenue: number; orders: number }>()
    for (const o of revenueOrders) {
      const id = o.pointOfSale?.id ?? "none"
      const name = o.pointOfSale?.name ?? "Non assigné"
      const entry = posMap.get(id) ?? { id, name, revenue: 0, orders: 0 }
      entry.revenue += o.total
      entry.orders += 1
      posMap.set(id, entry)
    }
    const byPointOfSale = [...posMap.values()].sort((a, b) => b.revenue - a.revenue)

    const cashierMap = new Map<string, { id: string; name: string; revenue: number; orders: number }>()
    for (const o of revenueOrders) {
      const id = o.cashier?.id ?? "none"
      const name = o.cashier?.name ?? o.cashier?.email ?? "Non assigné"
      const entry = cashierMap.get(id) ?? { id, name, revenue: 0, orders: 0 }
      entry.revenue += o.total
      entry.orders += 1
      cashierMap.set(id, entry)
    }
    const byCashier = [...cashierMap.values()].sort((a, b) => b.revenue - a.revenue)

    const cashSessionRows = cashSessions.map((c) => {
      const gap =
        c.closingBalance === null ? null : c.closingBalance - c.openingBalance
      return {
        id: c.id,
        pointOfSale: c.pointOfSale?.name ?? "—",
        cashier: c.openedBy?.name ?? c.openedBy?.email ?? null,
        status: c.status,
        openedAt: c.openedAt.toISOString(),
        closedAt: c.closedAt ? c.closedAt.toISOString() : null,
        openingBalance: c.openingBalance,
        closingBalance: c.closingBalance,
        gap,
        reportReference: c.reportReference,
      }
    })

    const cashSummary = {
      sessions: cashSessionRows.length,
      open: cashSessionRows.filter((c) => c.status === "OPEN").length,
      closed: cashSessionRows.filter((c) => c.status !== "OPEN").length,
      totalOpening: cashSessionRows.reduce((s, c) => s + c.openingBalance, 0),
      totalClosing: cashSessionRows.reduce((s, c) => s + (c.closingBalance ?? 0), 0),
      totalGap: cashSessionRows.reduce((s, c) => s + (c.gap ?? 0), 0),
    }

    const orderRows = active.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customerName,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      total: o.total,
      items: itemsOf(o),
      pointOfSale: o.pointOfSale?.name ?? null,
      cashier: o.cashier?.name ?? o.cashier?.email ?? null,
    }))

    return NextResponse.json({
      date: `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`,
      label: label(dayStart),
      generatedAt: new Date().toISOString(),
      pointsOfSale: pointsOfSale.map((p) => ({ id: p.id, name: p.name })),
      selectedPos: selectedPos ? { id: selectedPos.id, name: selectedPos.name } : null,
      summary: {
        revenue,
        orders: active.length,
        items,
        avgOrder: revenueOrders.length > 0 ? revenue / revenueOrders.length : 0,
        cancelled: orders.length - active.length,
        paidOrders: revenueOrders.length,
      },
      paymentBreakdown,
      ordersByStatus,
      topProducts,
      byPointOfSale,
      byCashier,
      cashSessions: cashSessionRows,
      cashSummary,
      orders: orderRows,
    })
  } catch (error) {
    console.error("Erreur API reports/journee:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
