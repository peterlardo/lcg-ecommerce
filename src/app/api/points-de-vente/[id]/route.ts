import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  const { id } = (await context.params) as { id: string }
  const [point, orders, reservations, stocks, movements, openCash, sales] = await Promise.all([
    prisma.pointOfSale.findUnique({ where: { id }, include: { managerUser: { select: { id: true, name: true, email: true } } } }),
    prisma.order.findMany({ where: { pointOfSaleId: id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, orderNumber: true, customerName: true, total: true, status: true, paymentStatus: true, createdAt: true } }),
    prisma.reservation.findMany({ where: { pointOfSaleId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.pointOfSaleStock.findMany({ where: { pointOfSaleId: id }, include: { variant: { include: { product: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.stockMovement.findMany({ where: { pointOfSaleId: id }, include: { variant: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.cashSession.findFirst({ where: { pointOfSaleId: id, status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    prisma.order.aggregate({ where: { pointOfSaleId: id, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: { id: true } }),
  ])
  if (!point) return NextResponse.json({ error: "Point de vente introuvable" }, { status: 404 })
  return NextResponse.json({ point, orders, reservations, stocks, movements, openCash, summary: { revenue: sales._sum.total ?? 0, orders: sales._count.id } })
}

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const { id } = (await context.params) as { id: string }
    const body = await request.json()
    const point = await prisma.pointOfSale.update({ where: { id }, data: { name: body.name?.trim(), code: body.code?.trim().toUpperCase(), address: body.address?.trim(), city: body.city?.trim(), phone: body.phone?.trim() || null, managerName: body.managerName?.trim() || null, managerUserId: body.managerUserId || null, isActive: body.isActive === undefined ? undefined : Boolean(body.isActive) } })
    return NextResponse.json(point)
  } catch (error) {
    console.error("Point of sale update error:", error)
    return NextResponse.json({ error: "Impossible de modifier le point de vente" }, { status: 400 })
  }
}
