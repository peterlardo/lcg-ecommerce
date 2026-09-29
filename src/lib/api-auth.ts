import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma";

type Role = string

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

/**
 * Règle de visibilité des commandes/ventes :
 * - ADMIN : tout
 * - COMMERCIAL : uniquement ses propres commandes
 * - autres rôles (STOCK_MANAGER, DELIVERY_AGENT) : tout SAUF les ventes comptoir
 *   réalisées par un autre vendeur (ownership sur `userId`).
 * Retourne true si l'accès à cette commande doit être refusé (404).
 */
export function isRestrictedOrder(
  order: { notes: string | null; userId: string | null },
  role: string | undefined,
  selfId: string | undefined
): boolean {
  if (role === "ADMIN") return false
  if (!role || !selfId) return true
  if (order.userId && order.userId === selfId) return false
  if (role === "COMMERCIAL") return true
  return (order.notes ?? "").startsWith("Vente comptoir")
}

/**
 * Filtre de visibilité des mouvements de stock pour les listes/historiques :
 * les non-ADMIN ne voient pas les mouvements SALE « Vente comptoir » des
 * autres vendeurs (leur `reference` = numéro de commande d'autrui).
 * À combiner en AND dans le `where` de `stockMovement.findMany`.
 */
export function saleMovementsFilter(
  role: string | undefined,
  selfId: string | undefined
): Prisma.StockMovementWhereInput {
  if (!role || role === "ADMIN") return {}
  const notForeignCounterSale: Prisma.StockMovementWhereInput = {
    NOT: { AND: [{ type: "SALE" }, { reason: { startsWith: "Vente comptoir" } }] },
  }
  if (!selfId) return notForeignCounterSale
  return { OR: [notForeignCounterSale, { userId: selfId }] }
}

type PermissionKey = "canView" | "canCreate" | "canEdit" | "canDelete"

export type UserPOSFilter = { userId: string; role: string; posIds: string[] | null }

export async function getUserPointOfSaleIds(): Promise<UserPOSFilter | null> {
  const session = await auth()
  if (!session?.user) return null
  const role = session.user.role as Role
  const userId = session.user.id

  if (role === "ADMIN") return { userId, role, posIds: null }

  const posList = await getPrisma().pointOfSale.findMany({
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

  const permission = await getPrisma().userPermission.findUnique({
    where: { userId_module: { userId: session.user.id, module } },
  })
  const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as PermissionKey
  return permission?.[key] ? null : NextResponse.json({ error: `Droit requis: ${action} sur ${module}` }, { status: 403 })
}
