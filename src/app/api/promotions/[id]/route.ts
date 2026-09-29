import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"

export async function PATCH(req: Request, ctx: RouteContext<"/api/promotions/[id]">) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const existing = await getPrisma().promotion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Promotion introuvable" }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
      data.name = name
    }
    if (body.percent !== undefined) {
      const percent = Number(body.percent)
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return NextResponse.json({ error: "La remise doit être comprise entre 1 et 100 %" }, { status: 400 })
      }
      data.percent = percent
    }
    const startsAt = body.startsAt !== undefined ? new Date(body.startsAt) : null
    const endsAt = body.endsAt !== undefined ? new Date(body.endsAt) : null
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Date de début invalide" }, { status: 400 })
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 })
    }
    const finalStart = startsAt ?? existing.startsAt
    const finalEnd = endsAt ?? existing.endsAt
    if (finalEnd <= finalStart) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 })
    }
    if (startsAt) data.startsAt = startsAt
    if (endsAt) data.endsAt = endsAt
    if (body.productId !== undefined) data.productId = body.productId || null
    if (body.categoryId !== undefined) data.categoryId = body.categoryId || null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    await getPrisma().promotion.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Promotion update error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/promotions/[id]">) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const existing = await getPrisma().promotion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Promotion introuvable" }, { status: 404 })
    await getPrisma().promotion.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Promotion delete error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
