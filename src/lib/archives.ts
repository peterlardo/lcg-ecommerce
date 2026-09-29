/**
 * Règles d'archivage partagées entre /admin/commandes (liste active) et
 * /admin/archives (vue d'archive).
 *
 * Une commande est archivée lorsqu'elle est Réglée (paymentStatus PAID) depuis
 * plus de ARCHIVE_AFTER_DAYS jours. Le classement est dérivé à l'affichage :
 * aucun état stocké, aucun job de fond, toujours juste.
 */

export const ARCHIVE_AFTER_DAYS = 14

export interface ArchiveableOrder {
  paymentStatus: string
  createdAt: string
  ticketGenerated?: boolean
  notes?: string | null
}

export function isArchivedOrder(order: ArchiveableOrder, now: number = Date.now()): boolean {
  if (order.paymentStatus !== "PAID") return false
  const created = Date.parse(order.createdAt)
  if (Number.isNaN(created)) return false
  return now - created > ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

/** Mêmes critères que la page /admin/tickets (tickets de caisse). */
export function isTicketOrder(order: ArchiveableOrder): boolean {
  return order.ticketGenerated === true || Boolean(order.notes?.startsWith("Vente comptoir"))
}
