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
 * Prix preferentiel d'un produit pour un partenaire (tarif par produit).
 * Retourne undefined si aucun tarif n'est defini pour cette variante.
 */
export function preferredPriceOf(
  partnerPrices: Record<string, number> | Map<string, number> | null | undefined,
  variantId: string
): number | undefined {
  if (!partnerPrices) return undefined
  if (partnerPrices instanceof Map) return partnerPrices.get(variantId)
  return partnerPrices[variantId]
}

/**
 * Reprixise un panier selon le partenaire selectionne.
 * - tarif preferentiel du produit s'il existe, sinon remise (%) du partenaire
 * - aucun partenaire (null) : prix public
 * - variant inconnu du catalogue public : conserve le prix courant
 */
export function repriceCart<T extends CartLine>(
  cart: T[],
  partner: (PartnerLike & { prices?: Record<string, number> | Map<string, number> }) | null,
  publicPriceOf: (variantId: string) => number | undefined,
  partnerPrices?: Record<string, number> | Map<string, number> | null
): T[] {
  const priceMap = partnerPrices ?? partner?.prices
  return cart.map((line) => {
    const publicPrice = publicPriceOf(line.variantId)
    if (publicPrice === undefined) return line
    if (!partner) return { ...line, price: publicPrice }
    const preferred = preferredPriceOf(priceMap, line.variantId)
    const next = preferred ?? applyPartnerDiscount(publicPrice, partner.discountPercent)
    return { ...line, price: next }
  })
}
