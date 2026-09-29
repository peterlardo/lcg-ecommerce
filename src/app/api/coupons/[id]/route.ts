import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"

export async function PATCH(req: Request, ctx: RouteContext<"/api/coupons/[id]">) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const existing = await getPrisma().coupon.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Coupon introuvable" }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.code !== undefined) {
      const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : ""
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
        return NextResponse.json({ error: "Code invalide (3 à 32 caractères : lettres, chiffres, - ou _)" }, { status: 400 })
      }
      if (code !== existing.code) {
        const duplicate = await getPrisma().coupon.findUnique({ where: { code } })
        if (duplicate) return NextResponse.json({ error: "Ce code existe déjà" }, { status: 400 })
      }
      data.code = code
    }
    if (body.type !== undefined) data.type = body.type === "FIXED" ? "FIXED" : "PERCENT"
    if (body.value !== undefined) {
      const value = Number(body.value)
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ error: "La valeur de la remise doit être positive" }, { status: 400 })
      }
      const finalType = data.type ?? existing.type
      if (finalType === "PERCENT" && value > 100) {
        return NextResponse.json({ error: "Un pourcentage ne peut dépasser 100" }, { status: 400 })
      }
      data.value = value
    }
    if (body.minSubtotal !== undefined) {
      const minSubtotal = body.minSubtotal === "" ? 0 : Number(body.minSubtotal)
      if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
        return NextResponse.json({ error: "Sous-total minimum invalide" }, { status: 400 })
      }
      data.minSubtotal = minSubtotal
    }
    if (body.startsAt !== undefined) {
      const d = new Date(body.startsAt)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Date de début invalide" }, { status: 400 })
      data.startsAt = d
    }
    if (body.endsAt !== undefined) {
      const d = body.endsAt ? new Date(body.endsAt) : null
      if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 })
      data.endsAt = d
    }
    if (body.maxUses !== undefined) {
      const maxUses = body.maxUses === null || body.maxUses === "" ? null : Math.floor(Number(body.maxUses))
      if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
        return NextResponse.json({ error: "Nombre d'utilisations invalide" }, { status: 400 })
      }
      data.maxUses = maxUses
    }
    if (body.description !== undefined) {
      data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const finalStart = data.startsAt ? new Date(data.startsAt as Date) : existing.startsAt
    const finalEnd = data.endsAt !== undefined ? (data.endsAt as Date | null) : existing.endsAt
    if (finalEnd && finalEnd <= finalStart) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 })
    }

    await getPrisma().coupon.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Coupon update error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/coupons/[id]">) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const existing = await getPrisma().coupon.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Coupon introuvable" }, { status: 404 })
    await getPrisma().coupon.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Coupon delete error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
