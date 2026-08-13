import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden
  try {
    const body = await request.json()
    const variantId = String(body.variantId || "")
    const quantity = Math.max(1, Number(body.quantity) || 0)
    const sourceId = body.sourcePointOfSaleId ? String(body.sourcePointOfSaleId) : null
    const destinationId = body.destinationPointOfSaleId ? String(body.destinationPointOfSaleId) : String(body.pointOfSaleId || "")
    if (!variantId || !destinationId || !quantity) return NextResponse.json({ error: "Produit, point de vente et quantité sont requis" }, { status: 400 })
    const [variant, destination, sourcePoint] = await Promise.all([
      prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: { select: { name: true } } } }),
      prisma.pointOfSale.findUnique({ where: { id: destinationId } }),
      sourceId ? prisma.pointOfSale.findUnique({ where: { id: sourceId } }) : Promise.resolve(null),
    ])
    if (!variant) return NextResponse.json({ error: "Produit ou format introuvable" }, { status: 400 })
    if (!destination || !destination.isActive) return NextResponse.json({ error: "Le point de vente de destination est invalide ou inactif" }, { status: 400 })
    if (sourceId && (!sourcePoint || !sourcePoint.isActive)) return NextResponse.json({ error: "Le point de vente source est invalide ou inactif" }, { status: 400 })
    if (sourceId === destinationId) return NextResponse.json({ error: "La source et la destination doivent être différentes" }, { status: 400 })
    await prisma.$transaction(async (tx) => {
      if (sourceId) {
        const source = await tx.pointOfSaleStock.findUnique({ where: { pointOfSaleId_variantId: { pointOfSaleId: sourceId, variantId } } })
        if (!source || source.quantity < quantity) throw new Error("Stock source insuffisant")
        await tx.pointOfSaleStock.update({ where: { id: source.id }, data: { quantity: { decrement: quantity } } })
        await tx.stockMovement.create({ data: { variantId, pointOfSaleId: sourceId, type: "TRANSFER_OUT", quantity, reason: body.reason || "Transfert de stock", reference: destinationId } })
      } else {
        if (variant.stock < quantity) {
          throw new Error(`Stock central insuffisant pour ${variant.product.name} ${variant.format} (disponible: ${variant.stock}, demandé: ${quantity})`)
        }
        await tx.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: quantity } } })
        await tx.stockMovement.create({ data: { variantId, type: "TRANSFER_OUT", quantity, reason: body.reason || "Approvisionnement point de vente depuis stock central", reference: destinationId } })
      }
      await tx.pointOfSaleStock.upsert({ where: { pointOfSaleId_variantId: { pointOfSaleId: destinationId, variantId } }, create: { pointOfSaleId: destinationId, variantId, quantity }, update: { quantity: { increment: quantity } } })
      await tx.stockMovement.create({ data: { variantId, pointOfSaleId: destinationId, type: sourceId ? "TRANSFER_IN" : "IN", quantity, reason: body.reason || (sourceId ? "Transfert de stock" : "Approvisionnement point de vente"), reference: sourceId || null } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de stock"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
