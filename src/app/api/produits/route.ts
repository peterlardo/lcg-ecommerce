import { NextResponse } from "next/server"
import { getProducts, createProduct } from "@/data/store"

export async function GET() {
  const products = await getProducts()
  return NextResponse.json(products)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, subtitle, description, image, categoryId, categorySlug, categoryName, isFeatured, badge, variants } = body

    if (!name || !variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ error: "Nom et au moins une variante sont requis" }, { status: 400 })
    }

    const product = await createProduct({
      name,
      subtitle: subtitle || null,
      description: description || null,
      image: image || null,
      categoryId: categoryId || null,
      categorySlug: categorySlug || null,
      categoryName: categoryName || null,
      isFeatured: isFeatured || false,
      badge: badge || null,
      variants: variants.map((v: any) => ({
        format: v.format,
        price: Number(v.price),
        stock: Number(v.stock) || 0,
        unit: v.unit || null,
      })),
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error("Product create error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
