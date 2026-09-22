import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || ""

    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ]
    }

    const users = await getPrisma().user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("GET /api/users error:", error)
    return NextResponse.json({ error: "Erreur lors du chargement des utilisateurs" }, { status: 500 })
  }
}
