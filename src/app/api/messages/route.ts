import { NextResponse } from "next/server"
import { getMessages, addMessage } from "@/data/store"

export async function GET() {
  const messages = getMessages()
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nom, telephone, email, objet, message } = body

    if (!nom || !telephone || !message) {
      return NextResponse.json({ error: "Nom, téléphone et message sont requis" }, { status: 400 })
    }

    const newMsg = addMessage({
      nom,
      telephone,
      email: email || "",
      objet: objet || "Question générale",
      message,
    })

    return NextResponse.json(newMsg, { status: 201 })
  } catch (error) {
    console.error("Message error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
