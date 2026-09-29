import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"

function serialize(c: {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  minSubtotal: number
  startsAt: Date
  endsAt: Date | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    minSubtotal: c.minSubtotal,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  }
}

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const rows = await getPrisma().coupon.findMany({ orderBy: { createdAt: "desc" } })
    return NextResponse.json(rows.map(serialize))
  } catch (error) {
    console.error("Coupons list error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : ""
    const type = body.type === "FIXED" ? "FIXED" : "PERCENT"
    const value = Number(body.value)
    const minSubtotal = body.minSubtotal === undefined || body.minSubtotal === "" ? 0 : Number(body.minSubtotal)
    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date()
    const endsAt = body.endsAt ? new Date(body.endsAt) : null
    const maxUses = body.maxUses === undefined || body.maxUses === null || body.maxUses === "" ? null : Math.floor(Number(body.maxUses))

    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return NextResponse.json({ error: "Code invalide (3 à 32 caractères : lettres, chiffres, - ou _)" }, { status: 400 })
    }
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "La valeur de la remise doit être positive" }, { status: 400 })
    }
    if (type === "PERCENT" && value > 100) {
      return NextResponse.json({ error: "Un pourcentage ne peut dépasser 100" }, { status: 400 })
    }
    if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
      return NextResponse.json({ error: "Sous-total minimum invalide" }, { status: 400 })
    }
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      return NextResponse.json({ error: "Dates invalides" }, { status: 400 })
    }
    if (endsAt && endsAt <= startsAt) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 })
    }
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
      return NextResponse.json({ error: "Nombre d'utilisations invalide" }, { status: 400 })
    }

    const duplicate = await getPrisma().coupon.findUnique({ where: { code } })
    if (duplicate) return NextResponse.json({ error: "Ce code existe déjà" }, { status: 400 })

    const created = await getPrisma().coupon.create({
      data: {
        code,
        description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
        type,
        value,
        minSubtotal,
        startsAt,
        endsAt,
        maxUses,
        isActive: body.isActive !== false,
      },
    })
    return NextResponse.json(serialize(created), { status: 201 })
  } catch (error) {
    console.error("Coupon create error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
