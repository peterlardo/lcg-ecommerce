import jsPDF from "jspdf"
import { LOGO_BASE64 } from "./logo-base64"

const COMPANY = {
  name: "LCG - La Congolaise des Glac\u00e7ons",
  address: "15 Avenue de la R\u00e9publique, Brazzaville, Congo",
  phone: "+242 05 123 45 67",
  email: "contact@lcg.cg",
}

function addCoverPage(doc: jsPDF) {
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
  doc.setFontSize(28)
  doc.setFont("helvetica", "bold")
  doc.text("Documentation Technique", w / 2, 115, { align: "center" })
  doc.setFontSize(16)
  doc.setFont("helvetica", "normal")
  doc.text("Module Lot, Production et Tra\u00e7abilit\u00e9", w / 2, 135, { align: "center" })
  doc.setFillColor(31, 79, 163)
  doc.roundedRect((w - 120) / 2, 142, 120, 3, 1.5, 1.5, "F")
  doc.setTextColor(160, 180, 220)
  doc.setFontSize(12)
  doc.text("Version 1.0  |  " + new Date().toLocaleDateString("fr-FR"), w / 2, 160, { align: "center" })
  const by = h - 70
  doc.setFillColor(20, 35, 70)
  doc.roundedRect(30, by, w - 60, 55, 4, 4, "F")
  doc.setTextColor(100, 140, 220)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("EDITEUR", 50, by + 12)
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
  doc.text(`${COMPANY.address}  |  ${COMPANY.phone}  |  ${COMPANY.email}`, 50, by + 40)
}

function addPageHeader(doc: jsPDF, title: string, pageNum: number) {
  const w = 210
  try { doc.addImage(LOGO_BASE64, "PNG", 10, 8, 10, 10) } catch {}
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.setFont("helvetica", "normal")
  doc.text(COMPANY.name, 24, 12)
  doc.setFontSize(7)
  doc.text("Documentation technique - Lot, Production, Tra\u00e7abilit\u00e9", 24, 16)
  doc.setDrawColor(31, 79, 163)
  doc.setLineWidth(0.3)
  doc.line(10, 21, w - 10, 21)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 79, 163)
  doc.text(title, 10, 29)
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.setFont("helvetica", "normal")
  doc.text(`Page ${pageNum}`, w - 10, 297 - 8, { align: "right" })
  doc.setDrawColor(200, 200, 200)
  doc.line(10, 297 - 12, w - 10, 297 - 12)
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFillColor(31, 79, 163)
  doc.roundedRect(10, y - 4, 190, 8, 1, 1, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(text, 14, y + 1.5)
  return y + 12
}

function bodyText(doc: jsPDF, y: number, text: string, indent = 14): number {
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const lines = doc.splitTextToSize(text, 170)
  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 38 }
    doc.text(line, indent, y)
    y += 5
  }
  return y + 2
}

function bulletPoint(doc: jsPDF, y: number, text: string): number {
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("\u2022", 16, y)
  const lines = doc.splitTextToSize(text, 162)
  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 38 }
    doc.text(line, 20, y)
    y += 5
  }
  return y + 1
}

function fieldTable(doc: jsPDF, y: number, fields: [string, string, string][]): number {
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setFillColor(240, 243, 250)
  doc.rect(14, y - 4, 182, 7, "F")
  doc.setTextColor(50, 50, 50)
  doc.text("Champ", 16, y)
  doc.text("Type", 80, y)
  doc.text("Description", 110, y)
  y += 7
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  for (const [field, type, desc] of fields) {
    if (y > 275) { doc.addPage(); y = 38 }
    doc.setDrawColor(230, 230, 230)
    doc.line(14, y - 1, 196, y - 1)
    doc.setTextColor(50, 50, 50)
    doc.text(field, 16, y + 3)
    doc.setTextColor(100, 100, 100)
    doc.text(type, 80, y + 3)
    doc.setTextColor(50, 50, 50)
    const descLines = doc.splitTextToSize(desc, 82)
    doc.text(descLines[0], 110, y + 3)
    y += Math.max(6, descLines.length * 4 + 2)
  }
  return y + 4
}

