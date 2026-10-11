import type { jsPDF } from "jspdf"
import { LOGO_BADGE_BASE64 } from "./logo-badge-base64"

// ─── PAGE DE GARDE COMMUNE AUX DOCUMENTS PDF ──────────────────
// Fond blanc, courbes bleues, texte au bleu du logo LCG.

type RGB = [number, number, number]
type Point = [number, number]
// Courbe de Bézier : deux points de contrôle puis le point d'arrivée
type Curve = [number, number, number, number, number, number]

/** Bleu du logo LCG */
export const LOGO_BLUE: RGB = [31, 79, 163]
const DEEP_BLUE: RGB = [17, 50, 118]
const BRIGHT_BLUE: RGB = [38, 126, 212]
const ICE_BLUE: RGB = [92, 182, 234]

const PAGE_W = 210
const PAGE_H = 297
const RIGHT = 190

export interface CoverOptions {
  title: string
  subtitle?: string
  /** Ligne d'information sous le titre (version, date…) */
  meta?: string
  company: { name: string; address: string; phone: string; email: string; website?: string }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
}

function trace(doc: jsPDF, start: Point, curves: Curve[], closed = true) {
  doc.moveTo(start[0], start[1])
  for (const c of curves) doc.curveTo(c[0], c[1], c[2], c[3], c[4], c[5])
  if (closed) doc.close()
}

/** Forme remplie d'un dégradé horizontal : la forme sert de masque à des bandes de couleur successives. */
function gradientShape(doc: jsPDF, start: Point, curves: Curve[], from: RGB, to: RGB, x0: number, x1: number) {
  const steps = 60
  doc.saveGraphicsState()
  trace(doc, start, curves)
  doc.clip()
  doc.discardPath()
  for (let i = 0; i < steps; i++) {
    const x = i === 0 ? 0 : x0 + ((x1 - x0) * i) / steps
    const [r, g, b] = mix(from, to, i / (steps - 1))
    doc.setFillColor(r, g, b)
    // chaque bande va jusqu'au bord droit : la suivante la recouvre, sans liseré entre deux bandes
    doc.rect(x, 0, PAGE_W - x, PAGE_H, "F")
  }
  doc.restoreGraphicsState()
}

function thinLine(doc: jsPDF, start: Point, curves: Curve[]) {
  doc.setDrawColor(LOGO_BLUE[0], LOGO_BLUE[1], LOGO_BLUE[2])
  doc.setLineWidth(0.25)
  trace(doc, start, curves, false)
  doc.stroke()
}

function drawWaves(doc: jsPDF) {
  // Filets, tracés en premier : les formes passent par-dessus
  thinLine(doc, [0, 138], [[58, 190, 172, 176, PAGE_W, 84]])
  thinLine(doc, [0, 186], [[20, 186, 42, 180, 58, 172]])
  thinLine(doc, [0, 200], [[44, 204, 84, 244, 88, PAGE_H]])

  // Grande vague : du bord gauche jusqu'à la pointe, à droite
  const tip: Point = [197, 80]
  gradientShape(
    doc,
    [0, 66],
    [
      [22, 104, 74, 131, 122, 129],
      [156, 127, 184, 106, tip[0], tip[1]],
      [188, 124, 142, 153, 88, 152],
      [52, 151, 20, 143, 0, 131],
    ],
    ICE_BLUE,
    LOGO_BLUE,
    0,
    tip[0],
  )
  // Partie haute, plus sombre, qui se fond dans la vague
  gradientShape(
    doc,
    [0, 66],
    [
      [22, 104, 74, 131, 122, 129],
      [84, 137, 34, 126, 0, 100],
    ],
    DEEP_BLUE,
    mix(ICE_BLUE, LOGO_BLUE, 122 / tip[0]),
    0,
    122,
  )
  // Pli sombre sous la vague
  gradientShape(
    doc,
    tip,
    [
      [188, 124, 142, 153, 88, 152],
      [128, 148, 168, 128, tip[0], tip[1]],
    ],
    mix(ICE_BLUE, LOGO_BLUE, 88 / tip[0]),
    DEEP_BLUE,
    88,
    172,
  )
  // Petite vague, en dessous à gauche
  gradientShape(
    doc,
    [0, 150],
    [
      [18, 162, 40, 167, 62, 166],
      [40, 176, 18, 177, 0, 174],
    ],
    BRIGHT_BLUE,
    ICE_BLUE,
    0,
    62,
  )
  // Lame au bas de la page
  gradientShape(
    doc,
    [72, 247],
    [
      [80, 262, 85, 280, 85, PAGE_H],
      [91, PAGE_H, 95, PAGE_H, 99, PAGE_H],
      [96, 278, 87, 260, 72, 247],
    ],
    LOGO_BLUE,
    BRIGHT_BLUE,
    72,
    99,
  )
}

