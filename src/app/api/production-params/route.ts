import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

const DEFAULT_PARAMS = [
  { name: "Sachet 1kg", code: "S1", unit: "Sachets", weightKg: 1, dailyObjective: 600 },
  { name: "Sachet 2kg", code: "S2", unit: "Sachets", weightKg: 2, dailyObjective: 400 },
  { name: "Sachet 5kg", code: "S5", unit: "Sachets", weightKg: 5, dailyObjective: 200 },
  { name: "Sac 10kg", code: "S10", unit: "Sacs", weightKg: 10, dailyObjective: 80 },
  { name: "Bloc de glace", code: "BL", unit: "Unités", weightKg: 0, dailyObjective: 50 },
  { name: "Barre de glace", code: "BR", unit: "Unités", weightKg: 0, dailyObjective: 20 },
  { name: "Glaçons en vrac", code: "VR", unit: "Kg", weightKg: 1, dailyObjective: 100 },
]

export async function GET() {
  const forbidden = await requireManagementAccess(undefined, [["production"], "view"])
  if (forbidden) return forbidden

  const prisma = await getPrisma()
  let params = await prisma.productionParam.findMany({ orderBy: { sortOrder: "asc" } })
  if (params.length === 0) {
    await prisma.productionParam.createMany({
      data: DEFAULT_PARAMS.map((p, i) => ({ ...p, sortOrder: i + 1 })),
    })
    params = await prisma.productionParam.findMany({ orderBy: { sortOrder: "asc" } })
  }
  return NextResponse.json({ params })
}

export async function PUT(request: Request) {
  const forbidden = await requireManagementAccess(undefined, [["production"], "create"])
  if (forbidden) return forbidden

  const prisma = await getPrisma()
  try {
    const body = await request.json()
    const list = Array.isArray(body?.params) ? body.params : null
    if (!list) return NextResponse.json({ error: "params requis" }, { status: 400 })

    for (const p of list) {
      if (!p?.name || !p?.code) return NextResponse.json({ error: "Chaque produit doit avoir un nom et un code." }, { status: 400 })
      if (p.dailyObjective != null && (typeof p.dailyObjective !== "number" || p.dailyObjective < 0))
        return NextResponse.json({ error: "Objectif invalide." }, { status: 400 })
    }

    const keepIds: string[] = []
    for (const [i, p] of list.entries()) {
      const data = {
        name: String(p.name).trim(),
        code: String(p.code).trim(),
        unit: p.unit ? String(p.unit).trim() : "Kg",
        weightKg: Number(p.weightKg) || 0,
        dailyObjective: Math.max(0, Math.trunc(Number(p.dailyObjective) || 0)),
        sortOrder: i + 1,
      }
      const row = p.id
        ? await prisma.productionParam.update({ where: { id: p.id }, data }).catch(() => null)
        : await prisma.productionParam.create({ data })
      if (!row) {
        const existing = await prisma.productionParam.findUnique({ where: { code: data.code } })
        if (existing) keepIds.push(existing.id)
        else return NextResponse.json({ error: "Code produit déjà utilisé." }, { status: 409 })
      } else {
        keepIds.push(row.id)
      }
    }
    await prisma.productionParam.deleteMany({ where: { id: { notIn: keepIds } } })

    const params = await prisma.productionParam.findMany({ orderBy: { sortOrder: "asc" } })
    return NextResponse.json({ params })
  } catch (error) {
    console.error("production-params PUT", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
