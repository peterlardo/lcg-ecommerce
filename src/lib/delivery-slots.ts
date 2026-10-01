/**
 * Créneaux fixes de livraison / retrait des pré-commandes (heure de Brazzaville, UTC+1).
 * Partagé par le panier, l'API et l'admin (planning, replanification).
 */
export const DELIVERY_SLOTS = [
  { id: "08-10", label: "8h – 10h", startHour: 8 },
  { id: "10-12", label: "10h – 12h", startHour: 10 },
  { id: "14-16", label: "14h – 16h", startHour: 14 },
  { id: "16-18", label: "16h – 18h", startHour: 16 },
] as const

export type SlotId = (typeof DELIVERY_SLOTS)[number]["id"]

// Délai minimal entre la commande et le début du créneau, pour préparer et planifier.
const MIN_LEAD_HOURS = 2
const TZ_OFFSET = "+01:00"

export function isSlotId(value: unknown): value is SlotId {
  return DELIVERY_SLOTS.some((s) => s.id === value)
}

export function slotLabel(slot: string | null | undefined): string {
  return DELIVERY_SLOTS.find((s) => s.id === slot)?.label ?? ""
}

/** Début du créneau à la date donnée (YYYY-MM-DD), à l'heure de Brazzaville. */
export function slotStart(date: string, slot: string): Date | null {
  const def = DELIVERY_SLOTS.find((s) => s.id === slot)
  if (!def || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const d = new Date(`${date}T${String(def.startHour).padStart(2, "0")}:00:00${TZ_OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Message d'erreur si la date + créneau ne peut pas être réservée, sinon null. */
export function slotError(date: string, slot: string, now = new Date()): string | null {
  if (!isSlotId(slot)) return "Choisissez un créneau de livraison"
  const start = slotStart(date, slot)
  if (!start) return "Date invalide"
  if (start.getTime() - now.getTime() < MIN_LEAD_HOURS * 3600_000) {
    return `Ce créneau n'est plus disponible : choisissez un créneau au moins ${MIN_LEAD_HOURS} h à l'avance`
  }
  return null
}

/** Date du jour à Brazzaville, au format YYYY-MM-DD (valeur min des champs date). */
export function todayInBrazzaville(now = new Date()): string {
  return new Date(now.getTime() + 3600_000).toISOString().slice(0, 10)
}
