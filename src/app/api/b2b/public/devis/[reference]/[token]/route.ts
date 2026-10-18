import { NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "crypto"
import { getPrisma } from "@/lib/prisma"
import { getSettings, documentCompany } from "@/lib/settings"
import { clientDisplayName } from "@/lib/commercial"

export const dynamic = "force-dynamic"

/** Comparaison à temps constant : jamais de fuite du jeton par le temps de réponse. */
function sameToken(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Consultation publique d'un devis : aucun compte requis, le jeton dérivé de la
 * référence sert de clé d'accès. La réponse ne contient que les informations
 * destinées au client (pas d'identifiants internes, pas de marge, pas de notes
 * privées du commercial).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ reference: string; token: string }> }) {
  const { reference, token } = await params

  const secret = process.env.NEXTAUTH_SECRET || ""
  if (!secret) return NextResponse.json({ error: "Configuration serveur incomplète" }, { status: 500 })

  const expected = createHash("sha256").update(reference + secret).digest("hex")
  if (!sameToken(expected, token)) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 })

  const doc = await getPrisma().b2bDocument.findFirst({
    where: { reference, type: "DEVIS" },
    select: {
      reference: true,
      type: true,
      status: true,
      createdAt: true,
      validUntil: true,
      deliveryTerms: true,
      requestedDeliveryDate: true,
      subtotal: true,
      discount: true,
      total: true,
      client: { select: { companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          productVariant: { select: { format: true, unit: true, product: { select: { name: true } } } },
        },
      },
    },
  })
  if (!doc) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
  if (doc.status === "CANCELLED") return NextResponse.json({ error: "Ce devis a été annulé" }, { status: 404 })

  const settings = await getSettings()
  const company = documentCompany(settings.general)

  return NextResponse.json({
    document: {
      reference: doc.reference,
      type: doc.type,
      status: doc.status,
      createdAt: doc.createdAt,
      validUntil: doc.validUntil,
      deliveryTerms: doc.deliveryTerms,
      requestedDeliveryDate: doc.requestedDeliveryDate,
      subtotal: doc.subtotal,
      discount: doc.discount,
      total: doc.total,
      client: { name: clientDisplayName(doc.client) },
      items: doc.items.map((item) => ({
        label: item.productVariant ? `${item.productVariant.product.name} — ${item.productVariant.format}` : "Article retiré du catalogue",
        unit: item.productVariant?.unit ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    },
    company,
    bank: settings.bank,
  })
}
