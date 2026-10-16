/**
 * Moyens de règlement des factures B2B : liste commune aux écrans et aux API.
 * Aucun import serveur ici : ce fichier est utilisé des deux côtés.
 */
export const RECEIPT_METHODS = ["CASH_ON_DELIVERY", "MOBILE_MONEY", "BANK_TRANSFER", "CHEQUE", "CARD"] as const
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number]

export const RECEIPT_METHOD_LABEL: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Virement bancaire",
  CHEQUE: "Chèque",
  CARD: "Carte bancaire",
}

/** Moyens pour lesquels la référence de la transaction est demandée. */
export const REFERENCE_EXPECTED: readonly string[] = ["MOBILE_MONEY", "BANK_TRANSFER", "CHEQUE", "CARD"]

/** Moyens pour lesquels la référence est obligatoire (n° de virement, n° de chèque). */
export const REFERENCE_REQUIRED: readonly string[] = ["BANK_TRANSFER", "CHEQUE"]

/** Libellé du champ référence selon le moyen. */
export const REFERENCE_LABEL: Record<string, string> = {
  MOBILE_MONEY: "N° de transaction",
  BANK_TRANSFER: "N° ou référence du virement",
  CHEQUE: "N° du chèque",
  CARD: "N° de transaction",
}

/**
 * Justificatif obligatoire : preuve du virement (avis, capture de l'ordre), scan du chèque.
 * Ces règlements restent « à valider » jusqu'à ce que l'argent soit reçu (virement arrivé, chèque encaissé).
 */
export const PROOF_REQUIRED: readonly string[] = ["BANK_TRANSFER", "CHEQUE"]

export const PROOF_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Preuve du virement",
  CHEQUE: "Scan du chèque",
}

/** Formats acceptés pour un justificatif, et taille maximale (après réduction des photos). */
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
export const PROOF_MAX_BYTES = 4 * 1024 * 1024

export const VALIDATION_LABEL: Record<string, string> = {
  PENDING: "À valider",
  VALIDATED: "Validé",
  REJECTED: "Refusé",
}
