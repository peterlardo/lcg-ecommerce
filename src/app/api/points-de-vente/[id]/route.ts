import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { ensurePointOfSaleStockRows } from "@/lib/stock-service"

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  const { id } = (await context.params) as { id: string }
  await ensurePointOfSaleStockRows([id])

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weeks: { start: Date; end: Date; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) - i * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 6)
    weeks.push({ start: weekStart, end: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59), label: `${weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} – ${weekEnd.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}` })
  }

  const [point, orders, reservations, stocks, movements, openCash, sales, todaySales, weeklySales, weeklyCashRaw] = await Promise.all([
    getPrisma().pointOfSale.findUnique({ where: { id }, include: { managerUser: { select: { id: true, name: true, email: true } }, cashSessions: { orderBy: { openedAt: "desc" }, take: 50 } } }),
    getPrisma().order.findMany({ where: { pointOfSaleId: id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, orderNumber: true, customerName: true, total: true, status: true, paymentStatus: true, createdAt: true } }),
    getPrisma().reservation.findMany({ where: { pointOfSaleId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    getPrisma().pointOfSaleStock.findMany({ where: { pointOfSaleId: id }, include: { variant: { include: { product: true } } }, orderBy: { updatedAt: "desc" } }),
    getPrisma().stockMovement.findMany({ where: { pointOfSaleId: id }, include: { variant: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    getPrisma().cashSession.findFirst({ where: { pointOfSaleId: id, status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    getPrisma().order.aggregate({ where: { pointOfSaleId: id, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: { id: true } }),
    getPrisma().order.aggregate({ where: { pointOfSaleId: id, status: { not: "CANCELLED" }, createdAt: { gte: startOfDay } }, _sum: { total: true }, _count: { id: true } }),
    getPrisma().$queryRaw<{ "week_start": Date; "revenue": bigint; "cnt": bigint }[]>`
      SELECT date_trunc('week', "createdAt") as "week_start", COALESCE(SUM("total"), 0) as "revenue", COUNT(*) as "cnt"
      FROM "Order"
      WHERE "pointOfSaleId" = ${id} AND "status" != 'CANCELLED' AND "createdAt" >= ${weeks[weeks.length - 1].start}
      GROUP BY date_trunc('week', "createdAt")
      ORDER BY "week_start" DESC
    `,
    getPrisma().$queryRaw<{ "week_start": Date; "sessions": bigint; "total_opened": bigint; "total_closed": bigint }[]>`
      SELECT date_trunc('week', "openedAt") as "week_start", COUNT(*) as "sessions", COALESCE(SUM("openingBalance"), 0) as "total_opened", COALESCE(SUM(COALESCE("closingBalance", 0)), 0) as "total_closed"
      FROM "CashSession"
      WHERE "pointOfSaleId" = ${id} AND "openedAt" >= ${weeks[weeks.length - 1].start}
      GROUP BY date_trunc('week', "openedAt")
      ORDER BY "week_start" DESC
    `,
  ])

  if (!point) return NextResponse.json({ error: "Point de vente introuvable" }, { status: 404 })

  const weeklySalesMap = new Map(weeklySales.map((w) => [new Date(w.week_start).toISOString().slice(0, 10), { revenue: Number(w.revenue), orders: Number(w.cnt) }]))
  const weeklySalesMapped = weeks.map((week) => {
    const key = week.start.toISOString().slice(0, 10)
    const data = weeklySalesMap.get(key)
    return { label: week.label, revenue: data?.revenue ?? 0, orders: data?.orders ?? 0 }
  })

  const weeklyCashMap = new Map(weeklyCashRaw.map((w) => [new Date(w.week_start).toISOString().slice(0, 10), { sessions: Number(w.sessions), totalOpened: Number(w.total_opened), totalClosed: Number(w.total_closed) }]))
  const weeklyCash = weeks.map((week) => {
    const key = week.start.toISOString().slice(0, 10)
    const data = weeklyCashMap.get(key)
    return { label: week.label, sessions: data?.sessions ?? 0, totalOpened: data?.totalOpened ?? 0, totalClosed: data?.totalClosed ?? 0 }
  })

  return NextResponse.json({
    point, orders, reservations, stocks, movements, openCash,
    summary: { revenue: sales._sum.total ?? 0, orders: sales._count.id },
    today: { revenue: todaySales._sum.total ?? 0, orders: todaySales._count.id },
    weeklyHistory: weeklySalesMapped,
    cashSessions: point?.cashSessions ?? [],
    weeklyCash,
  })
}

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const { id } = (await context.params) as { id: string }
    const body = await request.json()
    const point = await getPrisma().pointOfSale.update({ where: { id }, data: { name: body.name?.trim(), code: body.code?.trim().toUpperCase(), address: body.address?.trim(), city: body.city?.trim(), phone: body.phone?.trim() || null, managerName: body.managerName?.trim() || null, managerUserId: body.managerUserId || null, isActive: body.isActive === undefined ? undefined : Boolean(body.isActive) } })
    return NextResponse.json(point)
  } catch (error) {
    console.error("Point of sale update error:", error)
    return NextResponse.json({ error: "Impossible de modifier le point de vente" }, { status: 400 })
  }
}
