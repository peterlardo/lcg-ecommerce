import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma";

type Role = string

/** Rôles pour lesquels le login n'exige PAS `emailVerified` (identique à
 *  STAFF_ROLES de src/lib/auth.ts — duplication assumée : auth.ts importe
 *  déjà api-auth, import circulaire à éviter). */
export const STAFF_ROLES: Role[] = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]

const MANAGEMENT_ROLES: Role[] = STAFF_ROLES

/** Rôle responsable comptable : lecture large + édition des commandes/factures
 *  B2B, jamais de création/annulation de vente ni d'accès stock/caisse. */
export const COMPTABLE_ROLE = "COMPTABLE"

export function isComptable(role: string | undefined): boolean {
  return role === COMPTABLE_ROLE
}

/** Portée B2B stricte : seules les commandes rattachées à un client B2B.
 *  `{}` pour tous les autres rôles. À combiner en AND dans un `where`. */
export function b2bOrderScope(role: string | undefined): Prisma.OrderWhereInput {
  return isComptable(role) ? { b2bClientId: { not: null } } : {}
}

/** Statuts qu'un COMPTABLE peut appliquer : ni confirmation (débite le stock)
 *  ni annulation (remet du stock en jeu). */
export const COMPTABLE_STATUS: string[] = ["PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]

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
  order: { notes: string | null; userId: string | null; b2bClientId?: string | null },
  role: string | undefined,
  selfId: string | undefined
): boolean {
  if (role === "ADMIN") return false
  if (!role || !selfId) return true
  // Responsable comptable : uniquement les commandes des clients B2B.
  if (isComptable(role)) return !order.b2bClientId
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
