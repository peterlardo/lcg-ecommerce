import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { isSessionOpen } from "@/lib/device-session"

// Activité par compte : une ligne par compte actif, avec ce qu'il a fait sur la période.
// Réservé à l'ADMIN. Complète le journal d'activité (liste chronologique) par une vue d'ensemble.

/** Brazzaville : UTC+1, sans heure d'été. Les dates choisies à l'écran sont des jours de Brazzaville. */
const TZ = "+01:00"

const latest = (...dates: (Date | null | undefined)[]): Date | null => {
  let max: Date | null = null
  for (const d of dates) if (d && (!max || d > max)) max = d
  return max
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const prisma = getPrisma()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")?.trim() || ""
    const to = searchParams.get("to")?.trim() || ""
    const after = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00${TZ}`) : undefined
    const before = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999${TZ}`) : undefined
    const range = after || before ? { gte: after, lte: before } : undefined
    const created = range ? { createdAt: range } : {}

    const [users, orders, sales, moves, cash, deliveries, logs, logins, lastLogins, sessions] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
      // commandes créées
      prisma.order.groupBy({
        by: ["userId"],
        where: { ...created, userId: { not: null } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      // ventes : vente au comptoir ou commande encaissée ; elle compte pour son auteur ET pour la caissière qui l'a encaissée
      prisma.order.findMany({
        where: {
          AND: [created, { status: { not: "CANCELLED" } }, { OR: [{ notes: { startsWith: "Vente comptoir" } }, { ticketGenerated: true }] }],
        },
        select: { userId: true, cashierId: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      // mouvements de stock hors ventes (production, entrées, sorties, transferts, pertes)
      prisma.stockMovement.groupBy({
        by: ["userId"],
        where: { ...created, userId: { not: null }, NOT: { type: "SALE" } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.cashSession.groupBy({
        by: ["openedById"],
        where: { openedById: { not: null }, ...(range ? { openedAt: range } : {}) },
        _count: { _all: true },
        _max: { openedAt: true },
      }),
      prisma.delivery.findMany({
        where: { deliveredAt: range ?? { not: null }, agent: { userId: { not: null } } },
        select: { deliveredAt: true, agent: { select: { userId: true } } },
        take: 5000,
      }),
      // autres actions journalisées (changements de statut, affectations, modifications…)
      prisma.activityLog.groupBy({
        by: ["userId"],
        where: { ...created, NOT: { module: "auth" } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.loginLog.groupBy({
        by: ["userId"],
        where: { ...created, status: "SUCCESS", userId: { not: null } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      // dernière connexion, toutes périodes confondues
      prisma.loginLog.groupBy({
        by: ["userId"],
        where: { status: "SUCCESS", userId: { not: null } },
        _max: { createdAt: true },
      }),
      prisma.userDeviceSession.findMany({
        where: { isActive: true },
        select: { userId: true, deviceName: true, lastActiveAt: true, isActive: true },
      }),
    ])

    const accounts = users.map((u) => {
      const order = orders.find((r) => r.userId === u.id)
      const own = sales.filter((s) => s.userId === u.id || s.cashierId === u.id)
      const move = moves.find((r) => r.userId === u.id)
      const cashRow = cash.find((r) => r.openedById === u.id)
      const delivered = deliveries.filter((d) => d.agent?.userId === u.id)
      const log = logs.find((r) => r.userId === u.id)
      const login = logins.find((r) => r.userId === u.id)
      const session = sessions.find((s) => s.userId === u.id && isSessionOpen(s))
      const lastActivity = latest(
        order?._max.createdAt,
        own[0]?.createdAt,
        move?._max.createdAt,
        cashRow?._max.openedAt,
        ...delivered.map((d) => d.deliveredAt),
        log?._max.createdAt,
        login?._max.createdAt,
      )
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        online: Boolean(session),
        device: session?.deviceName ?? null,
        lastLoginAt: lastLogins.find((r) => r.userId === u.id)?._max.createdAt?.toISOString() ?? null,
        orders: order?._count._all ?? 0,
        sales: own.length,
        salesAmount: own.reduce((sum, s) => sum + s.total, 0),
        stock: move?._count._all ?? 0,
        cash: cashRow?._count._all ?? 0,
        deliveries: delivered.length,
        actions: log?._count._all ?? 0,
        logins: login?._count._all ?? 0,
        lastActivityAt: lastActivity?.toISOString() ?? null,
      }
    })

    // les comptes les plus récemment actifs d'abord, ceux qui n'ont rien fait en dernier
    accounts.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") || (a.name ?? a.email).localeCompare(b.name ?? b.email))

    return NextResponse.json({
      accounts,
      totals: {
        accounts: accounts.length,
        activeAccounts: accounts.filter((a) => a.lastActivityAt).length,
        online: accounts.filter((a) => a.online).length,
        // une vente n'est comptée qu'une fois ici, même si elle figure chez son auteur et chez la caissière
        sales: sales.length,
        salesAmount: sales.reduce((sum, s) => sum + s.total, 0),
        orders: orders.reduce((sum, r) => sum + r._count._all, 0),
      },
    })
  } catch (error) {
    console.error("GET activite/comptes error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
