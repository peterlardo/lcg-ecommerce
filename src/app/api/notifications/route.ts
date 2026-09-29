import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

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

// Une vente de caisse porte le marqueur "Vente comptoir" dans ses notes et la
// source "CAISSE" : elle doit etre notifiee comme une vente, pas comme une commande.
const isCaisseSale = (order: { source: string | null; notes: string | null }) =>
  (order.source || "").toUpperCase() === "CAISSE" || (order.notes || "").startsWith("Vente comptoir")

export async function GET() {
  const forbidden = await requireManagementAccess([
    "ADMIN",
    "STOCK_MANAGER",
    "COMMERCIAL",
    "DELIVERY_AGENT",
  ])
  if (forbidden) return forbidden

  const since = new Date(Date.now() - DAY_MS)
  const prisma = getPrisma()

  const [orders, reservations] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        total: true,
        createdAt: true,
        source: true,
        notes: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      where: { createdAt: { gte: since } },
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
    ...orders.map((order) => {
      const vente = isCaisseSale(order)
      return {
        id: order.id,
        kind: vente ? ("vente" as const) : ("commande" as const),
        orderNumber: order.orderNumber,
        customerName: order.customerName ?? "",
        status: vente ? "SOLD" : order.status,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        source: vente ? "CAISSE" : order.source || "WEB",
        href: vente ? "/admin/ventes" : `/admin/commandes/${order.id}/facture`,
      }
    }),
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
