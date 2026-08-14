import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { prisma } from "../src/lib/prisma"
import { readFileSync } from "fs"
import { join } from "path"

const LOGO_BASE64 = readFileSync(join(process.cwd(), "src", "lib", "logo-base64.ts"), "utf-8").match(/LOGO_BASE64 = "(.+)"/)?.[1] ?? ""

const COMPANY = {
  name: "LCG - La Congolaise des Glacons",
  address: "15 Avenue de la Republique, Brazzaville, Congo",
  phone: "+242 06 739 49 49 / +242 05 607 91 91",
  email: "contact@lcg.cg",
  website: "https://lcg.cg",
}

const REPORT_VERSION = "1.0"
const CURRENT_YEAR = new Date().getFullYear()

function addCoverPage(doc: jsPDF, reportTitle: string) {
  const w = 210, h = 297
  doc.setFillColor(15, 25, 55)
  doc.rect(0, 0, w, h, "F")
  doc.setFillColor(31, 79, 163)
  doc.rect(0, 0, 8, h, "F")
  doc.setFillColor(31, 79, 163)
  doc.triangle(0, 180, 120, 140, 0, 100, "F")
  doc.setFillColor(25, 60, 130)
  doc.triangle(0, 220, 160, 180, 0, 140, "F")
  try { doc.addImage(LOGO_BASE64, "PNG", 80, 25, 50, 50) } catch {}
  doc.setTextColor(180, 200, 240)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(COMPANY.name.toUpperCase(), w / 2, 85, { align: "center" })
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.8)
  doc.line(40, 92, w - 40, 92)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(32)
  doc.setFont("helvetica", "bold")
  doc.text(reportTitle, w / 2, 118, { align: "center" })
  doc.setFillColor(31, 79, 163)
  const lineW = Math.min(120, doc.getTextWidth(reportTitle) + 20)
  doc.roundedRect((w - lineW) / 2, 126, lineW, 3, 1.5, 1.5, "F")
  doc.setTextColor(160, 180, 220)
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text("Version " + REPORT_VERSION + "  |  " + new Date().toLocaleDateString("fr-FR"), w / 2, 146, { align: "center" })
  const by = h - 70
  doc.setFillColor(20, 35, 70)
  doc.roundedRect(30, by, w - 60, 55, 4, 4, "F")
  doc.setTextColor(100, 140, 220)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("EDITEUR DU RAPPORT", 50, by + 12)
  doc.setTextColor(220, 230, 250)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(COMPANY.name, 50, by + 20)
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

function addPageHeader(doc: jsPDF, reportTitle: string) {
  try { doc.addImage(LOGO_BASE64, "PNG", 10, 5, 11, 11) } catch {}
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text(COMPANY.name.toUpperCase(), 32, 11)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120, 120, 120)
  doc.text(reportTitle, 200, 11, { align: "right" })
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.4)
  doc.line(10, 21, 200, 21)
}

function addPageFooter(doc: jsPDF, reportTitle: string, pageNum: number, totalPages: number) {
  const footerY = 297 - 12
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(10, footerY - 4, 200, footerY - 4)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(140, 140, 140)
  doc.text(COMPANY.name, 10, footerY)
  doc.text(reportTitle + "  |  Annee " + CURRENT_YEAR + "  |  Version " + REPORT_VERSION, 105, footerY, { align: "center" })
  doc.text("Page " + pageNum + " / " + totalPages, 200, footerY, { align: "right" })
}

const REPORT_TITLE = "Document de Traçabilité des Lots"

