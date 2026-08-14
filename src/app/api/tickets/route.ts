import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const posFilter = await getUserPointOfSaleIds()
  const posIds = posFilter?.posIds ?? null

  const tickets = await prisma.order.findMany({
    where: {
      OR: [
        { notes: { startsWith: "Vente comptoir" } },
        { ticketGenerated: true },
      ],
      ...(posIds !== null ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } } : {}),
    },
    include: { pointOfSale: { select: { name: true, code: true } }, items: { include: { variant: { include: { product: true } } } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(tickets.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.orderNumber,
    customerName: ticket.customerName || "Client comptoir",
    paymentMethod: ticket.paymentMethod,
    paymentStatus: ticket.paymentStatus,
    total: ticket.total,
    createdAt: ticket.createdAt.toISOString(),
    notes: ticket.notes,
    pointOfSale: ticket.pointOfSale,
    items: ticket.items.map((item) => ({ name: item.variant.product.name, format: item.variant.format, quantity: item.quantity, price: item.price, total: item.total })),
  })))
}
