import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { nextDocumentReference, PRIMARY_DOC_TYPES } from "@/lib/b2b"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

const ALLOWED = ["ADMIN", "COMMERCIAL"]

const REF_PREFIX: Record<string, string> = {
  DEVIS: "DEV",
  COMMANDE: "BC",
  LIVRAISON: "BL",
  FACTURE: "FAC",
}

function isP2002(error: unknown): error is { code: string } {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
}

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const role = session?.user?.role
    const selfId = session?.user?.id
    const supervisesB2b = (session?.user as { supervisesB2b?: boolean } | undefined)?.supervisesB2b === true

    const url = new URL(req.url)
    const type = url.searchParams.get("type")?.toUpperCase() ?? ""
    const status = url.searchParams.get("status")?.toUpperCase() ?? ""
    const q = url.searchParams.get("q")?.trim()
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))

    const where: Prisma.B2bDocumentWhereInput = {}
    if (type) where.type = type as Prisma.B2bDocumentWhereInput["type"]
    if (status) where.status = status as string as Prisma.B2bDocumentWhereInput["status"]
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { client: { is: { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { tradeName: { contains: q, mode: "insensitive" } }] } } },
      ]
    }
    if (role !== "ADMIN" && !supervisesB2b) {
      where.client = { is: { commercialId: selfId } }
    }

    const [documents, counts, total] = await Promise.all([
      getPrisma().b2bDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: (page - 1) * 20,
        include: {
          client: { select: { id: true, companyName: true, tradeName: true } },
          _count: { select: { items: true } },
        },
      }),
      getPrisma().b2bDocument.groupBy({ by: ["type"], _count: { _all: true } }),
      getPrisma().b2bDocument.count({ where }),
    ])

    return NextResponse.json({ documents, counts, total, page, types: PRIMARY_DOC_TYPES })
  } catch (error) {
    console.error("GET b2b-documents error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const selfId = session?.user?.id
    if (!selfId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
    }

    const docType = String(body.type ?? "").toUpperCase()
    if (!PRIMARY_DOC_TYPES.includes(docType as (typeof PRIMARY_DOC_TYPES)[number])) {
      return NextResponse.json({ error: "Type de document invalide" }, { status: 400 })
    }
    if (!body.clientId) return NextResponse.json({ error: "Choisissez un client B2B" }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 })
    }

    const prisma = getPrisma()
    const client = await prisma.client.findFirst({ where: { id: String(body.clientId), type: "B2B" } })
    if (!client) return NextResponse.json({ error: "Client B2B introuvable" }, { status: 404 })

    const items = body.items.map((i) => {
      const item = i as { productVariantId?: unknown; quantity?: unknown; unitPrice?: unknown }
      return {
        productVariantId: String(item.productVariantId ?? ""),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      }
    })
    if (items.some((i) => !i.productVariantId)) {
      return NextResponse.json({ error: "Article sans produit" }, { status: 400 })
    }
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const discount = Math.max(0, Number(body.discount ?? 0))
    const notes = body.notes ? String(body.notes) : null

    // nextDocumentReference est count+1 : en cas de course (P2002), on régénère
    // la référence et on réessaie, sans bloquer.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const reference = await nextDocumentReference(prisma, REF_PREFIX[docType] as "DEV" | "BC" | "BL" | "FAC")
        const document = await prisma.b2bDocument.create({
          data: {
            type: docType as Prisma.B2bDocumentCreateInput["type"],
            reference,
            clientId: String(body.clientId),
            status: "DRAFT",
            subtotal,
            discount,
            total: Math.max(0, subtotal - discount),
            notes,
            createdById: selfId,
            items: {
              create: items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity })),
            },
          },
          include: { client: true, items: { include: { productVariant: true } } },
        })
        await logActivity({
          module: "b2b",
          action: "create",
          entity: "B2bDocument",
          entityId: document.id,
          summary: `Création ${document.type} ${document.reference}`,
        })
        return NextResponse.json({ document }, { status: 201 })
      } catch (error) {
        if (isP2002(error) && attempt < 2) continue
        throw error
      }
    }
    return NextResponse.json({ error: "Référence en collision, réessayez" }, { status: 409 })
  } catch (error) {
    console.error("POST b2b-documents error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}