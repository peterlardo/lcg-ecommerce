import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, saleMovementsFilter } from "@/lib/api-auth"
import { auth } from "@/lib/auth"

import { allocateStockFIFOTx, createCoverageLotTx } from "@/lib/lot-utils"
import { fetchCachedLocations, ensureOperationalStockLocations, OPERATIONAL_STOCK_CODES } from "@/lib/stock-service"

const NEGATIVE_TYPES = new Set(["OUT", "SALE", "LOSS", "TRANSFER_OUT", "ADJUSTMENT_OUT"])
const POSITIVE_TYPES = new Set(["IN", "PRODUCTION", "TRANSFER_IN", "RETURN", "ADJUSTMENT_IN", "CANCEL_RESTOCK"])

function stockDelta(type: string, quantity: number) {
  const normalized = type.toUpperCase()
  if (NEGATIVE_TYPES.has(normalized)) return -quantity
  if (POSITIVE_TYPES.has(normalized)) return quantity
  return quantity
}

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"], [["stock", "production", "lots", "etat-stock"], "view"])
  if (forbidden) return forbidden

  try {
    const locations = await fetchCachedLocations()

    if (locations.length < 2) {
      await ensureOperationalStockLocations()
    }

    const stockSession = await auth()
    const movementWhere = saleMovementsFilter(stockSession?.user?.role, stockSession?.user?.id)

    // 35 jours : couvre toujours le mois en cours et la semaine en cours
    const movementsSince = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)

    const [variants, movements, posStocks] = await Promise.all([
      getPrisma().productVariant.findMany({
        select: {
          id: true,
          productId: true,
          format: true,
          price: true,
          stock: true,
          unit: true,
          product: {
            select: { name: true, image: true, category: { select: { name: true, slug: true } } },
          },
        },
      }),
      getPrisma().stockMovement.findMany({
        // Tout le mois en cours (l'écran en tire ses totaux du jour, de la semaine et du mois) :
        // avec les 40 derniers mouvements seulement, ces totaux étaient tronqués dès qu'il y avait de l'activité.
        where: { AND: [movementWhere, { createdAt: { gte: movementsSince } }] },
        select: {
          id: true,
          variantId: true,
          type: true,
          quantity: true,
          reason: true,
          reference: true,
          pointOfSaleId: true,
          createdAt: true,
          variant: { select: { format: true, product: { select: { name: true } } } },
          pointOfSale: { select: { name: true, code: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 3000,
      }),
      getPrisma().pointOfSaleStock.findMany({
        where: { pointOfSale: { code: { in: OPERATIONAL_STOCK_CODES } } },
        select: {
          id: true,
          variantId: true,
          quantity: true,
          pointOfSaleId: true,
          variant: { select: { format: true, price: true, unit: true, product: { select: { name: true } } } },
          pointOfSale: { select: { id: true, name: true, code: true } },
        },
      }),
    ])

    const mappedVariants = variants
      .map((variant) => {
        const storageStocks = posStocks
          .filter((ps) => ps.variantId === variant.id)
          .map((ps) => ({
            pointOfSaleId: ps.pointOfSaleId,
            pointOfSaleName: ps.pointOfSale.name,
            pointOfSaleCode: ps.pointOfSale.code,
            quantity: ps.quantity,
          }))

        return {
          variantId: variant.id,
          productId: variant.productId,
          productName: variant.product.name,
          productImage: variant.product.image,
          categoryName: variant.product.category?.name ?? "Sans catégorie",
          categorySlug: variant.product.category?.slug ?? "",
          format: variant.format,
          price: variant.price,
          stock: variant.stock,
          unit: variant.unit,
          lowThreshold: 20,
          storageStocks,
        }
      })
      .sort((a, b) => `${a.productName} ${a.format}`.localeCompare(`${b.productName} ${b.format}`, "fr"))

    const locationData = locations.map((loc) => {
      const locStocks = posStocks
        .filter((ps) => ps.pointOfSaleId === loc.id)
        .map((ps) => ({
          variantId: ps.variantId,
          productName: ps.variant.product.name ?? "Variante",
          format: ps.variant.format,
          quantity: ps.quantity,
          price: ps.variant.price,
          unit: ps.variant.unit,
        }))

      return {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        type: loc.type,
        totalUnits: locStocks.reduce((sum, s) => sum + s.quantity, 0),
        stockValue: locStocks.reduce((sum, s) => sum + s.quantity * s.price, 0),
        stocks: locStocks,
      }
    })

    return NextResponse.json({
      summary: {
        totalVariants: mappedVariants.length,
        totalUnits: mappedVariants.reduce((sum, item) => sum + item.stock, 0),
        lowStock: mappedVariants.filter((item) => item.stock > 0 && item.stock < item.lowThreshold).length,
        outOfStock: mappedVariants.filter((item) => item.stock <= 0).length,
      },
      locations: locationData,
      variants: mappedVariants,
      movements: movements.map((movement) => ({
        id: movement.id,
        variantId: movement.variantId,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason ?? "",
        reference: movement.reference ?? "",
        pointOfSaleId: movement.pointOfSaleId,
        pointOfSaleName: movement.pointOfSale?.name ?? null,
        pointOfSaleCode: movement.pointOfSale?.code ?? null,
        createdAt: movement.createdAt.toISOString(),
        productName: movement.variant.product.name,
        format: movement.variant.format,
        // qui a fait le mouvement (vente d'une caissière, production, entrée, transfert…)
        userName: movement.user?.name ?? null,
      })),
    })
  } catch (error) {
    console.error("GET stock error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const authSession = await auth()
    const actorId = authSession?.user?.id ?? null
    const variantId = String(body.variantId || "")
    const type = String(body.type || "IN").toUpperCase()
    const quantity = Math.max(1, Number(body.quantity) || 0)
    const reason = body.reason ? String(body.reason) : null
    const reference = body.reference ? String(body.reference) : null
    const pointOfSaleId = body.pointOfSaleId ? String(body.pointOfSaleId) : null

    if (!variantId || quantity <= 0) {
      return NextResponse.json({ error: "Variante et quantité requises" }, { status: 400 })
    }

    const result = await getPrisma().$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
      if (!variant) throw new Error("Variante introuvable")

      const delta = stockDelta(type, quantity)
      const nextStock = variant.stock + delta
      if (nextStock < 0) throw new Error("Stock insuffisant pour ce mouvement")

      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: nextStock },
      })
      const movement = await tx.stockMovement.create({
        data: { variantId, type, quantity, reason, reference, pointOfSaleId, userId: actorId },
      })

      if (POSITIVE_TYPES.has(type)) {
        if (pointOfSaleId) {
          await tx.pointOfSaleStock.upsert({
            where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
            update: { quantity: { increment: quantity } },
            create: { pointOfSaleId, variantId, quantity },
          })
        }
        // Toute entrée est couverte par un lot, avec ou sans point de vente : sans lot, ce stock serait
        // refusé à la vente. Un transfert reçu ne crée rien : la marchandise garde son lot d'origine.
        if (!pointOfSaleId || type !== "TRANSFER_IN") {
          await createCoverageLotTx(tx, { variantId, quantity, notes: reason || "Entrée de stock", createdById: actorId })
        }
      } else if (NEGATIVE_TYPES.has(type)) {
        if (pointOfSaleId) {
          await tx.pointOfSaleStock.update({
            where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
            data: { quantity: { decrement: quantity } },
          })
        }
        await allocateStockFIFOTx(tx, variantId, quantity, type, reference ?? `ADJ-${movement.id}`)
      }

      return { updated, movement }
    })

    return NextResponse.json({
      stock: result.updated.stock,
      movement: {
        id: result.movement.id,
        type: result.movement.type,
        quantity: result.movement.quantity,
        reason: result.movement.reason,
        reference: result.movement.reference,
        createdAt: result.movement.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne du serveur"
    const status = message.includes("introuvable") || message.includes("Stock") ? 400 : 500
    console.error("POST stock error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}


