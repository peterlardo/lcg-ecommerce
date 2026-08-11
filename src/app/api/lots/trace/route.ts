import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const url = new URL(req.url)
  const lotNumber = url.searchParams.get("lotNumber")
  const lotId = url.searchParams.get("lotId")

  if (!lotNumber && !lotId) {
    return NextResponse.json({ error: "lotNumber ou lotId requis" }, { status: 400 })
  }

  const lot = await prisma.productionLot.findFirst({
    where: lotId ? { id: lotId } : { lotNumber: lotNumber! },
    include: {
      variant: { include: { product: { include: { category: true } } } },
      createdBy: { select: { name: true, email: true } },
    },
  })

  if (!lot) {
    return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  }

  const allocations = await prisma.lotAllocation.findMany({
    where: { lotId: lot.id },
    orderBy: { createdAt: "desc" },
  })

  const movements = await prisma.stockMovement.findMany({
    where: { lotId: lot.id },
    orderBy: { createdAt: "desc" },
  })

  const orderIds = allocations
    .filter((a) => a.type === "SALE" && a.reference)
    .map((a) => a.reference!)

  const orders = orderIds.length > 0
    ? await prisma.order.findMany({
        where: { orderNumber: { in: orderIds } },
        include: { items: true },
      })
    : []

  const orderMap = new Map(orders.map((o) => [o.orderNumber, o]))

  const trace = allocations.map((a) => ({
    ...a,
    order: a.reference ? orderMap.get(a.reference) ?? null : null,
  }))

  return NextResponse.json({
    lot,
    allocations: trace,
    movements,
    summary: {
      initialQuantity: lot.initialQuantity,
      remainingQuantity: lot.remainingQuantity,
      consumedQuantity: lot.initialQuantity - lot.remainingQuantity,
      totalAllocations: allocations.length,
      saleAllocations: allocations.filter((a) => a.type === "SALE").length,
    },
  })
}
