import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const userId = session.user.id as string
  const body = await request.json()

  try {
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) data.name = body.name.trim() || null
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase()
    if (body.phone !== undefined) data.phone = body.phone.trim() || null

    if (body.newPassword && body.currentPassword) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      })

      if (!user?.password) {
        return NextResponse.json(
          { error: "Compte social — modification du mot de passe impossible" },
          { status: 400 }
        )
      }

      const isValid = await bcrypt.compare(body.currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json(
          { error: "Mot de passe actuel incorrect" },
          { status: 400 }
        )
      }

      data.password = await bcrypt.hash(body.newPassword, 12)
    }

    await prisma.user.update({
      where: { id: userId },
      data: data as never,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "Impossible de mettre à jour le profil" },
      { status: 500 }
    )
  }
}
