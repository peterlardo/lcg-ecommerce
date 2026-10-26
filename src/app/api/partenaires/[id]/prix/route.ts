import { NextRequest, NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"
import { CASHIER_ROLES } from "@/lib/permissions"

export const dynamic = "force-dynamic"

const PARTNER_READ_ROLES = ["ADMIN", "STOCK_MANAGER", ...CASHIER_ROLES]
const PARTNER_WRITE_ROLES = ["ADMIN"]

type Ctx = { params: Promise<{ id: string }> }

function errorCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : null
}

// GET /api/partenaires/[id]/prix : liste le catalogue (produits + variantes) et le tarif
// preferentiel du partenaire pour chaque variante. Sert a l'editeur de la fiche partenaire
// ET a l'ecran de vente (reprixage du panier).
export async function GET(_request: NextRequest, { params }: Ctx) {
  const forbidden = await requireManagementAccess(PARTNER_READ_ROLES, [["partenaires", "view"]])
  if (forbidden) return forbidden

  const { id } = await params
  const prisma = getPrisma()

  try {
    const partner = await prisma.partner.findUnique({
      where: { id },
      select: { id: true, name: true, discountPercent: true },
    })
    if (!partner) return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 })

    const [products, prices] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          variants: {
            orderBy: { format: "asc" },
            select: { id: true, format: true, price: true },
          },
        },
      }),
      prisma.partnerPrice.findMany({
        where: { partnerId: id },
        select: { variantId: true, price: true, variant: { select: { format: true, product: { select: { name: true, isActive: true } } } } },
      }),
    ])

    const priceByVariant = new Map(prices.map((p) => [p.variantId, p.price]))

    return NextResponse.json({
      partnerId: partner.id,
      partnerName: partner.name,
      discountPercent: partner.discountPercent,
      // cohérence : prix restés sur un produit retiré de la vente (absent du catalogue ci-dessous)
      retired: prices
        .filter((p) => !p.variant.product.isActive)
        .map((p) => ({ variantId: p.variantId, price: p.price, productName: p.variant.product.name, format: p.variant.format })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        variants: p.variants.map((v) => ({
          id: v.id,
          format: v.format,
          price: v.price,
          partnerPrice: priceByVariant.get(v.id) ?? null,
        })),
      })),
    })
  } catch (error) {
    console.error("GET /api/partenaires/[id]/prix error", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT /api/partenaires/[id]/prix : upsert du tarif preferentiel d'une variante.
// Body : { variantId, price }. price = null => suppression du tarif.
export async function PUT(request: NextRequest, { params }: Ctx) {
  const forbidden = await requireManagementAccess(PARTNER_WRITE_ROLES, [["partenaires", "edit"]])
  if (forbidden) return forbidden

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  const variantId = typeof body.variantId === "string" ? body.variantId.trim() : ""
  if (!variantId) return NextResponse.json({ error: "Variante requise" }, { status: 400 })

  const prisma = getPrisma()

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true, price: true, product: { select: { isActive: true } } } })
  if (!variant) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })

  const raw = body.price
  const isClear = raw === null || raw === "" || raw === undefined

  try {
    if (isClear) {
      await prisma.partnerPrice.deleteMany({ where: { partnerId: id, variantId } })
      return NextResponse.json({ ok: true, variantId, price: null })
    }

    const price = Number(raw)
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Prix invalide : il doit être supérieur à 0" }, { status: 400 })
    }
    // cohérence avec le catalogue : un prix spécial ne dépasse pas le prix public, et ne vise qu'un produit en vente
    if (price > variant.price) {
      return NextResponse.json({ error: `Le prix spécial ne peut pas dépasser le prix public (${variant.price} FCFA) : laissez le champ vide pour appliquer le prix public` }, { status: 400 })
    }
    if (!variant.product.isActive) {
      return NextResponse.json({ error: "Ce produit est retiré de la vente : pas de prix spécial" }, { status: 400 })
    }

    const saved = await prisma.partnerPrice.upsert({
      where: { partnerId_variantId: { partnerId: id, variantId } },
      create: { partnerId: id, variantId, price },
      update: { price },
      select: { variantId: true, price: true },
    })
    return NextResponse.json({ ok: true, ...saved })
  } catch (error) {
    if (errorCode(error) === "P2003") {
      return NextResponse.json({ error: "Partenaire ou produit introuvable" }, { status: 400 })
    }
    console.error("PUT /api/partenaires/[id]/prix error", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
