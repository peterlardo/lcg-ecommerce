import bcrypt from "bcryptjs"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { PASSWORD_MIN_LENGTH, normalizePermissions, type PermissionRow } from "@/lib/permissions"

/** Saisie refusée : message affiché tel quel à l'écran, avec son code HTTP. */
export class InputError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/**
 * Hachage des mots de passe : coût 10. Le coût 12 demandait plusieurs secondes de calcul par compte
 * créé ou modifié sur l'hébergement (bcryptjs est du JavaScript pur).
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function checkedEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191) throw new InputError("Adresse email invalide")
  return email
}

export function checkedPassword(value: unknown): string {
  const password = String(value ?? "").trim()
  if (password.length < PASSWORD_MIN_LENGTH) throw new InputError(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
  return password
}

/** Profil de rôle attribuable : il doit exister, et être actif s'il s'agit d'une nouvelle attribution. */
export async function checkedRole(requested: unknown, current?: string): Promise<string> {
  const role = String(requested ?? "").trim().toUpperCase()
  if (!role) throw new InputError("Choisissez un rôle")
  const profile = await getPrisma().roleProfile.findUnique({ where: { key: role }, select: { label: true, isActive: true } })
  if (!profile) throw new InputError(`Rôle inconnu : ${role}`)
  if (!profile.isActive && role !== current) throw new InputError(`Le rôle « ${profile.label} » est désactivé : il ne peut plus être attribué`)
  return role
}

/** Droits par défaut d'un profil de rôle (définis dans « Rôles & permissions »). */
export async function rolePermissions(role: string): Promise<PermissionRow[]> {
  return normalizePermissions(await getPrisma().rolePermission.findMany({ where: { role } }))
}

/**
 * Enregistre les droits d'un utilisateur : seuls les modules transmis sont remplacés, les autres lignes
 * ne sont jamais effacées (une liste partielle supprimait tous les autres droits).
 */
export async function saveUserPermissions(tx: Prisma.TransactionClient, userId: string, rows: PermissionRow[]): Promise<void> {
  if (!rows.length) return
  await tx.userPermission.deleteMany({ where: { userId, module: { in: rows.map((r) => r.module) } } })
  await tx.userPermission.createMany({ data: rows.map((r) => ({ userId, ...r })) })
}

/** Même règle pour les droits par défaut d'un rôle. */
export async function saveRolePermissions(tx: Prisma.TransactionClient, role: string, rows: PermissionRow[]): Promise<void> {
  if (!rows.length) return
  await tx.rolePermission.deleteMany({ where: { role, module: { in: rows.map((r) => r.module) } } })
  await tx.rolePermission.createMany({ data: rows.map((r) => ({ role, ...r })) })
}

/** Points de vente dont l'utilisateur devient responsable (un seul responsable par point de vente). */
export async function assignPointsOfSale(tx: Prisma.TransactionClient, userId: string, posIds: unknown, reset: boolean): Promise<void> {
  if (reset) await tx.pointOfSale.updateMany({ where: { managerUserId: userId }, data: { managerUserId: null } })
  const ids = Array.isArray(posIds) ? [...new Set(posIds.filter((x): x is string => typeof x === "string"))] : []
  if (ids.length) await tx.pointOfSale.updateMany({ where: { id: { in: ids } }, data: { managerUserId: userId } })
}

/** Réponse d'erreur d'une route : saisie refusée (message clair) ou erreur interne. */
export function errorResponse(error: unknown, fallback: string): { body: { error: string }; status: number } {
  if (error instanceof InputError) return { body: { error: error.message }, status: error.status }
  console.error(fallback, error)
  return { body: { error: fallback }, status: 500 }
}
