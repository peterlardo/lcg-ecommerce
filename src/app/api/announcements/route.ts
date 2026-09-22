import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { requireManagementAccess } from "@/lib/api-auth"

const TONES = ["danger", "warning", "info"]
const AUDIENCES = ["ALL", "ROLES", "USERS"]

function byNow(now: Date) {
  return {
    isActive: true,
    startsAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get("scope")

  // Admin: full list (active + expired) regardless of audience
  if (scope === "admin") {
    const forbidden = await requireManagementAccess(["ADMIN"])
    if (forbidden) return forbidden

    const all = await getPrisma().announcement.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(
      all.map((a) => ({
        id: a.id,
        message: a.message,
        tone: a.tone,
        audience: a.audience,
        targetRoles: a.targetRoles,
        targetUserIds: a.targetUserIds,
        startsAt: a.startsAt.toISOString(),
        expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
        isActive: a.isActive,
        createdAt: a.createdAt.toISOString(),
      }))
    )
  }

  // Connected user: only announcements visible to them
  const now = new Date()
  const announcements = await getPrisma().announcement.findMany({
    where: byNow(now),
    orderBy: { createdAt: "desc" },
  })

  const visible = announcements.filter((a) => {
    if (a.audience === "ALL") return true
    if (a.audience === "ROLES") return a.targetRoles.includes(session.user.role)
    if (a.audience === "USERS") return a.targetUserIds.includes(session.user.id)
    return false
  })

  return NextResponse.json(
    visible.map((a) => ({
      id: a.id,
      message: a.message,
      tone: a.tone,
      expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    }))
  )
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const body = await request.json()

    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message) {
      return NextResponse.json({ error: "Le message est obligatoire" }, { status: 400 })
    }

    const tone = TONES.includes(body.tone) ? body.tone : "danger"
    const audience = AUDIENCES.includes(body.audience) ? body.audience : "ALL"

    const targetRoles = Array.isArray(body.targetRoles)
      ? body.targetRoles.filter((r: unknown) => typeof r === "string")
      : []
    const targetUserIds = Array.isArray(body.targetUserIds)
      ? body.targetUserIds.filter((u: unknown) => typeof u === "string")
      : []

    let expiresAt: Date | null = null
    if (body.expiresAt) {
      const parsed = new Date(body.expiresAt)
      if (!isNaN(parsed.getTime())) expiresAt = parsed
    }
    if (!expiresAt) {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    const announcement = await getPrisma().announcement.create({
      data: {
        message,
        tone,
        audience,
        targetRoles,
        targetUserIds,
        expiresAt,
        createdById: session?.user?.id ?? null,
      },
    })

    return NextResponse.json(
      {
        id: announcement.id,
        message: announcement.message,
        tone: announcement.tone,
        audience: announcement.audience,
        targetRoles: announcement.targetRoles,
        targetUserIds: announcement.targetUserIds,
        startsAt: announcement.startsAt.toISOString(),
        expiresAt: announcement.expiresAt ? announcement.expiresAt.toISOString() : null,
        isActive: announcement.isActive,
        createdAt: announcement.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/announcements error:", error)
    return NextResponse.json({ error: "Erreur lors de la publication de l'annonce" }, { status: 500 })
  }
}
