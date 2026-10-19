import { NextRequest, NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { CASHIER_ROLES } from "@/lib/permissions"

export const dynamic = "force-dynamic"

// Lecture alignée sur le POST de /api/sales : les rôles qui vendent au comptoir
// doivent pouvoir choisir un partenaire et lire sa grille de prix.
const PARTNER_READ_ROLES = ["ADMIN", "STOCK_MANAGER", ...CASHIER_ROLES]

const partnerSummary = {
  id: true,
  name: true,
  companyName: true,
  phone: true,
  isActive: true,
} as const

export async function GET(request: NextRequest) {
  const denied = await requireManagementAccess(PARTNER_READ_ROLES)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const active = searchParams.get("active")
  const withPrices = searchParams.get("withPrices") === "1"

  try {
  const prisma = getPrisma()
  const partners = await prisma.partner.findMany({
    where: {
      ...(active === "1" ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { companyName: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      ...partnerSummary,
      ...(withPrices
        ? {
            prices: {
              select: { variantId: true, price: true },
            },
          }
        : {}),
    },
  })

  return NextResponse.json(partners)
  } catch (error) {
    console.error("GET /api/partenaires error", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireManagementAccess(["ADMIN"], [["partenaires"]])
  if (denied) return denied

  const user = await getCurrentUser()
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "Le nom du partenaire est requis" }, { status: 400 })
  }

  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

  const prisma = getPrisma()
  const partner = await prisma.partner.create({
    data: {
      name,
      companyName: str(body.companyName),
      phone: str(body.phone),
      email: str(body.email),
      address: str(body.address),
      notes: str(body.notes),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      createdById: user?.id ?? null,
    },
    select: partnerSummary,
  })

  return NextResponse.json(partner, { status: 201 })
}
