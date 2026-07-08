import { NextResponse } from "next/server"
import { getReservationById, updateReservationStatus } from "@/data/store"

export async function GET(_req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const { id } = await ctx.params
  const res = await getReservationById(id)
  if (!res) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 })
  }
  return NextResponse.json(res)
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { status } = body

    if (!status || !["PENDING", "CONFIRMED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const success = await updateReservationStatus(id, status)
    if (!success) {
      return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reservation update error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
