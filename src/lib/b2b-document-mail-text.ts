import { formatPrice } from "./utils"

// ─── TEXTE DE L'E-MAIL D'UN DOCUMENT B2B ─────────────────────────
// Objet et mot d'accompagnement propres à chaque type de document (demande du 2026-10-23 :
// « traite le message d'envoi selon qu'il s'agisse d'une facture, d'un bon de commande ou d'un devis »).
// Sans import serveur : l'écran du document s'en sert pour pré-remplir le message, que l'on peut modifier.

export interface DocumentMailTextInput {
  type: string
  reference: string
  total: number
  companyName: string
  /** devis : date de validité */
  validUntil?: Date | string | null
  /** bon de commande : livraison souhaitée */
  requestedDeliveryDate?: Date | string | null
  /** facture : échéance et reste à payer */
  dueDate?: Date | string | null
  balance?: number | null
  /** avoir : facture d'origine */
  parentReference?: string | null
}

const day = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Brazzaville" })

export function documentMailSubjectFor(input: Pick<DocumentMailTextInput, "type" | "reference" | "companyName" | "dueDate">): string {
  const { reference, companyName } = input
  switch (input.type) {
    case "DEVIS":
      return `Votre devis ${reference} — ${companyName}`
    case "COMMANDE":
      return `Confirmation de votre commande ${reference} — ${companyName}`
    case "FACTURE":
      return `Facture ${reference}${input.dueDate ? ` — à régler avant le ${day(input.dueDate)}` : ""} — ${companyName}`
    case "LIVRAISON":
      return `Bon de livraison ${reference} — ${companyName}`
    case "AVOIR":
      return `Avoir ${reference} — ${companyName}`
    default:
      return `Document ${reference} — ${companyName}`
  }
}

export function documentMailMessage(input: DocumentMailTextInput): string {
  const { reference, companyName } = input
  const amount = formatPrice(input.total)
  let body: string
  switch (input.type) {
    case "DEVIS":
      body = `Suite à votre demande, veuillez trouver ci-dessous notre devis ${reference} d'un montant de ${amount}${input.validUntil ? `, valable jusqu'au ${day(input.validUntil)}` : ""}.\n\nPour l'accepter, il vous suffit de répondre à cet e-mail ou de nous appeler : nous établirons alors votre bon de commande.`
      break
    case "COMMANDE":
      body = `Nous vous remercions pour votre commande. Veuillez trouver ci-dessous le bon de commande ${reference} d'un montant de ${amount}, qui reprend les articles et les quantités convenus${input.requestedDeliveryDate ? ` pour une livraison souhaitée le ${day(input.requestedDeliveryDate)}` : ""}.\n\nMerci de vérifier ces informations et de nous signaler toute correction avant la livraison.`
      break
    case "FACTURE": {
      const due = input.balance != null && input.balance !== input.total ? `Le reste à payer est de ${formatPrice(input.balance)}` : `Elle est à régler`
      body = `Veuillez trouver ci-dessous notre facture ${reference} d'un montant de ${amount}. ${due}${input.dueDate ? ` au plus tard le ${day(input.dueDate)}` : ""}.\n\nLes modalités de règlement figurent sous la facture ; merci d'indiquer la référence ${reference} avec votre paiement.`
      break
    }
    case "LIVRAISON":
      body = `Veuillez trouver ci-dessous le bon de livraison ${reference} des articles qui vous sont livrés. Merci de vérifier les quantités à la réception.`
      break
    case "AVOIR":
      body = `Veuillez trouver ci-dessous l'avoir ${reference} d'un montant de ${amount}${input.parentReference ? `, établi sur la facture ${input.parentReference}` : ""}.`
      break
    default:
      body = `Veuillez trouver ci-dessous le document ${reference}.`
  }
  return `Bonjour,\n\n${body}\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${companyName}`
}
