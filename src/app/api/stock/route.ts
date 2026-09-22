import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

import { allocateStockFIFOTx, generateLotNumberTx } from "@/lib/lot-utils"
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
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const locations = await fetchCachedLocations()

    if (locations.length < 2) {
      await ensureOperationalStockLocations()
    }

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
        select: {
          id: true,
          variantId: true,
          type: true,
          quantity: true,
          reason: true,
          reference: true,
          createdAt: true,
          variant: { select: { format: true, product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
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
        createdAt: movement.createdAt.toISOString(),
        productName: movement.variant.product.name,
        format: movement.variant.format,
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
        data: { variantId, type, quantity, reason, reference, pointOfSaleId },
      })

      if (POSITIVE_TYPES.has(type)) {
        if (pointOfSaleId) {
          await tx.pointOfSaleStock.upsert({
            where: { pointOfSaleId_variantId: { pointOfSaleId, variantId } },
            update: { quantity: { increment: quantity } },
            create: { pointOfSaleId, variantId, quantity },
          })
        } else {
          await tx.productionLot.create({
            data: {
              lotNumber: await generateLotNumberTx(tx),
              variantId,
              initialQuantity: quantity,
              remainingQuantity: quantity,
              productionDate: new Date(),
            },
          })
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


