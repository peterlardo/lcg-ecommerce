import { NextResponse } from "next/server"
import { getMessages, addMessage } from "@/data/store"
import { requireModuleAccess } from "@/lib/api-auth"

// Lecture réservée au personnel qui a le droit « messages » : ils contiennent noms, téléphones et e-mails.
// L'envoi (POST) reste ouvert : c'est le formulaire de contact du site.
export async function GET() {
  const forbidden = await requireModuleAccess("messages")
  if (forbidden) return forbidden
  const messages = await getMessages()
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nom, telephone, email, objet, message } = body

    if (!nom || !telephone || !message) {
      return NextResponse.json({ error: "Nom, téléphone et message sont requis" }, { status: 400 })
    }

    const newMsg = await addMessage({
      nom,
      telephone,
      email: email || "",
      objet: objet || "Question générale",
      message,
    })

    // Envoi email à contact@lcg.cg
    try {
      const { sendContactMessage } = await import("@/lib/mailer")
      await sendContactMessage({ nom, telephone, email: email || "", objet: objet || "Question générale", message })
    } catch (e) {
      console.error("sendContactMessage import error:", e)
    }

    return NextResponse.json(newMsg, { status: 201 })
  } catch (error) {
    console.error("Message error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
