import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import type { LotAllocation } from "@prisma/client"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, saleMovementsFilter, isRestrictedOrder } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { expireOverdueLotsTx, generateLotNumberTx, isLotNumberConflict } from "@/lib/lot-utils"
import { ensureOperationalStockLocations } from "@/lib/stock-service"
import { LOT_LIST_LIMIT, checkedLotDates, checkedLotQuantity, LotInputError } from "@/lib/lot-input"

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const url = new URL(req.url)
  const variantId = url.searchParams.get("variantId")
  const status = url.searchParams.get("status")
  const withAllocations = url.searchParams.get("allocations") === "1"

  const session = await auth()
  const movementWhere = saleMovementsFilter(session?.user?.role, session?.user?.id)

  // Les lots dont la date d'expiration est passée basculent en « EXPIRED » avant l'affichage
  await expireOverdueLotsTx(getPrisma())

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
    take: LOT_LIST_LIMIT,
  })

  // Totaux de l'écran : toujours sur l'ensemble des lots, quels que soient le filtre et la limite de la liste.
  const [summary, allLots] = await Promise.all([
    getPrisma().productionLot.aggregate({
      where: { status: "ACTIVE" },
      _sum: { remainingQuantity: true },
      _count: true,
    }),
    getPrisma().productionLot.aggregate({ _sum: { initialQuantity: true }, _count: true }),
  ])
  const totals = {
    lots: allLots._count,
    produced: allLots._sum.initialQuantity ?? 0,
    activeLots: summary._count,
    activeRemaining: summary._sum.remainingQuantity ?? 0,
  }

  type LotWithAllocations = (typeof lots)[number] & {
    allocations?: LotAllocation[]
  }

  let enrichedLots = lots
  const lotsWithAllocations = lots as LotWithAllocations[]

  if (withAllocations) {
    const lotIds = lotsWithAllocations.filter((l) => l.allocations?.length > 0).map((l) => l.id)
    if (lotIds.length > 0) {
      const movements = await getPrisma().stockMovement.findMany({
        where: { lotId: { in: lotIds }, pointOfSaleId: { not: null }, AND: [movementWhere] },
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
            select: { orderNumber: true, notes: true, userId: true, pointOfSale: { select: { name: true, code: true } } },
          })
        : []
      const orderPosMap = new Map(orders.filter((o) => o.pointOfSale).map((o) => [o.orderNumber, o.pointOfSale!]))
      const orderByNumber = new Map(orders.map((o) => [o.orderNumber, o]))
      const role = session?.user?.role
      const selfId = session?.user?.id

      enrichedLots = lotsWithAllocations.map((lot) => ({
        ...lot,
        allocations: (lot.allocations ?? [])
          .filter((a) => {
            if (a.type !== "SALE" || !a.reference) return true
            const order = orderByNumber.get(a.reference)
            if (!order) return true
            return !isRestrictedOrder(order, role, selfId)
          })
          .map((a) => {
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

  const destMovements = await getPrisma().stockMovement.findMany({
    where: { lotId: { in: lots.map((l) => l.id) }, type: "PRODUCTION", pointOfSaleId: { not: null } },
    select: { lotId: true, pointOfSaleId: true },
  })
  const destPosIds = [...new Set(destMovements.map((m) => m.pointOfSaleId!).filter(Boolean))]
  const destPosList = destPosIds.length > 0
    ? await getPrisma().pointOfSale.findMany({ where: { id: { in: destPosIds } }, select: { id: true, name: true, code: true } })
    : []
  const destPosMap = new Map(destPosList.map((p) => [p.id, p]))
  const lotDestMap = new Map<string, { id: string; name: string; code: string }>()
  for (const m of destMovements) {
    const pos = destPosMap.get(m.pointOfSaleId!)
    if (pos && !lotDestMap.has(m.lotId!)) lotDestMap.set(m.lotId!, pos)
  }

  enrichedLots = (enrichedLots as LotWithAllocations[]).map((lot) => ({
    ...lot,
    destination: lotDestMap.get(lot.id) ?? null,
  }))

  return NextResponse.json({ lots: enrichedLots, summary, totals, truncated: lots.length >= LOT_LIST_LIMIT })
}

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const body = await req.json()
    const variantId = body.variantId ? String(body.variantId) : ""
    const destinationId = body.pointOfSaleId ? String(body.pointOfSaleId) : null
    const notes = typeof body.notes === "string" ? body.notes.trim() : ""

    if (!variantId) {
      return NextResponse.json({ error: "Choisissez un produit et un format" }, { status: 400 })
    }
    let quantity: number
    let dates: { productionDate: Date; expiryDate: Date | null }
    try {
      quantity = checkedLotQuantity(body.quantity)
      dates = checkedLotDates(body.productionDate, body.expiryDate)
    } catch (error) {
      if (error instanceof LotInputError) return NextResponse.json({ error: error.message }, { status: 400 })
      throw error
    }

    const authSession = await auth()
    const actorId = authSession?.user?.id ?? null

    const [variant, destination, locations] = await Promise.all([
      getPrisma().productVariant.findUnique({ where: { id: variantId } }),
      destinationId ? getPrisma().pointOfSale.findUnique({ where: { id: destinationId } }) : Promise.resolve(null),
      destinationId ? Promise.resolve(null) : ensureOperationalStockLocations(),
    ])
    if (!variant) {
      return NextResponse.json({ error: "Variante introuvable" }, { status: 404 })
    }
    if (destinationId && (!destination || !destination.isActive)) {
      return NextResponse.json({ error: "Le point de vente de destination est invalide ou inactif" }, { status: 400 })
    }

    const lot = await getPrisma().$transaction(async (tx) => {
      const lotNumber = await generateLotNumberTx(tx)
      const newLot = await tx.productionLot.create({
        data: {
          lotNumber,
          variantId,
          initialQuantity: quantity,
          remainingQuantity: quantity,
          productionDate: dates.productionDate,
          expiryDate: dates.expiryDate,
          notes: notes || null,
          createdById: actorId,
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
          userId: actorId,
        },
      })

      // Auto-distribute production to both operational stock locations
      // unless a single destination point of sale has been chosen
      if (destinationId && destination) {
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
            reason: notes || `Production vers ${destination.name}`,
            reference: lotNumber,
            pointOfSaleId: destinationId,
            lotId: newLot.id,
            userId: actorId,
          },
        })
      } else {
        const locs = locations ?? await ensureOperationalStockLocations()
        const perLocation = Math.floor(quantity / locs.length)
        const remainder = quantity % locs.length

        for (let i = 0; i < locs.length; i++) {
          const locQty = perLocation + (i < remainder ? 1 : 0)
          if (locQty > 0) {
            await tx.pointOfSaleStock.upsert({
              where: { pointOfSaleId_variantId: { pointOfSaleId: locs[i].id, variantId } },
              update: { quantity: { increment: locQty } },
              create: { pointOfSaleId: locs[i].id, variantId, quantity: locQty },
            })

            await tx.stockMovement.create({
              data: {
                variantId,
                type: "PRODUCTION",
                quantity: locQty,
                reason: notes || `Distribution production vers ${locs[i].name}`,
                reference: lotNumber,
                pointOfSaleId: locs[i].id,
                lotId: newLot.id,
                userId: actorId,
              },
            })
          }
        }
      }

      return newLot
    })

    return NextResponse.json({ lot, destination: destination ? { id: destination.id, name: destination.name, code: destination.code } : null }, { status: 201 })
  } catch (error) {
    if (isLotNumberConflict(error)) {
      return NextResponse.json({ error: "Un autre lot vient d'etre cree au meme instant : veuillez reessayer" }, { status: 409 })
    }
    console.error("POST lots error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
