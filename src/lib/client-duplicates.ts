/**
 * Détection des doublons dans le fichier clients (B2B et B2C).
 * Aucun import serveur : les mêmes règles servent à l'API et à l'écran « Nouveau client ».
 */

export type DuplicateCandidate = {
  type?: "B2B" | "B2C" | string | null
  companyName?: string | null
  tradeName?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  email?: string | null
}

export type DuplicateSource = DuplicateCandidate & {
  id: string
  contactName?: string | null
  city?: string | null
  isActive?: boolean
  commercial?: { name: string | null } | null
}

export type DuplicateMatch = {
  id: string
  label: string
  type: string
  phone: string | null
  city: string | null
  commercialName: string | null
  isActive: boolean
  /** ce qui correspond : même téléphone, même e-mail ou même nom */
  reason: "phone" | "email" | "name"
}

/** Téléphone réduit à ses 9 derniers chiffres : « +242 06 600 00 00 » et « 066000000 » désignent le même numéro. */
export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  return digits.length > 9 ? digits.slice(-9) : digits
}

/** Nom comparé sans accents, sans casse ni ponctuation : « Hôtel Émeraude » = « hotel emeraude ». */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Nom affiché d'un client, quel que soit son type. */
export function clientLabel(c: DuplicateSource | (DuplicateCandidate & { contactName?: string | null })): string {
  const person = [c.firstName, c.lastName].filter(Boolean).join(" ")
  return c.companyName || c.tradeName || person || c.contactName || c.email || c.phone || "(sans nom)"
}

/** Noms sous lesquels un client peut être connu (raison sociale, enseigne, prénom nom, nom prénom). */
function namesOf(c: DuplicateCandidate): string[] {
  const names = [
    c.companyName,
    c.tradeName,
    [c.firstName, c.lastName].filter(Boolean).join(" "),
    [c.lastName, c.firstName].filter(Boolean).join(" "),
  ]
  // un nom de deux lettres ou moins ne prouve rien
  return [...new Set(names.map(normalizeName).filter((n) => n.length > 2))]
}

/**
 * Clients existants qui ressemblent au client saisi : même téléphone, même e-mail, ou même nom dans le même type.
 * Le téléphone et l'e-mail sont comparés entre B2B et B2C (une entreprise et son gérant partagent souvent un numéro).
 */
export function findDuplicates(candidate: DuplicateCandidate, existing: DuplicateSource[], limit = 5): DuplicateMatch[] {
  const phone = normalizePhone(candidate.phone)
  const email = (candidate.email ?? "").trim().toLowerCase()
  const names = namesOf(candidate)
  const out: DuplicateMatch[] = []

  for (const c of existing) {
    let reason: DuplicateMatch["reason"] | null = null
    if (phone.length >= 8 && normalizePhone(c.phone) === phone) reason = "phone"
    else if (email && (c.email ?? "").trim().toLowerCase() === email) reason = "email"
    else if (names.length && (!candidate.type || c.type === candidate.type) && namesOf(c).some((n) => names.includes(n))) reason = "name"
    if (!reason) continue
    out.push({
      id: c.id,
      label: clientLabel(c),
      type: String(c.type ?? ""),
      phone: c.phone ?? null,
      city: c.city ?? null,
      commercialName: c.commercial?.name ?? null,
      isActive: c.isActive !== false,
      reason,
    })
  }
  // le téléphone d'abord : c'est l'indice le plus sûr
  const rank = { phone: 0, email: 1, name: 2 }
  return out.sort((a, b) => rank[a.reason] - rank[b.reason]).slice(0, limit)
}

export const DUPLICATE_REASON_LABELS: Record<DuplicateMatch["reason"], string> = {
  phone: "même téléphone",
  email: "même e-mail",
  name: "même nom",
}
