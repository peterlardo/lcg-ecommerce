/**
 * Droits d'accès : règles communes au menu, aux écrans « Utilisateurs » / « Rôles & permissions »
 * et aux API. Aucun import serveur ici : ce fichier est utilisé des deux côtés.
 */

/**
 * Modules soumis à droits. Liste unique : un module absent d'un écran voyait ses droits effacés à
 * chaque enregistrement, et un écran du menu absent de la liste ne pouvait jamais être accordé.
 */
export const PERMISSION_MODULES = [
  "dashboard", "ventes", "tickets", "commandes", "caisse", "reservations",
  "stock", "etat-stock", "production", "lots", "tracabilite", "distribution", "livraisons",
  "points-de-vente", "produits", "promotions", "rapports",
  "clients", "clients-b2b", "zone-commerciale", "commercial", "creances", "b2b",
  "messages", "parametres", "controle-distant", "utilisateurs", "activite",
] as const

export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", ventes: "Ventes", tickets: "Tickets de vente", commandes: "Commandes",
  caisse: "Caisse", reservations: "Pré-commandes", stock: "Stock", "etat-stock": "État de stock & caisse",
  production: "Production", lots: "Lots", tracabilite: "Traçabilité", distribution: "Distribution",
  livraisons: "Livraisons & livreurs", "points-de-vente": "Points de vente", produits: "Produits",
  promotions: "Promotions & coupons", rapports: "Rapports", clients: "Clients", "clients-b2b": "Clients B2B",
  "zone-commerciale": "Zone commerciale", commercial: "Tableau de bord commercial", creances: "Créances",
  b2b: "Devis, bons et factures B2B",
  messages: "Messages", parametres: "Paramètres",
  "controle-distant": "Contrôle distant", utilisateurs: "Utilisateurs", activite: "Journal d'activité",
}

/**
 * Modules dont les données sont réservées à certains rôles, quelle que soit la case cochée :
 * leurs API refusent tout autre rôle, le menu suit la même règle (sinon l'écran s'ouvrait vide).
 */
export const MODULE_ROLES: Record<string, string[]> = {
  utilisateurs: ["ADMIN"],
  activite: ["ADMIN"],
  clients: ["ADMIN", "COMMERCIAL", "COMPTABLE"],
  "zone-commerciale": ["ADMIN", "COMMERCIAL", "COMPTABLE"],
  commercial: ["ADMIN", "COMMERCIAL", "COMPTABLE"],
  creances: ["ADMIN", "COMMERCIAL", "COMPTABLE"],
  b2b: ["ADMIN", "COMMERCIAL"],
}

/** Écrans pilotés par le droit d'un module voisin. */
export const MODULE_ALIASES: Record<string, string> = { livreurs: "livraisons", archives: "commandes", "devis-b2b": "b2b", "bons-b2b": "b2b" }

/** Rôles historiques de l'administration : sans aucun droit défini, ils voient tout le menu. */
export const LEGACY_ADMIN_ROLES = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMMERCIAL", "COMPTABLE"]

/**
 * Modules propres au responsable commercial (profil RESPONSABLE_COMMERCIAL) : ils font partie de son rôle,
 * il les voit toujours. Les autres commerciaux gardent le menu général, selon les droits cochés sur leur fiche.
 */
export const COMMERCIAL_MODULES = ["commercial", "clients-b2b", "b2b", "creances", "zone-commerciale"]

/**
 * Rôles commerciaux. RESPONSABLE_COMMERCIAL est un profil créé par l'administrateur : il a les écrans
 * et les accès du commercial, et voit tout le portefeuille B2B (pas seulement ses propres clients).
 */
export const COMMERCIAL_MANAGER_ROLE = "RESPONSABLE_COMMERCIAL"
export const COMMERCIAL_ROLES = ["COMMERCIAL", COMMERCIAL_MANAGER_ROLE]

export function isCommercialRole(role: string | null | undefined): boolean {
  return !!role && COMMERCIAL_ROLES.includes(role)
}

