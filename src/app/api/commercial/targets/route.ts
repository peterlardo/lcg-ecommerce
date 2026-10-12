import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { currentMonth } from "@/lib/commercial"

export const dynamic = "force-dynamic"

/** Lecture : le commercial voit son objectif, le comptable consulte. Écriture : l'administrateur fixe les objectifs. */
const READ_ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE"]

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** Objectifs mensuels des commerciaux pour un mois (« AAAA-MM », mois en cours par défaut). */
export async function GET(req: Request) {
  const forbidden = await requireManagementAccess(READ_ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const params = new URL(req.url).searchParams
    const month = params.get("month") || params.get("yearMonth") || currentMonth().yearMonth
    if (!YEAR_MONTH.test(month)) return NextResponse.json({ error: "Mois invalide (format AAAA-MM)" }, { status: 400 })

    const targets = await getPrisma().commercialTarget.findMany({
      // un commercial ne lit que le sien
      where: { yearMonth: month, ...(session?.user?.role === "COMMERCIAL" ? { userId: session.user.id } : {}) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    })
    return NextResponse.json({
      month,
      targets: targets.map((t) => ({ userId: t.userId, userName: t.user.name, yearMonth: t.yearMonth, targetAmount: t.targetAmount })),
    })
  } catch (error) {
    console.error("GET commercial/targets error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}

/** Fixe (ou remplace) l'objectif d'un commercial pour un mois. Réservé à l'administrateur. */
export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const selfId = session?.user?.id
    if (!selfId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
    }

    const userId = body.userId ? String(body.userId) : ""
    const yearMonth = body.yearMonth ? String(body.yearMonth) : currentMonth().yearMonth
    const targetAmount = Number(body.targetAmount)
    if (!YEAR_MONTH.test(yearMonth)) return NextResponse.json({ error: "Mois invalide (format AAAA-MM)" }, { status: 400 })
    if (body.targetAmount === undefined || body.targetAmount === null || body.targetAmount === "" || !Number.isFinite(targetAmount) || targetAmount < 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
    }

    const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } })
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    if (user.role !== "COMMERCIAL") return NextResponse.json({ error: "Seul un responsable commercial peut avoir un objectif" }, { status: 400 })

    const target = await getPrisma().commercialTarget.upsert({
      where: { userId_yearMonth: { userId, yearMonth } },
      update: { targetAmount },
      create: { userId, yearMonth, targetAmount, createdById: selfId },
    })
    await logActivity({
      module: "commercial",
      action: "Objectif",
      entity: "user",
      entityId: userId,
      summary: `Objectif mensuel ${yearMonth} de ${user.name ?? "commercial"} : ${targetAmount}`,
    })
    return NextResponse.json({ target: { userId, yearMonth, targetAmount: target.targetAmount } }, { status: 201 })
  } catch (error) {
    console.error("POST commercial/targets error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
