import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import type { LotAllocation } from "@prisma/client"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { generateLotNumber } from "@/lib/lot-utils"
import { ensureOperationalStockLocations } from "@/lib/stock-service"

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const url = new URL(req.url)
  const variantId = url.searchParams.get("variantId")
  const status = url.searchParams.get("status")
  const withAllocations = url.searchParams.get("allocations") === "1"

  const where: Prisma.ProductionLotWhereInput = {}
  if (variantId) where.variantId = variantId
  if (status) where.status = status

  const lots = await getPrisma().productionLot.findMany({
    where,
    include: {
      variant: { include: { product: { include: { category: true } } } },
      createdBy: { select: { name: true, email: true } },
      ...(withAllocations ? { allocations: { orderBy: { createdAt: "desc" }, take: 20 } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const summary = await getPrisma().productionLot.aggregate({
    where: { status: "ACTIVE" },
    _sum: { remainingQuantity: true },
    _count: true,
  })

  type LotWithAllocations = (typeof lots)[number] & {
    allocations?: LotAllocation[]
  }

  let enrichedLots = lots
  const lotsWithAllocations = lots as LotWithAllocations[]

  if (withAllocations) {
    const lotIds = lotsWithAllocations.filter((l) => l.allocations?.length > 0).map((l) => l.id)
    if (lotIds.length > 0) {
      const movements = await getPrisma().stockMovement.findMany({
        where: { lotId: { in: lotIds }, pointOfSaleId: { not: null } },
        select: { lotId: true, reference: true, pointOfSaleId: true },
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
          if (pos && !refToPos.has(`${m.lotId}:${m.reference}`)) {
            refToPos.set(`${m.lotId}:${m.reference}`, pos)
          }
        }
      }

      const orderRefs = new Set<string>()
      for (const lot of lotsWithAllocations) {
        for (const a of lot.allocations ?? []) {
          if (a.type === "SALE" && a.reference) orderRefs.add(a.reference)
        }
      }

      const orders = orderRefs.size > 0
        ? await getPrisma().order.findMany({
            where: { orderNumber: { in: [...orderRefs] } },
            select: { orderNumber: true, pointOfSale: { select: { name: true, code: true } } },
          })
        : []
      const orderPosMap = new Map(orders.filter((o) => o.pointOfSale).map((o) => [o.orderNumber, o.pointOfSale!]))

      enrichedLots = lotsWithAllocations.map((lot) => ({
        ...lot,
        allocations: (lot.allocations ?? []).map((a) => {
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
    const destinationId = body.pointOfSaleId ? String(body.pointOfSaleId) : null

    if (!variantId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 })
    }

    const [variant, destination] = await Promise.all([
      getPrisma().productVariant.findUnique({ where: { id: variantId } }),
      destinationId ? getPrisma().pointOfSale.findUnique({ where: { id: destinationId } }) : Promise.resolve(null),
    ])
    if (!variant) {
      return NextResponse.json({ error: "Variante introuvable" }, { status: 404 })
    }
    if (destinationId && (!destination || !destination.isActive)) {
      return NextResponse.json({ error: "Le point de vente de destination est invalide ou inactif" }, { status: 400 })
    }

    const lotNumber = await generateLotNumber()

    const lot = await getPrisma().$transaction(async (tx) => {
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

      // Auto-distribute production to both operational stock locations
      // unless a single destination point of sale has been chosen
      if (destinationId) {
        await tx.pointOfSaleStock.upsert({
          where: { pointOfSaleId_variantId: { pointOfSaleId: destinationId, variantId } },
          update: { quantity: { increment: quantity } },
          create: { pointOfSaleId: destinationId, variantId, quantity },
        })

        await tx.stockMovement.create({
          data: {
            variantId,
            type: "PRODUCTION",
            quantity,
            reason: notes || `Production vers ${destination!.name}`,
            reference: lotNumber,
            pointOfSaleId: destinationId,
            lotId: newLot.id,
          },
        })
      } else {
        const locations = await ensureOperationalStockLocations()
        const perLocation = Math.floor(quantity / locations.length)
        const remainder = quantity % locations.length

        for (let i = 0; i < locations.length; i++) {
          const locQty = perLocation + (i < remainder ? 1 : 0)
          if (locQty > 0) {
            await tx.pointOfSaleStock.upsert({
              where: { pointOfSaleId_variantId: { pointOfSaleId: locations[i].id, variantId } },
              update: { quantity: { increment: locQty } },
              create: { pointOfSaleId: locations[i].id, variantId, quantity: locQty },
            })

            await tx.stockMovement.create({
              data: {
                variantId,
                type: "PRODUCTION",
                quantity: locQty,
                reason: notes || `Distribution production vers ${locations[i].name}`,
                reference: lotNumber,
                pointOfSaleId: locations[i].id,
                lotId: newLot.id,
              },
            })
          }
        }
      }

      return newLot
    })

    return NextResponse.json({ lot, destination: destination ? { id: destination.id, name: destination.name, code: destination.code } : null }, { status: 201 })
  } catch (error) {
    console.error("POST lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
