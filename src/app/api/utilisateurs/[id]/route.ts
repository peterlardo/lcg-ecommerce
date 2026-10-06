import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, STAFF_ROLES } from "@/lib/api-auth"

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const { id } = (await context.params) as { id: string }
    const body = await request.json()
    const data: Record<string, unknown> = { name: body.name?.trim() || null, email: body.email?.trim() || undefined, phone: body.phone?.trim() || null, role: body.role, isActive: body.isActive }
    if (body.password) data.password = await bcrypt.hash(String(body.password), 12)
    if (body.image !== undefined) data.image = body.image || null
    // Promotion vers un rôle hors STAFF_ROLES (ex. COMPTABLE) : sans
    // emailVerified le compte ne pourrait plus jamais se connecter.
    if (body.role && !STAFF_ROLES.includes(String(body.role))) {
      const existing = await getPrisma().user.findUnique({ where: { id }, select: { emailVerified: true } })
      if (existing && !existing.emailVerified) data.emailVerified = new Date()
    }
    const user = await getPrisma().user.update({ where: { id }, data: data as never })
    if (Array.isArray(body.permissions)) {
      await getPrisma().userPermission.deleteMany({ where: { userId: id } })
      if (body.permissions.length) await getPrisma().userPermission.createMany({ data: body.permissions.map((permission: Record<string, unknown>) => ({ userId: id, module: String(permission.module), canView: Boolean(permission.canView), canCreate: Boolean(permission.canCreate), canEdit: Boolean(permission.canEdit), canDelete: Boolean(permission.canDelete) })) })
    }
    if (Array.isArray(body.posIds)) {
      await getPrisma().pointOfSale.updateMany({ where: { managerUserId: id }, data: { managerUserId: null } })
      if (body.posIds.length) await getPrisma().pointOfSale.updateMany({ where: { id: { in: body.posIds } }, data: { managerUserId: id } })
    }
    return NextResponse.json({ id: user.id })
  } catch { return NextResponse.json({ error: "Impossible de modifier l'utilisateur" }, { status: 400 }) }
}
