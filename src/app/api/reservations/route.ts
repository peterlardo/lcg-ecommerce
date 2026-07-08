import { NextResponse } from "next/server"
import { getReservations, addReservation } from "@/data/store"

export async function GET() {
  const reservations = await getReservations()
  return NextResponse.json(reservations)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { client, telephone, email, type, date, heure, inviteCount, notes } = body

    if (!client || !telephone || !type || !date) {
      return NextResponse.json({ error: "Client, téléphone, type et date sont requis" }, { status: 400 })
    }

    const newRes = await addReservation({
      client,
      telephone,
      email: email || "",
      type,
      date,
      heure: heure || "",
      inviteCount: Number(inviteCount) || 0,
      notes: notes || "",
    })

    return NextResponse.json(newRes, { status: 201 })
  } catch (error) {
    console.error("Reservation error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
