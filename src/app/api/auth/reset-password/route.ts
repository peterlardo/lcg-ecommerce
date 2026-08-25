import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getPrisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 })
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 })
    }

    const resetToken = await getPrisma().passwordResetToken.findUnique({ where: { token } })

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Lien invalide ou expiré. Veuillez demander un nouveau lien." }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await getPrisma().user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    })

    // Delete the used token and any other tokens for this user
    await getPrisma().passwordResetToken.deleteMany({ where: { userId: resetToken.userId } })

    return NextResponse.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter." })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
