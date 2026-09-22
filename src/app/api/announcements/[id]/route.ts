import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

const TONES = ["danger", "warning", "info"]
const AUDIENCES = ["ALL", "ROLES", "USERS"]

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await getPrisma().announcement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}

    if (typeof body.message === "string") {
      const message = body.message.trim()
      if (!message) {
        return NextResponse.json({ error: "Le message est obligatoire" }, { status: 400 })
      }
      data.message = message
    }
    if (body.tone !== undefined) data.tone = TONES.includes(body.tone) ? body.tone : "danger"
    if (body.audience !== undefined) data.audience = AUDIENCES.includes(body.audience) ? body.audience : "ALL"
    if (Array.isArray(body.targetRoles)) {
      data.targetRoles = body.targetRoles.filter((r: unknown) => typeof r === "string")
    }
    if (Array.isArray(body.targetUserIds)) {
      data.targetUserIds = body.targetUserIds.filter((u: unknown) => typeof u === "string")
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive

    const updated = await getPrisma().announcement.update({ where: { id }, data })

    return NextResponse.json({
      id: updated.id,
      message: updated.message,
      tone: updated.tone,
      audience: updated.audience,
      targetRoles: updated.targetRoles,
      targetUserIds: updated.targetUserIds,
      startsAt: updated.startsAt.toISOString(),
      expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    })
  } catch (error) {
    console.error("PUT /api/announcements/[id] error:", error)
    return NextResponse.json({ error: "Erreur lors de la mise a jour de l'annonce" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const existing = await getPrisma().announcement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 })
    }

    await getPrisma().announcement.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/announcements/[id] error:", error)
    return NextResponse.json({ error: "Erreur lors de la suppression de l'annonce" }, { status: 500 })
  }
}
