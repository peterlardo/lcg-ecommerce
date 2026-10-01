import { formatPrice } from "@/lib/utils"
import { siteConfig } from "@/lib/site"
import { TICKET_LOGO } from "@/lib/ticket-logo"

export interface TicketItem {
  name: string
  format: string
  unit?: string | null
  quantity: number
  price: number
  total: number
}

export interface TicketData {
  orderNumber: string
  customerName: string
  customerPhone?: string
  sellerName?: string | null
  paymentMethod: string | null
  paymentStatus?: string | null
  total: number
  createdAt: string
  pointOfSale?: { name: string; code: string } | null
  items: TicketItem[]
  logo?: string
}

const COMPANY = {
  legal: "LCG-SARL",
  address: "97 Rue EWO, Ouenzé — Brazzaville",
  phones: "+242 06 739 49 49 · +242 05 607 91 91",
  website: siteConfig.url.replace(/^https?:\/\//, ""),
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  MOBILE_MONEY_MTN: "MTN MoMo",
  MOBILE_MONEY_AIRTEL: "Airtel Money",
  CARD: "Carte bancaire",
}

// Tampon imprimé sous le total selon le statut de paiement (absent = vente comptoir réglée).
const PAYMENT_STAMPS: Record<string, string> = {
  PAID: "PAYÉ",
  PENDING: "À RÉGLER",
  FAILED: "À RÉGLER",
  REFUNDED: "REMBOURSÉ",
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function formatAmount(value: number): string {
  return formatPrice(value).replace(/ FCFA$/, "")
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

// "2kg" -> "sac 2 kg"
function formatPackaging(item: TicketItem): string {
  const format = (item.format || "").replace(/(\d)\s*([a-zA-Z])/g, "$1 $2")
  return [item.unit, format].filter(Boolean).join(" ")
}

/**
 * Imprime un ticket déjà écrit dans `win` (popup ou iframe). On attend le logo, on
 * mesure le ticket et on déclare « 80 mm × hauteur réelle » (4 mm de marges + 2 mm de
 * sécurité) : sans taille exacte, Chromium retombe sur le papier du pilote, le pilote
 * thermique met le ticket à l'échelle et le texte devient flou.
 */
export function printTicketWindow(win: Window): void {
  const doc = win.document
  const go = () => {
    const px = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)
    const h = Math.max(40, Math.ceil((px * 25.4) / 96) + 6)
    const page = doc.createElement("style")
    page.textContent = `@page { size: 80mm ${h}mm; margin: 2mm 3mm; }`
    doc.head.appendChild(page)
    win.focus()
    win.print()
  }
  const img = doc.querySelector("img")
  if (img && !img.complete) {
    img.onload = go
    img.onerror = go
  } else setTimeout(go, 50)
}

export function buildTicketHtml(ticket: TicketData): string {
  const paymentLabel = PAYMENT_LABELS[ticket.paymentMethod || ""] || ticket.paymentMethod || "-"
  const stamp = PAYMENT_STAMPS[ticket.paymentStatus || "PAID"] || "PAYÉ"
  const pos = ticket.pointOfSale ? ticket.pointOfSale.name : "Comptoir"
  const logoUrl = ticket.logo || TICKET_LOGO

  const meta: [string, string][] = [
    ["Date", formatDateTime(ticket.createdAt)],
    ["Point de vente", pos],
    ...(ticket.sellerName ? [["Vendeur", ticket.sellerName] as [string, string]] : []),
    ["Client", ticket.customerName || "Client comptoir"],
    ...(ticket.customerPhone ? [["Téléphone", ticket.customerPhone] as [string, string]] : []),
  ]

  const rows = ticket.items
    .map((item) => {
      const packaging = formatPackaging(item)
      return `<tr>
  <td>${escapeHtml(item.name)}${packaging ? `<small>${escapeHtml(packaging)}</small>` : ""}</td>
  <td class="n">${item.quantity}</td>
  <td class="n">${formatAmount(item.price)}</td>
  <td class="n">${formatAmount(item.total)}</td>
</tr>`
    })
    .join("\n")

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket ${escapeHtml(ticket.orderNumber)}</title>
<style>
  /* « size: 80mm auto » est refusé par Chromium (auto n'est pas une dimension) : la règle
     serait ignorée et le pilote redimensionnerait le ticket (texte flou). Hauteur fixe à la place. */
  @page { size: 80mm 300mm; margin: 2mm 3mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Tête thermique 203 dpi : un trait de police normale à 11 px ne fait qu'un point
     de large et sort pâle ou haché. Tout le ticket est donc en gras, 11 px minimum. */
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-weight: bold;
    width: 72mm;
    margin: 0 auto;
    padding: 2mm 0 4mm;
    color: #000;
    font-size: 12px;
    line-height: 1.35;
    background: #fff;
  }
  .head { text-align: center; }
  /* Logo 1 bit de 224 px = 28 mm à 203 dpi : un pixel par point, rien à tramer. */
  .logo { display: block; margin: 0 auto 3px; width: 28mm; height: auto; image-rendering: pixelated; }
  .legal { font-size: 11px; }
  .rule { border-top: 1.5px solid #000; margin: 7px 0; }
  .thin { border-top: 1px solid #000; margin: 6px 0; }
  .num { text-align: center; }
  .num small { display: block; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  .num b { font-size: 17px; letter-spacing: .5px; }
  .meta { display: grid; grid-template-columns: auto 1fr; gap: 1px 8px; font-size: 12px; }
  .meta dd { text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .3px; text-align: left; border-bottom: 1px solid #000; padding: 0 0 3px; }
  td { padding: 4px 0 0; vertical-align: top; }
  td small { display: block; font-size: 11px; }
  th.n, td.n { text-align: right; white-space: nowrap; padding-left: 4px; }
  /* Bande noire dessinée par une bordure, pas par un fond : les navigateurs et pilotes
     thermiques suppriment les fonds à l'impression, jamais les bordures. */
  .band { position: relative; height: 9mm; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; margin: 8px 0 6px; }
  .band::before { content: ""; position: absolute; inset: 0; border-top: 9mm solid #000; }
  .band span, .band b { position: relative; }
  .band span { font-size: 12px; letter-spacing: 1.5px; padding-top: 3px; }
  .band b { font-size: 20px; white-space: nowrap; }
  .stamp { border: 2px solid #000; border-radius: 4px; text-align: center; padding: 3px 0; letter-spacing: 3px; font-size: 16px; margin: 0 7mm; }
  .stamp small { display: block; letter-spacing: .5px; font-size: 11px; }
  .foot { text-align: center; font-size: 11px; }
  .foot b { display: block; font-size: 13px; margin-bottom: 1px; }
</style>
</head>
<body>

<div class="head">
  <img src="${escapeHtml(logoUrl)}" class="logo" alt="LCG" />
  <div class="legal">${escapeHtml(COMPANY.legal)} · ${escapeHtml(COMPANY.address)}</div>
  <div class="legal">${escapeHtml(COMPANY.phones)}</div>
</div>

<div class="rule"></div>
<div class="num"><small>Ticket de vente</small><b>${escapeHtml(ticket.orderNumber)}</b></div>
<div class="thin"></div>

<dl class="meta">
${meta.map(([label, value]) => `  <dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("\n")}
</dl>

<table>
  <thead><tr><th>Article</th><th class="n">Qté</th><th class="n">P.U.</th><th class="n">Montant</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>

<div class="band"><span>TOTAL</span><b>${formatPrice(ticket.total)}</b></div>
<div class="stamp">${stamp}<small>${escapeHtml(paymentLabel)}</small></div>

<div class="rule"></div>
<div class="foot">
  <b>Merci pour votre confiance !</b>
  <div>Commandez en ligne sur ${escapeHtml(COMPANY.website)}</div>
  <div>Livraison à domicile · Brazzaville</div>
</div>

</body>
</html>`
}
