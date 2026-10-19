export interface PartnerLike {
  discountPercent?: number | null
}

export interface CartLine {
  variantId: string
  price: number
}

/**
 * Applique la remise (%) d'un partenaire a un prix public.
 * - remise bornee entre 0 et 100
 * - prix arrondi au multiple de 25 FCFA le plus proche
 */
export function applyPartnerDiscount(publicPrice: number, discountPercent?: number | null): number {
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0))
  const discounted = publicPrice * (1 - pct / 100)
  return Math.round(discounted / 25) * 25
}

/**
 * Reprixise un panier selon le partenaire selectionne.
 * - partenaire : prix public moins sa remise (%)
 * - aucun partenaire (null) : prix public
 * - variant inconnu du catalogue public : conserve le prix courant
 */
export function repriceCart<T extends CartLine>(
  cart: T[],
  partner: PartnerLike | null,
  publicPriceOf: (variantId: string) => number | undefined
): T[] {
  return cart.map((line) => {
    const publicPrice = publicPriceOf(line.variantId)
    if (publicPrice === undefined) return line
    const next = partner ? applyPartnerDiscount(publicPrice, partner.discountPercent) : publicPrice
    return { ...line, price: next }
  })
}
