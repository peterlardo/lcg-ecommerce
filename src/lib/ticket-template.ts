import { formatPrice } from "@/lib/utils"

export interface TicketItem {
  name: string
  format: string
  quantity: number
  price: number
  total: number
}

export interface TicketData {
  orderNumber: string
  customerName: string
  paymentMethod: string | null
  paymentStatus?: string | null
  total: number
  createdAt: string
  pointOfSale?: { name: string; code: string } | null
  items: TicketItem[]
  logo?: string
}

const COMPANY = {
  name: "LA CONGOLAISE DES GLAÇONS",
  legal: "LCG-SARL",
  address: "97 Rue EWO, Ouenzé — Brazzaville",
  tagline: "Production · Eau minérale · Glaçons · PET · Livraison",
  logo: "/logo-lcg.jpeg",
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte",
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Payé",
  PENDING: "En attente",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function buildBarcode(value: string): string {
  const chars = value.replace(/[^A-Z0-9]/gi, "").split("")
  if (chars.length === 0) return ""
  let bars = `<span style="width:2px"></span><span style="width:2px;background:#111"></span><span style="width:2px"></span>`
  bars += chars
    .map((char) => {
      const code = char.charCodeAt(0)
      const pattern = (code % 4) + 1
      return `<span style="width:${pattern + 1}px;background:#111"></span><span style="width:${2 + (pattern % 2)}px"></span><span style="width:${pattern}px;background:#111"></span><span style="width:2px"></span>`
    })
    .join("")
  bars += `<span style="width:2px"></span><span style="width:2px;background:#111"></span><span style="width:2px"></span>`
  return `<div style="display:flex;justify-content:center;gap:1px;margin:10px 0 6px">${bars}</div>`
}

export function buildTicketHtml(ticket: TicketData): string {
  const logo = ticket.logo || COMPANY.logo
  const paymentLabel = PAYMENT_LABELS[ticket.paymentMethod || ""] || ticket.paymentMethod || "-"
  const paymentStatus = PAYMENT_STATUS_LABELS[ticket.paymentStatus || ""] || ""
  const pointOfSale = ticket.pointOfSale ? `${escapeHtml(ticket.pointOfSale.name)} (${escapeHtml(ticket.pointOfSale.code)})` : "Comptoir principal"

  const itemsRows = ticket.items
    .map(
      (item) => `
        <tr>
          <td class="item-name">${escapeHtml(item.name)}</td>
          <td class="item-total">${formatPrice(item.total)}</td>
        </tr>
        <tr>
          <td class="item-meta">${item.format ? `${escapeHtml(item.format)} · ` : ""}${item.quantity} x ${formatPrice(item.price)}</td>
          <td class="item-meta" style="text-align:right"></td>
        </tr>
        <tr class="item-sep"><td colspan="2"></td></tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket ${escapeHtml(ticket.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    width: 72mm;
    margin: 0 auto;
    color: #121f37;
    font-size: 10.5px;
    line-height: 1.45;
  }
  .center { text-align: center; }
  .header { padding-bottom: 8px; }
  .logo { width: 21mm; height: 21mm; object-fit: contain; margin: 0 auto 4px; display: block; }
  .company-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #0e2654;
    line-height: 1.25;
  }
  .company-legal {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #1245b9;
    margin-top: 3px;
  }
  .company-address { font-size: 8.5px; color: #5a6a85; margin-top: 2px; }
  .company-tagline { font-size: 7.5px; color: #9aa7bd; margin-top: 2px; letter-spacing: 0.3px; }
  .accent-bar {
    height: 2.5px;
    margin: 8px 0;
    background: linear-gradient(90deg, #1245b9, #359bd9);
    border-radius: 2px;
  }
  .doc-type {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2.5px;
    color: #5a6a85;
    text-transform: uppercase;
    text-align: center;
    margin-bottom: 4px;
  }
  .ticket-badge {
    display: inline-block;
    background: #f0f4ff;
    border: 1px solid #d5e2ff;
    color: #1245b9;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 3px 14px;
    border-radius: 999px;
  }
  .meta { width: 100%; margin: 8px 0 4px; }
  .meta td { padding: 1.5px 0; vertical-align: top; }
  .meta-label {
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #9aa7bd;
    width: 26mm;
  }
  .meta-value { font-size: 10px; color: #121f37; font-weight: 600; }
  .divider { border: 0; border-top: 1px dashed #c3cbd9; margin: 8px 0; }
  .items-title {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #9aa7bd;
    margin-bottom: 4px;
  }
  table.items { width: 100%; border-collapse: collapse; }
  .item-name { font-size: 10.5px; font-weight: 700; color: #121f37; padding-top: 4px; }
  .item-total { font-size: 10.5px; font-weight: 700; text-align: right; padding-top: 4px; white-space: nowrap; }
  .item-meta { font-size: 8.5px; color: #5a6a85; }
  .item-sep td { border-top: 1px solid #eef1f6; height: 1px; padding: 3px 0 0; }
  .total-block {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0e2654;
    color: #ffffff;
    border-radius: 8px;
    padding: 9px 12px;
    margin: 10px 0;
  }
  .total-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .total-value { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
  .payment-line {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    margin-top: 2px;
  }
  .payment-line .label { color: #5a6a85; }
  .payment-line .value { font-weight: 700; color: #0e2654; }
  .thanks { text-align: center; margin-top: 10px; }
  .thanks-main { font-size: 11px; font-weight: 700; color: #0e2654; }
  .thanks-sub { font-size: 8.5px; color: #5a6a85; margin-top: 2px; }
  .footer-brand { text-align: center; font-size: 8px; color: #9aa7bd; margin-top: 4px; letter-spacing: 0.4px; }
  .barcode-number {
    text-align: center;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 9px;
    letter-spacing: 2px;
    color: #121f37;
  }
  .cut { border-top: 2px dashed #c3cbd9; margin-top: 10px; }
</style>
</head>
<body>
  <div class="header center">
    <img class="logo" src="${logo}" alt="LCG" />
    <div class="company-name">LA CONGOLAISE<br/>DES GLAÇONS</div>
    <div class="company-legal">${COMPANY.legal}</div>
    <div class="company-address">${escapeHtml(COMPANY.address)}</div>
    <div class="company-tagline">${escapeHtml(COMPANY.tagline)}</div>
  </div>
  <div class="accent-bar"></div>
  <div class="doc-type">Ticket de vente</div>
  <div class="center"><span class="ticket-badge">${escapeHtml(ticket.orderNumber)}</span></div>
  <div class="divider"></div>
  <table class="meta">
    <tr><td class="meta-label">Point de vente</td><td class="meta-value">${pointOfSale}</td></tr>
    <tr><td class="meta-label">Date</td><td class="meta-value">${formatDate(ticket.createdAt)}</td></tr>
    <tr><td class="meta-label">Heure</td><td class="meta-value">${formatTime(ticket.createdAt)}</td></tr>
    <tr><td class="meta-label">Client</td><td class="meta-value">${escapeHtml(ticket.customerName || "Client comptoir")}</td></tr>
    <tr><td class="meta-label">Paiement</td><td class="meta-value">${paymentLabel}</td></tr>
  </table>
  <hr class="divider" />
  <div class="items-title">Détail des articles</div>
  <table class="items">${itemsRows}</table>
  <div class="total-block">
    <span class="total-label">Total</span>
    <span class="total-value">${formatPrice(ticket.total)}</span>
  </div>
  <div class="payment-line">
    <span class="label">Paiement reçu</span>
    <span class="value">${paymentLabel}${paymentStatus ? ` · ${paymentStatus}` : ""}</span>
  </div>
  <div class="thanks">
    <div class="thanks-main">Merci pour votre achat !</div>
    <div class="thanks-sub">Nous restons à votre disposition.</div>
  </div>
  ${buildBarcode(ticket.orderNumber)}
  <div class="barcode-number">${escapeHtml(ticket.orderNumber)}</div>
  <div class="footer-brand">${COMPANY.name} · ${COMPANY.legal}<br/>${escapeHtml(COMPANY.address)}</div>
  <div class="cut"></div>
</body>
</html>`
}
