/** Domaine des comptes du personnel */
const STAFF_DOMAIN = "lcg.cg"

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/**
 * Adresse saisie en minuscules et sans espaces. Si le domaine est à deux lettres près de celui du personnel
 * (« lcg.cgt », « lcg.com », « lcg.c »), renvoie l'adresse corrigée ; sinon null. Le mot de passe reste exigé :
 * la correction ne donne aucun accès, elle évite seulement qu'une faute de frappe fasse échouer la connexion.
 */
export function correctStaffEmail(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const domain = email.slice(at + 1)
  if (domain === STAFF_DOMAIN || distance(domain, STAFF_DOMAIN) > 2) return null
  return `${email.slice(0, at)}@${STAFF_DOMAIN}`
}
