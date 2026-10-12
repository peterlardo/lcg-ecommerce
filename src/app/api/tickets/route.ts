import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMPTABLE", "OPERATEUR_ACCUEIL", ...CASHIER_ROLES])
  if (forbidden) return forbidden

  const session = await auth()
  const role = session?.user?.role
  const selfId = session?.user?.id

  // Qui voit quoi (même règle que la liste des commandes) :
  // - l'administrateur voit tous les tickets ;
  // - un compte de caisse voit ses propres ventes et les commandes qu'un opérateur lui a transmises ;
  // - les autres comptes voient les tickets dont ils sont l'auteur.
  // Le point de vente n'entre pas en compte : un compte qui n'en gère aucun ne voyait aucun de ses tickets.
  const scope =
    role === "ADMIN"
      ? []
      : !selfId
        ? [{ id: { in: [] as string[] } }]
        : isCashierRole(role)
          ? [{ OR: [{ userId: selfId }, { cashierId: selfId }] }]
          : [{ userId: selfId }]

  const tickets = await getPrisma().order.findMany({
    where: {
      AND: [
        { OR: [{ notes: { startsWith: "Vente comptoir" } }, { ticketGenerated: true }] },
        ...scope,
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
