import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, seesAllOrders } from "@/lib/api-auth"
import { CASHIER_ROLES } from "@/lib/permissions"
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
// (source "WEB", visibles par toute l'équipe), saisies depuis un poste de
// l'application (source "OPERATOR", visibles par leur auteur et l'administrateur)
// ou ventes de caisse (source "CAISSE", visibles par leur auteur et l'administrateur).
// Exclues : commandes générées par la confirmation d'une pré-commande
// ("RESERVATION", déjà notifiée comme pré-commande).
const NOTIFIED_SOURCES = ["WEB", "OPERATOR", "CAISSE"]
export async function GET() {
  const forbidden = await requireManagementAccess([
    "ADMIN",
    "STOCK_MANAGER",
    "COMMERCIAL",
    "DELIVERY_AGENT",
    "COMPTABLE",
    "OPERATEUR_ACCUEIL",
    ...CASHIER_ROLES,
  ])
  if (forbidden) return forbidden

  const session = await auth()
  const seesAll = seesAllOrders(session?.user?.role)
  const isComptableRole = session?.user?.role === "COMPTABLE"
  const selfId = (session?.user?.id as string | undefined) ?? ""
  // Site vitrine : tout le monde ; poste de l'application et caisse : l'auteur (et l'admin) ;
  // commande transmise par l'opérateur : la caissière ciblée (et l'admin).
  const orderVisible = seesAll
    ? { source: { in: NOTIFIED_SOURCES } }
    : {
        OR: [
          { source: "WEB" },
          { source: "OPERATOR", userId: selfId },
          { source: "CAISSE", userId: selfId },
          { cashierId: selfId },
        ],
      }
  // Les pré-commandes ne portent pas de caissière ciblée.
  const reservationVisible = seesAll
    ? { source: { in: NOTIFIED_SOURCES } }
    : { OR: [{ source: "WEB" }, { source: "OPERATOR", userId: selfId }, { source: "CAISSE", userId: selfId }] }
  const since = new Date(Date.now() - DAY_MS)
  const prisma = getPrisma()

  // Rappels (demande du 2026-10-24) : la veille, livraisons prévues le lendemain (heure de Brazzaville)
  // et pas encore parties. L'administrateur et les profils qui voient tout reçoivent toutes les commandes ;
  // les autres, celles qu'ils voient déjà dans la cloche.
  const tomorrow = new Date(Date.now() + DAY_MS).toLocaleDateString("fr-CA", { timeZone: "Africa/Brazzaville" })
  const tomorrowStart = new Date(`${tomorrow}T00:00:00+01:00`)
  const tomorrowEnd = new Date(tomorrowStart.getTime() + DAY_MS)

  const [orders, reservations, reminders] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        ...orderVisible,
        // Filtre strict B2B : le comptable n'est notifié que des commandes
        // rattachées à un client B2B.
        ...(isComptableRole ? { b2bClientId: { not: null } } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        cashier: { select: { name: true } },
        user: { select: { name: true } },
        status: true,
        total: true,
        createdAt: true,
        source: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      // Les pré-commandes ne portent pas de lien client B2B : hors périmètre.
      where: isComptableRole
        ? { id: { in: [] } }
        : { createdAt: { gte: since }, ...reservationVisible },
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
    prisma.order.findMany({
      where: {
        delivery: { scheduledDate: { gte: tomorrowStart, lt: tomorrowEnd } },
        status: { notIn: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] },
        ...(seesAll ? {} : orderVisible),
        ...(isComptableRole ? { b2bClientId: { not: null } } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        total: true,
        source: true,
        delivery: { select: { scheduledDate: true, mode: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ])

  const reminderItems = reminders.map((order) => ({
    // un identifiant par jour : le rappel sonne une fois, la veille
    id: `rappel-${order.id}-${tomorrow}`,
    kind: "rappel" as const,
    orderNumber: order.orderNumber,
    customerName: order.customerName ?? "",
    status: order.status,
    total: order.total,
    createdAt: new Date().toISOString(),
    scheduledDate: order.delivery?.scheduledDate?.toISOString() ?? null,
    pickup: order.delivery?.mode === "PICKUP",
    source: order.source || "WEB",
    href: `/admin/commandes/${order.id}/facture`,
  }))

  const items = [
    ...orders.map((order) => ({
      id: order.id,
      kind: "commande" as const,
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? "",
      cashierName: order.cashier?.name ?? "",
      userName: order.user?.name ?? "",
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

  // les rappels restent en tête de la cloche toute la journée
  return NextResponse.json([...reminderItems, ...items])
}
