import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { getReservations, addReservation, type ReservationItem } from "@/data/store"
import { sendReservationEmail } from "@/lib/mailer"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const posFilter = await getUserPointOfSaleIds()
  const posIds = posFilter?.posIds ?? null

  if (posIds !== null) {
    const rows = await prisma.reservation.findMany({
      where: posIds.length > 0 ? { pointOfSaleId: { in: posIds } } : { pointOfSaleId: { in: [] } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(rows.map((r) => {
      let items: ReservationItem[] = []
      try { items = JSON.parse(r.itemsJson || "[]") } catch { items = [] }
      return { id: r.id, client: r.client, telephone: r.telephone, email: r.email, type: r.type, date: r.date, heure: r.heure, inviteCount: r.inviteCount, address: r.address, items, notes: r.notes, status: r.status, source: r.source, pointOfSaleId: r.pointOfSaleId, orderId: r.orderId, createdAt: r.createdAt.toISOString() }
    }))
  }

  const reservations = await getReservations()
  return NextResponse.json(reservations)
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    const body = await request.json()
    const { client, telephone, email, type, date, heure, inviteCount, address, items, notes, pointOfSaleId } = body

    if (!client || !telephone || !type || !date) {
      return NextResponse.json({ error: "Client, téléphone, type et date sont requis" }, { status: 400 })
    }

    const itemList: ReservationItem[] = Array.isArray(items)
      ? items.map((i: any) => ({
          name: String(i.name ?? ""),
          format: String(i.format ?? ""),
          quantity: Number(i.quantity) || 1,
          price: Number(i.price) || 0,
        }))
      : []

    const source = body.source === "OPERATOR" ? "OPERATOR" : "WEB"

    const newRes = await addReservation({
      userId: session?.user?.id || undefined,
      client,
      telephone,
      email: email || session?.user?.email || "",
      type,
      date,
      heure: heure || "",
      inviteCount: Number(inviteCount) || 0,
      address: address || "",
      items: itemList,
      notes: notes || "",
      source,
    } as any)

    const ref = `RSV-${newRes.id.slice(-6).toUpperCase()}`
    await sendReservationEmail({
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
    })

    return NextResponse.json({ ...newRes, ref }, { status: 201 })
  } catch (error) {
    console.error("Reservation error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

