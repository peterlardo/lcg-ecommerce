import { NextResponse } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/mailer"

const resendSchema = z.object({
  email: z.string().email("Email invalide"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = resendSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const { email } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ message: "Si un compte existe avec cet email, un lien a été envoyé." }, { status: 200 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Cet email est déjà vérifié." }, { status: 200 })
    }

    await prisma.verificationToken.deleteMany({ where: { identifier: email } })

    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    await sendVerificationEmail(email, token, baseUrl)

    return NextResponse.json({ message: "Email de vérification renvoyé." }, { status: 200 })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
