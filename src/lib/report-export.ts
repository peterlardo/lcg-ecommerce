import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { LOGO_BADGE_BASE64 } from "./logo-badge-base64"
import { drawCoverPage } from "./pdf-cover"
import type { ReportPayload } from "./report-types"

type VentesData = Pick<ReportPayload, "summary" | "topProducts" | "paymentBreakdown30" | "daily7">
type StocksData = Pick<ReportPayload, "summary" | "stockByCategory" | "allStockVariants" | "stockAlerts">
type ApproData = Pick<ReportPayload, "supplyByType" | "supplyMovements">
type CommandesData = Pick<ReportPayload, "summary" | "ordersByStatus" | "ordersByDay">
type ReservationsData = Pick<ReportPayload, "reservationsByStatus" | "reservations" | "reservationsByDay">
type ProductionData = Pick<ReportPayload, "productionSummary" | "productionByDay" | "productionMovements">
type CaisseData = Pick<ReportPayload, "cashSessionsSummary" | "cashSessionsByDay">
type LotsData = Pick<ReportPayload, "lotSummary" | "lots">

const PAYMENT: Record<string, string> = { CASH_ON_DELIVERY: "Especes", MOBILE_MONEY: "Mobile Money", CARD: "Carte" }
const STATUS_LBL: Record<string, string> = { PENDING: "En attente", SENT_TO_CASHIER: "Caisse", CONFIRMED: "Confirmee", PROCESSING: "En cours", READY: "Prete", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livre", CANCELLED: "Annulee" }
const SUPPLY_LBL: Record<string, string> = { IN: "Entree", PRODUCTION: "Production", TRANSFER_IN: "Transfert", RETURN: "Retour" }
const LOT_STATUS_LBL: Record<string, string> = { ACTIVE: "Actif", EXHAUSTED: "Epuise", EXPIRED: "Expire" }

const COMPANY = {
  name: "LCG - La Congolaise des Glacons",
  address: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo",
  phone: "+242 06 739 49 49 · +242 05 607 91 91",
  email: "contact@lcg.cg",
  website: "https://lcg.cg",
}

const REPORT_VERSION = "1.0"
const CURRENT_YEAR = new Date().getFullYear()

function fmt(n: number) {
  const negative = n < 0
  const [intPart, decPart] = Math.abs(n).toString().split(".")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  const body = decPart ? `${grouped},${decPart}` : grouped
  return `${negative ? "-" : ""}${body} FCFA`
}

function today() {
  return new Date().toLocaleDateString("fr-FR")
}

function todayShort() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "")
}

// ─── PDF UTILITIES ────────────────────────────────────────────

interface AutoTableDoc extends jsPDF {
  lastAutoTable: { finalY: number }
}

function createDoc(): jsPDF {
  const doc = new jsPDF("p", "mm", "a4")
  doc.setProperties({
    title: COMPANY.name,
    author: COMPANY.name,
    creator: COMPANY.name + " - Systeme de rapports",
  })
  return doc
}

function addCoverPage(doc: jsPDF, reportTitle: string, reportVersion: string, meta?: string) {
  drawCoverPage(doc, {
    title: reportTitle,
    meta: meta ?? "Version " + reportVersion + "  |  " + today(),
    company: COMPANY,
  })
}

