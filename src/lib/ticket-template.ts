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
  phones: "+242 06 739 49 49 / +242 05 607 91 91",
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: "Especes",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte",
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length)
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : " ".repeat(len - str.length) + str
}

function center(str: string, len: number): string {
  const pad = Math.max(0, len - str.length)
  const left = Math.floor(pad / 2)
  return " ".repeat(left) + str + " ".repeat(pad - left)
}

const WIDTH = 42

function line(): string {
  return "-".repeat(WIDTH)
}

function dotted(): string {
  return ".".repeat(WIDTH)
}

export function buildTicketHtml(ticket: TicketData): string {
  const paymentLabel = PAYMENT_LABELS[ticket.paymentMethod || ""] || ticket.paymentMethod || "-"
  const pos = ticket.pointOfSale ? ticket.pointOfSale.name : "Comptoir"
  const w = WIDTH

  const itemsLines = ticket.items
    .map((item) => {
      const qty = `${item.quantity}x`
      const name = item.format ? `${item.name} ${item.format}` : item.name
      const nameMax = w - qty.length - 1 - 10
      const truncName = name.length > nameMax ? name.slice(0, nameMax - 1) + "+" : name
      const line1 = `${padRight(truncName, nameMax)} ${padLeft(qty, qty.length)} ${padLeft(formatPrice(item.total), 10)}`
      const unitPrice = `${item.quantity} x ${formatPrice(item.price)}`
      const line2 = `  ${unitPrice}`
      return [line1, line2]
    })
    .flat()

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket ${escapeHtml(ticket.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 2mm 3mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Courier New", "Consolas", monospace;
    width: 72mm;
    margin: 0 auto;
    color: #000;
    font-size: 11px;
    line-height: 1.35;
    background: #fff;
  }
  .line { white-space: pre; overflow: hidden; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .large { font-size: 14px; font-weight: bold; }
  .small { font-size: 9px; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .sep2 { border-top: 2px solid #000; margin: 4px 0; }
</style>
</head>
<body>

<div class="center bold large">${escapeHtml(COMPANY.name)}</div>
<div class="center small">${escapeHtml(COMPANY.legal)}</div>
<div class="center small">${escapeHtml(COMPANY.address)}</div>
<div class="center small">Tél: ${escapeHtml(COMPANY.phones)}</div>

<div class="sep2"></div>
<div class="center bold">TICKET DE VENTE</div>
<div class="center bold" style="font-size:13px">${escapeHtml(ticket.orderNumber)}</div>
<div class="sep"></div>

<div class="line">${padRight("Point:", 12)}${escapeHtml(pos)}</div>
<div class="line">${padRight("Date:", 12)}${formatDate(ticket.createdAt)}</div>
<div class="line">${padRight("Heure:", 12)}${formatTime(ticket.createdAt)}</div>
<div class="line">${padRight("Client:", 12)}${escapeHtml(ticket.customerName || "Client comptoir")}</div>
<div class="line">${padRight("Paiement:", 12)}${escapeHtml(paymentLabel)}</div>

<div class="sep"></div>

${itemsLines.map((l) => `<div class="line">${escapeHtml(l)}</div>`).join("\n")}

<div class="sep"></div>

<div class="line bold">${padRight("TOTAL", w - 10)}${padLeft(formatPrice(ticket.total), 10)}</div>

<div class="sep2"></div>

<div class="center small">Merci pour votre achat !</div>
<div class="center small">LCG - Brazzaville</div>

<div class="sep2"></div>

</body>
</html>`
}
