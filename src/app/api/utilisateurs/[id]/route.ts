import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, STAFF_ROLES } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const { id } = (await context.params) as { id: string }
    const body = await request.json()
    // Seuls les champs PRÉSENTS dans le corps sont modifiés : un PATCH partiel
    // (ex. changement de photo envoyant {image}) ne doit jamais effacer le nom,
    // le téléphone ou l'email.
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name?.trim() || null
    if (body.email !== undefined) data.email = body.email?.trim() || null
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null
    if (body.role !== undefined) {
      const roleProfile = await getPrisma().roleProfile.findUnique({ where: { key: String(body.role).trim().toUpperCase() } })
      if (!roleProfile) return NextResponse.json({ error: `Rôle inconnu : ${body.role}` }, { status: 400 })
      data.role = roleProfile.key
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
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
    await logActivity({ module: "utilisateurs", action: "Modification", entity: "user", entityId: id, summary: `Compte ${user.email} modifié${body.role ? ` (rôle ${body.role})` : ""}${body.password ? " · mot de passe réinitialisé" : ""}` })
    return NextResponse.json({ id: user.id })
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === "P2002") return NextResponse.json({ error: "Cet email existe déjà" }, { status: 409 })
    if (code === "P2025") return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    console.error("PATCH utilisateurs error:", error)
    return NextResponse.json({ error: "Impossible de modifier l'utilisateur" }, { status: 400 })
  }
}
