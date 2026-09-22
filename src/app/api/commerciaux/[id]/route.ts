import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await (await import("@/lib/auth")).auth()
  const role = session?.user?.role as string | undefined
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }
  if (role !== "ADMIN" && session.user.id !== (await params).id) {
    return NextResponse.json({ error: "Acces non autorise" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (typeof body.operationZone === "string") data.operationZone = body.operationZone.trim() || null
    if (body.zoneLat !== undefined) {
      const v = Number(body.zoneLat)
      data.zoneLat = body.zoneLat === "" || Number.isNaN(v) ? null : v
    }
    if (body.zoneLng !== undefined) {
      const v = Number(body.zoneLng)
      data.zoneLng = body.zoneLng === "" || Number.isNaN(v) ? null : v
    }
    if (body.zoneRadiusKm !== undefined) {
      const v = Number(body.zoneRadiusKm)
      data.zoneRadiusKm = Number.isNaN(v) || v <= 0 ? 10 : v
    }

    const user = await getPrisma().user.update({ where: { id }, data })
    return NextResponse.json({
      id: user.id,
      operationZone: user.operationZone,
      zoneLat: user.zoneLat,
      zoneLng: user.zoneLng,
      zoneRadiusKm: user.zoneRadiusKm,
    })
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Commercial introuvable" }, { status: 404 })
    }
    console.error("PATCH /api/commerciaux/[id] error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
