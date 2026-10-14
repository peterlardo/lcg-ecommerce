import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { auth } from "@/lib/auth"
import { clientDisplayName, seesAllB2b, type SessionUser } from "@/lib/commercial"
import { parseContractFields, parseContractItems, type ContractItemInput } from "@/lib/b2b-contract"

export const dynamic = "force-dynamic"

const ALLOWED = ["ADMIN", "COMMERCIAL"]

/** Code d'erreur Prisma sans dépendre du type généré. */
function errorCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : null
}

const CLIENT_NAMES = { id: true, commercialId: true, companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } as const

/** Le contrat, s'il existe et s'il est dans la portée de l'utilisateur (un commercial : ses clients). */
async function getContractOrNull(id: string, user: SessionUser) {
  const contract = await getPrisma().b2bContract.findUnique({
    where: { id },
    include: { client: { select: CLIENT_NAMES }, items: true },
  })
  if (!contract) return { contract: null, status: 404 as const }
  if (!seesAllB2b(user) && contract.client?.commercialId !== user?.id) {
    return { contract: null, status: 403 as const }
  }
  return { contract, status: 200 as const }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(ALLOWED)
  if (forbidden) return forbidden

  const session = await auth()
  if (!session?.user?.id || !session.user.role) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const { contract, status } = await getContractOrNull(id, session.user as SessionUser)
  if (!contract) return NextResponse.json({ error: status === 404 ? "Contrat introuvable" : "Non autorisé" }, { status })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  try {
    const parsedFields = parseContractFields(body)
    if ("error" in parsedFields) return NextResponse.json({ error: parsedFields.error }, { status: 400 })
    const fields = parsedFields.fields

    const startsAt = fields.startsAt ?? contract.startsAt
    const endsAt = fields.endsAt === undefined ? contract.endsAt : fields.endsAt
    if (endsAt && endsAt < startsAt) {
      return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 })
    }

    // Passer un contrat en ACTIVE quand un autre ACTIVE existe déjà : refusé.
    if (fields.status === "ACTIVE") {
      const otherActive = await getPrisma().b2bContract.findFirst({
        where: { clientId: contract.clientId, status: "ACTIVE", id: { not: id } },
      })
      if (otherActive) return NextResponse.json({ error: "Ce client a déjà un contrat actif : modifiez-le ou suspendez-le d'abord" }, { status: 400 })
    }

    let items: ContractItemInput[] | null = null
    if (body.items !== undefined) {
      const parsed = parseContractItems(body.items)
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
      items = parsed.items
      if (items.length > 0) {
        const known = await getPrisma().productVariant.count({ where: { id: { in: items.map((i) => i.productVariantId) } } })
        if (known !== items.length) return NextResponse.json({ error: "Produit introuvable" }, { status: 400 })
      }
    }

    const data: Prisma.B2bContractUpdateInput = { ...fields }

    const updated = await getPrisma().$transaction(async (tx) => {
      // Les lignes fournies remplacent l'intégralité de la grille de prix.
      if (items) await tx.b2bContractItem.deleteMany({ where: { contractId: id } })
      return tx.b2bContract.update({
        where: { id },
        data: { ...data, ...(items ? { items: { create: items } } : {}) },
        include: { items: true, client: true },
      })
    })

    // hors de la transaction : le journal ouvre sa propre connexion
    const onlyStatus = Object.keys(fields).length === 1 && fields.status !== undefined && !items
    await logActivity({
      module: "contrats",
      action: onlyStatus ? (fields.status === "ACTIVE" ? "reactivate" : "suspend") : "update",
      entity: "B2bContract",
      entityId: id,
      summary: onlyStatus
        ? `Contrat B2B de ${clientDisplayName(contract.client)} ${fields.status === "ACTIVE" ? "réactivé" : fields.status === "SUSPENDED" ? "suspendu" : "marqué expiré"}`
        : `Contrat B2B de ${clientDisplayName(contract.client)} modifié`,
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
  if (!session?.user?.id || !session.user.role) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const { id } = await params
  const { contract, status } = await getContractOrNull(id, session.user as SessionUser)
  if (!contract) return NextResponse.json({ error: status === 404 ? "Contrat introuvable" : "Non autorisé" }, { status })

  try {
    await getPrisma().b2bContract.delete({ where: { id } })
    await logActivity({
      module: "contrats",
      action: "delete",
      entity: "B2bContract",
      entityId: id,
      summary: `Contrat B2B de ${clientDisplayName(contract.client)} supprimé`,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (errorCode(error) === "P2025") return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 })
    console.error("DELETE b2b-contract error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
