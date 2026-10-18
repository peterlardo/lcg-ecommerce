export interface PartnerLikePrice {
  variantId: string
  price: number
}

export interface PartnerLike {
  prices?: PartnerLikePrice[] | null
}

export interface CartLine {
  variantId: string
  price: number
}

/**
 * Reprixise un panier selon le partenaire sélectionné.
 * - partenaire actif : prix négocié du partenaire, sinon prix PUBLIC (jamais le prix d'un autre partenaire)
 * - aucun partenaire (null) : prix public
 * - variant inconnu du catalogue public : conserve le prix courant
 */
export function repriceCart<T extends CartLine>(
  cart: T[],
  partner: PartnerLike | null,
  publicPriceOf: (variantId: string) => number | undefined
): T[] {
  return cart.map((line) => {
    if (partner) {
      const negotiated = partner.prices?.find((p) => p.variantId === line.variantId)?.price
      if (negotiated !== undefined) return { ...line, price: negotiated }
    }
    const publicPrice = publicPriceOf(line.variantId)
    return publicPrice !== undefined ? { ...line, price: publicPrice } : line
  })
}