async function main() {
  const doc = new jsPDF("p", "mm", "a4")
  const margin = 14
  const pageWidth = 210

  // Cover page
  addCoverPage(doc, REPORT_TITLE)

  // First content page
  doc.addPage()
  addPageHeader(doc, REPORT_TITLE)
  let y = 30

  // ─── SECTION 1: RESUME EXECUTIF ───────────────────────────
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("1. Résumé Exécutif", margin, y)
  y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)
  const summary = [
    "Ce document décrit le fonctionnement complet du système de traçabilité des lots",
    "de production chez LCG - La Congolaise des Glacons.",
    "",
    "Le système permet de :",
    "  - Suivre chaque lot de production du fabricant au client",
    "  - Allouer le stock selon la methode FIFO (First In, First Out)",
    "  - Tracer chaque mouvement de stock lié à un lot",
    "  - Générer des rapports de traçabilité par lot",
    "  - Gerer les dates d'expiration des lots",
  ]
  for (const line of summary) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 4

  // ─── SECTION 2: ARCHITECTURE BASE DE DONNEES ──────────────
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("2. Architecture Base de Données", margin, y)
  y += 8

  // ProductionLot
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40, 40, 40)
  doc.text("2.1 ProductionLot (Lots de production)", margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Champ", "Type", "Description"]],
    body: [
      ["id", "String (CUID)", "Identifiant unique du lot"],
      ["lotNumber", "String (unique)", "Numero format LOT-YYYYMMDD-XXX"],
      ["variantId", "String (FK)", "Reference vers ProductVariant"],
      ["initialQuantity", "Int", "Quantite produite au depart"],
      ["remainingQuantity", "Int", "Quantite restante non consommee"],
      ["productionDate", "DateTime", "Date de production du lot"],
      ["expiryDate", "DateTime?", "Date d'expiration (optionnel)"],
      ["status", "String", "ACTIVE | EXHAUSTED | EXPIRED"],
      ["notes", "String?", "Notes libres sur le lot"],
      ["createdById", "String (FK)?", "Utilisateur ayant cree le lot"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 } },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // LotAllocation
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40, 40, 40)
  doc.text("2.2 LotAllocation (Allocations de stock par lot)", margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Champ", "Type", "Description"]],
    body: [
      ["id", "String (CUID)", "Identifiant unique de l'allocation"],
      ["lotId", "String (FK)", "Reference vers le lot concerne"],
      ["quantity", "Int", "Quantite allouee (retiree du lot)"],
      ["type", "String", "SALE | TRANSFER | LOSS | ADJUSTMENT | PRODUCTION"],
      ["reference", "String?", "Numero de commande ou reference externe"],
      ["createdAt", "DateTime", "Date et heure de l'allocation"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 } },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // StockMovement
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40, 40, 40)
  doc.text("2.3 StockMovement (Mouvements de stock)", margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Champ", "Type", "Description"]],
    body: [
      ["id", "String (CUID)", "Identifiant unique du mouvement"],
      ["variantId", "String (FK)", "Variante de produit concernee"],
      ["type", "String", "IN | SALE | PRODUCTION | TRANSFER_IN | LOSS"],
      ["quantity", "Int", "Quantite du mouvement"],
      ["reason", "String?", "Motif du mouvement"],
      ["reference", "String?", "Reference externe"],
      ["lotId", "String (FK)?", "Lot rattache au mouvement (optionnel)"],
      ["pointOfSaleId", "String (FK)?", "Point de vente concerne"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 } },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // OrderItem
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40, 40, 40)
  doc.text("2.4 OrderItem (Lignes de commande avec lot)", margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Champ", "Type", "Description"]],
    body: [
      ["lotId", "String (FK)?", "Lot consomme pour cette ligne de commande"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 } },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // Check page break
  if (y > 250) {
    doc.addPage()
    y = 20
  }

  // ─── SECTION 3: ALLOCATION FIFO ───────────────────────────
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("3. Allocation FIFO (First In, First Out)", margin, y)
  y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)

  const fifoText = [
    "L'allocation FIFO est le mécanisme central du système. À chaque vente,",
    "le système retire automatiquement le stock du lot le plus ancien en premier.",
    "",
    "Algorithme :",
    "  1. Recuperer tous les lots ACTIVE pour la variante, tries par date",
    "     de production croissante (plus ancien en premier)",
    "  2. Pour chaque lot, prélever la quantité nécessaire :",
    "     take = min(lot.restant, quantite_restante)",
    "  3. Decremente remainingQuantity du lot",
    "  4. Si remainingQuantity = 0, passe le statut a EXHAUSTED",
    "  5. Cree un enregistrement LotAllocation (type=SALE, ref=n commande)",
    "  6. Si stock insuffisant → erreur",
  ]
  for (const line of fifoText) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 4

  // ─── SECTION 4: FLUX DE DONNEES ───────────────────────────
  if (y > 220) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("4. Flux de Données Complet", margin, y)
  y += 8

  // Flow diagram as table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Etape", "Action", "Tables concernees"]],
    body: [
      ["1. Production", "Creer un lot (POST /api/lots)", "ProductionLot + StockMovement"],
      ["2. Stock", "Ajouter quantité au ProductVariant", "ProductVariant"],
      ["3. Vente", "Passer une commande", "Order + OrderItem"],
      ["4. Allocation", "Retirer stock du lot (FIFO)", "ProductionLot + LotAllocation"],
      ["5. Statut", "Marquer lot EPUISE si reste=0", "ProductionLot"],
      ["6. Traçabilité", "Consulter l'historique d'un lot", "LotAllocation + StockMovement"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" }, 1: { cellWidth: 70 } },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ─── SECTION 5: ENDPOINTS API ─────────────────────────────
  if (y > 200) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("5. Endpoints API", margin, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Methode", "URL", "Description"]],
    body: [
      ["GET", "/api/lots", "Lister tous les lots avec resume"],
      ["POST", "/api/lots", "Creer un nouveau lot de production"],
      ["GET", "/api/lots/[id]", "Détail complet d'un lot"],
      ["PATCH", "/api/lots/[id]", "Modifier expiration/notes d'un lot"],
      ["DELETE", "/api/lots/[id]", "Supprimer un lot (retire le stock)"],
      ["GET", "/api/lots/trace", "Traçabilité complète d'un lot"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 18, fontStyle: "bold" }, 1: { cellWidth: 50 } },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ─── SECTION 6: STATUTS DES LOTS ──────────────────────────
  if (y > 220) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("6. Cycle de Vie d'un Lot", margin, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Statut", "Description", "Transition automatique"]],
    body: [
      ["ACTIVE", "Lot en cours d'utilisation, stock disponible", "Defaut a la creation"],
      ["EXHAUSTED", "Tout le stock a ete consomme", "remainingQuantity = 0"],
      ["EXPIRED", "Date d'expiration depassee", "A definir (cron manuel)"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ─── SECTION 7: TYPES D'ALLOCATION ────────────────────────
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("7. Types d'Allocation", margin, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Type", "Description", "Quand"]],
    body: [
      ["SALE", "Consommation lors d'une vente", "À chaque commande validée"],
      ["TRANSFER", "Transfert entre points de vente", "Mouvement de stock interne"],
      ["LOSS", "Perte ou casse declaree", "Inventaire / controle qualite"],
      ["ADJUSTMENT", "Ajustement manuel de stock", "Correction d'inventaire"],
      ["PRODUCTION", "Allocation interne a la production", "Creation de lot"],
    ],
    theme: "striped",
    headStyles: { fillColor: [31, 79, 163], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ─── SECTION 8: DONNEES EN DIRECT ─────────────────────────
  if (y > 200) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("8. État Actuel des Lots en Base", margin, y)
  y += 8

  try {
    const lots = await prisma.productionLot.findMany({
      include: {
        variant: { include: { product: true } },
        _count: { select: { allocations: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const totalProduced = lots.reduce((s, l) => s + l.initialQuantity, 0)
    const totalRemaining = lots.reduce((s, l) => s + l.remainingQuantity, 0)
    const activeLots = lots.filter((l) => l.status === "ACTIVE").length
    const exhaustedLots = lots.filter((l) => l.status === "EXHAUSTED").length

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 60, 60)
    doc.text(`Total lots : ${lots.length}  |  Actifs : ${activeLots}  |  Epuises : ${exhaustedLots}`, margin, y)
    y += 5
    doc.text(`Total produit : ${totalProduced}  |  Restant : ${totalRemaining}  |  Consomme : ${totalProduced - totalRemaining}`, margin, y)
    y += 8

    if (lots.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Lot", "Produit", "Format", "Initiale", "Restante", "Statut", "Allocations"]],
        body: lots.map((l) => [
          l.lotNumber,
          l.variant.product.name,
          l.variant.format,
          String(l.initialQuantity),
          String(l.remainingQuantity),
          l.status,
          String(l._count.allocations),
        ]),
        theme: "striped",
        headStyles: { fillColor: [31, 79, 163], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 32 },
          3: { halign: "right" },
          4: { halign: "right" },
          6: { halign: "right" },
        },
      })
      y = (doc as any).lastAutoTable.finalY + 8
    } else {
      doc.text("Aucun lot en base de données.", margin, y)
      y += 8
    }
  } catch (err) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(150, 150, 150)
    doc.text("Impossible de récupérer les données en base (mode hors-ligne).", margin, y)
    y += 8
  }

  // ─── SECTION 9: DIAGRAMME DE FLUX ─────────────────────────
  if (y > 210) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("9. Diagramme de Flux (FIFO)", margin, y)
  y += 10

  // Draw a simple flow diagram
  const boxW = 55
  const boxH = 14
  const gap = 12
  const centerX = pageWidth / 2

  // Box 1: Production
  const x1 = margin
  doc.setFillColor(220, 252, 231)
  doc.setDrawColor(34, 197, 94)
  doc.roundedRect(x1, y, boxW, boxH, 3, 3, "FD")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(22, 101, 52)
  doc.text("PRODUCTION", x1 + boxW / 2, y + 6, { align: "center" })
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Créer lot + stock", x1 + boxW / 2, y + 11, { align: "center" })

  // Arrow 1
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.5)
  doc.line(x1 + boxW + 2, y + boxH / 2, x1 + boxW + gap - 2, y + boxH / 2)
  doc.line(x1 + boxW + gap - 4, y + boxH / 2 - 2, x1 + boxW + gap - 2, y + boxH / 2)
  doc.line(x1 + boxW + gap - 4, y + boxH / 2 + 2, x1 + boxW + gap - 2, y + boxH / 2)

  // Box 2: Stock
  const x2 = x1 + boxW + gap
  doc.setFillColor(219, 234, 254)
  doc.setDrawColor(59, 130, 246)
  doc.roundedRect(x2, y, boxW, boxH, 3, 3, "FD")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 64, 175)
  doc.text("STOCK", x2 + boxW / 2, y + 6, { align: "center" })
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Quantité par lot", x2 + boxW / 2, y + 11, { align: "center" })

  // Arrow 2
  doc.setDrawColor(150, 150, 150)
  doc.line(x2 + boxW + 2, y + boxH / 2, x2 + boxW + gap - 2, y + boxH / 2)
  doc.line(x2 + boxW + gap - 4, y + boxH / 2 - 2, x2 + boxW + gap - 2, y + boxH / 2)
  doc.line(x2 + boxW + gap - 4, y + boxH / 2 + 2, x2 + boxW + gap - 2, y + boxH / 2)

  // Box 3: Vente
  const x3 = x2 + boxW + gap
  doc.setFillColor(254, 243, 199)
  doc.setDrawColor(234, 179, 8)
  doc.roundedRect(x3, y, boxW, boxH, 3, 3, "FD")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(146, 64, 14)
  doc.text("VENTE", x3 + boxW / 2, y + 6, { align: "center" })
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Allocation FIFO", x3 + boxW / 2, y + 11, { align: "center" })

  y += boxH + 15

  // Box 4: Traçabilité (centered)
  const x4 = (pageWidth - boxW * 1.3) / 2
  doc.setFillColor(243, 232, 255)
  doc.setDrawColor(139, 92, 246)
  doc.roundedRect(x4, y, boxW * 1.3, boxH, 3, 3, "FD")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(91, 33, 182)
  doc.text("TRACABILITÉ", x4 + (boxW * 1.3) / 2, y + 6, { align: "center" })
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Historique complet par lot", x4 + (boxW * 1.3) / 2, y + 11, { align: "center" })

  // Arrow from Vente down to Traçabilité
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.5)
  const arrowStartX = x3 + boxW / 2
  doc.line(arrowStartX, y - 15 + boxH + 2, arrowStartX, y - 2)
  doc.line(arrowStartX, y - 2, x4 + (boxW * 1.3) / 2, y - 2)
  doc.line(x4 + (boxW * 1.3) / 2, y - 2, x4 + (boxW * 1.3) / 2, y)

  y += boxH + 15

  // ─── SECTION 10: NOTES TECHNIQUES ─────────────────────────
  if (y > 240) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text("10. Notes Techniques", margin, y)
  y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 60, 60)

  const techNotes = [
    "Stack : Next.js 16 + Prisma 7 + PostgreSQL",
    "Authentification : NextAuth.js (session-based)",
    "Cote client : React, Tailwind CSS v4",
    "Export PDF : jsPDF + jspdf-autotable",
    "Export Excel : xlsx (SheetJS)",
    "",
    "Points importants :",
    "  - L'allocation FIFO s'effectue dans une transaction Prisma",
    "  - Le lot EPUISE ne peut plus etre utilise pour de nouvelles allocations",
    "  - La traçabilité est accessible aux rôles ADMIN et STOCK_MANAGER",
    "  - Le numero de lot est unique et auto-genere (LOT-YYYYMMDD-XXX)",
    "  - La suppression d'un lot retire automatiquement le stock restant",
  ]
  for (const line of techNotes) {
    doc.text(line, margin, y)
    y += 5
  }

  // ─── FOOTER (all content pages) ─────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    addPageFooter(doc, REPORT_TITLE, i - 1, totalPages - 1)
  }

  // Save
  const outputPath = "C:\\Users\\HP\\Desktop\\Designlabs\\lcg-website\\LCG-Traabilite-Lots.pdf"
  doc.save(outputPath)
  console.log(`PDF genere : ${outputPath}`)
}

main().catch((err) => {
  console.error("Erreur :", err)
  process.exit(1)
})
