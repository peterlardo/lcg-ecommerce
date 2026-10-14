import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { getPrisma } from "@/lib/prisma"
import { geocodeAddress } from "@/lib/geocode"
import { findDuplicates, type DuplicateCandidate } from "@/lib/client-duplicates"

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

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL", "COMPTABLE"])
  if (forbidden) return forbidden

  try {
    const session = await (await import("@/lib/auth")).auth()
    const role = session?.user?.role
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || ""
    const type = searchParams.get("type")?.trim() || ""
    const commercialId = searchParams.get("commercialId")?.trim() || ""
    const active = searchParams.get("active")?.trim() || ""

    const where: Record<string, unknown> = {}

    // Filtre strict B2B : le responsable comptable ne voit que les clients B2B.
    if (role === "COMPTABLE") {
      where.type = "B2B"
    } else if (type === "B2B" || type === "B2C") {
      where.type = type
    }
    // « none » : clients sans commercial attitré
    if (commercialId === "none") where.commercialId = null
    else if (commercialId) where.commercialId = commercialId
    if (active === "true") where.isActive = true
    if (active === "false") where.isActive = false

    if (q) {
      where.OR = [
        { companyName: { contains: q, mode: "insensitive" } },
        { tradeName: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ]
    }

    const clients = await getPrisma().client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { commercial: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error("GET /api/clients error:", error)
    return NextResponse.json(
      { error: "Erreur lors du chargement des clients" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const session = await (await import("@/lib/auth")).auth()
    const body = await request.json()

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
      isActive: body.isActive !== false,
    }

    // Écran « Nouveau client » : il demande un contrôle des doublons avant d'écrire. Sans `force`, un client
    // de même téléphone, même e-mail ou même nom fait échouer la création et renvoie les fiches trouvées.
    if (body.checkDuplicates === true && body.force !== true) {
      const existing = await getPrisma().client.findMany({
        select: {
          id: true, type: true, companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true,
          phone: true, email: true, city: true, isActive: true, commercial: { select: { name: true } },
        },
      })
      const duplicates = findDuplicates(data as DuplicateCandidate, existing)
      if (duplicates.length) {
        return NextResponse.json(
          { error: "Un client qui ressemble à celui-ci existe déjà dans la base.", duplicates },
          { status: 409 }
        )
      }
    }

    // Position relevée sur place (téléphone du commercial) : elle prime sur le géocodage de l'adresse.
    const lat = typeof body.latitude === "number" ? body.latitude : null
    const lng = typeof body.longitude === "number" ? body.longitude : null
    const hasPosition = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
    if (hasPosition) {
      data.latitude = lat
      data.longitude = lng
    }

    // Un commercial inscrit par défaut ses clients à son nom ; l'administrateur et le responsable commercial
    // choisissent le commercial attitré (ou n'en mettent pas).
    const commercialId =
      (typeof body.commercialId === "string" && body.commercialId.trim()) ||
      (session?.user?.role === "COMMERCIAL" ? session.user.id : null)
    if (commercialId) data.commercialId = commercialId

    const client = await getPrisma().client.create({ data })

    if (!hasPosition) void geocodeAndStore(client.id, client.address, client.city)

    await logActivity({ module: "clients", action: "Création", entity: "client", entityId: client.id, summary: `Client ${client.companyName || [client.firstName, client.lastName].filter(Boolean).join(" ") || client.email || client.id} créé (${type})` })
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("POST /api/clients error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la création du client" },
      { status: 500 }
    )
  }
}
