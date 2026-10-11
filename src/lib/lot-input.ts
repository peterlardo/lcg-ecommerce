/**
 * Contrôles communs à la création et à la modification des lots de production
 * (lot simple et production groupée) : mêmes règles, mêmes messages.
 */

export const LOT_STATUSES = ["ACTIVE", "EXHAUSTED", "EXPIRED"]

/** Nombre de lots renvoyés à l'écran ; au-delà, la liste est signalée comme partielle. */
export const LOT_LIST_LIMIT = 200

/** Quantité maximale d'un lot : garde-fou contre une faute de frappe (un zéro de trop). */
export const LOT_MAX_QUANTITY = 100000

/** Erreur de saisie : son message est destiné à l'utilisateur (réponse 400). */
export class LotInputError extends Error {}

/** Quantité produite : un entier d'au moins 1. */
export function checkedLotQuantity(value: unknown): number {
  const quantity = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
    throw new LotInputError("La quantite doit etre un nombre entier d'au moins 1")
  }
  if (quantity > LOT_MAX_QUANTITY) {
    throw new LotInputError(`La quantite ne peut pas depasser ${LOT_MAX_QUANTITY} par lot`)
  }
  return quantity
}

function checkedDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new LotInputError(`${label} invalide`)
  return date
}

/**
 * Dates d'un lot : production (aujourd'hui par défaut) et expiration facultative,
 * qui ne peut pas précéder le jour de production.
 */
export function checkedLotDates(productionValue: unknown, expiryValue: unknown): { productionDate: Date; expiryDate: Date | null } {
  const productionDate = checkedDate(productionValue, "Date de production") ?? new Date()
  const expiryDate = checkedDate(expiryValue, "Date d'expiration")
  if (expiryDate) {
    const productionDay = new Date(productionDate)
    productionDay.setHours(0, 0, 0, 0)
    if (expiryDate.getTime() < productionDay.getTime()) {
      throw new LotInputError("La date d'expiration ne peut pas preceder la date de production")
    }
  }
  return { productionDate, expiryDate }
}
