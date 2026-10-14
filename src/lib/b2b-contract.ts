// ─── CONTRATS B2B ─────────────────────────────────────────────
// Règles communes aux API et aux écrans (contrats, tarifs, devis). Aucun import serveur ici :
// ce fichier est utilisé des deux côtés.

export const CONTRACT_STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED"] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export interface ContractPeriod {
  status: string
  startsAt: string | Date
  endsAt?: string | Date | null
}

/** Contrat applicable : actif et dans sa période de validité. Lui seul fixe les prix et la remise. */
export function isContractApplicable(contract: ContractPeriod, now: Date = new Date()): boolean {
  if (contract.status !== "ACTIVE") return false
  if (new Date(contract.startsAt).getTime() > now.getTime()) return false
  return !contract.endsAt || new Date(contract.endsAt).getTime() >= now.getTime()
}

/**
 * Remise du contrat sur un document : pourcentage appliqué aux lignes SANS tarif négocié
 * (un prix négocié est déjà un prix net). Arrondie au franc.
 */
export function contractDiscount(
  percent: number | null | undefined,
  lines: { productVariantId: string; lineTotal: number }[],
  negotiated: ReadonlySet<string>,
): number {
  if (!percent || percent <= 0) return 0
  const base = lines.reduce((sum, l) => (negotiated.has(l.productVariantId) ? sum : sum + l.lineTotal), 0)
  return Math.round((base * percent) / 100)
}

interface CatalogueProduct {
  name: string
  isActive?: boolean
  variants: { id: string; format: string; price: number }[]
}

/**
 * Articles proposés dans les devis et les contrats : produits actifs seulement, rangés par nom puis par format
 * (1kg, 2kg, 5kg), libellé « Produit — format ».
 */
export function productOptions(products: CatalogueProduct[]): { id: string; label: string; price: number }[] {
  const byText = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
  return products
    .filter((p) => p.isActive !== false)
    .sort((a, b) => byText(a.name, b.name))
    .flatMap((p) => [...p.variants].sort((a, b) => byText(a.format, b.format)).map((v) => ({ id: v.id, label: `${p.name} — ${v.format}`, price: v.price })))
}

export interface ContractItemInput {
  productVariantId: string
  unitPrice: number
}

/** Grille de prix reçue d'un écran. Elle peut être vide : un contrat peut ne fixer que le délai et la remise. */
export function parseContractItems(raw: unknown): { items: ContractItemInput[] } | { error: string } {
  if (raw === undefined || raw === null) return { items: [] }
  if (!Array.isArray(raw)) return { error: "Grille de prix invalide" }
  const items: ContractItemInput[] = []
  const seen = new Set<string>()
  for (const it of raw) {
    const item = (it ?? {}) as { productVariantId?: unknown; unitPrice?: unknown }
    const productVariantId = String(item.productVariantId ?? "")
    if (!productVariantId) return { error: "Article sans produit" }
    if (seen.has(productVariantId)) return { error: "Article en double" }
    seen.add(productVariantId)
    if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice === "") return { error: "Prix unitaire manquant" }
    const unitPrice = Number(item.unitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Prix unitaire invalide" }
    items.push({ productVariantId, unitPrice })
  }
  return { items }
}

export interface ContractFields {
  status?: ContractStatus
  startsAt?: Date
  endsAt?: Date | null
  paymentTermsDays?: number
  minOrderAmount?: number
  discountPercent?: number
  deliveryFrequency?: string | null
  notes?: string | null
}

const present = (v: unknown) => v !== undefined && v !== null && v !== ""

/** Champs d'un contrat reçus d'un écran : seuls les champs fournis sont renvoyés, déjà contrôlés. */
export function parseContractFields(body: Record<string, unknown>): { fields: ContractFields } | { error: string } {
  const fields: ContractFields = {}

  if (present(body.status)) {
    const status = String(body.status).toUpperCase()
    if (!(CONTRACT_STATUSES as readonly string[]).includes(status)) return { error: "Statut de contrat invalide" }
    fields.status = status as ContractStatus
  }
  if (present(body.startsAt)) {
    const d = new Date(String(body.startsAt))
    if (Number.isNaN(d.getTime())) return { error: "Date de début invalide" }
    fields.startsAt = d
  }
  if (body.endsAt !== undefined) {
    if (present(body.endsAt)) {
      const d = new Date(String(body.endsAt))
      if (Number.isNaN(d.getTime())) return { error: "Date de fin invalide" }
      fields.endsAt = d
    } else {
      fields.endsAt = null
    }
  }
  if (present(body.paymentTermsDays)) {
    const n = Number(body.paymentTermsDays)
    if (!Number.isInteger(n) || n < 0 || n > 365) return { error: "Délai de paiement invalide (0 à 365 jours)" }
    fields.paymentTermsDays = n
  }
  if (present(body.minOrderAmount)) {
    const n = Number(body.minOrderAmount)
    if (!Number.isFinite(n) || n < 0) return { error: "Montant minimum invalide" }
    fields.minOrderAmount = n
  }
  if (present(body.discountPercent)) {
    const n = Number(body.discountPercent)
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Remise invalide (0 à 100 %)" }
    fields.discountPercent = n
  }
  if (body.deliveryFrequency !== undefined) fields.deliveryFrequency = present(body.deliveryFrequency) ? String(body.deliveryFrequency).trim().slice(0, 100) : null
  if (body.notes !== undefined) fields.notes = present(body.notes) ? String(body.notes).trim().slice(0, 2000) : null

  return { fields }
}
