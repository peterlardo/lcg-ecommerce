import { formatPrice } from "@/lib/utils"
import type { OrderMailData, ReservationMailData } from "./mailer"

const PAYMENT_LABELS: Record<string, string> = {
  CARD: "Carte bancaire",
  MOBILE_MONEY: "Mobile Money",
  CASH_ON_DELIVERY: "Paiement à la livraison",
}

function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] || method || "—"
}

export function buildOrderDevisText(data: OrderMailData): string {
  const lines = [
    "LCG — La Congolaise des Glaçons",
    `Bonjour ${data.customerName}, votre commande ${data.orderNumber} est enregistrée.`,
    "",
    "Devis de votre opération :",
    ...data.items.map((i) => `• ${i.name}${i.format ? ` (${i.format})` : ""} x${i.quantity} — ${formatPrice(i.price * i.quantity)}`),
    "",
    `Sous-total : ${formatPrice(data.subtotal)}`,
    `Livraison : ${data.deliveryFee > 0 ? formatPrice(data.deliveryFee) : "Gratuite"}`,
    ...(data.discountAmount && data.discountAmount > 0
      ? [`Remise${data.couponCode ? ` (${data.couponCode})` : ""} : - ${formatPrice(data.discountAmount)}`]
      : []),
    `TOTAL : ${formatPrice(data.total)}`,
    `Paiement : ${paymentLabel(data.paymentMethod)}`,
  ]
  if (data.notes) lines.push(`Notes : ${data.notes}`)
  lines.push("", "Notre équipe vous contactera très vite pour confirmer la livraison.")
  return lines.join("\n")
}

export function buildReservationDevisText(data: ReservationMailData): string {
  const lines = [
    "LCG — La Congolaise des Glaçons",
    `Bonjour ${data.client}, votre pré-commande ${data.ref} est enregistrée.`,
    "",
    "Devis de votre opération :",
    ...data.items.map((i) => `• ${i.name}${i.format ? ` (${i.format})` : ""} x${i.quantity} — ${formatPrice(i.price * i.quantity)}`),
    ...(data.deliveryFee !== undefined ? [`Livraison : ${data.deliveryFee > 0 ? formatPrice(data.deliveryFee) : "Gratuite"}`] : []),
    "",
    `TOTAL : ${formatPrice(data.total)}`,
    `Date : ${data.date}${data.heure ? `, créneau ${data.heure}` : ""}`,
  ]
  if (data.address) lines.push(`Lieu : ${data.address}`)
  if (data.notes) lines.push(`Notes : ${data.notes}`)
  lines.push("", "Notre équipe vous contactera pour confirmer le créneau et le paiement.")
  if (data.trackingUrl) lines.push(`Suivi : ${data.trackingUrl}`)
  return lines.join("\n")
}

/**
 * Numéro au format international sans « + », pour WhatsApp.
 * Congo-Brazzaville : le 0 initial FAIT PARTIE du numéro (06 979 08 17 -> 242 06 979 08 17),
 * on ne le supprime donc pas. Numéros à 9 chiffres = numéros congolais.
 */
export function normalizeWaPhone(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("242")) return digits
  if (digits.length === 9) return `242${digits}`
  // Numéro congolais saisi sans son 0 (ex. 6 979 08 17).
  if (digits.length === 8) return `2420${digits}`
  return digits
}

export function buildWaLink(phone: string, text: string): string {
  const to = normalizeWaPhone(phone)
  if (!to || !text) return ""
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}
