"use client"

/** Minuscules + suppression des accents (recherche insensible aux accents). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/** Horodatage complet en heure locale du navigateur. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Date seule en heure locale du navigateur. */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Quantité formatée à la française (espace fine comme séparateur de milliers). */
export function formatQty(value: number): string {
  return value.toLocaleString("fr-FR")
}

/**
 * Affiche un horodatage en heure locale du navigateur.
 * `suppressHydrationWarning` évite l'avertissement de désynchronisation entre
 * le rendu serveur (fuseau du serveur) et le rendu client (fuseau du poste).
 */
export function LocalDateTime({ value, className }: { value: string | null | undefined; className?: string }) {
  return (
    <span className={className} suppressHydrationWarning>
      {formatDateTime(value)}
    </span>
  )
}
