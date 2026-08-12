import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function dayKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const posFilter = await getUserPointOfSaleIds()
  const userPosIds = posFilter?.posIds ?? null

  try {
    const url = new URL(request.url)
    const pointOfSaleId = url.searchParams.get("pointOfSaleId")
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")

    const now = new Date()
    const to = toParam ? endOfDay(new Date(toParam)) : endOfDay(now)
    const from = fromParam ? startOfDay(new Date(fromParam)) : (() => {
      const d = new Date(to)
      d.setDate(d.getDate() - 29)
      return startOfDay(d)
    })()

    const effectivePosIds = pointOfSaleId
      ? [pointOfSaleId]
      : userPosIds !== null
        ? (userPosIds.length > 0 ? userPosIds : [])
        : null

    const posWhere = effectivePosIds !== null
      ? { pointOfSaleId: effectivePosIds.length > 0 ? { in: effectivePosIds } : { in: [] } }
      : {}

    const [sessions, orders] = await Promise.all([
      prisma.cashSession.findMany({
        where: {
          openedAt: { gte: from, lte: to },
          ...posWhere,
        },
        include: { pointOfSale: { select: { id: true, name: true, code: true } } },
        orderBy: { openedAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          status: { not: "CANCELLED" },
          ...posWhere,
        },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const dailyMap = new Map<string, {
      date: string
      label: string
      sessions: typeof sessions
      cashTotal: number
      mobileMoneyTotal: number
      cardTotal: number
      orderCount: number
      totalRevenue: number
    }>()

    for (const session of sessions) {
      const key = dayKey(session.openedAt)
      if (!dailyMap.has(key)) {
        const d = session.openedAt
        dailyMap.set(key, {
          date: key,
          label: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
          sessions: [],
          cashTotal: 0,
          mobileMoneyTotal: 0,
          cardTotal: 0,
          orderCount: 0,
          totalRevenue: 0,
        })
      }
      dailyMap.get(key)!.sessions.push(session)
    }

    for (const order of orders) {
      const key = dayKey(order.createdAt)
      if (!dailyMap.has(key)) {
        const d = order.createdAt
        dailyMap.set(key, {
          date: key,
          label: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
          sessions: [],
          cashTotal: 0,
          mobileMoneyTotal: 0,
          cardTotal: 0,
          orderCount: 0,
          totalRevenue: 0,
        })
      }
      const day = dailyMap.get(key)!
      day.orderCount++
      day.totalRevenue += order.total
      if (order.paymentMethod === "CASH_ON_DELIVERY" && order.paymentStatus === "PAID") day.cashTotal += order.total
      else if (order.paymentMethod === "MOBILE_MONEY") day.mobileMoneyTotal += order.total
      else if (order.paymentMethod === "CARD") day.cardTotal += order.total
    }

    const daily = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((day) => {
        const lastSession = day.sessions.find((s) => s.status === "CLOSED") ?? day.sessions[day.sessions.length - 1]
        const openingBalance = day.sessions.reduce((sum, s) => sum + s.openingBalance, 0)
        const closingBalance = lastSession?.closingBalance ?? null
        const expectedCash = openingBalance + day.cashTotal
        const gap = closingBalance !== null ? closingBalance - expectedCash : null

        return {
          date: day.date,
          label: day.label,
          pointOfSale: day.sessions[0]?.pointOfSale ?? null,
          sessions: day.sessions.map((s) => ({
            id: s.id,
            status: s.status,
            openingBalance: s.openingBalance,
            closingBalance: s.closingBalance,
            openedAt: s.openedAt.toISOString(),
            closedAt: s.closedAt?.toISOString() ?? null,
          })),
          openingBalance,
          closingBalance,
          cashTotal: day.cashTotal,
          mobileMoneyTotal: day.mobileMoneyTotal,
          cardTotal: day.cardTotal,
          totalRevenue: day.totalRevenue,
          orderCount: day.orderCount,
          expectedCash,
          gap,
        }
      })

    const totalCash = daily.reduce((sum, d) => sum + d.cashTotal, 0)
    const totalMobile = daily.reduce((sum, d) => sum + d.mobileMoneyTotal, 0)
    const totalCard = daily.reduce((sum, d) => sum + d.cardTotal, 0)
    const totalOrders = daily.reduce((sum, d) => sum + d.orderCount, 0)
    const totalRevenue = daily.reduce((sum, d) => sum + d.totalRevenue, 0)

    return NextResponse.json({
      summary: {
        totalDays: daily.length,
        totalOrders,
        totalRevenue,
        totalCash,
        totalMobile,
        totalCard,
      },
      daily,
    })
  } catch (error) {
    console.error("GET journal-caisse error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
