import { NextResponse } from "next/server"
import type { Prisma, DeliveryStatus } from "@prisma/client"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"

const ACTIVE_STATUSES: DeliveryStatus[] = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"]

type DeliveryWithRelations = Prisma.DeliveryGetPayload<{
  include: {
    agent: true
    zone: true
    order: {
      include: {
        items: { include: { variant: { include: { product: true } } } }
      }
    }
  }
}>

function mapDelivery(delivery: DeliveryWithRelations) {
  return {
    id: delivery.id,
    orderId: delivery.orderId,
    orderNumber: delivery.order?.orderNumber ?? "",
    customer: delivery.order?.customerName ?? "Client",
    phone: delivery.order?.customerPhone ?? "",
    address: delivery.address,
    city: delivery.city,
    district: delivery.district,
    mode: delivery.mode,
    fee: delivery.fee,
    zoneId: delivery.zoneId,
    zone: delivery.zone?.name ?? "",
    scheduledDate: delivery.scheduledDate?.toISOString() ?? null,
    assignedAt: delivery.assignedAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    failedReason: delivery.failedReason ?? "",
    agentId: delivery.agentId,
    agent: delivery.agent?.name ?? "",
    agentKind: delivery.agent?.kind ?? "",
    status: delivery.status,
    items: (delivery.order?.items ?? [])
      .map((item) => `${item.variant?.product?.name ?? "Produit"} ${item.variant?.format ?? ""} x${item.quantity}`)
      .join(", "),
    total: delivery.order?.total ?? 0,
    notes: delivery.notes ?? "",
    createdAt: delivery.createdAt.toISOString(),
  }
}

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const prisma = getPrisma()
    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const mode = url.searchParams.get("mode")
    const agentId = url.searchParams.get("agentId")
    const zoneId = url.searchParams.get("zoneId")
    const q = (url.searchParams.get("q") || "").trim()
    const date = url.searchParams.get("date")

    const posFilter = await getUserPointOfSaleIds()
    const role = posFilter?.role

    const where: Prisma.DeliveryWhereInput = {}

    if (role === "DELIVERY_AGENT") {
      const own = posFilter
        ? await prisma.deliveryAgent.findFirst({ where: { userId: posFilter.userId }, select: { id: true } })
        : null
      where.agentId = own?.id ?? "__none__"
    } else if (agentId) {
      where.agentId = agentId === "none" ? null : agentId
    }

    if (status && status !== "ALL") where.status = status as Prisma.DeliveryWhereInput["status"]
    if (mode && mode !== "ALL") where.mode = mode as Prisma.DeliveryWhereInput["mode"]
    if (zoneId && zoneId !== "ALL") where.zoneId = zoneId === "none" ? null : zoneId

    if (date) {
      const day = new Date(`${date}T00:00:00.000Z`)
      if (!Number.isNaN(day.getTime())) {
        const end = new Date(day.getTime() + 24 * 60 * 60 * 1000)
        where.scheduledDate = { gte: day, lt: end }
      }
    }

    if (q) {
      where.OR = [
        { order: { orderNumber: { contains: q, mode: "insensitive" } } },
        { order: { customerName: { contains: q, mode: "insensitive" } } },
        { address: { contains: q, mode: "insensitive" } },
        { district: { contains: q, mode: "insensitive" } },
      ]
    }

    const [deliveries, agents, zones, statusCounts, pickupCount] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: {
          agent: true,
          zone: true,
          order: {
            include: {
              items: { include: { variant: { include: { product: true } } } },
            },
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
        take: 400,
      }),
      prisma.deliveryAgent.findMany({
        where: { isActive: true },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        select: { id: true, name: true, kind: true, companyName: true, isAvailable: true, vehicle: true },
      }),
      prisma.deliveryZone.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, baseFee: true, isActive: true },
      }),
      prisma.delivery.groupBy({
        by: ["status"],
        where: { status: { in: ACTIVE_STATUSES } },
        _count: { _all: true },
      }),
      prisma.delivery.count({ where: { mode: "PICKUP", status: { not: "DELIVERED" } } }),
    ])

    const counts = Object.fromEntries(ACTIVE_STATUSES.map((s) => [s, 0])) as Record<string, number>
    for (const row of statusCounts) counts[row.status] = row._count?._all ?? 0

    return NextResponse.json({
      deliveries: deliveries.map(mapDelivery),
      agents,
      zones,
      counts,
      pendingPickups: pickupCount,
    })
  } catch (error) {
    console.error("GET deliveries error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
