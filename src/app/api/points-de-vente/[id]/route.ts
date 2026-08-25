import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  const { id } = (await context.params) as { id: string }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weeks: { start: Date; end: Date; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) - i * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 6)
    weeks.push({ start: weekStart, end: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59), label: `${weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} – ${weekEnd.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}` })
  }

  const [point, orders, reservations, stocks, movements, openCash, sales, todaySales, weeklySales] = await Promise.all([
    getPrisma().pointOfSale.findUnique({ where: { id }, include: { managerUser: { select: { id: true, name: true, email: true } }, cashSessions: { orderBy: { openedAt: "desc" }, take: 50 } } }),
    getPrisma().order.findMany({ where: { pointOfSaleId: id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, orderNumber: true, customerName: true, total: true, status: true, paymentStatus: true, createdAt: true } }),
    getPrisma().reservation.findMany({ where: { pointOfSaleId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    getPrisma().pointOfSaleStock.findMany({ where: { pointOfSaleId: id }, include: { variant: { include: { product: true } } }, orderBy: { updatedAt: "desc" } }),
    getPrisma().stockMovement.findMany({ where: { pointOfSaleId: id }, include: { variant: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    getPrisma().cashSession.findFirst({ where: { pointOfSaleId: id, status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    getPrisma().order.aggregate({ where: { pointOfSaleId: id, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: { id: true } }),
    getPrisma().order.aggregate({ where: { pointOfSaleId: id, status: { not: "CANCELLED" }, createdAt: { gte: startOfDay } }, _sum: { total: true }, _count: { id: true } }),
    Promise.all(weeks.map(async (week) => {
      const result = await getPrisma().order.aggregate({
        where: { pointOfSaleId: id, status: { not: "CANCELLED" }, createdAt: { gte: week.start, lte: week.end } },
        _sum: { total: true },
        _count: { id: true },
      })
      return { label: week.label, revenue: result._sum.total ?? 0, orders: result._count.id }
    })),
  ])

  if (!point) return NextResponse.json({ error: "Point de vente introuvable" }, { status: 404 })

  const weeklyCash = await Promise.all(weeks.map(async (week) => {
    const sessions = await getPrisma().cashSession.findMany({
      where: { pointOfSaleId: id, openedAt: { gte: week.start, lte: week.end } },
      orderBy: { openedAt: "asc" },
    })
    const totalOpened = sessions.reduce((s, c) => s + c.openingBalance, 0)
    const totalClosed = sessions.filter((c) => c.closingBalance !== null).reduce((s, c) => s + (c.closingBalance ?? 0), 0)
    return { label: week.label, sessions: sessions.length, totalOpened, totalClosed }
  }))

  return NextResponse.json({
    point, orders, reservations, stocks, movements, openCash,
    summary: { revenue: sales._sum.total ?? 0, orders: sales._count.id },
    today: { revenue: todaySales._sum.total ?? 0, orders: todaySales._count.id },
    weeklyHistory: weeklySales,
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
