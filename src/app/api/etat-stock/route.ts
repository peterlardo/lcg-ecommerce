import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth"
import { requireManagementAccess } from "@/lib/api-auth"
import { consumePointOfSaleStockTx, restockPointOfSaleStockTx } from "@/lib/stock-service"
import { COMPTOIR_CODE } from "@/lib/comptoir"

const VIEW_ROLES = ["ADMIN", "STOCK_MANAGER", "COMMERCIAL", "DELIVERY_AGENT"]
const SELLER_ROLES = ["ADMIN", "STOCK_MANAGER", "COMMERCIAL", "DELIVERY_AGENT"]
const MANAGE_ROLES = ["ADMIN", "STOCK_MANAGER"]

const POSITIVE_TYPES = new Set(["IN", "PRODUCTION", "TRANSFER_IN", "RETURN", "ADJUSTMENT_IN", "CANCEL_RESTOCK"])
const NEGATIVE_TYPES = new Set(["OUT", "SALE", "LOSS", "TRANSFER_OUT", "ADJUSTMENT_OUT"])
const SALE_TYPES = new Set(["SALE", "OUT"])

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

function parseDayParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(VIEW_ROLES)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const role = session?.user?.role ?? ""
    const canSeeAllSellers = MANAGE_ROLES.includes(role)
    const canManage = MANAGE_ROLES.includes(role)

    const { searchParams } = new URL(request.url)
    const day = parseDayParam(searchParams.get("date")) ?? new Date()
    const from = startOfDay(day)
    const to = endOfDay(day)
    const requestedUserId = searchParams.get("userId") || ""
    const userId = canSeeAllSellers ? requestedUserId : (session?.user?.id ?? "")
    const requestedPosId = searchParams.get("pointOfSaleId") || ""

    const [pointOfSales, sellers] = await Promise.all([
      getPrisma().pointOfSale.findMany({
        select: { id: true, name: true, code: true, type: true, isActive: true, managerUserId: true },
        orderBy: { name: "asc" },
      }),
      getPrisma().user.findMany({
        where: { role: { in: SELLER_ROLES }, isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ])

    const seller = userId ? sellers.find((u) => u.id === userId) ?? null : null
    const activePos = pointOfSales.filter((p) => p.isActive)
    const pointOfSale =
      activePos.find((p) => p.id === requestedPosId) ??
      (userId ? activePos.find((p) => p.managerUserId === userId) : undefined) ??
      activePos.find((p) => p.code === COMPTOIR_CODE) ??
      activePos[0] ??
      null
    const posId = pointOfSale?.id ?? null

    const orderWhere = {
      ...(posId ? { pointOfSaleId: posId } : {}),
      status: { not: "CANCELLED" as const },
      createdAt: { gte: from, lte: to },
      ...(userId ? { userId } : {}),
    }

    const [variants, posStocks, movements, orders, openSession, lastSession] = await Promise.all([
      getPrisma().productVariant.findMany({
        select: {
          id: true,
          format: true,
          price: true,
          stock: true,
          unit: true,
          product: { select: { name: true, category: { select: { name: true } } } },
        },
        orderBy: { product: { name: "asc" } },
      }),
      posId
        ? getPrisma().pointOfSaleStock.findMany({ where: { pointOfSaleId: posId }, select: { variantId: true, quantity: true } })
        : Promise.resolve([]),
      getPrisma().stockMovement.findMany({
        where: { ...(posId ? { pointOfSaleId: posId } : { pointOfSaleId: null }), createdAt: { gte: from, lte: to } },
        select: { id: true, variantId: true, type: true, quantity: true, reason: true, reference: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 400,
      }),
      getPrisma().order.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              variantId: true,
              quantity: true,
              price: true,
              total: true,
              variant: { select: { format: true, product: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      userId
        ? getPrisma().cashSession.findFirst({
            where: { openedById: userId, status: "OPEN" },
            orderBy: { openedAt: "desc" },
            include: { openedBy: { select: { name: true } } },
          })
        : posId
          ? getPrisma().cashSession.findFirst({
              where: { pointOfSaleId: posId, status: "OPEN" },
              orderBy: { openedAt: "desc" },
              include: { openedBy: { select: { name: true } } },
            })
          : Promise.resolve(null),
      userId
        ? getPrisma().cashSession.findFirst({
            where: { openedById: userId, openedAt: { gte: from, lte: to } },
            orderBy: { openedAt: "desc" },
            include: { openedBy: { select: { name: true } } },
          })
        : posId
          ? getPrisma().cashSession.findFirst({
              where: { pointOfSaleId: posId, openedAt: { gte: from, lte: to } },
              orderBy: { openedAt: "desc" },
              include: { openedBy: { select: { name: true } } },
            })
          : Promise.resolve(null),
    ])

    const posStockByVariant = new Map(posStocks.map((s) => [s.variantId, s.quantity]))
    // Le stock d'une journee appartient au point de vente : le vendeur n'y detient
    // aucun stock reserve. Quand un vendeur est selectionne, on ne regarde que ses
    // propres mouvements et ses propres ventes.
    const sellerMode = Boolean(userId)

    const movementByVariant = new Map<string, { entrees: number; sorties: number; debite: number }>()
    const ownMovementByVariant = new Map<string, { entrees: number; sorties: number; debite: number }>()
    for (const movement of movements) {
      const bucket = movementByVariant.get(movement.variantId) ?? { entrees: 0, sorties: 0, debite: 0 }
      if (POSITIVE_TYPES.has(movement.type)) bucket.entrees += movement.quantity
      else if (NEGATIVE_TYPES.has(movement.type)) bucket.sorties += movement.quantity
      if (SALE_TYPES.has(movement.type)) bucket.debite += movement.quantity
      movementByVariant.set(movement.variantId, bucket)

      if (userId && movement.userId === userId) {
        const own = ownMovementByVariant.get(movement.variantId) ?? { entrees: 0, sorties: 0, debite: 0 }
        if (POSITIVE_TYPES.has(movement.type)) own.entrees += movement.quantity
        else if (NEGATIVE_TYPES.has(movement.type)) own.sorties += movement.quantity
        if (SALE_TYPES.has(movement.type)) own.debite += movement.quantity
        ownMovementByVariant.set(movement.variantId, own)
      }
    }

    const soldByVariant = new Map<string, { quantity: number; total: number }>()
    for (const order of orders) {
      for (const item of order.items) {
        const bucket = soldByVariant.get(item.variantId) ?? { quantity: 0, total: 0 }
        bucket.quantity += item.quantity
        bucket.total += item.total
        soldByVariant.set(item.variantId, bucket)
      }
    }

    const rows = variants
      .filter(
        (v) =>
          posStockByVariant.has(v.id) ||
          movementByVariant.has(v.id) ||
          soldByVariant.has(v.id),
      )
      .map((variant) => {
        const posQuantity = posStockByVariant.get(variant.id) ?? 0
        const pool = movementByVariant.get(variant.id) ?? { entrees: 0, sorties: 0, debite: 0 }
        const movement = sellerMode
          ? (ownMovementByVariant.get(variant.id) ?? { entrees: 0, sorties: 0, debite: 0 })
          : pool
        const sold = soldByVariant.get(variant.id) ?? { quantity: 0, total: 0 }
        const autresSorties = Math.max(0, movement.sorties - sold.quantity)
        const autresMouvements = movement.entrees - autresSorties
        const stockDepart = posQuantity + pool.sorties - pool.entrees
        const stockCloture = stockDepart + movement.entrees - sold.quantity - autresSorties
        return {
          variantId: variant.id,
          productName: variant.product.name,
          categoryName: variant.product.category?.name ?? "Sans catégorie",
          format: variant.format,
          unit: variant.unit,
          price: variant.price,
          stockDepart,
          ventes: sold.quantity,
          ventesMontant: sold.total,
          entrees: movement.entrees,
          autresSorties,
          autresMouvements,
          stockCloture,
          stockReel: posQuantity,
          stockGlobal: variant.stock,
          debite: movement.debite,
          disponible: stockCloture,
          alerte: stockCloture < 0,
        }
      })

    const sum = (key: "stockDepart" | "ventes" | "entrees" | "autresSorties" | "autresMouvements" | "stockCloture" | "stockReel" | "stockGlobal" | "debite" | "disponible") =>
      rows.reduce((total, row) => total + row[key], 0)

    const cashOrders = orders.filter((o) => o.paymentMethod === "CASH_ON_DELIVERY" && o.paymentStatus === "PAID")
    const cashSession = openSession ?? lastSession
    const sessionOrders = cashSession
      ? await getPrisma().order.findMany({
          where: {
            ...(posId ? { pointOfSaleId: posId } : {}),
            status: { not: "CANCELLED" },
            paymentMethod: "CASH_ON_DELIVERY",
            paymentStatus: "PAID",
            createdAt: { gte: cashSession.openedAt, lte: cashSession.closedAt ?? new Date() },
            ...(userId ? { userId } : {}),
          },
          select: { total: true },
        })
      : []
    const sessionCash = sessionOrders.reduce((s, o) => s + o.total, 0)
    const sessionExpected = cashSession ? cashSession.openingBalance + sessionCash : 0

    return NextResponse.json({
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      pointOfSaleId: posId,
      pointOfSale: pointOfSale ? { id: pointOfSale.id, name: pointOfSale.name, code: pointOfSale.code } : null,
      userId,
      seller: seller ? { id: seller.id, name: seller.name } : null,
      sellers,
      pointOfSales: pointOfSales.map((p) => ({ id: p.id, name: p.name, code: p.code, isActive: p.isActive })),
      canManage,
      canSeeAllSellers,
      sellerMode,
      rows,
      totals: {
        stockDepart: sum("stockDepart"),
        ventes: sum("ventes"),
        entrees: sum("entrees"),
        autresSorties: sum("autresSorties"),
        autresMouvements: sum("autresMouvements"),
        stockCloture: sum("stockCloture"),
        stockReel: sum("stockReel"),
        stockGlobal: sum("stockGlobal"),
        ventesMontant: rows.reduce((total, row) => total + row.ventesMontant, 0),
        commandes: orders.length,
        montant: orders.reduce((total, order) => total + order.total, 0),
        ventesSansDebit: sum("ventes") - sum("debite"),
        disponible: sum("disponible"),
        alertes: rows.filter((row) => row.alerte).length,
        cashDay: cashOrders.reduce((s, o) => s + o.total, 0),
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.variant.product.name,
          format: item.variant.format,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      })),
      movements: movements.map((movement) => ({
        id: movement.id,
        variantId: movement.variantId,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason,
        reference: movement.reference,
        userId: movement.userId,
        own: userId ? movement.userId === userId : true,
        createdAt: movement.createdAt.toISOString(),
      })),
      cash: {
        session: cashSession
          ? {
              id: cashSession.id,
              openedAt: cashSession.openedAt.toISOString(),
              closedAt: cashSession.closedAt?.toISOString() ?? null,
              openingBalance: cashSession.openingBalance,
              closingBalance: cashSession.closingBalance,
              status: cashSession.status,
              expected: sessionExpected,
              cashSales: sessionCash,
              gap: cashSession.closingBalance === null ? null : cashSession.closingBalance - sessionExpected,
              openedByName: cashSession.openedBy?.name ?? null,
              reportGeneratedAt: cashSession.reportGeneratedAt?.toISOString() ?? null,
              reportReference: cashSession.reportReference,
            }
          : null,
        dayExpected: cashOrders.reduce((s, o) => s + o.total, 0),
      },
    })
  } catch (error) {
    console.error("GET etat-stock error:", error)
    return NextResponse.json({ error: "Impossible de charger l'état de stock" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(MANAGE_ROLES)
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const authSession = await auth()
    const actorId = authSession?.user?.id ?? ""
    const actorName = authSession?.user?.name ?? "un responsable"
    const pointOfSaleId = String(body.pointOfSaleId || "")
    const variantId = String(body.variantId || "")
    const targetQuantity = Number(body.targetQuantity)
    // L'ajustement porte sur le stock physique du point de vente. Le vendeur
    // cible n'est pas proprietaire du stock : il est seulement trace dans le
    // libelle du mouvement.
    const targetSellerId = body.userId ? String(body.userId) : ""
    const baseReason = String(body.reason || "").trim() || "Ajustement d'inventaire"
    const reason = targetSellerId ? `${baseReason} (ajustement par ${actorName})` : baseReason
    const movementUserId = targetSellerId || actorId

    if (!pointOfSaleId || !variantId || !Number.isFinite(targetQuantity)) {
      return NextResponse.json({ error: "Point de vente, variante et quantité requis" }, { status: 400 })
    }

    const variant = await getPrisma().productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    })
    if (!variant) return NextResponse.json({ error: "Variante introuvable" }, { status: 404 })

    const current = await getPrisma().pointOfSaleStock.findUnique({
      where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
      select: { quantity: true },
    })
    const currentQuantity = current?.quantity ?? 0
    const delta = Math.trunc(targetQuantity) - currentQuantity

    if (delta === 0) {
      return NextResponse.json({ error: "Le stock physique est identique au stock système" }, { status: 400 })
    }

    const reference = `INV-${Date.now().toString(36).toUpperCase()}`

    await getPrisma().$transaction(async (tx) => {
      if (delta > 0) {
        await restockPointOfSaleStockTx(tx, {
          variantId,
          pointOfSaleId,
          quantity: delta,
          type: "ADJUSTMENT_IN",
          reason,
          reference,
          userId: movementUserId,
        })
      } else {
        await consumePointOfSaleStockTx(tx, {
          variantId,
          pointOfSaleId,
          quantity: Math.abs(delta),
          type: "ADJUSTMENT_OUT",
          reason,
          reference,
          userId: movementUserId,
        })
      }
    })

    const updated = await getPrisma().pointOfSaleStock.findUnique({
      where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
      select: { quantity: true },
    })

    return NextResponse.json({ quantity: updated?.quantity ?? currentQuantity + delta, delta, reference })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible d'ajuster le stock"
    console.error("POST etat-stock error:", error)
    const status = message.includes("Stock insuffisant") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
