import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma";
import { getReservationById, updateReservationStatus } from "@/data/store"
import { ReservationError, confirmReservation, cancelReservation, rescheduleReservation } from "@/lib/reservation-service"

export async function GET(_req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const { id } = await ctx.params
  const res = await getReservationById(id)
  if (!res) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 })
  }
  return NextResponse.json(res)
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()

    if (body.action === "reschedule") {
      await rescheduleReservation(id, String(body.date || ""), String(body.slot || ""))
      return NextResponse.json({ success: true })
    }

    const { status, pointOfSaleId } = body
    if (!status || !["CONFIRMED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Action non autorisée — seul Confirmer ou Annuler est disponible" }, { status: 400 })
    }

    if (pointOfSaleId !== undefined) {
      await getPrisma().reservation.update({ where: { id }, data: { pointOfSaleId: pointOfSaleId || null } })
    }

    const previous = await getPrisma().reservation.findUnique({ where: { id }, select: { status: true } })
    if (!previous) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 })

    let createdOrder: Awaited<ReturnType<typeof confirmReservation>> | null = null
    if (status === "CONFIRMED" && previous.status === "PENDING") {
      createdOrder = await confirmReservation(id, body.agentId ? String(body.agentId) : null)
    } else if (status === "CANCELLED" && previous.status === "CONFIRMED") {
      await cancelReservation(id)
    }

    await updateReservationStatus(id, status)
    return NextResponse.json({
      success: true,
      orderId: createdOrder?.id,
      orderNumber: createdOrder?.orderNumber,
    })
  } catch (error) {
    if (error instanceof ReservationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Reservation update error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
