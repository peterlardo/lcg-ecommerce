import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getProducts, createProduct } from "@/data/store"
import { ensureOperationalStockLocations, ensurePointOfSaleStockRows } from "@/lib/stock-service"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const includeAll = searchParams.get("all") === "1"
  if (includeAll) {
    const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
    if (forbidden) return forbidden
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

    if (!name || !variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ error: "Nom et au moins une variante sont requis" }, { status: 400 })
    }
    const invalidVariant = variants.find(
      (v) => !v?.format || !Number.isFinite(Number(v?.price)) || Number(v?.price) < 0
    )
    if (invalidVariant) {
      return NextResponse.json({ error: "Chaque variante doit avoir un format et un prix valide" }, { status: 400 })
    }

    const product = await createProduct({
      name,
      subtitle: subtitle || null,
      description: description || null,
      image: image || null,
      categoryId: categoryId || null,
      isFeatured: isFeatured || false,
      isActive: isActive !== false,
      badge: badge || null,
      variants: variants.map((v) => ({
        format: v.format,
        price: Number(v.price),
        stock: v.stock === undefined || v.stock === null || v.stock === "" ? 0 : Math.max(0, Math.floor(Number(v.stock))),
        unit: v.unit || null,
      })),
    })
    const locations = await ensureOperationalStockLocations()
    await ensurePointOfSaleStockRows(locations.map((l) => l.id))

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error("Product create error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