function flowStep(doc: jsPDF, y: number, num: number, title: string, desc: string): number {
  if (y > 260) { doc.addPage(); y = 38 }
  doc.setFillColor(31, 79, 163)
  doc.circle(20, y, 4, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text(String(num), 20, y + 1.2, { align: "center" })
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(title, 28, y + 1.2)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  const lines = doc.splitTextToSize(desc, 158)
  let ly = y + 6
  for (const line of lines) {
    if (ly > 275) { doc.addPage(); ly = 38 }
    doc.text(line, 28, ly)
    ly += 4
  }
  return ly + 3
}

export function generateLotDocumentationPDF(): jsPDF {
  const doc = new jsPDF("p", "mm", "a4")
  doc.setProperties({ title: "Documentation Lot, Production, Tra\u00e7abilit\u00e9", author: COMPANY.name, creator: COMPANY.name })

  // ── COVER ──
  addCoverPage(doc)

  // ── PAGE 2: TABLE DES MATI\u00c8RES ──
  doc.addPage()
  addPageHeader(doc, "Table des mati\u00e8res", 2)
  let y = 38
  const toc: [string, number][] = [
    ["1. Vue d'ensemble du syst\u00e8me", 3],
    ["2. Mod\u00e8les de donn\u00e9es", 3],
    ["3. Cr\u00e9ation de lot (Production)", 4],
    ["4. Allocation FIFO / FEFO", 5],
    ["5. Int\u00e9gration avec les commandes", 6],
    ["6. Syst\u00e8me de tra\u00e7abilit\u00e9", 7],
    ["7. R\u00e8gles m\u00e9tier", 8],
  ]
  for (const [title, page] of toc) {
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(50, 50, 50)
    doc.text(title, 20, y)
    doc.text(String(page), 190, y, { align: "right" })
    doc.setDrawColor(200, 200, 200)
    doc.line(22, y + 2, 185, y + 2)
    y += 9
  }

  // ── PAGE 3: VUE D'ENSEMBLE ──
  doc.addPage()
  addPageHeader(doc, "1. Vue d'ensemble du syst\u00e8me", 3)
  y = 38
  y = bodyText(doc, y, "Le module Lot, Production et Tra\u00e7abilit\u00e9 de LCG permet de suivre le cycle de vie complet de chaque batch de gla\u00e7ons, de sa cr\u00e9ation en usine jusqu'\u00e0 sa vente finale. Le syst\u00e8me garantit la tra\u00e7abilit\u00e9 totale gr\u00e2ce \u00e0 l'allocation FIFO (First In, First Out) et l'enregistrement de chaque mouvement de stock.")
  y = bodyText(doc, y, "Composants principaux :")
  y = bulletPoint(doc, y, "ProductionLot : Repr\u00e9sente un batch de production (num\u00e9ro unique, quantit\u00e9, date de production, date d'expiration)")
  y = bulletPoint(doc, y, "LotAllocation : Enregistre chaque retrait d'un lot (vente, transfert, perte, ajustement)")
  y = bulletPoint(doc, y, "StockMovement : Journal de tous les mouvements de stock avec lien optionnel au lot")
  y = bulletPoint(doc, y, "OrderItem.lotId : Lien entre chaque article de commande et le lot FIFO qui l'a fulfillment")

  y = sectionTitle(doc, y, "Architecture technique")
  y = flowStep(doc, y, 1, "Cr\u00e9ation du lot", "L'op\u00e9rateur saisit la variante, la quantit\u00e9 et optionnellement la date d'expiration. Le g\u00e9n\u00e9rateur cr\u00e9e un num\u00e9ro unique LOT-YYYYMMDD-NNN.")
  y = flowStep(doc, y, 2, "Mise \u00e0 jour du stock", "Dans une transaction atomique : cr\u00e9ation du ProductionLot + incr\u00e9mentation du stock variante + cr\u00e9ation d'un StockMovement type PRODUCTION.")
  y = flowStep(doc, y, 3, "Allocation lors d'une vente", "Lors d'une commande, l'algorithme FIFO s\u00e9lectionne les plus anciens lots actifs, cr\u00e9e des LotAllocation et met \u00e0 jour remainingQuantity.")
  y = flowStep(doc, y, 4, "Tra\u00e7abilit\u00e9", "Chaque lot est consultable via l'onglet Tra\u00e7abilit\u00e9 : historique des allocations, mouvements de stock, et liens avec les commandes clients.")

  // ── PAGE 4: MOD\u00c8LES DE DONN\u00c9ES ──
  doc.addPage()
  addPageHeader(doc, "2. Mod\u00e8les de donn\u00e9es", 4)
  y = 38
  y = sectionTitle(doc, y, "ProductionLot")
  y = fieldTable(doc, y, [
    ["id", "String (CUID)", "Identifiant unique"],
    ["lotNumber", "String (unique)", "Num\u00e9ro format LOT-YYYYMMDD-NNN"],
    ["variantId", "String (FK)", "Variante de produit associ\u00e9e"],
    ["initialQuantity", "Int", "Quantit\u00e9 produite \u00e0 la cr\u00e9ation"],
    ["remainingQuantity", "Int", "Quantit\u00e9 restante (d\u00e9cr\u00e9ment\u00e9e lors des allocations)"],
    ["productionDate", "DateTime", "Date de production"],
    ["expiryDate", "DateTime?", "Date d'expiration optionnelle (pour FEFO)"],
    ["status", "Enum", "ACTIVE | EXHAUSTED | EXPIRED"],
    ["notes", "String?", "Notes de production"],
    ["createdById", "String? (FK)", "Utilisateur ayant cr\u00e9\u00e9 le lot"],
  ])

  y = sectionTitle(doc, y, "LotAllocation")
  y = fieldTable(doc, y, [
    ["id", "String (CUID)", "Identifiant unique"],
    ["lotId", "String (FK)", "Lot d'origine (cascade delete)"],
    ["quantity", "Int", "Nombre d'unit\u00e9es retir\u00e9es"],
    ["type", "Enum", "SALE | TRANSFER | LOSS | ADJUSTMENT"],
    ["reference", "String?", "Num\u00e9ro de commande (pour SALE)"],
    ["createdAt", "DateTime", "Horodatage de l'allocation"],
  ])

  y = sectionTitle(doc, y, "StockMovement")
  y = fieldTable(doc, y, [
    ["id", "String (CUID)", "Identifiant unique"],
    ["variantId", "String (FK)", "Variante de produit"],
    ["type", "String", "IN, OUT, PRODUCTION, SALE, LOSS, TRANSFER_IN/OUT, etc."],
    ["quantity", "Int", "Quantit\u00e9 absolue"],
    ["lotId", "String? (FK)", "Lot li\u00e9 (uniquement pour PRODUCTION)"],
    ["pointOfSaleId", "String? (FK)", "Point de vente concern\u00e9"],
    ["reference", "String?", "Num\u00e9ro de lot ou commande"],
  ])

  // ── PAGE 5: CR\u00c9ATION DE LOT ──
  doc.addPage()
  addPageHeader(doc, "3. Cr\u00e9ation de lot (Production)", 5)
  y = 38
  y = bodyText(doc, y, "La cr\u00e9ation de lot se fait via l'interface d'administration Production (/admin/production). Seuls les utilisateurs avec le r\u00f4le ADMIN ou STOCK_MANAGER peuvent cr\u00e9er des lots.")
  y = bodyText(doc, y, "Formulaire de cr\u00e9ation :")
  y = bulletPoint(doc, y, "Variante de produit : S\u00e9lection parmi les variantes disponibles (Gla\u00e7on Creux 1kg/2kg/5kg, Cubes, Pil\u00e9, Plein)")
  y = bulletPoint(doc, y, "Quantit\u00e9 : Nombre d'unit\u00e9es produites (entier positif)")
  y = bulletPoint(doc, y, "Date d'expiration : Optionnelle, utilis\u00e9e pour l'allocation FEFO")
  y = bulletPoint(doc, y, "Note : Texte libre de production")

  y = sectionTitle(doc, y, "Num\u00e9rotation automatique")
  y = bodyText(doc, y, "Le num\u00e9ro de lot suit le format LOT-YYYYMMDD-NNN o\u00f9 NNN est un s\u00e9quenceur quotidien remis \u00e0 z\u00e9ro chaque jour. Exemple : LOT-20260811-001, LOT-20260811-002, etc.")

  y = sectionTitle(doc, y, "Transaction atomique")
  y = bodyText(doc, y, "La cr\u00e9ation s'effectue dans une transaction prisma.$transaction() garantissant l'int\u00e9grit\u00e9 des donn\u00e9es :")
  y = flowStep(doc, y, 1, "Cr\u00e9er le ProductionLot", "Avec lotNumber g\u00e9n\u00e9r\u00e9, variantId, initialQuantity = remainingQuantity = quantit\u00e9 saisie")
  y = flowStep(doc, y, 2, "Incr\u00e9menter le stock", "ProductVariant.stock += quantit\u00e9 produite")
  y = flowStep(doc, y, 3, "Cr\u00e9er le mouvement", "StockMovement type=PRODUCTION, reference=lotNumber, lotId=nouveau lot")

  // ── PAGE 6: ALLOCATION FIFO / FEFO ──
  doc.addPage()
  addPageHeader(doc, "4. Allocation FIFO / FEFO", 6)
  y = 38
  y = sectionTitle(doc, y, "Algorithme FIFO (First In, First Out)")
  y = bodyText(doc, y, "L'allocation FIFO est utilis\u00e9e par d\u00e9faut lors de chaque vente. Elle garantit que les lots les plus anciens sont consomm\u00e9s en priorit\u00e9.")
  y = flowStep(doc, y, 1, "Requ\u00eate des lots", "Recherche de tous les ProductionLot actifs (status=ACTIVE, remainingQuantity>0) pour la variante demand\u00e9e, tri\u00e9s par productionDate ASC, puis createdAt ASC.")
  y = flowStep(doc, y, 2, "Boucle d'allocation", "It\u00e9ration sur les lots : prendre min(lot.remainingQuantity, restant). D\u00e9cr\u00e9menter remainingQuantity. Si reste=0, d\u00e9finir status=EXHAUSTED.")
  y = flowStep(doc, y, 3, "Cr\u00e9ation des LotAllocation", "Pour chaque retrait : enregistrer LotAllocation avec lotId, quantity, type=SALE, reference=orderNumber")
  y = flowStep(doc, y, 4, "Contr\u00f4le stock", "Si restant>0 apr\u00e8s tous les lots : erreur 'Stock insuffisant par lots'")

  y = sectionTitle(doc, y, "Algorithme FEFO (First Expired, First Out)")
  y = bodyText(doc, y, "Le FEFO priorise les lots dont la date d'expiration est la plus proche. Si pas de date d'expiration, le FIFO s'applique en fallback.")
  y = bulletPoint(doc, y, "1er crit\u00e8re : expiryDate ASC (lots p\u00e9rimables en priorit\u00e9)")
  y = bulletPoint(doc, y, "2\u00e8me crit\u00e8re : productionDate ASC (plus ancien d'abord)")
  y = bulletPoint(doc, y, "3\u00e8me crit\u00e8re : createdAt ASC (ordre de cr\u00e9ation)")

  y = sectionTitle(doc, y, "G\u00e9n\u00e9ration du num\u00e9ro de lot")
  y = bodyText(doc, y, "Le num\u00e9ro suit le format LOT-YYYYMMDD-NNN. Le s\u00e9quenceur NNN est calcul\u00e9 en comptant les lots cr\u00e9\u00e9s le jour m\u00eame, puis en ajoutant 1, avec z\u00e9ros de gauche sur 3 chiffres.")

  // ── PAGE 7: INT\u00c9GRATION COMMANDES ──
  doc.addPage()
  addPageHeader(doc, "5. Int\u00e9gration avec les commandes", 7)
  y = 38
  y = sectionTitle(doc, y, "Commandes web (store.ts - createOrder)")
  y = bodyText(doc, y, "Lors de la cr\u00e9ation d'une commande client, le syst\u00e8me :")
  y = flowStep(doc, y, 1, "Validation du stock", "V\u00e9rifie que ProductVariant.stock >= quantit\u00e9 demand\u00e9e pour chaque article")
  y = flowStep(doc, y, 2, "Cr\u00e9ation de la commande", "Order + OrderItems + Delivery cr\u00e9\u00e9s en une seule op\u00e9ration")
  y = flowStep(doc, y, 3, "D\u00e9cr\u00e9mentation du stock", "ProductVariant.stock -= quantit\u00e9 pour chaque article")
  y = flowStep(doc, y, 4, "Mouvement de stock", "Cr\u00e9ation d'un StockMovement type=SALE, reference=orderNumber")
  y = flowStep(doc, y, 5, "Allocation FIFO", "Appel \u00e0 allocateStockFIFO() pour chaque variante")
  y = flowStep(doc, y, 6, "Lien lot-article", "OrderItem.lotId = premier lot allou\u00e9 par FIFO")

  y = sectionTitle(doc, y, "Ventes comptoir (POS) - /api/sales")
  y = bodyText(doc, y, "Les ventes en point de vente suivent le m\u00eame processus avec des sp\u00e9cificit\u00e9s :")
  y = bulletPoint(doc, y, "V\u00e9rification du stock sp\u00e9cifique au POS (PointOfSaleStock) plut\u00f4t que le stock global")
  y = bulletPoint(doc, y, "D\u00e9cr\u00e9mentation du stock global ET du stock POS")
  y = bulletPoint(doc, y, "Commande cr\u00e9\u00e9e avec status=DELIVERED et paymentStatus=PAID (vente imm\u00e9diate)")
  y = bulletPoint(doc, y, "M\u00eame allocation FIFO et lien OrderItem.lotId")

  y = sectionTitle(doc, y, "D\u00e9gradation gracieuse")
  y = bodyText(doc, y, "Si aucun lot n'existe pour une variante (avant la premi\u00e8re production), l'appel \u00e0 allocateStockFIFO est envelopp\u00e9 dans un try/catch et ignor\u00e9 silencieusement. Le syst\u00e8me fonctionne sans lots jusqu'\u00e0 ce que la production commence.")

  // ── PAGE 8: TRA\u00c7ABILIT\u00c9 ──
  doc.addPage()
  addPageHeader(doc, "6. Syst\u00e8me de tra\u00e7abilit\u00e9", 8)
  y = 38
  y = bodyText(doc, y, "La tra\u00e7abilit\u00e9 permet de retrouver l'historique complet d'un lot : de sa cr\u00e9ation \u00e0 chaque vente qui l'a consomm\u00e9.")

  y = sectionTitle(doc, y, "API de tra\u00e7abilit\u00e9")
  y = bodyText(doc, y, "GET /api/lots/trace?lotNumber=LOT-... ou ?lotId=...")
  y = bodyText(doc, y, "La r\u00e9ponse contient :")
  y = bulletPoint(doc, y, "lot : D\u00e9tails complets du ProductionLot (variante, produit, cr\u00e9ateur)")
  y = bulletPoint(doc, y, "allocations : Liste de toutes les LotAllocation avec type, quantit\u00e9, r\u00e9f\u00e9rence")
  y = bulletPoint(doc, y, "movements : Tous les StockMovement li\u00e9s au lot (via lotId)")
  y = bulletPoint(doc, y, "summary : initialQuantity, remainingQuantity, consumedQuantity, totalAllocations, saleAllocations")
  y = bulletPoint(doc, y, "Pour chaque allocation de type SALE : les d\u00e9tails de la commande associ\u00e9e (articles, client, montant)")

  y = sectionTitle(doc, y, "Interface utilisateur (/admin/tracabilite)")
  y = bulletPoint(doc, y, "S\u00e9lecteur de lot : Dropdown pr\u00e9-rempli avec tous les lots existants")
  y = bulletPoint(doc, y, "Recherche manuelle : Saisie du num\u00e9ro de lot ou de l'ID")
  y = bulletPoint(doc, y, "Fiche d\u00e9taill\u00e9e : KPIs (produit, restant, consomm\u00e9), m\u00e9tadonn\u00e9es, badges de statut")
  y = bulletPoint(doc, y, "Historique des allocations : Tableau avec type (Vente/Transfert/Perte/Ajustement), quantit\u00e9, r\u00e9f\u00e9rence, date")
  y = bulletPoint(doc, y, "Mouvements de stock : Liste chronologique des entr\u00e9es/sorties avec signe +/-")

  // ── PAGE 9: R\u00c8GLES M\u00c9TIER ──
  doc.addPage()
  addPageHeader(doc, "7. R\u00e8gles m\u00e9tier", 9)
  y = 38
  y = sectionTitle(doc, y, "R\u00e8gles de gestion des lots")
  y = bulletPoint(doc, y, "Les num\u00e9ros de lot sont uniques et g\u00e9n\u00e9r\u00e9s automatiquement (LOT-YYYYMMDD-NNN)")
  y = bulletPoint(doc, y, "Le stock augmente \u00e0 la cr\u00e9ation du lot (m\u00eame transaction)")
  y = bulletPoint(doc, y, "Le stock diminue lors de la commande (avant l'allocation FIFO)")
  y = bulletPoint(doc, y, "FIFO : les lots les plus anciens sont consomm\u00e9s en priorit\u00e9")
  y = bulletPoint(doc, y, "FEFO : les lots dont l'expiration est la plus proche sont prioritaires")
  y = bulletPoint(doc, y, "Quando remainingQuantity atteint 0, le statut passe automatiquement \u00e0 EXHAUSTED")
  y = bulletPoint(doc, y, "Un lot utilis\u00e9 (avec des allocations) ne peut pas \u00eatre supprim\u00e9")
  y = bulletPoint(doc, y, "La suppression d'un lot non utilis\u00e9 d\u00e9cr\u00e9mente le stock de la variante")

  y = sectionTitle(doc, y, "Lien lot-article")
  y = bulletPoint(doc, y, "OrderItem.lotId enregistre le premier lot FIFO utilis\u00e9 pour chaque article de commande")
  y = bulletPoint(doc, y, "StockMovement.lotId est uniquement renseign\u00e9 pour les mouvements de type PRODUCTION")
  y = bulletPoint(doc, y, "Les allocations (LotAllocation) g\u00e8rent l'audit trail d\u00e9taill\u00e9")

  y = sectionTitle(doc, y, "Stock par point de vente")
  y = bulletPoint(doc, y, "PointOfSaleStock assure un suivi sp\u00e9cifique par POS (contrainte unique pointOfSaleId+variantId)")
  y = bulletPoint(doc, y, "Les ventes POS v\u00e9rifient le stock du POS plut\u00f4t que le stock global")
  y = bulletPoint(doc, y, "La double d\u00e9cr\u00e9mentation (global + POS) garantit la coh\u00e9rence")
  y = bulletPoint(doc, y, "Les transferts entre POS cr\u00e9ent des mouvements TRANSFER_OUT / TRANSFER_IN")

  y = sectionTitle(doc, y, "S\u00e9curit\u00e9 et acc\u00e8s")
  y = bulletPoint(doc, y, "Toutes les op\u00e9rations sur les lots n\u00e9cessitent requireManagementAccess() (ADMIN ou STOCK_MANAGER)")
  y = bulletPoint(doc, y, "La cr\u00e9ation, modification et suppression de lots sont \u00e9 strictement r\u00e9serv\u00e9es aux r\u00f4les autoris\u00e9s")
  y = bulletPoint(doc, y, "La tra\u00e7abilit\u00e9 est accessible \u00e0 tous les utilisateurs ayant le module 'production' en visibilit\u00e9")

  return doc
}
