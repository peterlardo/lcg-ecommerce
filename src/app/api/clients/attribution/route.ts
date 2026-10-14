import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { getPrisma } from "@/lib/prisma"
import { canAssignClients, COMMERCIAL_ROLES } from "@/lib/permissions"

export const dynamic = "force-dynamic"

const MAX_CLIENTS = 500

/**
 * Attribue plusieurs clients à un commercial : `{ clientIds: string[], commercialId: string | null }`
 * (`null` : les rendre « non assignés »). Seul le commercial attitré est modifié.
 */
export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const user = session?.user as { id?: string; role?: string; supervisesB2b?: boolean } | undefined
    if (!canAssignClients(user)) {
      return NextResponse.json({ error: "Seuls l'administrateur et le responsable commercial répartissent les clients" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { clientIds?: unknown; commercialId?: unknown } | null
    const clientIds = Array.isArray(body?.clientIds) ? [...new Set(body.clientIds.filter((x): x is string => typeof x === "string" && x.length > 0))] : []
    if (clientIds.length === 0) return NextResponse.json({ error: "Aucun client sélectionné" }, { status: 400 })
    if (clientIds.length > MAX_CLIENTS) return NextResponse.json({ error: `${MAX_CLIENTS} clients au plus à la fois` }, { status: 400 })

    const commercialId = typeof body?.commercialId === "string" && body.commercialId ? body.commercialId : null
    let commercialName = "personne (non assigné)"
    if (commercialId) {
      const commercial = await getPrisma().user.findUnique({ where: { id: commercialId }, select: { name: true, email: true, role: true, isActive: true } })
      if (!commercial || !commercial.isActive || !(commercial.role === "ADMIN" || COMMERCIAL_ROLES.includes(commercial.role))) {
        return NextResponse.json({ error: "Commercial introuvable ou inactif" }, { status: 400 })
      }
      commercialName = commercial.name || commercial.email
    }

    const { count } = await getPrisma().client.updateMany({ where: { id: { in: clientIds } }, data: { commercialId } })
    await logActivity({
      module: "clients",
      action: "Attribution",
      entity: "client",
      entityId: commercialId ?? "aucun",
      summary: `${count} client${count > 1 ? "s" : ""} attribué${count > 1 ? "s" : ""} à ${commercialName}`,
    })
    return NextResponse.json({ updated: count, commercialId })
  } catch (error) {
    console.error("POST /api/clients/attribution error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
