import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { LOGO_BASE64 } from "./logo-base64"

const PAYMENT: Record<string, string> = { CASH_ON_DELIVERY: "Especes", MOBILE_MONEY: "Mobile Money", CARD: "Carte" }
const STATUS_LBL: Record<string, string> = { PENDING: "En attente", CONFIRMED: "Confirmee", PROCESSING: "En cours", READY: "Prete", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livre", CANCELLED: "Annulee" }
const SUPPLY_LBL: Record<string, string> = { IN: "Entree", PRODUCTION: "Production", TRANSFER_IN: "Transfert", RETURN: "Retour" }
const LOT_STATUS_LBL: Record<string, string> = { ACTIVE: "Actif", EXHAUSTED: "Epuise", EXPIRED: "Expire" }

const COMPANY = {
  name: "LCG - La Congolaise des Glacons",
  address: "15 Avenue de la Republique, Brazzaville, Congo",
  phone: "+242 05 123 45 67",
  email: "contact@lcg.cg",
  website: "https://lcg.cg",
}

const REPORT_VERSION = "1.0"
const CURRENT_YEAR = new Date().getFullYear()

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"
}

function today() {
  return new Date().toLocaleDateString("fr-FR")
}

function todayShort() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "")
}

// ─── PDF UTILITIES ────────────────────────────────────────────

function createDoc(): jsPDF {
  const doc = new jsPDF("p", "mm", "a4")
  doc.setProperties({
    title: COMPANY.name,
    author: COMPANY.name,
    creator: COMPANY.name + " - Systeme de rapports",
  })
  return doc
}

function addCoverPage(doc: jsPDF, reportTitle: string, reportVersion: string) {
  const w = 210
  const h = 297

  // Full page dark background
  doc.setFillColor(15, 25, 55)
  doc.rect(0, 0, w, h, "F")

  // Accent stripe left
  doc.setFillColor(31, 79, 163)
  doc.rect(0, 0, 8, h, "F")

  // Decorative diagonal shape
  doc.setFillColor(31, 79, 163)
  doc.setDrawColor(31, 79, 163)
  doc.triangle(0, 180, 120, 140, 0, 100, "F")
  doc.setFillColor(25, 60, 130)
  doc.triangle(0, 220, 160, 180, 0, 140, "F")

  // Logo
  try {
    doc.addImage(LOGO_BASE64, "PNG", 80, 25, 50, 50)
  } catch { /* logo not available */ }

  // Company name under logo
  doc.setTextColor(180, 200, 240)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(COMPANY.name.toUpperCase(), w / 2, 85, { align: "center" })

  // Thin separator line
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.8)
  doc.line(40, 92, w - 40, 92)

  // Report title - bold modern style
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(32)
  doc.setFont("helvetica", "bold")
  const titleLines = wrapText(reportTitle, 170)
  let ty = 118
  for (const line of titleLines) {
    doc.text(line, w / 2, ty, { align: "center" })
    ty += 14
  }

  // Accent underline under title
  doc.setFillColor(31, 79, 163)
  const lineW = Math.min(120, doc.getTextWidth(reportTitle) + 20)
  doc.roundedRect((w - lineW) / 2, ty + 2, lineW, 3, 1.5, 1.5, "F")

  // Version + Date
  doc.setTextColor(160, 180, 220)
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text("Version " + reportVersion + "  |  " + today(), w / 2, ty + 22, { align: "center" })

  // Bottom info block
  const by = h - 70
  doc.setFillColor(20, 35, 70)
  doc.roundedRect(30, by, w - 60, 55, 4, 4, "F")

  // Editor
  doc.setTextColor(100, 140, 220)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("EDITEUR DU RAPPORT", 50, by + 12)
  doc.setTextColor(220, 230, 250)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(COMPANY.name, 50, by + 20)

  // Coordinates
  doc.setTextColor(100, 140, 220)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("COORDONNEES", 50, by + 32)
  doc.setTextColor(200, 210, 240)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(COMPANY.address, 50, by + 39)
  doc.text(COMPANY.phone + "  |  " + COMPANY.email, 50, by + 46)
  doc.text(COMPANY.website, 50, by + 53)
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const test = current ? current + " " + word : word
    if (test.length * 5.5 > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function addPageHeader(doc: jsPDF, reportTitle: string) {
  const w = 210

  // Logo (small) top left
  try {
    doc.addImage(LOGO_BASE64, "PNG", 10, 5, 11, 11)
  } catch { /* skip */ }

  // Company name
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text(COMPANY.name.toUpperCase(), 32, 11)

  // Report title right
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120, 120, 120)
  doc.text(reportTitle, w - 10, 11, { align: "right" })

  // Separator line
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.4)
  doc.line(10, 21, w - 10, 21)
}

