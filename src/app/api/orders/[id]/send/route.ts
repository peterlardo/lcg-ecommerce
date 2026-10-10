import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isOperateurAccueil } from "@/lib/api-auth"
import { isCashierRole } from "@/lib/permissions"
import { logActivity } from "@/lib/activity"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  const role = session.user.role as string | undefined
  const selfId = session.user.id as string

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const cashierId =
      typeof body?.cashierId === "string" && body.cashierId.trim() ? body.cashierId.trim() : null

    const order = await getPrisma().order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, userId: true },
    })
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })

    const isAdmin = role === "ADMIN"
    const isAuthorOperator = isOperateurAccueil(role) && order.userId === selfId
    if (!isAdmin && !isAuthorOperator) {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 })
    }

    let cashierName: string | null = null
    if (cashierId) {
      const cashier = await getPrisma().user.findUnique({
        where: { id: cashierId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      })
      if (!cashier || !cashier.isActive || !isCashierRole(cashier.role)) {
        return NextResponse.json({ error: "Caissiere introuvable" }, { status: 400 })
      }
      cashierName = cashier.name ?? cashier.email
    }

    const updated = await getPrisma().order.update({
      where: { id },
      data: { cashierId, sentToCashierAt: cashierId ? new Date() : null },
      select: { cashierId: true, sentToCashierAt: true },
    })

    await logActivity({
      module: "commandes",
      action: cashierId ? "Envoi a la caisse" : "Retrait de l'envoi caisse",
      entity: "order",
      entityId: id,
      summary: cashierId
        ? `Commande ${order.orderNumber} transmise a ${cashierName}`
        : `Commande ${order.orderNumber} retiree de la caisse`,
      userId: selfId,
    })

    return NextResponse.json({
      id,
      cashierId: updated.cashierId,
      cashierName,
      sentToCashierAt: updated.sentToCashierAt ? updated.sentToCashierAt.toISOString() : null,
    })
  } catch (error) {
    console.error("POST order send error:", error)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
