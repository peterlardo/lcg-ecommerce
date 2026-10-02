import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getProductById, updateProduct, deleteProduct, VariantInUseError, type ProductWriteInput } from "@/data/store"
import { parseVariants } from "@/lib/product-validation"

export async function GET(_req: Request, ctx: RouteContext<"/api/produits/[id]">) {
  const { id } = await ctx.params
  const product = await getProductById(id)
  // Un produit masqué n'est visible que par la gestion.
  if (!product || (!product.isActive && (await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])))) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }
  return NextResponse.json(product)
}

const optionalText = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

export async function PATCH(req: Request, ctx: RouteContext<"/api/produits/[id]">) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()

    // Seuls les champs connus sont transmis à la base, chacun validé.
    const data: Partial<ProductWriteInput> = {}
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "Le nom du produit est requis" }, { status: 400 })
      }
      data.name = body.name.trim()
    }
    if (body.subtitle !== undefined) data.subtitle = optionalText(body.subtitle)
    if (body.description !== undefined) data.description = optionalText(body.description)
    if (body.image !== undefined) data.image = optionalText(body.image)
    if (body.badge !== undefined) data.badge = optionalText(body.badge)
    if (body.categoryId !== undefined) data.categoryId = optionalText(body.categoryId)
    if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.variants !== undefined) {
      const parsed = parseVariants(body.variants)
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
      data.variants = parsed.variants
    }

    const success = await updateProduct(id, data)
    if (!success) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof VariantInUseError) {
      return NextResponse.json(
        {
          error: `Impossible de retirer ${error.formats.map((f) => `« ${f} »`).join(", ")} : déjà vendu ou en stock. Gardez cette variante.`,
        },
        { status: 409 }
      )
    }
    console.error("Product update error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/produits/[id]">) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const result = await deleteProduct(id)
    if (result === "not_found") {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Product delete error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
