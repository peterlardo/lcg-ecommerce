import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const { id } = await params
  const lot = await getPrisma().productionLot.findUnique({
    where: { id },
    include: {
      variant: { include: { product: { include: { category: true } } } },
      createdBy: { select: { name: true, email: true } },
      allocations: { orderBy: { createdAt: "desc" } },
      stockMovements: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!lot) {
    return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  }

  const movements = await getPrisma().stockMovement.findMany({
    where: { lotId: id, pointOfSaleId: { not: null } },
    select: { reference: true, pointOfSaleId: true },
  })

  const posIds = [...new Set(movements.map((m) => m.pointOfSaleId!).filter(Boolean))]
  const posList = posIds.length > 0
    ? await getPrisma().pointOfSale.findMany({ where: { id: { in: posIds } }, select: { id: true, name: true, code: true } })
    : []
  const posMap = new Map(posList.map((p) => [p.id, { name: p.name, code: p.code }]))

  const refToPos = new Map<string, { name: string; code: string }>()
  for (const m of movements) {
    if (m.reference && m.pointOfSaleId) {
      const pos = posMap.get(m.pointOfSaleId)
      if (pos && !refToPos.has(m.reference)) refToPos.set(m.reference, pos)
    }
  }

  const orderRefs = lot.allocations
    .filter((a) => a.type === "SALE" && a.reference)
    .map((a) => a.reference!)
  const orders = orderRefs.length > 0
    ? await getPrisma().order.findMany({
        where: { orderNumber: { in: [...new Set(orderRefs)] } },
        select: { orderNumber: true, pointOfSale: { select: { name: true, code: true } } },
      })
    : []
  const orderPosMap = new Map(orders.filter((o) => o.pointOfSale).map((o) => [o.orderNumber, o.pointOfSale!]))

  const enrichedAllocations = lot.allocations.map((a) => {
    let pointOfSale: { name: string; code: string } | null = null
    if (a.type === "SALE" && a.reference) {
      pointOfSale = orderPosMap.get(a.reference) ?? null
    } else if (a.type === "TRANSFER" && a.reference) {
      pointOfSale = refToPos.get(a.reference) ?? null
    }
    return { ...a, pointOfSale }
  })

  return NextResponse.json({ lot: { ...lot, allocations: enrichedAllocations } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const body = await req.json()
    const { status, expiryDate, notes } = body

    const lot = await getPrisma().productionLot.findUnique({ where: { id } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }

    const updated = await getPrisma().productionLot.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })

    return NextResponse.json({ lot: updated })
  } catch (error) {
    console.error("PATCH lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const lot = await getPrisma().productionLot.findUnique({ where: { id }, include: { allocations: true } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }

    if (lot.allocations.length > 0) {
      return NextResponse.json({ error: "Impossible de supprimer un lot deja utilise" }, { status: 400 })
    }

    await getPrisma().$transaction(async (tx) => {
      if (lot.remainingQuantity > 0) {
        const productionMovement = await tx.stockMovement.findFirst({
          where: { lotId: id, pointOfSaleId: { not: null } },
          select: { pointOfSaleId: true },
        })

        if (productionMovement?.pointOfSaleId) {
          const stock = await tx.pointOfSaleStock.findUnique({
            where: {
              pointOfSaleId_variantId: {
                pointOfSaleId: productionMovement.pointOfSaleId,
                variantId: lot.variantId,
              },
            },
          })
          if (!stock || stock.quantity < lot.remainingQuantity) {
            throw new Error("Stock du moyen de stockage insuffisant pour supprimer ce lot")
          }

          await tx.pointOfSaleStock.update({
            where: { id: stock.id },
            data: { quantity: { decrement: lot.remainingQuantity } },
          })
        }

        await tx.productVariant.update({
          where: { id: lot.variantId },
          data: { stock: { decrement: lot.remainingQuantity } },
        })
      }
      await tx.lotAllocation.deleteMany({ where: { lotId: id } })
      await tx.stockMovement.deleteMany({ where: { lotId: id } })
      await tx.productionLot.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
