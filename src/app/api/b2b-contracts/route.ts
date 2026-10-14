import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { auth } from "@/lib/auth"
import { b2bClientScope, clientDisplayName, seesAllB2b, type SessionUser } from "@/lib/commercial"
import { CONTRACT_STATUSES, isContractApplicable, parseContractFields, parseContractItems } from "@/lib/b2b-contract"

export const dynamic = "force-dynamic"

/** Écriture réservée aux gestionnaires : ni COMPTABLE ni profils de caisse. */
const ALLOWED = ["ADMIN", "COMMERCIAL"]
/** Lecture : le responsable comptable (B2B_SCOPE_USERS) voit aussi les contrats. */
const READ_ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE"]

function isP2002(error: unknown): error is { code: string } {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
}

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess(READ_ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()

    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId")?.trim() || undefined
    const status = url.searchParams.get("status")?.toUpperCase() ?? ""
    if (status && !(CONTRACT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Statut de contrat invalide" }, { status: 400 })
    }

    // ADMIN, COMPTABLE et responsable commercial voient tout ; un commercial, les contrats de SES clients.
    const where: Prisma.B2bContractWhereInput = { client: { is: b2bClientScope(session?.user as SessionUser) } }
    if (clientId) where.clientId = clientId
    if (status) where.status = status as Prisma.B2bContractWhereInput["status"]

    const rows = await getPrisma().b2bContract.findMany({
      where,
      orderBy: [{ startsAt: "desc" }],
      include: {
        client: { select: { id: true, companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } },
        items: {
          include: { productVariant: { select: { id: true, format: true, unit: true, price: true, product: { select: { name: true } } } } },
        },
      },
    })

    const now = new Date()
    const contracts = rows.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      clientName: clientDisplayName(c.client),
      status: c.status,
      /** actif et dans sa période : c'est lui qui fixe les prix des devis du client */
      applicable: isContractApplicable(c, now),
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt?.toISOString() ?? null,
      paymentTermsDays: c.paymentTermsDays,
      minOrderAmount: c.minOrderAmount,
      deliveryFrequency: c.deliveryFrequency,
      discountPercent: c.discountPercent ?? 0,
      notes: c.notes,
      itemCount: c.items.length,
      items: c.items
        .map((i) => ({
          productVariantId: i.productVariantId,
          name: i.productVariant?.product?.name ?? "Produit",
          format: i.productVariant?.format ?? "",
          unit: i.productVariant?.unit ?? null,
          publicPrice: i.productVariant?.price ?? null,
          unitPrice: i.unitPrice,
        }))
        .sort((a, b) => `${a.name} ${a.format}`.localeCompare(`${b.name} ${b.format}`, "fr")),
    }))
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

    const parsedFields = parseContractFields(body)
    if ("error" in parsedFields) return NextResponse.json({ error: parsedFields.error }, { status: 400 })
    const fields = parsedFields.fields
    const parsed = parseContractItems(body.items)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const prisma = getPrisma()
    const client = await prisma.client.findFirst({ where: { id: clientId, type: "B2B" } })
    if (!client) return NextResponse.json({ error: "Client B2B introuvable" }, { status: 404 })
    // Même portée que la lecture : un commercial ne crée de contrat que pour SES clients.
    if (!seesAllB2b(session?.user as SessionUser) && client.commercialId !== selfId) {
      return NextResponse.json({ error: "Ce client B2B ne vous est pas affecté" }, { status: 403 })
    }

    const status = fields.status ?? "ACTIVE"
    const startsAt = fields.startsAt ?? new Date()
    const endsAt = fields.endsAt ?? null
    if (endsAt && endsAt < startsAt) {
      return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 })
    }

    if (parsed.items.length > 0) {
      const known = await prisma.productVariant.count({ where: { id: { in: parsed.items.map((i) => i.productVariantId) } } })
      if (known !== parsed.items.length) return NextResponse.json({ error: "Produit introuvable" }, { status: 400 })
    }

    // Un seul contrat actif par client : le suivant doit attendre que le premier soit suspendu.
    if (status === "ACTIVE") {
      const active = await prisma.b2bContract.findFirst({ where: { clientId, status: "ACTIVE" } })
      if (active) return NextResponse.json({ error: "Ce client a déjà un contrat actif : modifiez-le ou suspendez-le d'abord" }, { status: 400 })
    }

    try {
      const contract = await prisma.b2bContract.create({
        data: {
          clientId,
          status,
          startsAt,
          endsAt,
          paymentTermsDays: fields.paymentTermsDays ?? 30,
          minOrderAmount: fields.minOrderAmount ?? 0,
          deliveryFrequency: fields.deliveryFrequency ?? null,
          discountPercent: fields.discountPercent ?? 0,
          notes: fields.notes ?? null,
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
        summary: `Contrat B2B créé pour ${clientDisplayName(contract.client)}`,
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
