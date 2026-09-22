import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"
import { geocodeAddress } from "@/lib/geocode"

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
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || ""
    const type = searchParams.get("type")?.trim() || ""
    const commercialId = searchParams.get("commercialId")?.trim() || ""
    const active = searchParams.get("active")?.trim() || ""

    const where: Record<string, unknown> = {}

    if (type === "B2B" || type === "B2C") where.type = type
    if (commercialId) where.commercialId = commercialId
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

    const commercialId =
      body.commercialId?.trim() ||
      (session?.user?.role === "COMMERCIAL" ? session.user.id : null)
    if (commercialId) data.commercialId = commercialId

    const client = await getPrisma().client.create({ data })

    void geocodeAndStore(client.id, client.address, client.city)

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("POST /api/clients error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la création du client" },
      { status: 500 }
    )
  }
}