function addPageHeader(doc: jsPDF, reportTitle: string) {
  const w = 210

  // Logo (small) top left
  try {
    doc.addImage(LOGO_BADGE_BASE64, "PNG", 10, 5, 11, 11)
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

function finalizePDF(doc: jsPDF, reportTitle: string, filename: string, hasCover = true) {
  const totalPages = doc.getNumberOfPages()
  const start = hasCover ? 2 : 1
  for (let i = start; i <= totalPages; i++) {
    doc.setPage(i)
    addPageFooter(doc, reportTitle, hasCover ? i - 1 : i, hasCover ? totalPages - 1 : totalPages)
  }
  doc.save(filename)
}

// ─── VENTES ────────────────────────────────────────────────────

export function exportVentesPDF(data: VentesData) {
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
  doc.text("CA 7j: " + fmt(data.summary.revenue7), 14, y); y += 6
  doc.text("CA 30j: " + fmt(data.summary.revenue30), 14, y); y += 6
  doc.text("Commandes 30j: " + data.summary.orders30, 14, y); y += 6
  doc.text("Panier moyen: " + fmt(data.summary.avgOrder), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Top produits", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Produit", "Qte", "Revenu"]],
    body: data.topProducts.map((p) => [p.name, String(p.quantity), fmt(p.revenue)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Paiements (30j)", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Methode", "Transactions", "Total"]],
    body: data.paymentBreakdown30.map((p) => [PAYMENT[p.method] ?? p.method, String(p.count), fmt(p.total)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Ventes", "rapport-ventes-" + todayShort() + ".pdf")
}

export function exportVentesExcel(data: VentesData) {
  const wb = XLSX.utils.book_new()
  const summary = [["Indicateur", "Valeur"], ["CA 7j", data.summary.revenue7], ["CA 30j", data.summary.revenue30], ["Commandes 30j", data.summary.orders30], ["Panier moyen", data.summary.avgOrder]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resume")
  const top: (string | number)[][] = [["Produit", "Qte", "Revenu"], ...data.topProducts.map((p) => [p.name, p.quantity, p.revenue])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(top), "Top Produits")
  const pay: (string | number)[][] = [["Methode", "Transactions", "Total"], ...data.paymentBreakdown30.map((p) => [PAYMENT[p.method] ?? p.method, p.count, p.total])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pay), "Paiements")
  const daily: (string | number)[][] = [["Jour", "Revenu", "Commandes"], ...data.daily7.map((d) => [d.name, d.revenu, d.commandes])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "CA 7j")
  XLSX.writeFile(wb, "rapport-ventes-" + todayShort() + ".xlsx")
}

// ─── STOCKS ────────────────────────────────────────────────────

export function exportStocksPDF(data: StocksData) {
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
  doc.text("Unites stock: " + data.summary.stockUnits, 14, y); y += 6
  doc.text("Variantes: " + data.summary.totalVariants, 14, y); y += 6
  doc.text("Stock faible: " + data.summary.lowStock, 14, y); y += 6
  doc.text("Rupture: " + data.summary.outOfStock, 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Stock par categorie", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Categorie", "Stock total", "Variantes"]],
    body: data.stockByCategory.map((c) => [c.name, String(c.totalStock), String(c.variants)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Variantes", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Produit", "Format", "Categorie", "Stock"]],
    body: data.allStockVariants.map((v) => [v.productName, v.format, v.categoryName, String(v.stock)]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Stocks", "rapport-stocks-" + todayShort() + ".pdf")
}

export function exportStocksExcel(data: StocksData) {
  const wb = XLSX.utils.book_new()
  const cats: (string | number)[][] = [["Categorie", "Stock total", "Variantes"], ...data.stockByCategory.map((c) => [c.name, c.totalStock, c.variants])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cats), "Par categorie")
  const vars: (string | number)[][] = [["Produit", "Format", "Categorie", "Stock"], ...data.allStockVariants.map((v) => [v.productName, v.format, v.categoryName, v.stock])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vars), "Variantes")
  const alerts: (string | number)[][] = [["Produit", "Format", "Stock"], ...data.stockAlerts.map((a) => [a.productName, a.format, a.stock])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(alerts), "Alertes")
  XLSX.writeFile(wb, "rapport-stocks-" + todayShort() + ".xlsx")
}

// ─── APPROVISIONNEMENTS ───────────────────────────────────────

export function exportApproPDF(data: ApproData) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Approvisionnements", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Approvisionnements")
  let y = 30

  const types = data.supplyByType.filter((t) => t.quantity > 0)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume par type", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Type", "Quantite", "Mouvements"]],
    body: types.map((t) => [SUPPLY_LBL[t.type] ?? t.type, String(t.quantity), String(t.count)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Mouvements (30j)", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Date", "Produit", "Format", "Type", "Qte", "Raison"]],
    body: data.supplyMovements.map((m) => [
      new Date(m.createdAt).toLocaleDateString("fr-FR"),
      m.productName, m.format, SUPPLY_LBL[m.type] ?? m.type, "+" + m.quantity, m.reason || "-",
    ]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Approvisionnements", "rapport-approvisionnements-" + todayShort() + ".pdf")
}

