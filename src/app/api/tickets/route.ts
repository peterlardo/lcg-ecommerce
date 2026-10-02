import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds } from "@/lib/api-auth"
import { auth } from "@/lib/auth"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const session = await auth()
  const role = session?.user?.role
  const selfId = session?.user?.id

  const posFilter = await getUserPointOfSaleIds()
  const posIds = posFilter?.posIds ?? null
  const posClause =
    posIds !== null
      ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } }
      : null

  const tickets = await getPrisma().order.findMany({
    where: {
      AND: [
        { OR: [{ notes: { startsWith: "Vente comptoir" } }, { ticketGenerated: true }] },
        ...(posClause ? [posClause] : []),
        ...(role === "ADMIN" || !role || !selfId
          ? []
          : [{ OR: [{ NOT: { notes: { startsWith: "Vente comptoir" } } }, { userId: selfId }] }]),
      ],
    },
include: { pointOfSale: { select: { name: true, code: true } }, user: { select: { name: true } }, items: { include: { variant: { include: { product: true } } } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(tickets.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.orderNumber,
    customerName: ticket.customerName || "Client comptoir",
    customerPhone: ticket.customerPhone || "",
    sellerName: ticket.user?.name ?? null,
    paymentMethod: ticket.paymentMethod,
    paymentStatus: ticket.paymentStatus,
    total: ticket.total,
    createdAt: ticket.createdAt.toISOString(),
    notes: ticket.notes,
    pointOfSale: ticket.pointOfSale,
    items: ticket.items.map((item) => ({ name: item.variant.product.name, format: item.variant.format, unit: item.variant.unit, quantity: item.quantity, price: item.price, total: item.total })),
  })))
}
