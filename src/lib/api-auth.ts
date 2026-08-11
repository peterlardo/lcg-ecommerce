import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Role = "ADMIN" | "STOCK_MANAGER" | "DELIVERY_AGENT" | "CUSTOMER"

const MANAGEMENT_ROLES: Role[] = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]

export async function requireManagementAccess(roles: Role[] = MANAGEMENT_ROLES) {
  const session = await auth()
  const role = session?.user?.role as Role | undefined

  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }

  if (!role || !roles.includes(role)) {
    return NextResponse.json({ error: "Acces non autorise" }, { status: 403 })
  }

  return null
}

export type PermissionAction = "view" | "create" | "edit" | "delete"

type PermissionKey = "canView" | "canCreate" | "canEdit" | "canDelete"

export type UserPOSFilter = { userId: string; role: string; posIds: string[] | null }

export async function getUserPointOfSaleIds(): Promise<UserPOSFilter | null> {
  const session = await auth()
  if (!session?.user) return null
  const role = session.user.role as Role
  const userId = session.user.id

  if (role === "ADMIN") return { userId, role, posIds: null }

  const posList = await prisma.pointOfSale.findMany({
    where: { managerUserId: userId },
    select: { id: true },
  })
  const posIds = posList.map((p) => p.id)
  return { userId, role, posIds: posIds.length > 0 ? posIds : [] }
}

export async function requireModuleAccess(module: string, action: PermissionAction = "view") {
  const session = await auth()
  const role = session?.user?.role as Role | undefined

  if (!session?.user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  if (role === "ADMIN") return null
  if (!role || !MANAGEMENT_ROLES.includes(role)) return NextResponse.json({ error: "Acces non autorise" }, { status: 403 })

  const permission = await prisma.userPermission.findUnique({
    where: { userId_module: { userId: session.user.id, module } },
  })
  const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as PermissionKey
  return permission?.[key] ? null : NextResponse.json({ error: `Droit requis: ${action} sur ${module}` }, { status: 403 })
}
