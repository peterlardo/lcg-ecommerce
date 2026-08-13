import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function PATCH(request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const { id } = (await context.params) as { id: string }
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.label !== undefined) data.label = String(body.label).trim()
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null
    if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 })
    }

    const profile = await prisma.roleProfile.update({
      where: { id },
      data,
    })

    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: "Impossible de modifier le profil" }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const { id } = (await context.params) as { id: string }

    const profile = await prisma.roleProfile.findUnique({ where: { id } })
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
    }
    if (profile.isSystem) {
      return NextResponse.json({ error: "Impossible de supprimer un rôle système" }, { status: 403 })
    }

    const userCount = await prisma.user.count({ where: { role: profile.key } })
    if (userCount > 0) {
      return NextResponse.json({ error: `Ce rôle est assigné à ${userCount} utilisateur(s). Changez leur rôle d'abord.` }, { status: 409 })
    }

    await prisma.roleProfile.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Impossible de supprimer le profil" }, { status: 400 })
  }
}
