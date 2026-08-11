import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

const ROLES = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "CUSTOMER"] as const

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  const users = await prisma.user.findMany({ include: { permissions: true, managedPointOfSales: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: "desc" } })
  return NextResponse.json(users.map(({ password, ...user }) => user))
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    const role = ROLES.includes(body.role) ? body.role : "CUSTOMER"
    if (!email || password.length < 6) return NextResponse.json({ error: "Email et mot de passe de 6 caractères minimum requis" }, { status: 400 })
    const user = await prisma.user.create({
      data: {
        name: body.name?.trim() || null,
        email,
        phone: body.phone?.trim() || null,
        password: await bcrypt.hash(password, 12),
        role,
        isActive: body.isActive !== false,
        image: body.image || null,
      },
    })
    if (Array.isArray(body.permissions) && body.permissions.length) {
      await prisma.userPermission.createMany({ data: body.permissions.map((permission: Record<string, unknown>) => ({ userId: user.id, module: String(permission.module), canView: Boolean(permission.canView), canCreate: Boolean(permission.canCreate), canEdit: Boolean(permission.canEdit), canDelete: Boolean(permission.canDelete) })) })
    }
    if (Array.isArray(body.posIds) && body.posIds.length) {
      await prisma.pointOfSale.updateMany({ where: { id: { in: body.posIds } }, data: { managerUserId: user.id } })
    }
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "Cet email existe déjà" }, { status: 409 })
    return NextResponse.json({ error: "Impossible de créer l’utilisateur" }, { status: 500 })
  }
}