function addPageFooter(doc: jsPDF, reportTitle: string, pageNum: number, totalPages: number) {
  const w = 210
  const h = 297
  const footerY = h - 12

  // Separator line
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(10, footerY - 4, w - 10, footerY - 4)

  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(140, 140, 140)

  // Left: company name
  doc.text(COMPANY.name, 10, footerY)

  // Center: report title + year + version
  doc.text(
    reportTitle + "  |  Annee " + CURRENT_YEAR + "  |  Version " + REPORT_VERSION,
    w / 2,
    footerY,
    { align: "center" }
  )

  // Right: page number
  doc.text("Page " + pageNum + " / " + totalPages, w - 10, footerY, { align: "right" })
}

function finalizePDF(doc: jsPDF, reportTitle: string, filename: string) {
  const totalPages = doc.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    addPageFooter(doc, reportTitle, i - 1, totalPages - 1)
  }
  doc.save(filename)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── VENTES ────────────────────────────────────────────────────

export function exportVentesPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Ventes", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Ventes")
  let y = 30

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("CA 7j: " + fmt(data.summary?.revenue7 ?? 0), 14, y); y += 6
  doc.text("CA 30j: " + fmt(data.summary?.revenue30 ?? 0), 14, y); y += 6
  doc.text("Commandes 30j: " + (data.summary?.orders30 ?? 0), 14, y); y += 6
  doc.text("Panier moyen: " + fmt(data.summary?.avgOrder ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Top produits", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Produit", "Qte", "Revenu"]],
    body: (data.topProducts ?? []).map((p: any) => [p.name, String(p.quantity), fmt(p.revenue)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Paiements (30j)", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Methode", "Transactions", "Total"]],
    body: (data.paymentBreakdown30 ?? []).map((p: any) => [PAYMENT[p.method] ?? p.method, String(p.count), fmt(p.total)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Ventes", "rapport-ventes-" + todayShort() + ".pdf")
}

export function exportVentesExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const summary = [["Indicateur", "Valeur"], ["CA 7j", data.summary?.revenue7 ?? 0], ["CA 30j", data.summary?.revenue30 ?? 0], ["Commandes 30j", data.summary?.orders30 ?? 0], ["Panier moyen", data.summary?.avgOrder ?? 0]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resume")
  const top = [["Produit", "Qte", "Revenu"], ...(data.topProducts ?? []).map((p: any) => [p.name, p.quantity, p.revenue])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(top), "Top Produits")
  const pay = [["Methode", "Transactions", "Total"], ...(data.paymentBreakdown30 ?? []).map((p: any) => [PAYMENT[p.method] ?? p.method, p.count, p.total])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pay), "Paiements")
  const daily = [["Jour", "Revenu", "Commandes"], ...(data.daily7 ?? []).map((d: any) => [d.name, d.revenu, d.commandes])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "CA 7j")
  XLSX.writeFile(wb, "rapport-ventes-" + todayShort() + ".xlsx")
}

// ─── STOCKS ────────────────────────────────────────────────────

