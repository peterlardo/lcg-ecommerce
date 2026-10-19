import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

// Remplace integrement la grille de prix negocies d'un partenaire.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireManagementAccess(["ADMIN"], [["partenaires"]])
  if (guard) return guard
  try {
    const { id } = await context.params
    const prisma = getPrisma()
    const body = await request.json().catch(() => null)
    const raw = Array.isArray(body?.prices) ? body.prices : null
    if (!raw) return NextResponse.json({ error: "Liste de prix invalide." }, { status: 400 })
    const seen = new Set<string>()
    const rows: { partnerId: string; variantId: string; price: number }[] = []
    for (const entry of raw) {
      const variantId = typeof entry?.variantId === "string" ? entry.variantId : ""
      const price = Number(entry?.price)
      if (!variantId || !Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "Prix invalide (valeur numerique positive requise)." }, { status: 400 })
      }
      if (seen.has(variantId)) continue
      seen.add(variantId)
      rows.push({ partnerId: id, variantId, price })
    }
    const exists = await prisma.partner.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: "Partenaire introuvable." }, { status: 404 })
    if (rows.length) {
      const known = await prisma.productVariant.count({ where: { id: { in: rows.map((row) => row.variantId) } } })
      if (known !== rows.length) {
        return NextResponse.json({ error: "Format inconnu du catalogue." }, { status: 400 })
      }
    }
    const partner = await prisma.$transaction(async (tx) => {
      await tx.partnerPrice.deleteMany({ where: { partnerId: id } })
      if (rows.length) await tx.partnerPrice.createMany({ data: rows })
      return tx.partner.findUnique({
        where: { id },
        select: { id: true, name: true, isActive: true, prices: { select: { variantId: true, price: true } } },
      })
    })
    return NextResponse.json(partner)
  } catch (error) {
    console.error("Erreur PUT /api/partenaires/[id]/prix:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
