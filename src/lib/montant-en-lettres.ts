// Montant en toutes lettres pour les documents (« Arrêtée la présente facture à la somme de … »).
// Portage de nombre_en_lettres / montant_en_lettres (lcgapp3, src/helpers.php). Aucun import serveur ici.

const UNITS = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"]
const TENS: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" }

const below20 = (x: number) => (x < 17 ? UNITS[x] : `dix-${UNITS[x - 10]}`)

/** `final` : le groupe termine le nombre (ou précède « million »), donc « cents » et « quatre-vingts » prennent leur s. */
function below100(x: number, final: boolean): string {
  if (x < 20) return below20(x)
  if (x < 70) {
    const r = x % 10
    return TENS[Math.floor(x / 10)] + (r === 0 ? "" : r === 1 ? " et un" : `-${UNITS[r]}`)
  }
  if (x < 80) return "soixante" + (x === 71 ? " et onze" : `-${below20(x - 60)}`)
  return "quatre-vingt" + (x === 80 ? (final ? "s" : "") : `-${below20(x - 80)}`)
}

function below1000(x: number, final: boolean): string {
  const c = Math.floor(x / 100)
  const r = x % 100
  const hundreds = c === 0 ? "" : c === 1 ? "cent" : `${UNITS[c]} cent${r === 0 && final ? "s" : ""}`
  return `${hundreds}${r ? ` ${below100(r, final)}` : ""}`.trim()
}

/** Nombre entier en toutes lettres : 27500 → « vingt-sept mille cinq cents ». */
export function nombreEnLettres(value: number): string {
  const n = Math.round(value)
  if (n === 0) return "zéro"
  if (n < 0) return `moins ${nombreEnLettres(-n)}`
  const billions = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (billions) parts.push(`${nombreEnLettres(billions)} milliard${billions > 1 ? "s" : ""}`)
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? "s" : ""}`)
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`)
  if (rest) parts.push(below1000(rest, true))
  return parts.join(" ")
}

/** Montant en francs CFA : 400000 → « Quatre cent mille francs CFA », 1000000 → « Un million de francs CFA ». */
export function montantEnLettres(amount: number): string {
  const n = Math.round(amount)
  const words = nombreEnLettres(n)
  const de = n !== 0 && n % 1_000_000 === 0 ? " de" : ""
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}${de} ${Math.abs(n) < 2 ? "franc" : "francs"} CFA`
}
