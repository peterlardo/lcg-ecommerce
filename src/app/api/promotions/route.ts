import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"

type PromotionRow = {
  id: string
  name: string
  percent: number
  productId: string | null
  categoryId: string | null
  startsAt: Date
  endsAt: Date
  isActive: boolean
  createdAt: Date
  product: { name: string } | null
  category: { name: string } | null
}

function serialize(p: PromotionRow) {
  return {
    id: p.id,
    name: p.name,
    percent: p.percent,
    productId: p.productId,
    productName: p.product?.name ?? null,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    scope: p.productId ? "product" : p.categoryId ? "category" : "all",
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }
}

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const rows = await getPrisma().promotion.findMany({
      include: { product: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(rows.map(serialize))
  } catch (error) {
    console.error("Promotions list error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const percent = Number(body.percent)
    const startsAt = new Date(body.startsAt)
    const endsAt = new Date(body.endsAt)

    if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return NextResponse.json({ error: "La remise doit être comprise entre 1 et 100 %" }, { status: 400 })
    }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Dates de validité invalides" }, { status: 400 })
    }
    if (endsAt <= startsAt) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 })
    }

    const productId = typeof body.productId === "string" && body.productId ? body.productId : null
    const categoryId = typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null

    const created = await getPrisma().promotion.create({
      data: {
        name,
        percent,
        productId,
        categoryId,
        startsAt,
        endsAt,
        isActive: body.isActive !== false,
      },
      include: { product: { select: { name: true } }, category: { select: { name: true } } },
    })
    return NextResponse.json(serialize(created), { status: 201 })
  } catch (error) {
    console.error("Promotion create error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
