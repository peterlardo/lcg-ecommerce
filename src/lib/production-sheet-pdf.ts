import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { LOGO_BADGE_BASE64 } from "./logo-badge-base64"

export interface ProductionSheetLineView {
  productName: string
  productCode: string
  shift: string | null
  machine: string | null
  startTime: string | null
  endTime: string | null
  producedQty: number
  rejectedQty: number
  conformQty: number
  unit: string
  operator: string | null
  qualityStatus: string | null
  notes: string | null
}

export interface ProductionSheetView {
  date: string
  sheetNumber: string
  manager: string | null
  qualityControl: string | null
  shifts: string | null
  emptyPackaging: number | null
  waterM3: number | null
  electricityKwh: number | null
  generatorLiters: number | null
  outageMinutes: number | null
  machineDowntimeMinutes: number | null
  incidents: string | null
  lines: ProductionSheetLineView[]
}

export interface ProductionParamView {
  name: string
  code: string
  unit: string
  weightKg: number
  dailyObjective: number
}

const COMPANY_LINES = [
  "LA CONGOLAISE DES GLAÇONS – LCG",
  "SARL au capital de 1.000.000 FCFA — Siège : 97 Rue Ewo, Ouenzé, Brazzaville",
  "RCCM CG-BZV-01-2025-B12-00-146  |  NIU M250000007225623  |  Tél : 06 739 49 49 / 05 607 91 91",
]

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso))
}

