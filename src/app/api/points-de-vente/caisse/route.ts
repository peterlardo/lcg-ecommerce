import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  const pointOfSaleId = new URL(request.url).searchParams.get("pointOfSaleId")
  const sessions = await prisma.cashSession.findMany({ where: pointOfSaleId ? { pointOfSaleId } : undefined, include: { pointOfSale: { select: { name: true, code: true } } }, orderBy: { openedAt: "desc" }, take: 50 })
  return NextResponse.json(sessions)
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden
  try {
    const body = await request.json()
    const pointOfSaleId = String(body.pointOfSaleId || "")
    const open = await prisma.cashSession.findFirst({ where: { pointOfSaleId, status: "OPEN" } })
    if (open) return NextResponse.json({ error: "Une caisse est déjà ouverte pour ce point de vente" }, { status: 409 })
    const session = await prisma.cashSession.create({ data: { pointOfSaleId, openingBalance: Math.max(0, Number(body.openingBalance) || 0) } })
    return NextResponse.json(session, { status: 201 })
  } catch { return NextResponse.json({ error: "Impossible d’ouvrir la caisse" }, { status: 400 }) }
}

export async function PATCH(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden
  try {
    const body = await request.json()
    const session = await prisma.cashSession.update({ where: { id: String(body.id) }, data: { status: "CLOSED", closedAt: new Date(), closingBalance: Math.max(0, Number(body.closingBalance) || 0) } })
    return NextResponse.json(session)
  } catch { return NextResponse.json({ error: "Impossible de fermer la caisse" }, { status: 400 }) }
}
