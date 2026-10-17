import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma";
import { baseRole, hasPermission, isStaffRole, type PermissionAction } from "@/lib/permissions"

type Role = string

/** Rôles pour lesquels le login n'exige PAS `emailVerified` (identique à
 *  STAFF_ROLES de src/lib/auth.ts — duplication assumée : auth.ts importe
 *  déjà api-auth, import circulaire à éviter). */
export const STAFF_ROLES: Role[] = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]

export const MANAGEMENT_ROLES: Role[] = STAFF_ROLES

/** Rôle responsable comptable : lecture large + édition des commandes/factures
 *  B2B, jamais de création/annulation de vente ni d'accès stock/caisse. */
export const COMPTABLE_ROLE = "COMPTABLE"

export function isComptable(role: string | undefined): boolean {
  return role === COMPTABLE_ROLE
}

/** Rôle « opérateur accueil » (réception) : crée les commandes et les transmet à
 *  la caisse, mais ne voit que les commandes dont il est l'auteur. */
export const OPERATEUR_ACCUEIL_ROLE = "OPERATEUR_ACCUEIL"

export function isOperateurAccueil(role: string | undefined): boolean {
  return role === OPERATEUR_ACCUEIL_ROLE
}

/** Rôles qui voient TOUTES les commandes/ventes, sans isolation par vendeur ni
 *  par point de vente (comme ADMIN) : l'encadrement et la gestion de stock. */
export const ALL_ORDERS_ROLES: Role[] = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]

/** true pour un rôle qui voit tout le parc de commandes/ventes (comme ADMIN). */
export function seesAllOrders(role: string | undefined): boolean {
  return !!role && ALL_ORDERS_ROLES.includes(role)
}

/** Rôles qui ne voient QUE leurs propres commandes/ventes (auteur = eux-mêmes,
 *  ou caissière à qui la commande a été transmise). Tout compte hors encadrement. */
export function seesOnlyOwnOrders(role: string | undefined): boolean {
  return !!role && !seesAllOrders(role)
}

/** Portée B2B stricte : seules les commandes rattachées à un client B2B.
 *  `{}` pour tous les autres rôles. À combiner en AND dans un `where`. */
export function b2bOrderScope(role: string | undefined): Prisma.OrderWhereInput {
  return isComptable(role) ? { b2bClientId: { not: null } } : {}
}

/** Statuts qu'un COMPTABLE peut appliquer : ni confirmation (débite le stock)
 *  ni annulation (remet du stock en jeu). */
export const COMPTABLE_STATUS: string[] = ["PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]

/**
 * Accès ouvert par les droits cochés sur la fiche de l'utilisateur, quand son rôle n'est pas dans la
 * liste de la route : `[modules, action]`. Sert aux profils créés par l'administrateur (ex. CAISSIERE),
 * qui n'étaient acceptés nulle part. Jamais pour les routes réservées au seul administrateur.
 */
export type AccessRule = readonly [modules: readonly string[], action?: PermissionAction]

export async function requireManagementAccess(roles: Role[] = MANAGEMENT_ROLES, rule?: AccessRule) {
  const session = await auth()
  const role = session?.user?.role as Role | undefined

  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }

  // le responsable commercial passe partout où le commercial est admis
  if (role && (roles.includes(role) || roles.includes(baseRole(role)))) return null

  const adminOnly = roles.length === 1 && roles[0] === "ADMIN"
  if (rule && !adminOnly && hasPermission(session.user, [...rule[0]], rule[1] ?? "view")) return null

  return NextResponse.json({ error: "Acces non autorise" }, { status: 403 })
}

export type { PermissionAction }

/**
 * Règle de visibilité des commandes/ventes :
 * - ADMIN : tout
 * - COMMERCIAL : uniquement ses propres commandes
 * - autres rôles (STOCK_MANAGER, DELIVERY_AGENT) : tout SAUF les ventes comptoir
 *   réalisées par un autre vendeur (ownership sur `userId`).
 * Retourne true si l'accès à cette commande doit être refusé (404).
 */
export function isRestrictedOrder(
  order: { notes: string | null; userId: string | null; b2bClientId?: string | null; cashierId?: string | null },
  role: string | undefined,
  selfId: string | undefined
): boolean {
  // Encadrement et gestion de stock : accès à toutes les commandes/ventes.
  if (seesAllOrders(role)) return false
  if (!role || !selfId) return true
  // Responsable comptable : uniquement les commandes des clients B2B.
  if (isComptable(role)) return !order.b2bClientId
  if (order.userId && order.userId === selfId) return false
  // Une caissière à qui la commande a été transmise peut la lire.
  if (order.cashierId && order.cashierId === selfId) return false
  if (seesOnlyOwnOrders(role)) return true
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
  if (!role || seesAllOrders(role) || isComptable(role)) return {}
  // Tous les autres rôles ne voient QUE leurs propres ventes (mouvements SALE
  // dont le `userId` est le leur). Les mouvements hors vente restent partagés :
  // le stock est une ressource commune au point de vente.
  return selfId
    ? { OR: [{ NOT: { type: "SALE" } }, { userId: selfId }] }
    : { NOT: { type: "SALE" } }
}

export type UserPOSFilter = { userId: string; role: string; posIds: string[] | null }

export async function getUserPointOfSaleIds(): Promise<UserPOSFilter | null> {
  const session = await auth()
  if (!session?.user) return null
  const role = session.user.role as Role
  const userId = session.user.id

  if (seesAllOrders(role)) return { userId, role, posIds: null }

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
  // Tout le personnel (profils créés par l'administrateur compris) : c'est le droit coché qui décide.
  // Les droits viennent de la session, tenue à jour à chaque modification de la fiche : pas de requête de plus.
  if (!isStaffRole(role)) return NextResponse.json({ error: "Acces non autorise" }, { status: 403 })
  return hasPermission(session.user, [module], action)
    ? null
    : NextResponse.json({ error: `Droit requis: ${action} sur ${module}` }, { status: 403 })
}