export function exportApproExcel(data: ApproData) {
  const wb = XLSX.utils.book_new()
  const types: (string | number)[][] = [["Type", "Quantite", "Mouvements"], ...data.supplyByType.filter((t) => t.quantity > 0).map((t) => [SUPPLY_LBL[t.type] ?? t.type, t.quantity, t.count])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(types), "Resume")
  const mvts: (string | number)[][] = [["Date", "Produit", "Format", "Type", "Qte", "Raison"], ...data.supplyMovements.map((m) => [new Date(m.createdAt).toLocaleDateString("fr-FR"), m.productName, m.format, SUPPLY_LBL[m.type] ?? m.type, m.quantity, m.reason || ""])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mvts), "Mouvements")
  XLSX.writeFile(wb, "rapport-approvisionnements-" + todayShort() + ".xlsx")
}

// ─── COMMANDES ────────────────────────────────────────────────

export function exportCommandesPDF(data: CommandesData) {
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
  doc.text("Commandes 30j: " + data.summary.orders30, 14, y); y += 6
  doc.text("CA commandes: " + fmt(data.summary.revenue30), 14, y); y += 6
  doc.text("Aujourd'hui: " + data.summary.todayOrders, 14, y); y += 6
  doc.text("En livraison: " + data.summary.deliveriesInProgress, 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Par statut", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Statut", "Commandes", "Total"]],
    body: data.ordersByStatus.map((s) => [STATUS_LBL[s.status] ?? s.status, String(s.count), fmt(s.total)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Commandes / jour", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Jour", "Commandes", "Revenu"]],
    body: data.ordersByDay.map((d) => [d.name, String(d.commandes), fmt(d.revenu)]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Commandes", "rapport-commandes-" + todayShort() + ".pdf")
}

export function exportCommandesExcel(data: CommandesData) {
  const wb = XLSX.utils.book_new()
  const summary: (string | number)[][] = [["Statut", "Commandes", "Total"], ...data.ordersByStatus.map((s) => [STATUS_LBL[s.status] ?? s.status, s.count, s.total])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Par statut")
  const daily: (string | number)[][] = [["Jour", "Commandes", "Revenu"], ...data.ordersByDay.map((d) => [d.name, d.commandes, d.revenu])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Par jour")
  XLSX.writeFile(wb, "rapport-commandes-" + todayShort() + ".xlsx")
}

// ─── RESERVATIONS ─────────────────────────────────────────────

export function exportReservationsPDF(data: ReservationsData) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Reservations", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Reservations")
  let y = 30

  const rs = data.reservationsByStatus
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Total: " + rs.total, 14, y); y += 6
  doc.text("En attente: " + rs.pending, 14, y); y += 6
  doc.text("Confirmees: " + rs.confirmed, 14, y); y += 6
  doc.text("Annulees: " + rs.cancelled, 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Dernieres reservations", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Client", "Type", "Date", "Heure", "Statut"]],
    body: data.reservations.map((r) => [r.client, r.type, r.date, r.heure, STATUS_LBL[r.status] ?? r.status]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Reservations", "rapport-reservations-" + todayShort() + ".pdf")
}

