import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { generateLotNumberTx } from "@/lib/lot-utils"
import { ensureOperationalStockLocations } from "@/lib/stock-service"

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const body = await req.json()
    const { entries, productionDate, expiryDate, notes } = body
    const destinationId = body.pointOfSaleId ? String(body.pointOfSaleId) : null

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "Aucune entree de production fournie" }, { status: 400 })
    }

    const cleaned = new Map<string, number>()
    for (const entry of entries) {
      const variantId = entry?.variantId ? String(entry.variantId) : ""
      const qty = Number(entry?.quantity)
      if (!variantId) continue
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "Quantite invalide pour un format fourni" }, { status: 400 })
      }
      cleaned.set(variantId, (cleaned.get(variantId) ?? 0) + qty)
    }

    if (cleaned.size === 0) {
      return NextResponse.json({ error: "Aucune quantite valide" }, { status: 400 })
    }

    const authSession = await auth()
    const actorId = authSession?.user?.id ?? null

    const variantIds = [...cleaned.keys()]
    const [variants, destination, locations] = await Promise.all([
      getPrisma().productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true } }),
      destinationId ? getPrisma().pointOfSale.findUnique({ where: { id: destinationId } }) : Promise.resolve(null),
      destinationId ? Promise.resolve(null) : ensureOperationalStockLocations(),
    ])

    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: "Un ou plusieurs formats sont introuvables" }, { status: 400 })
    }
    if (destinationId && (!destination || !destination.isActive)) {
      return NextResponse.json({ error: "Le point de vente de destination est invalide ou inactif" }, { status: 400 })
    }

    const lots = await getPrisma().$transaction(async (tx) => {
      const created: { lotNumber: string; variantId: string }[] = []

      for (const [variantId, quantity] of cleaned) {
        const lotNumber = await generateLotNumberTx(tx)
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
        created.push({ lotNumber, variantId })

        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { increment: quantity } },
        })

        await tx.stockMovement.create({
          data: {
            variantId,
            type: "PRODUCTION",
            quantity,
            reason: notes || "Production groupée",
            reference: lotNumber,
            lotId: newLot.id,
            userId: actorId,
          },
        })

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
              reason: notes || `Production groupée vers ${destination.name}`,
              reference: lotNumber,
              pointOfSaleId: destinationId,
              lotId: newLot.id,
              userId: actorId,
            },
          })
        } else {
          const locs = locations ?? (await ensureOperationalStockLocations())
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
                  reason: notes || `Distribution production groupée vers ${locs[i].name}`,
                  reference: lotNumber,
                  pointOfSaleId: locs[i].id,
                  lotId: newLot.id,
                  userId: actorId,
                },
              })
            }
          }
        }
      }

      return created
    })

    return NextResponse.json({ count: lots.length, lots }, { status: 201 })
  } catch (error) {
    console.error("POST lots/batch error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}