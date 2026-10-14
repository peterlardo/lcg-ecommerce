/**
 * Moyens de règlement des factures B2B : liste commune aux écrans et aux API.
 * Aucun import serveur ici : ce fichier est utilisé des deux côtés.
 */
export const RECEIPT_METHODS = ["CASH_ON_DELIVERY", "MOBILE_MONEY", "BANK_TRANSFER", "CARD"] as const
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number]

export const RECEIPT_METHOD_LABEL: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Virement bancaire",
  CARD: "Carte bancaire",
}

/** Moyens pour lesquels la référence de la transaction est demandée. */
export const REFERENCE_EXPECTED: readonly string[] = ["MOBILE_MONEY", "BANK_TRANSFER", "CARD"]

export const VALIDATION_LABEL: Record<string, string> = {
  PENDING: "À valider",
  VALIDATED: "Validé",
  REJECTED: "Refusé",
}