export function exportStocksPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Stocks", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Stocks")
  let y = 30

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Unites stock: " + (data.summary?.stockUnits ?? 0), 14, y); y += 6
  doc.text("Variantes: " + (data.summary?.totalVariants ?? 0), 14, y); y += 6
  doc.text("Stock faible: " + (data.summary?.lowStock ?? 0), 14, y); y += 6
  doc.text("Rupture: " + (data.summary?.outOfStock ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Stock par categorie", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Categorie", "Stock total", "Variantes"]],
    body: (data.stockByCategory ?? []).map((c: any) => [c.name, String(c.totalStock), String(c.variants)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Variantes", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Produit", "Format", "Categorie", "Stock"]],
    body: (data.allStockVariants ?? []).map((v: any) => [v.productName, v.format, v.categoryName, String(v.stock)]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Stocks", "rapport-stocks-" + todayShort() + ".pdf")
}

export function exportStocksExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const cats = [["Categorie", "Stock total", "Variantes"], ...(data.stockByCategory ?? []).map((c: any) => [c.name, c.totalStock, c.variants])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cats), "Par categorie")
  const vars = [["Produit", "Format", "Categorie", "Stock"], ...(data.allStockVariants ?? []).map((v: any) => [v.productName, v.format, v.categoryName, v.stock])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vars), "Variantes")
  const alerts = [["Produit", "Format", "Stock"], ...(data.stockAlerts ?? []).map((a: any) => [a.productName, a.format, a.stock])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(alerts), "Alertes")
  XLSX.writeFile(wb, "rapport-stocks-" + todayShort() + ".xlsx")
}

// ─── APPROVISIONNEMENTS ───────────────────────────────────────

export function exportApproPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Approvisionnements", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Approvisionnements")
  let y = 30

  const types = (data.supplyByType ?? []).filter((t: any) => t.quantity > 0)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume par type", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Type", "Quantite", "Mouvements"]],
    body: types.map((t: any) => [SUPPLY_LBL[t.type] ?? t.type, String(t.quantity), String(t.count)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Mouvements (30j)", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Date", "Produit", "Format", "Type", "Qte", "Raison"]],
    body: (data.supplyMovements ?? []).map((m: any) => [
      new Date(m.createdAt).toLocaleDateString("fr-FR"),
      m.productName, m.format, SUPPLY_LBL[m.type] ?? m.type, "+" + m.quantity, m.reason || "-",
    ]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Approvisionnements", "rapport-approvisionnements-" + todayShort() + ".pdf")
}

export function exportApproExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const types = [["Type", "Quantite", "Mouvements"], ...(data.supplyByType ?? []).filter((t: any) => t.quantity > 0).map((t: any) => [SUPPLY_LBL[t.type] ?? t.type, t.quantity, t.count])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(types), "Resume")
  const mvts = [["Date", "Produit", "Format", "Type", "Qte", "Raison"], ...(data.supplyMovements ?? []).map((m: any) => [new Date(m.createdAt).toLocaleDateString("fr-FR"), m.productName, m.format, SUPPLY_LBL[m.type] ?? m.type, m.quantity, m.reason || ""])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mvts), "Mouvements")
  XLSX.writeFile(wb, "rapport-approvisionnements-" + todayShort() + ".xlsx")
}

// ─── COMMANDES ────────────────────────────────────────────────

export function exportCommandesPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Commandes", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Commandes")
  let y = 30

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Commandes 30j: " + (data.summary?.orders30 ?? 0), 14, y); y += 6
  doc.text("CA commandes: " + fmt(data.summary?.revenue30 ?? 0), 14, y); y += 6
  doc.text("Aujourd'hui: " + (data.summary?.todayOrders ?? 0), 14, y); y += 6
  doc.text("En livraison: " + (data.summary?.deliveriesInProgress ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Par statut", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Statut", "Commandes", "Total"]],
    body: (data.ordersByStatus ?? []).map((s: any) => [STATUS_LBL[s.status] ?? s.status, String(s.count), fmt(s.total)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Commandes / jour", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Jour", "Commandes", "Revenu"]],
    body: (data.ordersByDay ?? []).map((d: any) => [d.name, String(d.commandes), fmt(d.revenu)]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Commandes", "rapport-commandes-" + todayShort() + ".pdf")
}

