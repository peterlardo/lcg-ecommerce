import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { getPrisma } from "@/lib/prisma"
import { canAssignClients } from "@/lib/permissions"
import { clientLabel } from "@/lib/client-duplicates"

export const dynamic = "force-dynamic"

class MergeError extends Error {}

/** Champs repris de la fiche supprimée quand la fiche gardée ne les a pas. */
const FILLED_FIELDS = ["companyName", "tradeName", "contactName", "taxId", "firstName", "lastName", "email", "phone", "city", "address", "category"] as const

/**
 * Fusion de deux fiches en double : `{ keepId, removeId }`. Les devis, bons, factures et contrats de la fiche
 * supprimée passent sur la fiche gardée ; ses informations complètent celles qui manquent ; puis elle est supprimée.
 * Réservé à l'administrateur et au responsable commercial. Irréversible : l'écran demande confirmation.
 */
export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const user = (await auth())?.user as { id?: string; role?: string; supervisesB2b?: boolean } | undefined
    if (!canAssignClients(user)) {
      return NextResponse.json({ error: "Seuls l'administrateur et le responsable commercial fusionnent des clients" }, { status: 403 })
    }
    const body = (await req.json().catch(() => null)) as { keepId?: unknown; removeId?: unknown } | null
    const keepId = typeof body?.keepId === "string" ? body.keepId : ""
    const removeId = typeof body?.removeId === "string" ? body.removeId : ""
    if (!keepId || !removeId) return NextResponse.json({ error: "Choisissez la fiche à garder et celle à fusionner" }, { status: 400 })
    if (keepId === removeId) return NextResponse.json({ error: "Une fiche ne se fusionne pas avec elle-même" }, { status: 400 })

    const result = await getPrisma().$transaction(async (tx) => {
      const [keep, remove] = await Promise.all([tx.client.findUnique({ where: { id: keepId } }), tx.client.findUnique({ where: { id: removeId } })])
      if (!keep || !remove) throw new MergeError("Client introuvable")
      if (keep.type !== remove.type) throw new MergeError("Un client B2B et un client B2C ne se fusionnent pas")

      // la fiche gardée est complétée, jamais écrasée
      const fill: Record<string, unknown> = {}
      for (const field of FILLED_FIELDS) {
        if (!keep[field] && remove[field]) fill[field] = remove[field]
      }
      if ((keep.latitude === null || keep.longitude === null) && remove.latitude !== null && remove.longitude !== null) {
        fill.latitude = remove.latitude
        fill.longitude = remove.longitude
      }
      if (!keep.commercialId && remove.commercialId) fill.commercialId = remove.commercialId
      if (keep.creditLimit === null && remove.creditLimit !== null) fill.creditLimit = remove.creditLimit
      if (remove.notes && remove.notes !== keep.notes) fill.notes = [keep.notes, remove.notes].filter(Boolean).join("\n").slice(0, 2000)
      if (!keep.isActive && remove.isActive) fill.isActive = true

      const [documents, contracts] = await Promise.all([
        tx.b2bDocument.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } }),
        tx.b2bContract.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } }),
      ])
      if (Object.keys(fill).length) await tx.client.update({ where: { id: keepId }, data: fill })
      await tx.client.delete({ where: { id: removeId } })
      return { keepLabel: clientLabel(keep), removeLabel: clientLabel(remove), documents: documents.count, contracts: contracts.count, filled: Object.keys(fill) }
    })

    // hors transaction : le journal ouvre sa propre connexion
    await logActivity({
      module: "clients",
      action: "Fusion",
      entity: "client",
      entityId: keepId,
      summary: `Fiche « ${result.removeLabel} » fusionnée dans « ${result.keepLabel} » (${result.documents} document(s), ${result.contracts} contrat(s) repris)`,
    })
    return NextResponse.json({ keepId, ...result })
  } catch (error) {
    if (error instanceof MergeError) return NextResponse.json({ error: error.message }, { status: error.message === "Client introuvable" ? 404 : 400 })
    console.error("POST /api/clients/fusion error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
