import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { auth } from "@/lib/auth"
import { B2B_SCOPE_USERS } from "@/lib/b2b"

export const dynamic = "force-dynamic"

/** Écriture réservée aux gestionnaires : ni COMPTABLE ni profils de caisse. */
const ALLOWED = ["ADMIN", "COMMERCIAL"]
/** Lecture : le responsable comptable (B2B_SCOPE_USERS) voit aussi les contrats. */
const READ_ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE"]

const CONTRACT_STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED"]

function parseItems(raw: unknown): { items: { productVariantId: string; unitPrice: number }[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Ajoutez au moins un article" }
  const items: { productVariantId: string; unitPrice: number }[] = []
  const seen = new Set<string>()
  for (const it of raw) {
    const item = it as { productVariantId?: unknown; unitPrice?: unknown }
    const productVariantId = String(item.productVariantId ?? "")
    if (!productVariantId) return { error: "Article sans produit" }
    if (seen.has(productVariantId)) return { error: "Article en double" }
    seen.add(productVariantId)
    const unitPrice = Number(item.unitPrice ?? 0)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Prix unitaire invalide" }
    items.push({ productVariantId, unitPrice })
  }
  return { items }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function isP2002(error: unknown): error is { code: string } {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
}

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess(READ_ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const role = session?.user?.role
    const selfId = session?.user?.id
    const supervisesB2b = (session?.user as { supervisesB2b?: boolean } | undefined)?.supervisesB2b === true

    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId")?.trim() || undefined
    const status = url.searchParams.get("status")?.toUpperCase() ?? ""
    if (status && !CONTRACT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut de contrat invalide" }, { status: 400 })
    }

    const where: Prisma.B2bContractWhereInput = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status as Prisma.B2bContractWhereInput["status"]
    // ADMIN et COMPTABLE voient tout ; un COMMERCIAL limité à SES clients sauf
    // s'il supervise les clients B2B (supervisesB2b).
    const seesAll = !!role && (B2B_SCOPE_USERS as readonly string[]).includes(role)
    if (!seesAll && !supervisesB2b) where.client = { is: { commercialId: selfId } }

    const contracts = await getPrisma().b2bContract.findMany({
      where,
      orderBy: [{ startsAt: "desc" }],
      include: {
        client: { select: { id: true, companyName: true, tradeName: true } },
        items: { include: { productVariant: { select: { id: true, format: true } } } },
      },
    })
    return NextResponse.json({ contracts, clientId: clientId ?? null, count: contracts.length })
  } catch (error) {
    console.error("GET b2b-contracts error:", error)
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

    const clientId = body.clientId ? String(body.clientId) : ""
    if (!clientId) return NextResponse.json({ error: "Choisissez un client B2B" }, { status: 400 })

    const status = body.status ? String(body.status).toUpperCase() : "ACTIVE"
    if (!CONTRACT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut de contrat invalide" }, { status: 400 })
    }

    const parsed = parseItems(body.items)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const prisma = getPrisma()
    const client = await prisma.client.findFirst({ where: { id: clientId, type: "B2B" } })
    if (!client) return NextResponse.json({ error: "Client B2B introuvable" }, { status: 404 })

    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : new Date()
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Date de début invalide" }, { status: 400 })
    }
    const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 })
    }

    // Garde « 1 ACTIVE max / client » : un second contrat actif est refusé.
    if (status === "ACTIVE") {
      const active = await prisma.b2bContract.findFirst({ where: { clientId, status: "ACTIVE" } })
      if (active) return NextResponse.json({ error: "Ce client a déjà un contrat actif" }, { status: 400 })
    }

    try {
      const contract = await prisma.b2bContract.create({
        data: {
          clientId,
          status: status as Prisma.B2bContractCreateInput["status"],
          startsAt,
          endsAt,
          paymentTermsDays: Number(body.paymentTermsDays) || 30,
          minOrderAmount: Number(body.minOrderAmount) || 0,
          deliveryFrequency: body.deliveryFrequency ? String(body.deliveryFrequency) : null,
          discountPercent: numOrNull(body.discountPercent),
          notes: body.notes ? String(body.notes) : null,
          createdById: selfId,
          items: { create: parsed.items },
        },
        include: { items: true, client: true },
      })
      await logActivity({
        module: "contrats",
        action: "create",
        entity: "B2bContract",
        entityId: contract.id,
        summary: `Création contrat B2B ${contract.id}`,
      })
      return NextResponse.json({ contract }, { status: 201 })
    } catch (error) {
      if (isP2002(error)) {
        return NextResponse.json({ error: "Article en double sur le contrat" }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error("POST b2b-contracts error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}