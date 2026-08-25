import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma";

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

  const existing = await getPrisma().address.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 })
  }

  const body = await request.json()

  if (body.isDefault) {
    await getPrisma().address.updateMany({
      where: { userId },
      data: { isDefault: false },
    })
  }

  const updated = await getPrisma().address.update({
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

  const existing = await getPrisma().address.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 })
  }

  await getPrisma().address.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
