/** Libellés français des statuts / types utilisés dans les rapports (détails par section). */

export const PAYMENT_METHOD_LBL: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte",
  BANK_TRANSFER: "Virement bancaire",
  CHEQUE: "Chèque",
}

export const PAYMENT_STATUS_LBL: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  FAILED: "Échoué",
  REFUNDED: "Remboursée",
  PARTIAL: "Partielle",
}

export const SOURCE_LBL: Record<string, string> = {
  WEB: "Site web",
  OPERATOR: "Opérateur",
  RESERVATION: "Réservation",
  CAISSE: "Caisse",
  ADMIN: "Administration",
}

export const MOVEMENT_LBL: Record<string, string> = {
  SALE: "Vente",
  OUT: "Sortie",
  LOSS: "Perte",
  IN: "Entrée",
  PRODUCTION: "Production",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  RETURN: "Retour",
  ADJUSTMENT_IN: "Ajustement (+)",
  ADJUSTMENT_OUT: "Ajustement (−)",
  CANCEL_RESTOCK: "Annulation de vente",
}

/** Types de mouvements qui SORTENT du stock (quantité stockée en positif). */
export const MOVEMENT_NEGATIVE_TYPES = new Set(["OUT", "SALE", "LOSS", "TRANSFER_OUT", "ADJUSTMENT_OUT"])

/** Quantité signée d'un mouvement : la base stocke la quantité en positif, le type porte le sens. */
export function signedMovementQuantity(type: string, quantity: number): number {
  return MOVEMENT_NEGATIVE_TYPES.has(type) ? -Math.abs(quantity) : Math.abs(quantity)
}

export const DELIVERY_MODE_LBL: Record<string, string> = {
  DELIVERY: "Livraison à domicile",
  PICKUP: "Retrait sur place",
}

export const DELIVERY_STATUS_LBL: Record<string, string> = {
  PENDING: "En attente",
  ASSIGNED: "Affectée",
  PICKED_UP: "Prise en charge",
  IN_TRANSIT: "En cours",
  DELIVERED: "Livrée",
  FAILED: "Échec",
}

export const CASH_STATUS_LBL: Record<string, string> = {
  OPEN: "Ouverte",
  CLOSED: "Fermée",
}

export const RESERVATION_STATUS_LBL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
}

export const LOT_STATUS_LBL: Record<string, string> = {
  ACTIVE: "Actif",
  EXHAUSTED: "Épuisé",
  EXPIRED: "Expiré",
}

export const B2B_DOC_LBL: Record<string, string> = {
  DEVIS: "Devis",
  COMMANDE: "Commande client",
  LIVRAISON: "Bon de livraison",
  FACTURE: "Facture",
  AVOIR: "Avoir",
}

export const B2B_STATUS_LBL: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  CONFIRMED: "Confirmé",
  REJECTED: "Rejeté",
  DELIVERED: "Livré",
  INVOICED: "Facturé",
  CANCELLED: "Annulé",
}
