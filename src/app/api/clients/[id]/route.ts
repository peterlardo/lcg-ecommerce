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

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const client = await getPrisma().client.findUnique({
      where: { id },
      include: { commercial: { select: { id: true, name: true, email: true } } },
    })
    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    }
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
    if (body.commercialId !== undefined) {
      data.commercialId = body.commercialId?.trim() || null
    }

    const client = await getPrisma().client.update({ where: { id }, data })

    void geocodeAndStore(client.id, client.address, client.city)

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
    await getPrisma().client.delete({ where: { id } })
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
