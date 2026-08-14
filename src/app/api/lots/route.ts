import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { generateLotNumber } from "@/lib/lot-utils"

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const url = new URL(req.url)
  const variantId = url.searchParams.get("variantId")
  const status = url.searchParams.get("status")
  const withAllocations = url.searchParams.get("allocations") === "1"

  const where: any = {}
  if (variantId) where.variantId = variantId
  if (status) where.status = status

  const lots = await prisma.productionLot.findMany({
    where,
    include: {
      variant: { include: { product: { include: { category: true } } } },
      createdBy: { select: { name: true, email: true } },
      ...(withAllocations ? { allocations: { orderBy: { createdAt: "desc" }, take: 20 } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const summary = await prisma.productionLot.aggregate({
    where: { status: "ACTIVE" },
    _sum: { remainingQuantity: true },
    _count: true,
  })

  let enrichedLots = lots

  if (withAllocations) {
    const lotIds = lots.filter((l: any) => l.allocations?.length > 0).map((l: any) => l.id)
    if (lotIds.length > 0) {
      const movements = await prisma.stockMovement.findMany({
        where: { lotId: { in: lotIds }, pointOfSaleId: { not: null } },
        select: { lotId: true, reference: true, pointOfSaleId: true },
      })

      const posIds = [...new Set(movements.map((m) => m.pointOfSaleId!).filter(Boolean))]
      const posList = posIds.length > 0
        ? await prisma.pointOfSale.findMany({ where: { id: { in: posIds } }, select: { id: true, name: true, code: true } })
        : []
      const posMap = new Map(posList.map((p) => [p.id, { name: p.name, code: p.code }]))

      const refToPos = new Map<string, { name: string; code: string }>()
      for (const m of movements) {
        if (m.reference && m.pointOfSaleId) {
          const pos = posMap.get(m.pointOfSaleId)
          if (pos && !refToPos.has(`${m.lotId}:${m.reference}`)) {
            refToPos.set(`${m.lotId}:${m.reference}`, pos)
          }
        }
      }

      const orderRefs = new Set<string>()
      for (const lot of lots) {
        for (const a of (lot as any).allocations ?? []) {
          if (a.type === "SALE" && a.reference) orderRefs.add(a.reference)
        }
      }

      const orders = orderRefs.size > 0
        ? await prisma.order.findMany({
            where: { orderNumber: { in: [...orderRefs] } },
            select: { orderNumber: true, pointOfSale: { select: { name: true, code: true } } },
          })
        : []
      const orderPosMap = new Map(orders.filter((o) => o.pointOfSale).map((o) => [o.orderNumber, o.pointOfSale!]))

      enrichedLots = lots.map((lot: any) => ({
        ...lot,
        allocations: (lot.allocations ?? []).map((a: any) => {
          let pointOfSale: { name: string; code: string } | null = null
          if (a.type === "SALE" && a.reference) {
            pointOfSale = orderPosMap.get(a.reference) ?? null
          } else if (a.type === "TRANSFER" && a.reference) {
            pointOfSale = refToPos.get(`${lot.id}:${a.reference}`) ?? null
          }
          return { ...a, pointOfSale }
        }),
      }))
    }
  }

  return NextResponse.json({ lots: enrichedLots, summary })
}

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const body = await req.json()
    const { variantId, quantity, productionDate, expiryDate, notes } = body

    if (!variantId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 })
    }

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
    if (!variant) {
      return NextResponse.json({ error: "Variante introuvable" }, { status: 404 })
    }

    const lotNumber = await generateLotNumber()

    const lot = await prisma.$transaction(async (tx) => {
      const newLot = await tx.productionLot.create({
        data: {
          lotNumber,
          variantId,
          initialQuantity: quantity,
          remainingQuantity: quantity,
          productionDate: productionDate ? new Date(productionDate) : new Date(),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          notes: notes || null,
        },
      })

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } },
      })

      await tx.stockMovement.create({
        data: {
          variantId,
          type: "PRODUCTION",
          quantity,
          reason: notes || "Production",
          reference: lotNumber,
          lotId: newLot.id,
        },
      })

      return newLot
    })

    return NextResponse.json({ lot }, { status: 201 })
  } catch (error: any) {
    console.error("POST lots error:", error)
    return NextResponse.json({ error: error.message ?? "Erreur serveur" }, { status: 500 })
  }
}
