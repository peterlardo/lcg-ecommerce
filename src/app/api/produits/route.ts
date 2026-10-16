import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { getProducts, createProduct } from "@/data/store"
import { getPrisma } from "@/lib/prisma"
import { COMPTOIR_CODE, ensureOperationalStockLocations, ensurePointOfSaleStockRows } from "@/lib/stock-service"
import { placeUnlocatedStockTx } from "@/lib/lot-coherence"
import { parseVariants } from "@/lib/product-validation"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get("all") === "1"
  if (includeAll) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }
  const products = await getProducts({ includeInactive: includeAll })
  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const { name, subtitle, description, image, categoryId, isFeatured, isActive, badge, variants } = body

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Le nom du produit est requis" }, { status: 400 })
    }
    const parsed = parseVariants(variants)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const product = await createProduct({
      name: name.trim(),
      subtitle: subtitle || null,
      description: description || null,
      image: image || null,
      categoryId: categoryId || null,
      isFeatured: isFeatured || false,
      isActive: isActive !== false,
      badge: badge || null,
      variants: parsed.variants.map((v) => ({ ...v, stock: v.stock ?? 0 })),
    })
    const locations = await ensureOperationalStockLocations()
    await ensurePointOfSaleStockRows(locations.map((l) => l.id))

    // Le stock saisi à la création va au Comptoir LCG (avec son lot) : sans point de vente,
    // il resterait invisible en caisse.
    const comptoir = locations.find((l) => l.code === COMPTOIR_CODE)
    const session = await auth()
    if (comptoir && product.variants.some((v) => v.stock > 0)) {
      await getPrisma().$transaction(async (tx) => {
        for (const v of product.variants) {
          if (v.stock > 0) {
            await placeUnlocatedStockTx(tx, { variantId: v.id, comptoirId: comptoir.id, actorId: session?.user?.id ?? null, reason: "Stock initial du produit" })
          }
        }
      })
    }

    await logActivity({ module: "produits", action: "Création", entity: "product", entityId: product.id, summary: `Produit « ${product.name} » créé` })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error("Product create error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
