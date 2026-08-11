import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { addressSchema } from "@/lib/validations"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id as string },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(addresses)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = addressSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const userId = session.user.id as string

    if (parsed.data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.create({
      data: {
        userId,
        label: parsed.data.label || null,
        street: parsed.data.street,
        city: parsed.data.city,
        district: parsed.data.district || null,
        isDefault: parsed.data.isDefault ?? false,
      },
    })

    return NextResponse.json(address, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Impossible de créer l'adresse" },
      { status: 500 }
    )
  }
}