export function exportReservationsExcel(data: ReservationsData) {
  const wb = XLSX.utils.book_new()
  const res: (string | number)[][] = [["Client", "Type", "Date", "Heure", "Statut"], ...data.reservations.map((r) => [r.client, r.type, r.date, r.heure, STATUS_LBL[r.status] ?? r.status])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(res), "Reservations")
  const daily: (string | number)[][] = [["Jour", "Reservations"], ...data.reservationsByDay.map((d) => [d.name, d.reservations])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Par jour")
  XLSX.writeFile(wb, "rapport-reservations-" + todayShort() + ".xlsx")
}

// ─── PRODUCTION ───────────────────────────────────────────────

export function exportProductionPDF(data: ProductionData) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Production", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Production")
  let y = 30

  const ps = data.productionSummary
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Total produit (30j): " + ps.totalProduced, 14, y); y += 6
  doc.text("Ordres: " + ps.productionCount, 14, y); y += 6
  doc.text("Entrees stock: " + ps.totalIn, 14, y); y += 6
  doc.text("Pertes: " + ps.totalLoss, 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Production / jour", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Jour", "Quantite produite"]],
    body: data.productionByDay.filter((d) => d.quantity > 0).map((d) => [d.name, String(d.quantity)]),
    styles: { fontSize: 9, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Mouvements production", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Date", "Produit", "Format", "Qte", "Raison"]],
    body: data.productionMovements.map((m) => [
      new Date(m.createdAt).toLocaleDateString("fr-FR"), m.productName, m.format, "+" + m.quantity, m.reason || "-",
    ]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Production", "rapport-production-" + todayShort() + ".pdf")
}

export function exportProductionExcel(data: ProductionData) {
  const wb = XLSX.utils.book_new()
  const ps = data.productionSummary
  const summary: (string | number)[][] = [["Indicateur", "Valeur"], ["Total produit", ps.totalProduced], ["Ordres", ps.productionCount], ["Entrees stock", ps.totalIn], ["Pertes", ps.totalLoss]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resume")
  const daily: (string | number)[][] = [["Jour", "Quantite"], ...data.productionByDay.map((d) => [d.name, d.quantity])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Par jour")
  const mvts: (string | number)[][] = [["Date", "Produit", "Format", "Qte", "Raison"], ...data.productionMovements.map((m) => [new Date(m.createdAt).toLocaleDateString("fr-FR"), m.productName, m.format, m.quantity, m.reason || ""])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mvts), "Mouvements")
  XLSX.writeFile(wb, "rapport-production-" + todayShort() + ".xlsx")
}

// ─── CAISSE ───────────────────────────────────────────────────

export function exportCaissePDF(data: CaisseData) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Caisse", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Caisse")
  let y = 30

  const cs = data.cashSessionsSummary
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Sessions: " + cs.totalSessions, 14, y); y += 6
  doc.text("Ouvertes: " + cs.openSessions, 14, y); y += 6
  doc.text("Fermees: " + cs.closedSessions, 14, y); y += 6
  doc.text("Solde total ouverture: " + fmt(cs.totalOpening), 14, y); y += 6
  doc.text("Solde total cloture: " + fmt(cs.totalClosing), 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Recapitulatif / jour", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Date", "Sessions", "Ouverture", "Cloture", "Ecart"]],
    body: data.cashSessionsByDay.map((d) => [
      d.name, String(d.sessions), fmt(d.openingTotal),
      d.closingTotal !== null ? fmt(d.closingTotal) : "-",
      d.gap !== null ? (d.gap > 0 ? "+" : "") + fmt(d.gap) : "-",
    ]),
    styles: { fontSize: 8, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })

  finalizePDF(doc, "Rapport Caisse", "rapport-caisse-" + todayShort() + ".pdf")
}

export function exportCaisseExcel(data: CaisseData) {
  const wb = XLSX.utils.book_new()
  const daily: (string | number | null)[][] = [["Date", "Sessions", "Ouverture", "Cloture", "Ecart"], ...data.cashSessionsByDay.map((d) => [d.name, d.sessions, d.openingTotal, d.closingTotal, d.gap])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), "Recapitulatif")
  XLSX.writeFile(wb, "rapport-caisse-" + todayShort() + ".xlsx")
}

