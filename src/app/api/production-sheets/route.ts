import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(undefined, [["production"], "view"])
  if (forbidden) return forbidden

  const prisma = await getPrisma()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where: { date?: { gte?: Date; lte?: Date } } = {}
  if (from && ISO_DATE.test(from)) {
    where.date = { ...(where.date ?? {}), gte: new Date(`${from}T00:00:00.000Z`) }
  }
  if (to && ISO_DATE.test(to)) {
    where.date = { ...(where.date ?? {}), lte: new Date(`${to}T23:59:59.999Z`) }
  }

  const sheets = await prisma.productionSheet.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true,
      date: true,
      sheetNumber: true,
      manager: true,
      status: true,
      _count: { select: { lines: true } },
    },
  })

  const withTotals = await Promise.all(
    sheets.map(async (s) => {
      const agg = await prisma.productionSheetLine.aggregate({
        where: { sheetId: s.id },
        _sum: { conformQty: true, rejectedQty: true },
      })
      return {
        id: s.id,
        date: s.date,
        sheetNumber: s.sheetNumber,
        manager: s.manager,
        status: s.status,
        lines: s._count.lines,
        conformTotal: agg._sum.conformQty ?? 0,
        rejectedTotal: agg._sum.rejectedQty ?? 0,
      }
    })
  )

  const rangeSheetIds = withTotals.map((s) => s.id)
  const lines = rangeSheetIds.length
    ? await prisma.productionSheetLine.findMany({
        where: { sheetId: { in: rangeSheetIds } },
        select: { sheetId: true, productName: true, producedQty: true, rejectedQty: true, conformQty: true },
      })
    : []
  const sheetDateById = new Map(sheets.map((s) => [s.id, s.date]))
  const synthesisMap = new Map<string, { date: string; product: string; lots: number; produced: number; rejected: number; conform: number }>()
  for (const l of lines) {
    const d = sheetDateById.get(l.sheetId)
    if (!d) continue
    const key = `${d.toISOString().slice(0, 10)}|${l.productName}`
    const entry = synthesisMap.get(key) ?? { date: d.toISOString().slice(0, 10), product: l.productName, lots: 0, produced: 0, rejected: 0, conform: 0 }
    entry.lots += 1
    entry.produced += l.producedQty
    entry.rejected += l.rejectedQty
    entry.conform += l.conformQty
    synthesisMap.set(key, entry)
  }

  return NextResponse.json({ sheets: withTotals, synthesis: Array.from(synthesisMap.values()) })
}
