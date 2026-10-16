import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { dropUnlocatedStockTx, placeUnlocatedStockTx } from "@/lib/lot-coherence"
import { COMPTOIR_CODE, ensureOperationalStockLocations } from "@/lib/stock-service"
import { isLotNumberConflict } from "@/lib/lot-utils"

export const dynamic = "force-dynamic"

/**
 * Stock hors point de vente d'un format (stock global sans emplacement, invisible en caisse) :
 * - « placer » : il va au Comptoir LCG, couvert par un lot, et devient vendable ;
 * - « retirer » (administrateur) : il n'existe pas réellement, le stock global redescend.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const variantId = typeof body?.variantId === "string" ? body.variantId : ""
  const action = body?.action === "retirer" ? "retirer" : "placer"
  const forbidden = await requireManagementAccess(action === "retirer" ? ["ADMIN"] : ["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden
  if (!variantId) return NextResponse.json({ error: "Format requis" }, { status: 400 })

  try {
    const session = await auth()
    const actorId = session?.user?.id ?? null
    const variant = await getPrisma().productVariant.findUnique({
      where: { id: variantId },
      select: { format: true, product: { select: { name: true } } },
    })
    if (!variant) return NextResponse.json({ error: "Format introuvable" }, { status: 404 })
    const label = `${variant.product.name} · ${variant.format}`

    if (action === "retirer") {
      const { dropped } = await getPrisma().$transaction((tx) => dropUnlocatedStockTx(tx, { variantId, actorId }))
      if (dropped === 0) return NextResponse.json({ error: "Aucun stock hors point de vente pour ce format" }, { status: 409 })
      await logActivity({ module: "stock", action: "Retrait", entity: "ProductVariant", entityId: variantId, summary: `${dropped} unité(s) hors point de vente retirée(s) : ${label}` })
      return NextResponse.json({ dropped })
    }

    const comptoir = (await ensureOperationalStockLocations()).find((l) => l.code === COMPTOIR_CODE)
    if (!comptoir) return NextResponse.json({ error: "Comptoir LCG introuvable" }, { status: 500 })
    const result = await getPrisma().$transaction((tx) => placeUnlocatedStockTx(tx, { variantId, comptoirId: comptoir.id, actorId }))
    if (result.placed === 0) return NextResponse.json({ error: "Aucun stock hors point de vente pour ce format" }, { status: 409 })
    await logActivity({ module: "stock", action: "Placement", entity: "ProductVariant", entityId: variantId, summary: `${result.placed} unité(s) placée(s) au ${comptoir.name} : ${label}` })
    return NextResponse.json({ ...result, pointOfSale: comptoir.name })
  } catch (error) {
    if (isLotNumberConflict(error)) {
      return NextResponse.json({ error: "Un autre lot vient d'etre cree au meme instant : veuillez reessayer" }, { status: 409 })
    }
    console.error("POST stock/hors-point-de-vente error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