// ─── LOTS ─────────────────────────────────────────────────────

export function exportLotsPDF(data: LotsData) {
  const doc = createDoc()
  addCoverPage(doc, "Rapport Lots", REPORT_VERSION)
  doc.addPage()
  addPageHeader(doc, "Rapport Lots")
  let y = 30

  const ls = data.lotSummary
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Resume", 14, y); y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  doc.text("Total lots: " + ls.totalLots, 14, y); y += 6
  doc.text("Lots actifs: " + ls.activeLots, 14, y); y += 6
  doc.text("Total produit: " + ls.totalProduced, 14, y); y += 6
  doc.text("Stock restant: " + ls.totalRemaining, 14, y); y += 12

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("Details des lots", 14, y); y += 2
  autoTable(doc, {
    startY: y,
    head: [["Numero", "Produit", "Format", "Produit (qte)", "Restant", "Statut", "Production", "Expiration"]],
    body: data.lots.map((l) => [
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

export function exportLotsExcel(data: LotsData) {
  const wb = XLSX.utils.book_new()
  const ls = data.lotSummary
  const summary: (string | number)[][] = [["Indicateur", "Valeur"], ["Total lots", ls.totalLots], ["Lots actifs", ls.activeLots], ["Total produit", ls.totalProduced], ["Stock restant", ls.totalRemaining]]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resume")
  const lots: (string | number)[][] = [["Numero", "Produit", "Format", "Produit (qte)", "Restant", "Statut", "Allocations", "Production", "Expiration"], ...data.lots.map((l) => [l.lotNumber, l.productName, l.format, l.initialQuantity, l.remainingQuantity, LOT_STATUS_LBL[l.status] ?? l.status, l.allocationCount, new Date(l.productionDate).toLocaleDateString("fr-FR"), l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("fr-FR") : ""])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lots), "Lots")
  XLSX.writeFile(wb, "rapport-lots-" + todayShort() + ".xlsx")
}

// ─── CLOTURE DE CAISSE (une session) ──────────────────────────

export interface ClotureReport {
  session: {
    id: string
    status: string
    openedAt: string
    closedAt: string | null
    openingBalance: number
    closingBalance: number | null
    reportGeneratedAt: string | null
    reportReference: string | null
  }
  pointOfSale: { id: string; name: string; code: string; address: string | null; city: string | null } | null
  seller: { id: string; name: string | null; email: string; role: string } | null
  reconciliation: {
    openingBalance: number
    revenue: number
    expected: number
    closingBalance: number | null
    gap: number | null
  }
  totals: { orders: number; items: number; products: number; movements: number }
  orders: {
    id: string
    orderNumber: string
    createdAt: string
    customerName: string | null
    paymentMethod: string | null
    paymentMethodLabel: string
    paymentStatus: string
    total: number
    items: number
  }[]
  soldByProduct: { variantId: string; productName: string; format: string | null; quantity: number; amount: number }[]
  paymentBreakdown: { method: string; count: number; amount: number }[]
  movements: {
    id: string
    createdAt: string
    type: string
    typeLabel: string
    productName: string
    format: string | null
    quantity: number
    reason: string | null
    reference: string | null
    lotId: string | null
  }[]
}

function sectionTitle(doc: jsPDF, y: number, title: string) {
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text(title, 14, y)
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.3)
  doc.line(14, y + 1.5, 196, y + 1.5)
  return y + 7
}

function kv(doc: jsPDF, y: number, label: string, value: string) {
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(90, 90, 90)
  doc.text(label, 14, y)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)
  doc.text(value, 62, y)
  return y + 5.5
}

export function exportClotureCaissePDF(data: ClotureReport) {
  const doc = createDoc()
  const title = "FICHE D'ARRÊTÉ DE CAISSE JOURNALIER"

  const header = (full: boolean) => {
    try {
      doc.addImage(LOGO_BADGE_BASE64, "PNG", 2, 4.5, 10, 10)
    } catch { /* skip */ }
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(31, 79, 163)
    doc.text("LCG  –  La Congolaise des Glaçons", 14, 13)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 60, 60)
    doc.text("Service commercial – Tél. 06 739 49 49 / 05 607 91 91", 14, 17.5)
    doc.text("97, rue Ewo, Ouenzé – Brazzaville, République du Congo  |  site web : www.lcg.cg  |  email : contact@lcg.cg", 14, 21.5)
    doc.setFontSize(7.5)
    doc.setTextColor(90, 90, 90)
    doc.text("SARL au capital de 1 000 000 FCFA  –  RCCM : CG-BZV-01-2025-B12-00-146  –  NIU : M250000007225623", 14, 25.5)
    doc.setDrawColor(31, 79, 163)
    doc.setLineWidth(0.5)
    doc.line(14, 27.5, 196, 27.5)
    if (full) {
      doc.setFontSize(15)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(40, 40, 40)
      doc.text(title, 105, 34.5, { align: "center" })
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(120, 120, 120)
      doc.text("À remplir par le caissier ou la caissière à la fin de chaque service", 105, 39.5, { align: "center" })
    }
  }

  addCoverPage(
    doc,
    title,
    REPORT_VERSION,
    [data.session.reportReference, new Date(data.session.openedAt).toLocaleDateString("fr-FR")].filter(Boolean).join("  |  "),
  )
  doc.addPage()
  header(true)
  let y = 46

  const spaceFor = (needed: number) => {
    const pageHeight = doc.internal.pageSize.height
    if (y + needed > pageHeight - 18) {
      doc.addPage()
      header(false)
      y = 46
    }
  }

  // ── Identification ──
  const opened = new Date(data.session.openedAt)
  const closed = data.session.closedAt ? new Date(data.session.closedAt) : null
  y = sectionTitle(doc, y, "Identification de la fiche")
  y = kv(doc, y, "Date", opened.toLocaleDateString("fr-FR"))
  y = kv(doc, y, "N° de caisse", data.session.reportReference ?? data.session.id)
  y = kv(doc, y, "Caissier(ère)", data.seller?.name ?? data.seller?.email ?? "-")
  y = kv(doc, y, "Point de vente", data.pointOfSale ? `${data.pointOfSale.name} (${data.pointOfSale.code})` : "-")
  y = kv(doc, y, "Heure d'ouverture", opened.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))
  y = kv(doc, y, "Heure de clôture", closed ? closed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Session encore ouverte")
  y += 6

  // ── 1. Ventes du jour ──
  spaceFor(40)
  y = sectionTitle(doc, y, "1. VENTES DU JOUR")
  if (data.soldByProduct.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text("Aucune vente enregistrée sur cette session.", 14, y)
    y += 8
  } else {
    autoTable(doc, {
      startY: y,
      pageBreak: "avoid",
      head: [["Produit", "Format", "Quantité", "Prix unitaire (FCFA)", "Montant (FCFA)"]],
      body: data.soldByProduct.map((row) => [
        row.productName,
        row.format ?? "-",
        String(row.quantity),
        fmt(row.quantity ? row.amount / row.quantity : 0),
        fmt(row.amount),
      ]),
      foot: [["Total", "", String(data.totals.items), "", fmt(data.soldByProduct.reduce((sum, row) => sum + row.amount, 0))]],
      styles: { fontSize: 8.5, textColor: [40, 40, 40] },
      headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
      footStyles: { fillColor: [235, 240, 250], fontStyle: "bold", textColor: [31, 79, 163] },
    })
    y = (doc as AutoTableDoc).lastAutoTable.finalY + 8
  }

  // ── 2. Encaissements par mode de paiement ──
  spaceFor(30)
  y = sectionTitle(doc, y, "2. ENCAISSEMENTS PAR MODE DE PAIEMENT")
  autoTable(doc, {
startY: y,
      pageBreak: "avoid",
      head: [["Mode de paiement", "Montant (FCFA)", "Références / observations"]],
    body: data.paymentBreakdown.length > 0
      ? data.paymentBreakdown.map((row) => [PAYMENT[row.method] ?? row.method, fmt(row.amount), ""])
      : [["-", "", ""]],
    foot: [["TOTAL ENCAISSÉ", fmt(data.paymentBreakdown.reduce((sum, row) => sum + row.amount, 0)), ""]],
    styles: { fontSize: 8.5, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
    footStyles: { fillColor: [235, 240, 250], fontStyle: "bold", textColor: [31, 79, 163] },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 8

  // ── 3. Sorties de caisse ──
  spaceFor(34)
  y = sectionTitle(doc, y, "3. SORTIES DE CAISSE (dépenses payées en espèces)")
  autoTable(doc, {
startY: y,
      pageBreak: "avoid",
      head: [["N°", "Motif de la dépense", "N° de justificatif", "Montant (FCFA)"]],
    body: [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""]],
    foot: [["", "", "TOTAL DES SORTIES", ""]],
    styles: { fontSize: 8.5, textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
    footStyles: { fillColor: [235, 240, 250], fontStyle: "bold", textColor: [31, 79, 163] },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 8

  // ── 4. Billetage ──
  spaceFor(56)
  y = sectionTitle(doc, y, "4. BILLETAGE (comptage des espèces)")
  autoTable(doc, {
    startY: y,
    pageBreak: "avoid",
    margin: { left: 14 },
    tableWidth: 90,
    head: [["Billets", "Nombre", "Montant (FCFA)"]],
    body: [["10 000", "", ""], ["5 000", "", ""], ["2 000", "", ""], ["1 000", "", ""], ["500", "", ""]],
    foot: [["Sous-total billets", "", ""]],
    styles: { fontSize: 8.5, textColor: [40, 40, 40], cellPadding: 1.4 },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
    footStyles: { fillColor: [235, 240, 250], fontStyle: "bold", textColor: [31, 79, 163] },
  })
  const billetsFinalY = (doc as AutoTableDoc).lastAutoTable.finalY
  autoTable(doc, {
    startY: y,
    pageBreak: "avoid",
    margin: { left: 112 },
    tableWidth: 84,
    head: [["Pièces", "Nombre", "Montant (FCFA)"]],
    body: [["500", "", ""], ["100", "", ""], ["50", "", ""], ["25", "", ""], ["10 et moins", "", ""]],
    foot: [["Sous-total pièces", "", ""]],
    styles: { fontSize: 8.5, textColor: [40, 40, 40], cellPadding: 1.4 },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
    footStyles: { fillColor: [235, 240, 250], fontStyle: "bold", textColor: [31, 79, 163] },
  })
  y = Math.max(billetsFinalY, (doc as AutoTableDoc).lastAutoTable.finalY) + 5
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40, 40, 40)
  doc.text("Total des espèces comptées : ........................................ FCFA", 14, y + 3)
  y += 10

  // ── 5. Rapprochement de caisse ──
  const cashAmount = data.paymentBreakdown.find((row) => row.method === "CASH_ON_DELIVERY")?.amount ?? 0
  spaceFor(52)
  y = sectionTitle(doc, y, "5. RAPPROCHEMENT DE CAISSE")
  autoTable(doc, {
    startY: y,
    pageBreak: "avoid",
    head: [["Calcul", "Montant (FCFA)"]],
    body: [
      ["A. Fonds de caisse à l'ouverture", fmt(data.reconciliation.openingBalance)],
      ["B. Encaissements en espèces (ligne « Espèces » du tableau 2)", fmt(cashAmount)],
      ["C. Sorties de caisse (total du tableau 3)", ""],
      ["D. Solde théorique (A + B - C)", ""],
      ["E. Espèces réellement comptées (billetage)", ""],
      ["F. Écart (E - D)   [ ] Excédent   /   [ ] Manquant", ""],
      ["G. Montant versé ou remis au responsable", ""],
      ["H. Fonds de caisse laissé pour le service suivant", ""],
    ],
    styles: { fontSize: 8.5, textColor: [40, 40, 40], cellPadding: 1.4 },
    headStyles: { fillColor: [31, 79, 163], fontStyle: "bold" },
  })
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 5

  // ── Observations ──
  spaceFor(30)
  y = sectionTitle(doc, y, "OBSERVATIONS")
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.rect(14, y, 182, 18)
  y += 26

  // ── Signatures ──
  spaceFor(30)
  const sig = (x: number, label: string) => {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(90, 90, 90)
    doc.text(label, x, y)
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.2)
    doc.line(x, y + 13, x + 54, y + 13)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text("Nom :", x, y + 21)
    doc.line(x + 12, y + 21, x + 54, y + 21)
  }
  sig(14, "Le caissier / la caissière")
  sig(74, "Le superviseur commercial")
  sig(134, "La Direction")
  y += 26

  finalizePDF(doc, title, `cloture-caisse-${(data.session.reportReference ?? todayShort()).replace(/[^\w-]/g, "")}.pdf`)
}
export function exportClotureCaisseExcel(data: ClotureReport) {
  const wb = XLSX.utils.book_new()

  const resume: (string | number | null)[][] = [
    ["Indicateur", "Valeur"],
    ["Reference rapport", data.session.reportReference ?? ""],
    ["Point de vente", data.pointOfSale?.name ?? ""],
    ["Code point de vente", data.pointOfSale?.code ?? ""],
    ["Vendeur", data.seller?.name ?? ""],
    ["Ouverture", data.session.openedAt],
    ["Cloture", data.session.closedAt ?? "Session ouverte"],
    ["Statut", data.session.status],
    ["Transactions", data.totals.orders],
    ["Articles vendus", data.totals.items],
    ["References produits", data.totals.products],
    ["Mouvements de stock", data.totals.movements],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resume), "Resume")

  const arrears: (string | number | null)[][] = [
    ["Fond de caisse", "Chiffre d'affaires", "Attendu", "Compte reel", "Ecart"],
    [
      data.reconciliation.openingBalance,
      data.reconciliation.revenue,
      data.reconciliation.expected,
      data.reconciliation.closingBalance,
      data.reconciliation.gap,
    ],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(arrears), "Arras")

  const ventes: (string | number)[][] = [
    ["Quantite vendue", "Montant", "Produit", "Format", "Variante"],
    ...data.soldByProduct.map((row) => [row.quantity, row.amount, row.productName, row.format ?? "", row.variantId]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ventes), "Quantites vendues")

  const transactions: (string | number)[][] = [
    ["Heure", "Piece", "Client", "Articles", "Paiement", "Statut", "Montant"],
    ...data.orders.map((order) => [
      order.createdAt, order.orderNumber, order.customerName ?? "", order.items,
      order.paymentMethodLabel, order.paymentStatus, order.total,
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(transactions), "Transactions")

  const mouvements: (string | number)[][] = [
    ["Heure", "Type", "Produit", "Format", "Quantite", "Reference", "Lot", "Motif"],
    ...data.movements.map((m) => [
      m.createdAt, m.typeLabel, m.productName, m.format ?? "", m.quantity, m.reference ?? "", m.lotId ?? "", m.reason ?? "",
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mouvements), "Mouvements")

  const paiements: (string | number)[][] = [
    ["Mode", "Transactions", "Montant"],
    ...data.paymentBreakdown.map((row) => [PAYMENT[row.method] ?? row.method, row.count, row.amount]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paiements), "Paiements")

  XLSX.writeFile(wb, `cloture-caisse-${(data.session.reportReference ?? todayShort()).replace(/[^\w-]/g, "")}.xlsx`)
}