function drawLogo(doc: jsPDF) {
  const size = 34
  const x = RIGHT - size
  const y = 14
  try {
    // le logo est rogné au ras de son anneau : son fond gris très clair ne se voit pas sur la page blanche
    doc.saveGraphicsState()
    doc.circle(x + size / 2, y + size / 2, (size / 2) * 0.945, null)
    doc.clip()
    doc.discardPath()
    doc.addImage(LOGO_BADGE_BASE64, "PNG", x, y, size, size)
    doc.restoreGraphicsState()
  } catch { /* logo indisponible */ }
}

/** Texte en capitales espacées, aligné à droite. */
function spacedRight(doc: jsPDF, text: string, y: number, charSpace: number) {
  // Lettre par lettre : l'option d'espacement de jsPDF laisse une trace dans tout le reste du document
  let x = RIGHT - (doc.getTextWidth(text) + charSpace * Math.max(0, text.length - 1))
  for (const letter of text) {
    doc.text(letter, x, y)
    x += doc.getTextWidth(letter) + charSpace
  }
}

function titleLines(title: string): string[] {
  const words = title.trim().toUpperCase().split(/\s+/)
  if (words.length < 2) return words
  // deux mots : un par ligne ; au-delà, on coupe au plus près du milieu
  if (words.length === 2) return words
  let best = 1
  let bestGap = Infinity
  for (let i = 1; i < words.length; i++) {
    const gap = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length)
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")]
}

export function drawCoverPage(doc: jsPDF, options: CoverOptions) {
  const { company } = options

  // La page de garde ne laisse aucune trace : les réglages du document sont remis tels quels à la fin
  const before = {
    lineWidth: doc.getLineWidth(),
    draw: doc.getDrawColor(),
    fill: doc.getFillColor(),
    text: doc.getTextColor(),
    font: doc.getFont(),
    size: doc.getFontSize(),
  }

  // Fond blanc
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, "F")

  drawWaves(doc)
  drawLogo(doc)

  // Tout le texte de la page est au bleu du logo
  doc.setTextColor(LOGO_BLUE[0], LOGO_BLUE[1], LOGO_BLUE[2])

  // Titre
  const lines = titleLines(options.title)
  const maxWidth = 122
  const charSpace = 0.7
  let size = 32
  doc.setFont("helvetica", "bold")
  doc.setFontSize(size)
  const widest = () => Math.max(...lines.map((l) => doc.getTextWidth(l) + charSpace * (l.length - 1)))
  while (size > 16 && widest() > maxWidth) {
    size -= 1
    doc.setFontSize(size)
  }
  const lineHeight = size * 0.44
  let y = 196
  for (const line of lines) {
    spacedRight(doc, line, y, charSpace)
    y += lineHeight
  }
  y -= lineHeight

  if (options.subtitle) {
    y += 9
    doc.setFont("helvetica", "normal")
    doc.setFontSize(13)
    doc.text(options.subtitle, RIGHT, y, { align: "right" })
  }

  // Petit trait sous le titre
  y += 6
  doc.setFillColor(LOGO_BLUE[0], LOGO_BLUE[1], LOGO_BLUE[2])
  doc.rect(RIGHT - 16, y, 16, 1.1, "F")

  // Version et date
  y += 10
  if (options.meta) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    doc.text(options.meta, RIGHT, y, { align: "right" })
    y += 9
  }

  // Éditeur et coordonnées
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text(company.name, RIGHT, y, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  const details = [company.address, company.phone, [company.email, company.website].filter(Boolean).join("  |  ")]
  for (const detail of details) {
    y += 4.6
    doc.text(detail, RIGHT, y, { align: "right" })
  }

  doc.setLineWidth(before.lineWidth)
  doc.setDrawColor(before.draw)
  doc.setFillColor(before.fill)
  doc.setTextColor(before.text)
  doc.setFont(before.font.fontName, before.font.fontStyle)
  doc.setFontSize(before.size)
}
