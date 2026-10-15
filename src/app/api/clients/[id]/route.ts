import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { getPrisma } from "@/lib/prisma"
import { geocodeAddress } from "@/lib/geocode"
import { auth } from "@/lib/auth"
import { canAssignClients } from "@/lib/permissions"

async function geocodeAndStore(clientId: string, address: string | null, city: string | null) {
  const query = [address, city].filter(Boolean).join(", ")
  if (!query) return
  const pt = await geocodeAddress(query)
  if (pt) {
    await getPrisma().client.update({
      where: { id: clientId },
      data: { latitude: pt.lat, longitude: pt.lng },
    })
  }
}

type Ctx = { params: Promise<{ id: string }> }
type SessionUser = { id?: string; role?: string; supervisesB2b?: boolean } | undefined

/**
 * Le client, s'il est dans la portée de l'utilisateur ; sinon null (404, sans dire qu'il existe).
 * Un simple commercial ne touche que ses clients ; le comptable ne voit que les clients B2B.
 */
async function clientInScope(id: string, user: SessionUser) {
  const client = await getPrisma().client.findUnique({
    where: { id },
    include: { commercial: { select: { id: true, name: true, email: true } } },
  })
  if (!client) return null
  if (user?.role === "COMPTABLE" && client.type !== "B2B") return null
  if (user?.role === "COMMERCIAL" && !canAssignClients(user) && client.commercialId !== user.id) return null
  return client
}

export async function GET(_req: Request, { params }: Ctx) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL", "COMPTABLE"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const client = await clientInScope(id, (await auth())?.user as SessionUser)
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    return NextResponse.json(client)
  } catch (error) {
    console.error("GET /api/clients/[id] error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const user = (await auth())?.user as SessionUser
    const current = await clientInScope(id, user)
    if (!current) return NextResponse.json({ error: "Client introuvable" }, { status: 404 })

    const body = await req.json()
    const type = body.type === "B2B" ? "B2B" : "B2C"

    if (type === "B2B") {
      if (!body.companyName || !body.companyName.trim()) {
        return NextResponse.json(
          { error: "La raison sociale (entreprise) est obligatoire pour un client B2B" },
          { status: 400 }
        )
      }
    } else {
      if (
        (!body.firstName || !body.firstName.trim()) &&
        (!body.lastName || !body.lastName.trim())
      ) {
        return NextResponse.json(
          { error: "Le nom ou le prénom est obligatoire pour un client B2C" },
          { status: 400 }
        )
      }
    }

    const data: Record<string, unknown> = {
      type,
      companyName: body.companyName?.trim() || null,
      tradeName: body.tradeName?.trim() || null,
      contactName: body.contactName?.trim() || null,
      taxId: body.taxId?.trim() || null,
      firstName: body.firstName?.trim() || null,
      lastName: body.lastName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      city: body.city?.trim() || null,
      address: body.address?.trim() || null,
      notes: body.notes?.trim() || null,
    }

    if (typeof body.isActive === "boolean") data.isActive = body.isActive
    // Le commercial attitré ne change que par l'administrateur ou le responsable commercial :
    // un commercial ne peut ni prendre le client d'un collègue, ni donner le sien.
    if (body.commercialId !== undefined && canAssignClients(user)) {
      data.commercialId = body.commercialId?.trim() || null
    }

    const client = await getPrisma().client.update({ where: { id }, data })

    void geocodeAndStore(client.id, client.address, client.city)

    await logActivity({ module: "clients", action: "Modification", entity: "client", entityId: id, summary: `Client ${client.companyName || [client.firstName, client.lastName].filter(Boolean).join(" ") || client.email || id} modifié` })
    return NextResponse.json(client)
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    }
    console.error("PUT /api/clients/[id] error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const user = (await auth())?.user as SessionUser
    // supprimer une fiche est réservé à l'administrateur et au responsable commercial
    if (!canAssignClients(user)) {
      return NextResponse.json({ error: "Seuls l'administrateur et le responsable commercial suppriment un client : désactivez-le plutôt" }, { status: 403 })
    }
    const client = await clientInScope(id, user)
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 })

    // un client qui a des documents ou un contrat garde sa fiche : ses devis et factures resteraient sans client
    const [documents, contracts] = await Promise.all([
      getPrisma().b2bDocument.count({ where: { clientId: id } }),
      getPrisma().b2bContract.count({ where: { clientId: id } }),
    ])
    if (documents > 0 || contracts > 0) {
      const parts = [documents > 0 && `${documents} document${documents > 1 ? "s" : ""} B2B`, contracts > 0 && `${contracts} contrat${contracts > 1 ? "s" : ""}`].filter(Boolean).join(" et ")
      return NextResponse.json(
        { error: `Ce client a ${parts} : il ne peut pas être supprimé. Désactivez-le, ou fusionnez-le avec son doublon.` },
        { status: 409 }
      )
    }

    await getPrisma().client.delete({ where: { id } })
    await logActivity({ module: "clients", action: "Suppression", entity: "client", entityId: id, summary: `Client ${client.companyName || [client.firstName, client.lastName].filter(Boolean).join(" ") || client.email || id} supprimé` })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    }
    console.error("DELETE /api/clients/[id] error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
