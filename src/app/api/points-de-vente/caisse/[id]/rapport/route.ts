import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

// GET  : apercu des donnees du rapport de cloture (ne marque rien).
// POST : genere officiellement le rapport : horodate la session et lui attribue
//        une reference. C'est ce POST qui leve le blocage de fermeture.
//
// Le perimetre est celui de la session : ventes passees sur le point de vente
// entre l'ouverture et la cloture, par le vendeur de la session.
const PAYMENT_LBL: Record<string, string> = {
  CASH_ON_DELIVERY: "Especes",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte",
}

const MOVEMENT_LBL: Record<string, string> = {
  SALE: "Vente comptoir",
  ADJUSTMENT_OUT: "Sortie ajustement",
  ADJUSTMENT_IN: "Entree ajustement",
  PRODUCTION: "Production",
  IN: "Entree",
  OUT: "Sortie",
  TRANSFER_OUT: "Transfert sortant",
  TRANSFER_IN: "Transfert entrant",
  RETURN: "Retour",
}

function generateReportReference() {
  return `CLOTURE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString(36).toUpperCase().slice(-5)}`
}

async function buildReport(sessionId: string) {
  const session = await getPrisma().cashSession.findUnique({
    where: { id: sessionId },
    include: {
      pointOfSale: { select: { id: true, name: true, code: true, address: true, city: true } },
      openedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  })
  if (!session) return null

  // Fenetre de la session : de l'ouverture a la cloture (ou maintenant si ouverte).
  const from = session.openedAt
  const to = session.closedAt ?? new Date()

  const sellerId = session.openedById
  const pointOfSaleId = session.pointOfSaleId

  const [orders, movements] = await Promise.all([
    getPrisma().order.findMany({
      where: {
        pointOfSaleId,
        createdAt: { gte: from, lte: to },
        status: { not: "CANCELLED" },
        ...(sellerId ? { userId: sellerId } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            variant: { select: { format: true } },
          },
        },
      },
    }),
    getPrisma().stockMovement.findMany({
      where: {
        pointOfSaleId,
        createdAt: { gte: from, lte: to },
        ...(sellerId ? { userId: sellerId } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { variant: { include: { product: { select: { name: true } } } } },
    }),
  ])

  // Recapitulatif des quantites vendues par produit
  const soldByProduct = new Map<
    string,
    { variantId: string; productName: string; format: string | null; quantity: number; amount: number }
  >()
  let totalItems = 0
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.variantId
      const row = soldByProduct.get(key) ?? {
        variantId: item.variantId,
        productName: item.product.name,
        format: item.variant.format,
        quantity: 0,
        amount: 0,
      }
      row.quantity += item.quantity
      row.amount += item.total
      soldByProduct.set(key, row)
      totalItems += item.quantity
    }
  }

  const revenue = orders.reduce((sum, order) => sum + order.total, 0)
  const paidOrders = orders.filter((order) => order.paymentStatus === "PAID")
  const expected = session.openingBalance + paidOrders.reduce((sum, order) => sum + order.total, 0)
  const gap = session.closingBalance === null ? null : session.closingBalance - expected

  const paymentBreakdown = new Map<string, { method: string; count: number; amount: number }>()
  for (const order of orders) {
    const method = order.paymentMethod ?? "UNKNOWN"
    const row = paymentBreakdown.get(method) ?? { method, count: 0, amount: 0 }
    row.count += 1
    row.amount += order.total
    paymentBreakdown.set(method, row)
  }

  return {
    session: {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingBalance: session.openingBalance,
      closingBalance: session.closingBalance,
      reportGeneratedAt: session.reportGeneratedAt,
      reportReference: session.reportReference,
    },
    pointOfSale: session.pointOfSale,
    seller: session.openedBy,
    reconciliation: {
      openingBalance: session.openingBalance,
      revenue,
      expected,
      closingBalance: session.closingBalance,
      gap,
    },
    totals: {
      orders: orders.length,
      items: totalItems,
      products: soldByProduct.size,
      movements: movements.length,
    },
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      customerName: order.customerName,
      paymentMethod: order.paymentMethod,
      paymentMethodLabel: PAYMENT_LBL[order.paymentMethod ?? ""] ?? "Non precise",
      paymentStatus: order.paymentStatus,
      total: order.total,
      items: order.items.length,
    })),
    soldByProduct: [...soldByProduct.values()].sort((a, b) => b.quantity - a.quantity),
    paymentBreakdown: [...paymentBreakdown.values()].sort((a, b) => b.amount - a.amount),
    movements: movements.map((movement) => ({
      id: movement.id,
      createdAt: movement.createdAt,
      type: movement.type,
      typeLabel: MOVEMENT_LBL[movement.type] ?? movement.type,
      productName: movement.variant.product.name,
      format: movement.variant.format,
      quantity: movement.quantity,
      reason: movement.reason,
      reference: movement.reference,
      lotId: movement.lotId,
    })),
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const { id } = await params
  const report = await buildReport(id)
  if (!report) return NextResponse.json({ error: "Session de caisse introuvable" }, { status: 404 })
  return NextResponse.json(report)
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  const { id } = await params
  const report = await buildReport(id)
  if (!report) return NextResponse.json({ error: "Session de caisse introuvable" }, { status: 404 })

  if (!report.session.reportGeneratedAt) {
    await getPrisma().cashSession.update({
      where: { id },
      data: {
        reportGeneratedAt: new Date(),
        reportReference: generateReportReference(),
      },
    })
  }

  return NextResponse.json({ ...report, session: await refreshSession(id) })
}

async function refreshSession(id: string) {
  const session = await getPrisma().cashSession.findUnique({
    where: { id },
    select: { id: true, status: true, reportGeneratedAt: true, reportReference: true },
  })
  return session
}
