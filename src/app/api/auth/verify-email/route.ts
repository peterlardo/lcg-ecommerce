import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.redirect(new URL("/auth/verification?error=missing", request.url))
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(new URL("/auth/verification?error=invalid", request.url))
    }

    if (new Date() > verificationToken.expires) {
      await prisma.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL("/auth/verification?error=expired", request.url))
    }

    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
    })

    if (!user) {
      return NextResponse.redirect(new URL("/auth/verification?error=invalid", request.url))
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })

    await prisma.verificationToken.delete({ where: { token } })

    return NextResponse.redirect(new URL("/auth/verification?success=1", request.url))
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.redirect(new URL("/auth/verification?error=server", request.url))
  }
}
