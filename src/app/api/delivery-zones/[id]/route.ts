import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/api-auth"

export async function PATCH(req: Request, ctx: RouteContext<"/api/delivery-zones/[id]">) {
  const forbidden = await requireModuleAccess("livraisons", "edit")
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()

    const zone = await getPrisma().deliveryZone.findUnique({ where: { id } })
    if (!zone) return NextResponse.json({ error: "Zone introuvable" }, { status: 404 })

    const data: { name?: string; baseFee?: number; isActive?: boolean; sortOrder?: number } = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: "Nom de zone requis" }, { status: 400 })
      if (name !== zone.name) {
        const dup = await getPrisma().deliveryZone.findUnique({ where: { name } })
        if (dup) return NextResponse.json({ error: "Une zone porte déjà ce nom" }, { status: 409 })
      }
      data.name = name
    }
    if (body.baseFee !== undefined) data.baseFee = Math.max(0, Number(body.baseFee) || 0)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0

    const updated = await getPrisma().deliveryZone.update({ where: { id }, data })
    return NextResponse.json({ zone: updated })
  } catch (error) {
    console.error("PATCH delivery-zone error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/delivery-zones/[id]">) {
  const forbidden = await requireModuleAccess("livraisons", "delete")
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const zone = await getPrisma().deliveryZone.findUnique({
      where: { id },
      include: { _count: { select: { deliveries: true } } },
    })
    if (!zone) return NextResponse.json({ error: "Zone introuvable" }, { status: 404 })
    if (zone._count.deliveries > 0) {
      return NextResponse.json(
        { error: `Impossible : ${zone._count.deliveries} livraison(s) référencent cette zone. Désactivez-la plutôt.` },
        { status: 409 }
      )
    }

    await getPrisma().deliveryZone.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE delivery-zone error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
