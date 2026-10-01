import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"

const DAY_MS = 24 * 60 * 60 * 1000

interface ReservationRow {
  id: string
  client: string
  status: string
  source: string | null
  createdAt: Date
  itemsJson: string
  orderId: string | null
}

const reservationTotal = (itemsJson: string) => {
  try {
    const items = JSON.parse(itemsJson || "[]") as { quantity?: number; price?: number }[]
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0)
  } catch {
    return 0
  }
}

// Cloche : commandes et pré-commandes des dernières 24 h passées depuis le site vitrine
// (source "WEB", visibles par toute l'équipe) ou saisies depuis un poste de
// l'application (source "OPERATOR", visibles par leur auteur et l'administrateur).
// Exclues : ventes de caisse ("CAISSE") et commandes générées par la confirmation
// d'une pré-commande ("RESERVATION", déjà notifiée comme pré-commande).
const NOTIFIED_SOURCES = ["WEB", "OPERATOR"]
export async function GET() {
  const forbidden = await requireManagementAccess([
    "ADMIN",
    "STOCK_MANAGER",
    "COMMERCIAL",
    "DELIVERY_AGENT",
  ])
  if (forbidden) return forbidden

  const session = await auth()
  const isAdmin = session?.user?.role === "ADMIN"
  const selfId = (session?.user?.id as string | undefined) ?? ""
  // Site vitrine : tout le monde ; poste de l'application : l'auteur (et l'admin).
  const visible = isAdmin
    ? { source: { in: NOTIFIED_SOURCES } }
    : { OR: [{ source: "WEB" }, { source: "OPERATOR", userId: selfId }] }
  const since = new Date(Date.now() - DAY_MS)
  const prisma = getPrisma()

  const [orders, reservations] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        ...visible,
        NOT: { notes: { startsWith: "Vente comptoir" } },
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        total: true,
        createdAt: true,
        source: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      where: { createdAt: { gte: since }, ...visible },
      select: {
        id: true,
        client: true,
        status: true,
        source: true,
        createdAt: true,
        itemsJson: true,
        orderId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  const items = [
    ...orders.map((order) => ({
      id: order.id,
      kind: "commande" as const,
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
      status: order.status,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      source: order.source || "WEB",
      href: `/admin/commandes/${order.id}/facture`,
    })),
    ...reservations.map((reservation: ReservationRow) => ({
      id: `rsv-${reservation.id}`,
      kind: "precommande" as const,
      orderNumber: `PRÉ-${reservation.id.slice(-6).toUpperCase()}`,
      customerName: reservation.client,
      status: reservation.status,
      total: reservationTotal(reservation.itemsJson),
      createdAt: reservation.createdAt.toISOString(),
      source: reservation.source || "WEB",
      href: reservation.orderId
        ? `/admin/commandes/${reservation.orderId}/facture`
        : "/admin/reservations",
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)

  return NextResponse.json(items)
}
