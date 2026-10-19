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

const PARTNER_SELECT = {
  id: true,
  name: true,
  companyName: true,
  phone: true,
  email: true,
  address: true,
  notes: true,
  isActive: true,
  discountPercent: true,
} as const

export async function GET(_request: NextRequest, { params }: Ctx) {
  const forbidden = await requireManagementAccess(PARTNER_READ_ROLES, [["partenaires", "view"]])
  if (forbidden) return forbidden

  const { id } = await params
  const partner = await getPrisma().partner.findUnique({
    where: { id },
    select: PARTNER_SELECT,
  })
  if (!partner) return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 })

  return NextResponse.json(partner)
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const forbidden = await requireManagementAccess(PARTNER_WRITE_ROLES, [["partenaires"]])
  if (forbidden) return forbidden

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) return NextResponse.json({ error: "Le nom du partenaire est requis" }, { status: 400 })
    data.name = name
  }
  for (const field of ["companyName", "phone", "email", "address", "notes"] as const) {
    if (body[field] !== undefined) {
      const value = body[field]
      data[field] = typeof value === "string" && value.trim() ? value.trim() : null
    }
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
  if (body.discountPercent !== undefined) {
    const pct = Number(body.discountPercent)
    if (!Number.isFinite(pct)) return NextResponse.json({ error: "Remise invalide." }, { status: 400 })
    data.discountPercent = Math.max(0, Math.min(100, Math.trunc(pct)))
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 })
  }

  try {
    const partner = await getPrisma().partner.update({ where: { id }, data, select: PARTNER_SELECT })
    return NextResponse.json(partner)
  } catch (error) {
    if (errorCode(error) === "P2025") {
      return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 })
    }
    console.error("PATCH /api/partenaires/[id] error", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const forbidden = await requireManagementAccess(PARTNER_WRITE_ROLES, [["partenaires"]])
  if (forbidden) return forbidden

  const { id } = await params
  const prisma = getPrisma()

  const orderCount = await prisma.order.count({ where: { partnerId: id } })
  if (orderCount > 0) {
    return NextResponse.json(
      { error: "Ce partenaire est rattaché à des commandes et ne peut pas être supprimé." },
      { status: 400 },
    )
  }

  try {
    await prisma.partner.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (errorCode(error) === "P2025") {
      return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 })
    }
    console.error("DELETE /api/partenaires/[id] error", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
