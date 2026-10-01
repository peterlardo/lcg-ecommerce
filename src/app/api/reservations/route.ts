import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { addReservation, type ReservationItem } from "@/data/store"
import { sendReservationEmail, sendReservationDevisEmail, buildReservationDevisText, type ReservationMailData } from "@/lib/mailer"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth"
import { resolveDeliveryChoice, DeliveryChoiceError } from "@/lib/delivery"
import { DELIVERY_SLOTS, slotError, slotLabel, todayInBrazzaville } from "@/lib/delivery-slots"
import { reservationRef, reservationTrackingUrl } from "@/lib/reservation-notify"

const PICKUP_PLACE = "97 Rue EWO — site LCG, Brazzaville"

const listInclude = {
  zone: { select: { name: true } },
  order: {
    select: {
      orderNumber: true,
      status: true,
      delivery: { select: { id: true, status: true, agentId: true, failedReason: true, agent: { select: { name: true } } } },
    },
  },
} satisfies Prisma.ReservationInclude

type ReservationRow = Prisma.ReservationGetPayload<{ include: typeof listInclude }>

function mapRow(r: ReservationRow) {
  let items: ReservationItem[] = []
  try { items = JSON.parse(r.itemsJson || "[]") } catch { items = [] }
  return {
    id: r.id, ref: reservationRef(r.id), client: r.client, telephone: r.telephone, email: r.email, type: r.type,
    date: r.date, heure: r.heure, inviteCount: r.inviteCount, address: r.address, items, notes: r.notes,
    status: r.status, source: r.source, pointOfSaleId: r.pointOfSaleId, orderId: r.orderId, userId: r.userId,
    deliveryMode: r.deliveryMode === "PICKUP" ? "PICKUP" : "DELIVERY",
    zoneId: r.zoneId, zoneName: r.zone?.name ?? null, deliveryFee: r.deliveryFee, slot: r.slot, slotLabel: slotLabel(r.slot),
    order: r.order
      ? {
          orderNumber: r.order.orderNumber,
          status: r.order.status,
          delivery: r.order.delivery
            ? { id: r.order.delivery.id, status: r.order.delivery.status, agentId: r.order.delivery.agentId, agent: r.order.delivery.agent?.name ?? null, failedReason: r.order.delivery.failedReason }
            : null,
        }
      : null,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const posFilter = await getUserPointOfSaleIds()
  const posIds = posFilter?.posIds ?? null
  const where: Prisma.ReservationWhereInput =
    posIds !== null ? { pointOfSaleId: { in: posIds } } : {}

  // ?planning=upcoming : toutes les pré-commandes à partir d'aujourd'hui ;
  // ?planning=YYYY-MM-DD : celles d'un jour. Triées par date puis par créneau.
  const planning = new URL(request.url).searchParams.get("planning")
  const day = planning === "upcoming" ? null : planning
  if (planning === "upcoming" || (day && /^\d{4}-\d{2}-\d{2}$/.test(day))) {
    const rows = await getPrisma().reservation.findMany({
      where: { ...where, ...(day ? { date: day } : { date: { gte: todayInBrazzaville() } }), status: { in: ["PENDING", "CONFIRMED"] } },
      include: listInclude,
      orderBy: { createdAt: "asc" },
    })
    const order = (slot: string) => {
      const i = DELIVERY_SLOTS.findIndex((s) => s.id === slot)
      return i === -1 ? DELIVERY_SLOTS.length : i
    }
    return NextResponse.json(rows.map(mapRow).sort((a, b) => a.date.localeCompare(b.date) || order(a.slot) - order(b.slot)))
  }

  const rows = await getPrisma().reservation.findMany({ where, include: listInclude, orderBy: { createdAt: "desc" } })
  return NextResponse.json(rows.map(mapRow))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { client, telephone, email, type, date, inviteCount, address, items, notes } = body
    const slot = String(body.slot || "")

    if (!client || !telephone || !date) {
      return NextResponse.json({ error: "Nom, téléphone et date sont requis" }, { status: 400 })
    }
    const slotProblem = slotError(String(date), slot)
    if (slotProblem) return NextResponse.json({ error: slotProblem }, { status: 400 })

    const itemList: ReservationItem[] = Array.isArray(items)
      ? items.map((i) => ({
          ...(i.productId ? { productId: String(i.productId) } : {}),
          ...(i.variantId ? { variantId: String(i.variantId) } : {}),
          name: String(i.name ?? ""),
          format: String(i.format ?? ""),
          quantity: Math.max(1, Number(i.quantity) || 1),
          price: Math.max(0, Number(i.price) || 0),
        }))
      : []
    if (itemList.length === 0) return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 })

    // Livraison (zone obligatoire, frais calculés ici) ou retrait sur place (gratuit).
    const choice = await resolveDeliveryChoice({ mode: body.deliveryMode, zoneId: body.zoneId })
    const place = choice.mode === "PICKUP" ? PICKUP_PLACE : String(address || "").trim()
    if (choice.mode === "DELIVERY" && !place) {
      return NextResponse.json({ error: "Adresse de livraison requise" }, { status: 400 })
    }

    const source = body.source === "OPERATOR" ? "OPERATOR" : "WEB"
    const operatorId = source === "OPERATOR" ? ((await auth())?.user?.id as string | undefined) ?? null : null

    const newRes = await addReservation({
      userId: operatorId,
      client,
      telephone,
      email: email || "",
      type: type || "Pré-commande de glaçons",
      date: String(date),
      heure: slotLabel(slot),
      inviteCount: Number(inviteCount) || 0,
      address: choice.mode === "DELIVERY" && choice.zoneName ? `${place} (${choice.zoneName})` : place,
      items: itemList,
      notes: notes || "",
      source,
      deliveryMode: choice.mode,
      zoneId: choice.zoneId,
      deliveryFee: choice.fee,
      slot,
    })

    const ref = reservationRef(newRes.id)
    const trackingUrl = reservationTrackingUrl(newRes.id)
    const subtotal = itemList.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const mailData: ReservationMailData = {
      ref,
      createdAt: newRes.createdAt,
      client: newRes.client,
      telephone: newRes.telephone,
      email: newRes.email,
      type: newRes.type,
      date: newRes.date,
      heure: newRes.heure,
      address: newRes.address,
      source: newRes.source,
      notes: newRes.notes,
      items: itemList,
      deliveryFee: choice.fee,
      total: subtotal + choice.fee,
      trackingUrl,
    }
    await sendReservationEmail(mailData)
    await sendReservationDevisEmail(mailData)
    sendWhatsAppMessage(newRes.telephone, buildReservationDevisText(mailData)).catch(() => {})

    return NextResponse.json({ ...newRes, ref, trackingUrl }, { status: 201 })
  } catch (error) {
    if (error instanceof DeliveryChoiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Reservation error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
