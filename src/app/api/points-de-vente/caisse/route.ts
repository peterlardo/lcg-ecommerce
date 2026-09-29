import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  const { searchParams } = new URL(request.url)
  const pointOfSaleId = searchParams.get("pointOfSaleId")
  const userId = searchParams.get("userId")
  const mine = searchParams.get("mine") === "1"
  const session = await auth()
  const effectiveUserId = mine ? (session?.user?.id ?? undefined) : (userId || undefined)

  const sessions = await getPrisma().cashSession.findMany({
    where: {
      ...(pointOfSaleId ? { pointOfSaleId } : {}),
      ...(effectiveUserId ? { openedById: effectiveUserId } : {}),
    },
    include: {
      pointOfSale: { select: { name: true, code: true } },
      openedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { openedAt: "desc" },
    take: 50,
  })
  return NextResponse.json(sessions)
}

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden
  try {
    const authSession = await auth()
    const openedById = authSession?.user?.id ?? null
    if (!openedById) return NextResponse.json({ error: "Session utilisateur introuvable" }, { status: 401 })

    const body = await request.json()
    const pointOfSaleId = String(body.pointOfSaleId || "")
    if (!pointOfSaleId) return NextResponse.json({ error: "Point de vente requis" }, { status: 400 })

    // Une session de caisse est strictement personnelle : un seul point de
    // caisse ouvert par utilisateur, quel que soit le point de vente.
    const open = await getPrisma().cashSession.findFirst({ where: { openedById, status: "OPEN" } })
    if (open) {
      return NextResponse.json(
        { error: "Vous avez déjà une caisse ouverte. Fermez-la avant d'en ouvrir une nouvelle." },
        { status: 409 },
      )
    }

    const openingBalance = Math.max(0, Number(body.openingBalance) || 0)

    const session = await getPrisma().$transaction(async (tx) => {
      const conflict = await tx.cashSession.findFirst({ where: { openedById, status: "OPEN" } })
      if (conflict) throw new Error("SESSION_DEJA_OUVERTE")

      return tx.cashSession.create({
        data: { pointOfSaleId, openedById, openingBalance },
      })
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "SESSION_DEJA_OUVERTE") return null
      throw error
    })

    if (!session) {
      return NextResponse.json(
        { error: "Vous avez déjà une caisse ouverte. Fermez-la avant d'en ouvrir une nouvelle." },
        { status: 409 },
      )
    }

    return NextResponse.json(session, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Impossible d’ouvrir la caisse" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden
  try {
    const authSession = await auth()
    const currentUserId = authSession?.user?.id ?? null
    const isAdmin = authSession?.user?.role === "ADMIN"

    const body = await request.json()
    const id = String(body.id || "")
    const current = await getPrisma().cashSession.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: "Session de caisse introuvable" }, { status: 404 })
    if (current.status !== "OPEN") return NextResponse.json({ error: "Cette caisse est déjà fermée" }, { status: 409 })
    // Chaque session appartient a son proprietaire : seul lui (ou un admin) la cloture.
    if (current.openedById && current.openedById !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Cette caisse appartient à un autre utilisateur" }, { status: 403 })
    }
    // Le rapport de cloture est obligatoire : il retrace les transactions et les
    // quantites vendues de la journee avant que la caisse ne soit fermee.
    if (!current.reportGeneratedAt) {
      return NextResponse.json(
        { error: "Générez le rapport de clôture avant de fermer la caisse." },
        { status: 409 },
      )
    }

    const session = await getPrisma().cashSession.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance: Math.max(0, Number(body.closingBalance) || 0),
      },
    })

    return NextResponse.json(session)
  } catch {
    return NextResponse.json({ error: "Impossible de fermer la caisse" }, { status: 400 })
  }
}
