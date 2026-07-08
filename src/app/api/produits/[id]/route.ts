import { NextResponse } from "next/server"
import { getProductById, updateProduct, deleteProduct } from "@/data/store"

export async function GET(_req: Request, ctx: RouteContext<"/api/produits/[id]">) {
  const { id } = await ctx.params
  const product = await getProductById(id)
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }
  return NextResponse.json(product)
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/produits/[id]">) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const success = await updateProduct(id, body)
    if (!success) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Product update error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/produits/[id]">) {
  const { id } = await ctx.params
  const success = await deleteProduct(id)
  if (!success) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
