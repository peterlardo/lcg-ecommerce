import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  context: { params: Promise<unknown> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { id } = (await context.params) as { id: string }
  const userId = session.user.id as string

  const existing = await prisma.address.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 })
  }

  const body = await request.json()

  if (body.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.address.update({
    where: { id },
    data: {
      label: body.label !== undefined ? body.label : undefined,
      street: body.street !== undefined ? body.street : undefined,
      city: body.city !== undefined ? body.city : undefined,
      district: body.district !== undefined ? body.district : undefined,
      isDefault: body.isDefault !== undefined ? body.isDefault : undefined,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<unknown> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { id } = (await context.params) as { id: string }
  const userId = session.user.id as string

  const existing = await prisma.address.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 })
  }

  await prisma.address.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
