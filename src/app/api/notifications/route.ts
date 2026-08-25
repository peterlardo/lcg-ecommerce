import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const since = new Date(Date.now() - 5 * 60 * 1000)

  const orders = await getPrisma().order.findMany({
    where: { createdAt: { gte: since } },
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
  })

  return NextResponse.json(orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName ?? "",
    status: o.status,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    source: o.source || "WEB",
  })))
}