export function exportCommandesExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const summary = [["Statut", "Commandes", "Total"], ...(data.ordersByStatus ?? []).map((s: any) => [STATUS_LBL[s.status] ?? s.status, s.count, s.total])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Par statut")
  const daily = [["Jour", "Commandes", "Revenu"], ...(data.ordersByDay ?? []).map((d: any) => [d.name, d.commandes, d.revenu])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Par jour")
  XLSX.writeFile(wb, "rapport-commandes-" + todayShort() + ".xlsx")
}

// ─── RESERVATIONS ─────────────────────────────────────────────

export function exportReservationsPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Reservations", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Reservations")
  let y = 30

  const rs = data.reservationsByStatus ?? {}
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Total: " + (rs.total ?? 0), 14, y); y += 6
  doc.text("En attente: " + (rs.pending ?? 0), 14, y); y += 6
  doc.text("Confirmees: " + (rs.confirmed ?? 0), 14, y); y += 6
  doc.text("Annulees: " + (rs.cancelled ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Dernieres reservations", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Client", "Type", "Date", "Heure", "Statut"]],
    body: (data.reservations ?? []).map((r: any) => [r.client, r.type, r.date, r.heure, STATUS_LBL[r.status] ?? r.status]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Reservations", "rapport-reservations-" + todayShort() + ".pdf")
}

export function exportReservationsExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const res = [["Client", "Type", "Date", "Heure", "Statut"], ...(data.reservations ?? []).map((r: any) => [r.client, r.type, r.date, r.heure, STATUS_LBL[r.status] ?? r.status])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(res), "Reservations")
  const daily = [["Jour", "Reservations"], ...(data.reservationsByDay ?? []).map((d: any) => [d.name, d.reservations])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Par jour")
  XLSX.writeFile(wb, "rapport-reservations-" + todayShort() + ".xlsx")
}

// ─── PRODUCTION ───────────────────────────────────────────────

export function exportProductionPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Production", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Production")
  let y = 30

  const ps = data.productionSummary ?? {}
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Total produit (30j): " + (ps.totalProduced ?? 0), 14, y); y += 6
  doc.text("Ordres: " + (ps.productionCount ?? 0), 14, y); y += 6
  doc.text("Entrees stock: " + (ps.totalIn ?? 0), 14, y); y += 6
  doc.text("Pertes: " + (ps.totalLoss ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Production / jour", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Jour", "Quantite produite"]],
    body: (data.productionByDay ?? []).filter((d: any) => d.quantity > 0).map((d: any) => [d.name, String(d.quantity)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Mouvements production", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Date", "Produit", "Format", "Qte", "Raison"]],
    body: (data.productionMovements ?? []).map((m: any) => [
      new Date(m.createdAt).toLocaleDateString("fr-FR"), m.productName, m.format, "+" + m.quantity, m.reason || "-",
    ]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Production", "rapport-production-" + todayShort() + ".pdf")
}

export function exportProductionExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const ps = data.productionSummary ?? {}
  const summary = [["Indicateur", "Valeur"], ["Total produit", ps.totalProduced ?? 0], ["Ordres", ps.productionCount ?? 0], ["Entrees stock", ps.totalIn ?? 0], ["Pertes", ps.totalLoss ?? 0]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resume")
  const daily = [["Jour", "Quantite"], ...(data.productionByDay ?? []).map((d: any) => [d.name, d.quantity])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Par jour")
  const mvts = [["Date", "Produit", "Format", "Qte", "Raison"], ...(data.productionMovements ?? []).map((m: any) => [new Date(m.createdAt).toLocaleDateString("fr-FR"), m.productName, m.format, m.quantity, m.reason || ""])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mvts), "Mouvements")
  XLSX.writeFile(wb, "rapport-production-" + todayShort() + ".xlsx")
}

