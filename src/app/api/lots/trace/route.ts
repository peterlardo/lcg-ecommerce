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

  const allocationIds = allocations.map((a) => a.id)
  const allocMovements = movements.filter(
    (m) => m.type === "TRANSFER_IN" || m.type === "TRANSFER_OUT"
  )

  const refs = allocations
    .filter((a) => a.reference)
    .map((a) => a.reference!)
  const uniqueRefs = [...new Set(refs)]

  const orders = uniqueRefs.length > 0
    ? await prisma.order.findMany({
        where: { orderNumber: { in: uniqueRefs } },
        select: { orderNumber: true, pointOfSaleId: true, pointOfSale: { select: { name: true, code: true } } },
      })
    : []

  const orderMap = new Map(orders.map((o) => [o.orderNumber, o]))

  const movementsByRef = new Map<string, typeof movements[0]>()
  for (const m of allocMovements) {
    if (m.reference && !movementsByRef.has(m.reference)) {
      movementsByRef.set(m.reference, m)
    }
  }

  const posCache = new Map<string, { name: string; code: string }>()

  const trace = allocations.map((a) => {
    let pointOfSale: { name: string; code: string } | null = null

    if (a.type === "SALE" && a.reference) {
      const order = orderMap.get(a.reference)
      if (order?.pointOfSale) {
        pointOfSale = order.pointOfSale
      }
    }

    if (a.type === "TRANSFER" && a.reference) {
      const mov = movementsByRef.get(a.reference)
      if (mov?.pointOfSaleId) {
        const cached = posCache.get(mov.pointOfSaleId)
        if (cached) {
          pointOfSale = cached
        }
      }
    }

    return {
      ...a,
      pointOfSale,
    }
  })

  const posIds = trace
    .filter((t) => t.type === "TRANSFER" && !t.pointOfSale)
    .map((t) => t.reference)
    .filter(Boolean)

  if (posIds.length > 0) {
    const allMovements = await prisma.stockMovement.findMany({
      where: {
        lotId: lot.id,
        type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
        pointOfSaleId: { not: null },
      },
      select: { reference: true, pointOfSaleId: true },
      distinct: ["reference"],
    })

    const refToPosId = new Map<string, string>()
    for (const m of allMovements) {
      if (m.reference && m.pointOfSaleId) refToPosId.set(m.reference, m.pointOfSaleId)
    }

    const remainingPosIds = [...new Set([...refToPosId.values()].filter((id) => !posCache.has(id)))]
    if (remainingPosIds.length > 0) {
      const posList = await prisma.pointOfSale.findMany({
        where: { id: { in: remainingPosIds } },
        select: { id: true, name: true, code: true },
      })
      for (const pos of posList) posCache.set(pos.id, { name: pos.name, code: pos.code })
    }

    for (const t of trace) {
      if (t.type === "TRANSFER" && !t.pointOfSale && t.reference) {
        const posId = refToPosId.get(t.reference)
        if (posId) t.pointOfSale = posCache.get(posId) ?? null
      }
    }
  }

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
