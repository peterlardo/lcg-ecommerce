import { formatPrice } from "./utils"
import { montantEnLettres } from "./montant-en-lettres"
import type { BankSettings } from "./settings"
import { hasBankDetails } from "./settings"

// ─── DOCUMENT B2B ENVOYÉ PAR E-MAIL ──────────────────────────────
// Devis, bon de commande, bon de livraison, facture ou avoir, mis en forme pour la messagerie du client.
// Couleurs : celles du logo (bleu 31,79,163). Tout texte venu de la base est échappé.

export const DOC_TITLE: Record<string, string> = {
  DEVIS: "Devis",
  COMMANDE: "Bon de commande",
  LIVRAISON: "Bon de livraison",
  FACTURE: "Facture",
  AVOIR: "Avoir",
}

const BLUE = "#1f4fa3"
/** Logo servi par le site lui-même (adresse absolue : la messagerie du client le télécharge). */
const LOGO_URL = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://lcg.cg").replace(/\/$/, "")}/logo-lcg-transparent.png`
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Brazzaville" })

export interface DocumentMailData {
  type: string
  reference: string
  issuedAt: Date
  clientName: string
  company: { name: string; address: string; phones: string; contact: string; legal: string }
  items: { label: string; quantity: number; unit: string | null; unitPrice: number; lineTotal: number }[]
  subtotal: number
  discount: number
  total: number
  notes: string | null
  /** devis : date de validité */
  validUntil?: Date | null
  /** facture : échéance et situation */
  invoice?: { dueDate: Date; credited: number; paid: number; balance: number } | null
  /** avoir : facture d'origine */
  parentReference?: string | null
  bank: BankSettings
  /** mot d'accompagnement saisi par l'expéditeur */
  message?: string | null
}

// L'objet et le mot d'accompagnement propres à chaque type sont dans b2b-document-mail-text.ts.

