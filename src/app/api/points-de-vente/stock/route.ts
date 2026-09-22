import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import {
  createProductionForLocationTx,
  ensurePointOfSaleStockRows,
  transferPointOfSaleStockTx,
} from "@/lib/stock-service"

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
      getPrisma().productVariant.findUnique({ where: { id: variantId }, include: { product: { select: { name: true } } } }),
      getPrisma().pointOfSale.findUnique({ where: { id: destinationId } }),
      sourceId ? getPrisma().pointOfSale.findUnique({ where: { id: sourceId } }) : Promise.resolve(null),
    ])
    if (!variant) return NextResponse.json({ error: "Produit ou format introuvable" }, { status: 400 })
    if (!destination || !destination.isActive) return NextResponse.json({ error: "Le point de vente de destination est invalide ou inactif" }, { status: 400 })
    if (sourceId && (!sourcePoint || !sourcePoint.isActive)) return NextResponse.json({ error: "Le point de vente source est invalide ou inactif" }, { status: 400 })
    if (sourceId === destinationId) return NextResponse.json({ error: "La source et la destination doivent être différentes" }, { status: 400 })

    await ensurePointOfSaleStockRows(sourceId ? [sourceId, destinationId] : [destinationId])

    const transferRef = `TRANSFERT-${Date.now()}`

    await getPrisma().$transaction(async (tx) => {
      if (sourceId) {
        await transferPointOfSaleStockTx(tx, {
          sourcePointOfSaleId: sourceId,
          destinationPointOfSaleId: destinationId,
          variantId,
          quantity,
          reason: body.reason || "Transfert de stock",
          reference: transferRef,
        })
        return
      }

      await createProductionForLocationTx(tx, {
        variantId,
        quantity,
        pointOfSaleId: destinationId,
        movementType: "IN",
        reason: body.reason || "Approvisionnement point de vente",
        reference: transferRef,
        notes: body.reason || "Approvisionnement point de vente",
      })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de stock"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
