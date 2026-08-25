import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"

function mapDelivery(delivery: any) {
  return {
    id: delivery.id,
    orderId: delivery.orderId,
    orderNumber: delivery.order?.orderNumber ?? "",
    customer: delivery.order?.customerName ?? "Client",
    phone: delivery.order?.customerPhone ?? "",
    address: delivery.address,
    city: delivery.city,
    district: delivery.district,
    scheduledDate: delivery.scheduledDate?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    agentId: delivery.deliveryAgentId,
    agent: delivery.deliveryAgent?.name ?? "",
    status: delivery.status,
    items: (delivery.order?.items ?? [])
      .map((item: any) => `${item.variant?.product?.name ?? "Produit"} ${item.variant?.format ?? ""} x${item.quantity}`)
      .join(", "),
    total: delivery.order?.total ?? 0,
    notes: delivery.notes ?? "",
    createdAt: delivery.createdAt.toISOString(),
  }
}

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const posFilter = await getUserPointOfSaleIds()
  const role = posFilter?.role

  try {
    const agentFilter = role === "DELIVERY_AGENT" && posFilter
      ? { deliveryAgentId: posFilter.userId }
      : {}

    const [deliveries, agents] = await Promise.all([
      getPrisma().delivery.findMany({
        where: agentFilter,
        include: {
          deliveryAgent: true,
          order: {
            include: {
              items: { include: { variant: { include: { product: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      getPrisma().user.findMany({
        where: { role: "DELIVERY_AGENT", isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ])

    return NextResponse.json({
      deliveries: deliveries.map(mapDelivery),
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name || agent.email,
      })),
    })
  } catch (error) {
    console.error("GET deliveries error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