export function buildDocumentMail(data: DocumentMailData): string {
  const title = DOC_TITLE[data.type] ?? "Document"
  const showPrices = data.type !== "LIVRAISON"
  const cell = "padding:10px 8px;font-size:14px;color:#1f2937;border-bottom:1px solid #e5e7eb"
  const head = `padding:10px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#ffffff;background:${BLUE}`

  const rows = data.items.length
    ? data.items
        .map(
          (i) => `<tr>
            <td style="${cell}">${esc(i.label)}</td>
            <td style="${cell};text-align:right;white-space:nowrap">${i.quantity}${i.unit ? ` ${esc(i.unit)}` : ""}</td>
            ${showPrices ? `<td style="${cell};text-align:right;white-space:nowrap">${formatPrice(i.unitPrice)}</td><td style="${cell};text-align:right;font-weight:700;white-space:nowrap">${formatPrice(i.lineTotal)}</td>` : ""}
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="${showPrices ? 4 : 2}" style="${cell}">${data.type === "AVOIR" ? `Avoir sur la facture ${esc(data.parentReference ?? "")}${data.notes ? ` : ${esc(data.notes)}` : ""}` : "—"}</td></tr>`

  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:14px;color:${strong ? "#111827" : "#4b5563"};${strong ? "font-weight:800" : ""}">${label}</td><td style="padding:4px 0;font-size:${strong ? 16 : 14}px;text-align:right;white-space:nowrap;color:#111827;${strong ? "font-weight:800" : ""}">${value}</td></tr>`

  const totals = showPrices
    ? `<table style="width:100%;max-width:320px;margin:16px 0 0 auto;border-collapse:collapse">
        ${line("Sous-total", formatPrice(data.subtotal))}
        ${data.discount > 0 ? line("Remise", `− ${formatPrice(data.discount)}`) : ""}
        ${line(data.type === "FACTURE" ? "Total à payer" : data.type === "AVOIR" ? "Montant de l'avoir" : "Total", formatPrice(data.total), true)}
        ${data.invoice && data.invoice.credited > 0 ? line("Avoirs", `− ${formatPrice(data.invoice.credited)}`) : ""}
        ${data.invoice && data.invoice.paid > 0 ? line("Déjà payé", `− ${formatPrice(data.invoice.paid)}`) : ""}
        ${data.invoice && (data.invoice.paid > 0 || data.invoice.credited > 0) ? line("Reste à payer", formatPrice(data.invoice.balance), true) : ""}
      </table>
      <p style="margin:12px 0 0;font-size:13px;font-style:italic;color:#4b5563">Arrêté${data.type === "FACTURE" ? "e la présente facture" : data.type === "AVOIR" ? " le présent avoir" : ` le présent ${title.toLowerCase()}`} à la somme de : <strong style="font-style:normal;color:#111827">${esc(montantEnLettres(data.total))}</strong>.</p>`
    : ""

  const dates = [
    `Date : <strong>${day(data.issuedAt)}</strong>`,
    data.invoice ? `Échéance : <strong>${day(data.invoice.dueDate)}</strong>` : "",
    data.validUntil ? `Valable jusqu'au <strong>${day(data.validUntil)}</strong>` : "",
    data.parentReference ? `Réf. d'origine : <strong>${esc(data.parentReference)}</strong>` : "",
  ].filter(Boolean).join(" · ")

  const bank =
    data.type === "FACTURE" && hasBankDetails(data.bank)
      ? `<div style="margin-top:20px;padding:14px 16px;border:1px solid #c7d2fe;border-radius:10px;background:#eef2ff">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${BLUE};font-weight:700">Modalités de règlement</div>
          ${data.bank.accountNumber ? `<p style="margin:6px 0 0;font-size:14px;color:#1f2937">Virement : ${esc(data.bank.bankName)}${data.bank.accountHolder ? ` — titulaire ${esc(data.bank.accountHolder)}` : ""}<br><span style="font-family:monospace">${esc(data.bank.accountNumber)}</span></p>` : ""}
          ${data.bank.mtnMoney ? `<p style="margin:6px 0 0;font-size:14px;color:#1f2937">MTN Mobile Money : <strong>${esc(data.bank.mtnMoney)}</strong></p>` : ""}
          ${data.bank.airtelMoney ? `<p style="margin:6px 0 0;font-size:14px;color:#1f2937">Airtel Money : <strong>${esc(data.bank.airtelMoney)}</strong></p>` : ""}
          ${data.bank.instructions ? `<p style="margin:6px 0 0;font-size:13px;color:#4b5563">${esc(data.bank.instructions)}</p>` : ""}
          <p style="margin:6px 0 0;font-size:13px;color:#4b5563">Merci d'indiquer la référence ${esc(data.reference)} avec votre paiement.</p>
        </div>`
      : ""

  return `
  <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:680px;margin:0 auto;padding:24px 16px">
      <div style="background:${BLUE};border-radius:12px 12px 0 0;padding:22px 26px;color:#ffffff">
        <table style="border-collapse:collapse"><tr>
          <td style="padding:0 14px 0 0;vertical-align:middle"><img src="${esc(LOGO_URL)}" alt="LCG" width="56" height="54" style="display:block;background:#ffffff;border-radius:50%;padding:4px"></td>
          <td style="vertical-align:middle;color:#ffffff">
            <div style="font-size:20px;font-weight:800">${esc(data.company.name)}</div>
            <div style="font-size:13px;opacity:.9;margin-top:4px">${esc(data.company.address)}</div>
            <div style="font-size:13px;opacity:.9">${esc([data.company.phones, data.company.contact].filter(Boolean).join(" · "))}</div>
          </td>
        </tr></table>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:26px">
        ${data.message ? `<p style="margin:0 0 18px;font-size:15px;color:#1f2937;white-space:pre-wrap">${esc(data.message)}</p>` : ""}
        <h1 style="margin:0;font-size:22px;color:#111827">${esc(title)} ${esc(data.reference)}</h1>
        <p style="margin:6px 0 0;font-size:14px;color:#4b5563">${dates}</p>
        <p style="margin:14px 0 0;font-size:14px;color:#1f2937">Client : <strong>${esc(data.clientName)}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead><tr>
            <th style="${head};text-align:left">Désignation</th>
            <th style="${head};text-align:right">Quantité</th>
            ${showPrices ? `<th style="${head};text-align:right">Prix unitaire</th><th style="${head};text-align:right">Montant</th>` : ""}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${totals}
        ${bank}
        ${data.notes && data.type !== "AVOIR" ? `<p style="margin:18px 0 0;font-size:13px;color:#4b5563;white-space:pre-wrap"><strong>Remarques :</strong> ${esc(data.notes)}</p>` : ""}
        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
          ${esc(data.company.legal)}<br>Pour toute question : ${esc([data.company.phones, data.company.contact].filter(Boolean).join(" · "))}
        </div>
      </div>
    </div>
  </div>`
}
