import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

const MODULES = [
  "dashboard", "ventes", "tickets", "commandes", "stock", "caisse",
  "journal-caisse", "production", "distribution", "livraisons",
  "reservations", "points-de-vente", "produits", "rapports",
  "controle-distant", "utilisateurs",
]

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const profiles = await getPrisma().roleProfile.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } })
    const roleKeys = profiles.map((p) => p.key)

    const rolePermissions = await getPrisma().rolePermission.findMany({
      where: { role: { in: roleKeys } },
      orderBy: [{ role: "asc" }, { module: "asc" }],
    })

    const grouped = roleKeys.map((role) => ({
      role,
      permissions: MODULES.map((mod) => {
        const existing = rolePermissions.find((rp) => rp.role === role && rp.module === mod)
        return {
          module: mod,
          canView: existing?.canView ?? false,
          canCreate: existing?.canCreate ?? false,
          canEdit: existing?.canEdit ?? false,
          canDelete: existing?.canDelete ?? false,
        }
      }),
    }))

    const userCounts = await getPrisma().user.groupBy({
      by: ["role"],
      _count: { id: true },
    })
    const counts = Object.fromEntries(userCounts.map((uc) => [uc.role, uc._count.id]))

    return NextResponse.json({ roles: grouped, userCounts: counts, modules: MODULES })
  } catch (error) {
    console.error("GET roles error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const { role, permissions } = body as { role: string; permissions: { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[] }

    if (!role || typeof role !== "string") {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })
    }
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: "Permissions invalides" }, { status: 400 })
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } })

      const data = permissions
        .filter((p) => p.canView || p.canCreate || p.canEdit || p.canDelete)
        .map((p) => ({
          role,
          module: p.module,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        }))

      if (data.length > 0) {
        await tx.rolePermission.createMany({ data })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PUT roles error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
