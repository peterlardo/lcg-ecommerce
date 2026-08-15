import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const { isTyping } = await request.json() as { isTyping: boolean }

    await prisma.chatPresence.upsert({
      where: { userId: session.user.id },
      update: { lastSeen: new Date(), isTyping: isTyping ?? true },
      create: { userId: session.user.id, lastSeen: new Date(), isTyping: isTyping ?? true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Chat typing error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