// ─── CAISSE ───────────────────────────────────────────────────

export function exportCaissePDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Caisse", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Caisse")
  let y = 30

  const cs = data.cashSessionsSummary ?? {}
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Sessions: " + (cs.totalSessions ?? 0), 14, y); y += 6
  doc.text("Ouvertes: " + (cs.openSessions ?? 0), 14, y); y += 6
  doc.text("Fermees: " + (cs.closedSessions ?? 0), 14, y); y += 6
  doc.text("Solde total ouverture: " + fmt(cs.totalOpening ?? 0), 14, y); y += 6
  doc.text("Solde total cloture: " + fmt(cs.totalClosing ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Recapitulatif / jour", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Date", "Sessions", "Ouverture", "Cloture", "Ecart"]],
    body: (data.cashSessionsByDay ?? []).map((d: any) => [
      d.name, String(d.sessions), fmt(d.openingTotal),
      d.closingTotal !== null ? fmt(d.closingTotal) : "-",
      d.gap !== null ? (d.gap > 0 ? "+" : "") + fmt(d.gap) : "-",
    ]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Caisse", "rapport-caisse-" + todayShort() + ".pdf")
}

export function exportCaisseExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const daily = [["Date", "Sessions", "Ouverture", "Cloture", "Ecart"], ...(data.cashSessionsByDay ?? []).map((d: any) => [d.name, d.sessions, d.openingTotal, d.closingTotal, d.gap])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Recapitulatif")
  XLSX.writeFile(wb, "rapport-caisse-" + todayShort() + ".xlsx")
}

// ─── LOTS ─────────────────────────────────────────────────────

export function exportLotsPDF(data: any) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Lots", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Lots")
  let y = 30

  const ls = data.lotSummary ?? {}
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Total lots: " + (ls.totalLots ?? 0), 14, y); y += 6
  doc.text("Lots actifs: " + (ls.activeLots ?? 0), 14, y); y += 6
  doc.text("Total produit: " + (ls.totalProduced ?? 0), 14, y); y += 6
  doc.text("Stock restant: " + (ls.totalRemaining ?? 0), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Details des lots", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Numero", "Produit", "Format", "Produit (qte)", "Restant", "Statut", "Production", "Expiration"]],
    body: (data.lots ?? []).map((l: any) => [
      l.lotNumber, l.productName, l.format, String(l.initialQuantity), String(l.remainingQuantity),
      LOT_STATUS_LBL[l.status] ?? l.status,
      new Date(l.productionDate).toLocaleDateString("fr-FR"),
      l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("fr-FR") : "-",
    ]),
    styles: { fontSize: 7, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Lots", "rapport-lots-" + todayShort() + ".pdf")
}

export function exportLotsExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const ls = data.lotSummary ?? {}
  const summary = [["Indicateur", "Valeur"], ["Total lots", ls.totalLots ?? 0], ["Lots actifs", ls.activeLots ?? 0], ["Total produit", ls.totalProduced ?? 0], ["Stock restant", ls.totalRemaining ?? 0]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resume")
  const lots = [["Numero", "Produit", "Format", "Produit (qte)", "Restant", "Statut", "Allocations", "Production", "Expiration"], ...(data.lots ?? []).map((l: any) => [l.lotNumber, l.productName, l.format, l.initialQuantity, l.remainingQuantity, LOT_STATUS_LBL[l.status] ?? l.status, l.allocationCount, new Date(l.productionDate).toLocaleDateString("fr-FR"), l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("fr-FR") : ""])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lots), "Lots")
  XLSX.writeFile(wb, "rapport-lots-" + todayShort() + ".xlsx")
}
