import type { ProductWriteInput } from "@/data/store"

type VariantInput = ProductWriteInput["variants"][number]

/**
 * Valide et normalise les variantes envoyées par l'admin (création et modification).
 * Renvoie un message d'erreur, ou les variantes nettoyées.
 */
export function parseVariants(raw: unknown): { error: string } | { variants: VariantInput[] } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Au moins une variante est requise" }

  const variants: VariantInput[] = []
  const seen = new Set<string>()
  for (const v of raw) {
    const format = typeof v?.format === "string" ? v.format.trim() : ""
    const price = Number(v?.price)
    if (!format) return { error: "Chaque variante doit avoir un format" }
    if (!Number.isFinite(price) || price < 0) return { error: `Prix invalide pour la variante « ${format} »` }
    const key = format.toLowerCase().replace(/\s+/g, "")
    if (seen.has(key)) return { error: `Le format « ${format} » apparaît deux fois` }
    seen.add(key)

    const stockRaw = v?.stock
    const hasStock = stockRaw !== undefined && stockRaw !== null && stockRaw !== ""
    const stock = hasStock ? Number(stockRaw) : undefined
    if (stock !== undefined && (!Number.isFinite(stock) || stock < 0)) return { error: `Stock invalide pour la variante « ${format} »` }

    variants.push({
      ...(typeof v?.id === "string" && v.id ? { id: v.id } : {}),
      format,
      price,
      unit: typeof v?.unit === "string" && v.unit.trim() ? v.unit.trim() : null,
      ...(stock !== undefined ? { stock: Math.floor(stock) } : {}),
    })
  }
  return { variants }
}