function dayLabel(iso: string): string {
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(new Date(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function num(v: number | null | undefined, unit = ""): string {
  if (v == null) return "—"
  return `${v.toLocaleString("fr-FR")}${unit ? " " + unit : ""}`
}

function pct(part: number, total: number): string {
  if (!total) return "0 %"
  return `${Math.round((part / total) * 1000) / 10} %`
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text(title, 14, y)
  return y + 4
}

export function exportProductionSheetPDF(
  sheet: ProductionSheetView,
  params: ProductionParamView[],
  dayLabelText: string
) {
  const doc = new jsPDF("p", "mm", "a4")
  const w = 210
  doc.setProperties({ title: sheet.sheetNumber, author: "LCG", creator: "LCG - Fiche de production" })

  // ── En-tête LCG ──
  try {
    doc.addImage(LOGO_BADGE_BASE64, "PNG", 12, 8, 13, 13)
  } catch {
    /* logo optionnel */
  }
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text(COMPANY_LINES[0], 30, 14)
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(90, 90, 90)
  doc.text(COMPANY_LINES[1], 30, 18)
  doc.text(COMPANY_LINES[2], 30, 21.5)
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.5)
  doc.line(12, 24, w - 12, 24)

  // ── Titre + infos générales ──
  let y = 32
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(20, 20, 20)
  doc.text("FICHE DE PRODUCTION DU JOUR", w / 2, y, { align: "center" })
  y += 6

  const infoRows: [string, string][] = [
    ["N° fiche", sheet.sheetNumber],
    ["Date", `${fmtDate(sheet.date)} (${dayLabel(sheet.date)})`],
    ["Jour", dayLabelText || dayLabel(sheet.date)],
    ["Responsable production", sheet.manager ?? "—"],
    ["Contrôle qualité", sheet.qualityControl ?? "—"],
    ["Postes", sheet.shifts ?? "Matin / Après-midi / Nuit"],
  ]
  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: [200, 200, 200], textColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", fillColor: [240, 244, 250] } },
    margin: { left: 14, right: 14 },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── §1 Production par produit ──
  y = sectionTitle(doc, y, "1. Production par produit")
  y += 2

  const byProduct = new Map<
    string,
    { code: string; unit: string; lots: number; produced: number; rejected: number; conform: number; objective: number; weightKg: number }
  >()
  for (const line of sheet.lines) {
    const key = line.productName
    const param = params.find((p) => p.name === key || p.code === line.productCode)
    const entry = byProduct.get(key) ?? {
      code: line.productCode,
      unit: line.unit,
      lots: 0,
      produced: 0,
      rejected: 0,
      conform: 0,
      objective: param?.dailyObjective ?? 0,
      weightKg: param?.weightKg ?? 0,
    }
    entry.lots += 1
    entry.produced += line.producedQty
    entry.rejected += line.rejectedQty
    entry.conform += line.conformQty
    byProduct.set(key, entry)
  }

  const rows1 = Array.from(byProduct.entries()).map(([name, e], i) => [
    String(i + 1),
    name,
    String(e.lots),
    String(e.produced),
    String(e.rejected),
    String(e.conform),
    pct(e.rejected, e.produced),
    String(e.objective),
    e.objective ? pct(e.conform, e.objective) : "—",
    e.weightKg ? `${(e.conform * e.weightKg).toLocaleString("fr-FR")} kg` : "—",
  ])
  const totals1 = Array.from(byProduct.values()).reduce(
    (acc, e) => ({ lots: acc.lots + e.lots, produced: acc.produced + e.produced, rejected: acc.rejected + e.rejected, conform: acc.conform + e.conform }),
    { lots: 0, produced: 0, rejected: 0, conform: 0 }
  )
  rows1.push(["", "TOTAL JOURNÉE", String(totals1.lots), String(totals1.produced), String(totals1.rejected), String(totals1.conform), pct(totals1.rejected, totals1.produced), "", "", ""])

  autoTable(doc, {
    startY: y,
    head: [["N°", "Produit", "Nb lots", "Produit", "Rejeté", "Conforme", "Taux rejet", "Objectif", "Réalisé", "Poids conforme"]],
    body: rows1.length ? rows1 : [["", "Aucune production enregistrée", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [200, 200, 200], textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
      8: { halign: "center" },
      9: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === rows1.length - 1) data.cell.styles.fontStyle = "bold"
    },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── §2 Détail des lots ──
  if (y > 245) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, y, "2. Détail des lots de la journée")
  y += 2

  const perProductCount = new Map<string, number>()
  const dateKey = sheet.date.slice(0, 10).replace(/-/g, "").slice(2) // AAMMJJ
  const rows2 = sheet.lines.map((l, i) => {
    const n = (perProductCount.get(l.productCode) ?? 0) + 1
    perProductCount.set(l.productCode, n)
    const lotNo = l.productCode ? `L-${dateKey}-${l.productCode}-${String(n).padStart(2, "0")}` : "—"
    return [
      String(i + 1),
      lotNo,
      l.productName,
      l.shift ?? "—",
      l.startTime ?? "—",
      l.endTime ?? "—",
      l.machine ?? "—",
      String(l.producedQty),
      String(l.rejectedQty),
      String(l.conformQty),
      l.qualityStatus ?? "—",
    ]
  })
  autoTable(doc, {
    startY: y,
    head: [["N°", "N° lot", "Produit", "Poste", "Début", "Fin", "Ligne", "Produit", "Rejeté", "Conforme", "Contrôle qual."]],
    body: rows2.length ? rows2 : [["", "—", "Aucun lot", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [200, 200, 200], textColor: [40, 40, 40] },
    headStyles: { fillColor: [31, 79, 163], textColor: 255, fontSize: 6.5 },
    margin: { left: 14, right: 14 },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── §3 Consommations et arrêts ──
  if (y > 235) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, y, "3. Consommations et arrêts")
  y += 2

  const consRows: [string, string][] = [
    ["Sachets / sacs vides utilisés", num(sheet.emptyPackaging)],
    ["Eau (m³)", num(sheet.waterM3)],
    ["Électricité (kWh compteur)", num(sheet.electricityKwh)],
    ["Gasoil groupe (litres)", num(sheet.generatorLiters)],
    ["Durée coupures courant (min)", num(sheet.outageMinutes)],
    ["Durée pannes machines (min)", num(sheet.machineDowntimeMinutes)],
  ]
  autoTable(doc, {
    startY: y,
    body: consRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: [200, 200, 200], textColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: [240, 244, 250] } },
    margin: { left: 14, right: 14 },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7

  // ── §4 Incidents ──
  if (y > 215) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, y, "4. Incidents, lots non conformes et mesures")
  y += 2
  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)
  const incidents = sheet.incidents || "Aucun incident signalé."
  const lines = doc.splitTextToSize(incidents, w - 28)
  doc.setDrawColor(200, 200, 200)
  doc.rect(14, y - 4, w - 28, Math.max(18, lines.length * 4.5 + 6))
  doc.text(lines, 17, y)
  y += Math.max(18, lines.length * 4.5 + 6) + 8

  // ── Signatures ──
  if (y > 230) {
    doc.addPage()
    y = 20
  }
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(20, 20, 20)
  doc.text("Signatures", 14, y)
  y += 4
  const signers = ["Chef de production", "Contrôleur qualité", "Magasinier chambre froide", "Visa DG"]
  const colW = (w - 28) / 4
  doc.setDrawColor(120, 120, 120)
  doc.setLineWidth(0.3)
  signers.forEach((label, i) => {
    const x = 14 + i * colW
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(60, 60, 60)
    doc.text(label, x + 2, y + 4)
    doc.rect(x, y + 6, colW - 2, 22)
  })
  y += 34

  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(120, 120, 120)
  doc.text(
    "À classer avec les bons d'entrée chambre froide — les quantités conformes constituent les entrées de la fiche de stock.",
    w / 2,
    y,
    { align: "center" }
  )

  doc.save(`fiche-production-${sheet.sheetNumber}.pdf`)
}
