import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const profiles = await getPrisma().roleProfile.findMany({
      orderBy: { createdAt: "asc" },
    })

    const rolesWithCount = await Promise.all(
      profiles.map(async (p) => {
        const count = await getPrisma().user.count({ where: { role: p.key } })
        return { ...p, userCount: count }
      })
    )

    return NextResponse.json(rolesWithCount)
  } catch (error) {
    console.error("GET role-profiles error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const key = String(body.key || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
    const label = String(body.label || "").trim()
    const description = body.description ? String(body.description).trim() : null
    const color = body.color ? String(body.color).trim() : null

    if (!key || !label) {
      return NextResponse.json({ error: "Clé et libellé sont requis" }, { status: 400 })
    }

    const existing = await getPrisma().roleProfile.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json({ error: "Ce rôle existe déjà" }, { status: 409 })
    }

    const profile = await getPrisma().roleProfile.create({
      data: { key, label, description, color },
    })

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error("POST role-profiles error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
