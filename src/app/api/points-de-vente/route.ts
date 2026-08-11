import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

async function getNextCode() {
  const existing = await prisma.pointOfSale.findMany({ select: { code: true } })
  const max = existing.reduce((current, item) => {
    const match = item.code.match(/^PDV-(\d+)$/)
    return Math.max(current, match ? Number(match[1]) : 0)
  }, 0)
  return `PDV-${String(max + 1).padStart(3, "0")}`
}
export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  const points = await prisma.pointOfSale.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      managerUser: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { orders: true, reservations: true, stocks: true } },
      cashSessions: { where: { status: "OPEN" }, orderBy: { openedAt: "desc" }, take: 1 },
    },
  })
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"] }, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })
  const variants = await prisma.productVariant.findMany({ include: { product: { select: { name: true } } }, orderBy: { product: { name: "asc" } } })
  const stats = await Promise.all(points.map(async (point) => {
    const result = await prisma.order.aggregate({ where: { pointOfSaleId: point.id, status: { not: "CANCELLED" } }, _sum: { total: true } })
    return { pointOfSaleId: point.id, revenue: result._sum.total ?? 0 }
  }))
  return NextResponse.json({ points, users, variants, stats, nextCode: await getNextCode() })
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const body = await request.json()
    const name = String(body.name || "").trim()
    const code = String(body.code || "").trim().toUpperCase() || await getNextCode()
    const address = String(body.address || "").trim()
    const city = String(body.city || "").trim()
    if (!name || !code || !address || !city) return NextResponse.json({ error: "Nom, code, adresse et ville sont requis" }, { status: 400 })
    const point = await prisma.pointOfSale.create({ data: { name, code, address, city, phone: body.phone ? String(body.phone).trim() : null, managerName: body.managerName ? String(body.managerName).trim() : null, managerUserId: body.managerUserId || null } })
    return NextResponse.json(point, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 })
    console.error("Point of sale create error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne du serveur" }, { status: 500 })
  }
}


