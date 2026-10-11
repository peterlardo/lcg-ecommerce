import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

const ALLOWED = ["ADMIN", "COMMERCIAL"]

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

/** Code d'erreur Prisma sans dépendre du type généré. */
function errorCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : null
}

/** Coercition stricte : nombre fini ≥ 0, sinon null (jamais de négatif ni NaN stocké). */
function strictNumber(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function getContractOrNull(id: string, userId: string, role: string, supervisesB2b: boolean) {
  const contract = await getPrisma().b2bContract.findUnique({
    where: { id },
    include: { client: { select: { id: true, commercialId: true } }, items: true },
  })
  if (!contract) return { contract: null, status: 404 as const }
  if (role !== "ADMIN" && !supervisesB2b && contract.client?.commercialId !== userId) {
    return { contract: null, status: 403 as const }
  }
  return { contract, status: 200 as const }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  const session = await auth()
  const selfId = session?.user?.id
  const role = session?.user?.role
  if (!selfId || !role) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const { contract, status } = await getContractOrNull(
    id,
    selfId,
    role,
    (session?.user as { supervisesB2b?: boolean }).supervisesB2b === true
  )
  if (!contract) return NextResponse.json({ error: status === 404 ? "Contrat introuvable" : "Non autorisé" }, { status })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  try {
    const nextStatus = body.status === undefined || body.status === null ? null : String(body.status).toUpperCase()
    if (nextStatus !== null && !CONTRACT_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: "Statut de contrat invalide" }, { status: 400 })
    }
    // Passer un contrat en ACTIVE quand un autre ACTIVE existe déjà : refusé.
    if (nextStatus === "ACTIVE") {
      const otherActive = await getPrisma().b2bContract.findFirst({
        where: { clientId: contract.clientId, status: "ACTIVE", id: { not: id } },
      })
      if (otherActive) return NextResponse.json({ error: "Ce client a déjà un contrat actif" }, { status: 400 })
    }

    let items: { productVariantId: string; unitPrice: number }[] | null = null
    if (body.items !== undefined) {
      const parsed = parseItems(body.items)
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
      items = parsed.items
    }

    const data: Prisma.B2bContractUpdateInput = {}
    if (nextStatus !== null) data.status = nextStatus as Prisma.B2bContractUpdateInput["status"]
    if (body.paymentTermsDays !== undefined) {
      const v = strictNumber(body.paymentTermsDays)
      if (v === null) return NextResponse.json({ error: "Valeur invalide : paymentTermsDays" }, { status: 400 })
      data.paymentTermsDays = v
    }
    if (body.minOrderAmount !== undefined) {
      const v = strictNumber(body.minOrderAmount)
      if (v === null) return NextResponse.json({ error: "Valeur invalide : minOrderAmount" }, { status: 400 })
      data.minOrderAmount = v
    }
    if (body.discountPercent !== undefined) {
      const v = strictNumber(body.discountPercent)
      if (v === null) return NextResponse.json({ error: "Valeur invalide : discountPercent" }, { status: 400 })
      data.discountPercent = v
    }
    if (body.deliveryFrequency !== undefined) data.deliveryFrequency = body.deliveryFrequency ? String(body.deliveryFrequency) : null
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null

    const updated = await getPrisma().$transaction(async (tx) => {
      // Les lignes fournies remplacent l'intégralité de la grille de prix.
      if (items) await tx.b2bContractItem.deleteMany({ where: { contractId: id } })
      return tx.b2bContract.update({
        where: { id },
        data: { ...data, ...(items ? { items: { create: items } } : {}) },
        include: { items: true, client: true },
      })
    })

    await logActivity({
      module: "contrats",
      action: "update",
      entity: "B2bContract",
      entityId: id,
      summary: `Modification contrat B2B ${id}`,
    })
    return NextResponse.json({ contract: updated })
  } catch (error) {
    const code = errorCode(error)
    if (code === "P2025") return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 })
    if (code === "P2003") return NextResponse.json({ error: "Article invalide" }, { status: 400 })
    console.error("PATCH b2b-contract error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  const session = await auth()
  const selfId = session?.user?.id
  const role = session?.user?.role
  if (!selfId || !role) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const { contract, status } = await getContractOrNull(
    id,
    selfId,
    role,
    (session?.user as { supervisesB2b?: boolean }).supervisesB2b === true
  )
  if (!contract) return NextResponse.json({ error: status === 404 ? "Contrat introuvable" : "Non autorisé" }, { status })

  try {
    await getPrisma().b2bContract.delete({ where: { id } })
    await logActivity({
      module: "contrats",
      action: "delete",
      entity: "B2bContract",
      entityId: id,
      summary: `Contrat ${id} supprimé`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (errorCode(error) === "P2025") return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 })
    console.error("DELETE b2b-contract error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
