import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { getProducts } from "@/data/store"
import { allocateStockFIFOTx, generateLotNumberTx } from "@/lib/lot-utils"

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
    await getProducts()

    const [variants, movements] = await Promise.all([
      prisma.productVariant.findMany({
        include: { product: { include: { category: true } } },
      }),
      prisma.stockMovement.findMany({
        include: { variant: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ])

    const mappedVariants = variants
      .map((variant) => ({
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
      }))
      .sort((a, b) => `${a.productName} ${a.format}`.localeCompare(`${b.productName} ${b.format}`, "fr"))

    return NextResponse.json({
      summary: {
        totalVariants: mappedVariants.length,
        totalUnits: mappedVariants.reduce((sum, item) => sum + item.stock, 0),
        lowStock: mappedVariants.filter((item) => item.stock > 0 && item.stock < item.lowThreshold).length,
        outOfStock: mappedVariants.filter((item) => item.stock <= 0).length,
      },
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

    if (!variantId || quantity <= 0) {
      return NextResponse.json({ error: "Variante et quantité requises" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
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
        data: { variantId, type, quantity, reason, reference },
      })

      if (POSITIVE_TYPES.has(type)) {
        await tx.productionLot.create({
          data: {
            lotNumber: await generateLotNumberTx(tx),
            variantId,
            initialQuantity: quantity,
            remainingQuantity: quantity,
            productionDate: new Date(),
          },
        })
      } else if (NEGATIVE_TYPES.has(type)) {
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