/** Le responsable commercial : son propre tableau de bord et son propre menu. */
export function isCommercialManager(role: string | null | undefined): boolean {
  return role === COMMERCIAL_MANAGER_ROLE
}

/** Rôle à comparer aux listes de rôles : le responsable commercial passe partout où le commercial passe. */
export function baseRole<T extends string | null | undefined>(role: T): T | "COMMERCIAL" {
  return role === COMMERCIAL_MANAGER_ROLE ? "COMMERCIAL" : role
}

/** Profils de caisse : ils reçoivent les commandes et sont seuls à établir l'état de caisse. */
export const CASHIER_ROLES = ["CAISSE", "CAISSIERE", "CAISSIER", "CASHIER"]

export const PASSWORD_MIN_LENGTH = 6

export type PermissionAction = "view" | "create" | "edit" | "delete"
export type PermissionRow = { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }
export type PermissionUser = { role?: string | null; permissions?: PermissionRow[] | null } | null | undefined

const FIELD: Record<PermissionAction, keyof Omit<PermissionRow, "module">> = {
  view: "canView", create: "canCreate", edit: "canEdit", delete: "canDelete",
}

export function isCashierRole(role: string | null | undefined): boolean {
  return !!role && CASHIER_ROLES.includes(role)
}

/** Personnel : tout rôle autre que client (rôles système et profils créés par l'administrateur). */
export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && role !== "CUSTOMER" && role !== "DISABLED"
}

/** Le rôle peut-il recevoir ce module ? */
export function moduleOpenTo(role: string | null | undefined, module: string): boolean {
  const reserved = MODULE_ROLES[module]
  return !reserved || (!!role && reserved.includes(baseRole(role) as string))
}

/** Module d'un écran d'administration à partir de son adresse (/admin/livreurs -> livraisons). */
export function moduleOfPath(pathname: string): string {
  const slug = pathname.split("/")[2] || "dashboard"
  return MODULE_ALIASES[slug] ?? slug
}

/** Lignes de droits reçues d'un écran : modules connus seulement, une ligne par module (la dernière gagne). */
export function normalizePermissions(list: unknown): PermissionRow[] {
  if (!Array.isArray(list)) return []
  const out = new Map<string, PermissionRow>()
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue
    const p = raw as Record<string, unknown>
    const mod = typeof p.module === "string" ? p.module : ""
    if (!(PERMISSION_MODULES as readonly string[]).includes(mod)) continue
    out.set(mod, { module: mod, canView: !!p.canView, canCreate: !!p.canCreate, canEdit: !!p.canEdit, canDelete: !!p.canDelete })
  }
  return [...out.values()]
}

/** L'utilisateur a-t-il le droit `action` sur l'un des modules ? (droits cochés sur sa fiche) */
export function hasPermission(user: PermissionUser, modules: string[], action: PermissionAction = "view"): boolean {
  if (!user?.role || !isStaffRole(user.role)) return false
  if (user.role === "ADMIN") return true
  const field = FIELD[action]
  return (user.permissions ?? []).some((p) => modules.includes(p.module) && p[field] && moduleOpenTo(user.role, p.module))
}

/** Le module apparaît-il dans le menu de cet utilisateur ? */
export function canSeeModule(user: PermissionUser, module: string): boolean {
  const role = user?.role
  if (!isStaffRole(role)) return false
  if (role === "ADMIN") return true
  if (!moduleOpenTo(role, module)) return false
  if (isCommercialManager(role) && COMMERCIAL_MODULES.includes(module)) return true
  // La caisse tactile reste accessible aux profils de caisse même si « ventes » n'est pas coché
  if (isCashierRole(role) && module === "ventes") return true
  const permissions = user?.permissions ?? []
  if (!permissions.length) return LEGACY_ADMIN_ROLES.includes(role as string)
  return permissions.some((p) => p.module === module && p.canView)
}
