import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { isSessionOpen } from "@/lib/device-session"

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const users = await getPrisma().user.findMany({
      include: {
        permissions: true,
        managedPointOfSales: { select: { id: true, name: true, code: true } },
        deviceSessions: { where: { isActive: true }, orderBy: { lastActiveAt: "desc" }, take: 1, select: { deviceName: true, deviceType: true, lastActiveAt: true, isActive: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(
      users.map(({ password, deviceSessions, ...user }) => {
        void password // exclu volontairement de la réponse (jamais exposé)
        // session ouverte du compte (une seule à la fois), ou null
        const session = deviceSessions[0]
        const openSession = session && isSessionOpen(session) ? { deviceName: session.deviceName, deviceType: session.deviceType, lastActiveAt: session.lastActiveAt } : null
        return { ...user, openSession }
      })
    )
  } catch (error) {
    console.error("GET utilisateurs error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    const requestedRole = String(body.role || "").trim().toUpperCase()
    const validProfile = await getPrisma().roleProfile.findUnique({ where: { key: requestedRole } })
    // Refuser plutôt que de basculer silencieusement en CUSTOMER : un compte
    // créé avec le mauvais rôle donne l'impression que l'enregistrement a échoué.
    if (!validProfile) return NextResponse.json({ error: `Rôle inconnu : ${requestedRole || "(vide)"}` }, { status: 400 })
    const role = requestedRole
    if (!email || password.length < 6) return NextResponse.json({ error: "Email et mot de passe de 6 caractères minimum requis" }, { status: 400 })
    const user = await getPrisma().user.create({
      data: {
        name: body.name?.trim() || null,
        email,
        phone: body.phone?.trim() || null,
        password: await bcrypt.hash(password, 12),
        role,
        // Compte provisionné par un ADMIN : considéré comme vérifié, sinon un
        // rôle hors STAFF_ROLES (ex. COMPTABLE) ne pourrait jamais se connecter
        // (la vérification par e-mail ne fonctionne pas — SMTP en échec).
        emailVerified: new Date(),
        isActive: body.isActive !== false,
        image: body.image || null,
      },
    })
    if (Array.isArray(body.permissions) && body.permissions.length) {
      await getPrisma().userPermission.createMany({ data: body.permissions.map((permission: Record<string, unknown>) => ({ userId: user.id, module: String(permission.module), canView: Boolean(permission.canView), canCreate: Boolean(permission.canCreate), canEdit: Boolean(permission.canEdit), canDelete: Boolean(permission.canDelete) })) })
    }
    if (Array.isArray(body.posIds) && body.posIds.length) {
      await getPrisma().pointOfSale.updateMany({ where: { id: { in: body.posIds } }, data: { managerUserId: user.id } })
    }
    await logActivity({ module: "utilisateurs", action: "Création", entity: "user", entityId: user.id, summary: `Compte ${user.email} créé (${role})` })
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "Cet email existe déjà" }, { status: 409 })
    return NextResponse.json({ error: "Impossible de créer l’utilisateur" }, { status: 500 })
  }
}

