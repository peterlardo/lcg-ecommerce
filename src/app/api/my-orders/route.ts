import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const userId = session.user.id as string
  const email = session.user.email ?? undefined

  const [orders, reservations] = await Promise.all([
    getPrisma().order.findMany({
      where: {
        OR: [
          { userId },
          ...(email ? [{ customerEmail: email }] : []),
        ],
      },
      include: {
        items: {
          include: { variant: { include: { product: true } } },
        },
        delivery: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getPrisma().reservation.findMany({
      where: {
        OR: [
          { userId },
          ...(email ? [{ email }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const mappedOrders = orders.map((o) => ({
    type: "order" as const,
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      name: i.variant?.product?.name ?? "Produit",
      format: i.variant?.format ?? "",
      quantity: i.quantity,
      price: i.price,
      total: i.total,
    })),
    delivery: o.delivery
      ? {
          status: o.delivery.status,
          address: o.delivery.address,
          city: o.delivery.city,
          scheduledDate: o.delivery.scheduledDate?.toISOString() ?? null,
          deliveredAt: o.delivery.deliveredAt?.toISOString() ?? null,
        }
      : null,
  }))

  const mappedReservations = reservations.map((r) => {
    let items: { name: string; format: string; quantity: number; price: number }[] = []
    try {
      items = JSON.parse(r.itemsJson || "[]")
    } catch { /* empty */ }
    const itemTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      type: "reservation" as const,
      id: r.id,
      orderNumber: `RSV-${r.id.slice(-6).toUpperCase()}`,
      status: r.status,
      subtotal: itemTotal,
      deliveryFee: 0,
      total: itemTotal,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      client: r.client,
      telephone: r.telephone,
      eventDate: r.date,
      eventTime: r.heure,
      items,
      delivery: null,
    }
  })

  const all = [...mappedOrders, ...mappedReservations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return NextResponse.json(all)
}
