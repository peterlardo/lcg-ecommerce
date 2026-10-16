import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess, MANAGEMENT_ROLES } from "@/lib/api-auth"
import { CASHIER_ROLES } from "@/lib/permissions"
import { ensurePointOfSaleStockRows } from "@/lib/stock-service"
import { startOfToday } from "@/lib/lot-utils"

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess([...MANAGEMENT_ROLES, ...CASHIER_ROLES])
  if (forbidden) return forbidden
  const { id } = (await context.params) as { id: string }
  await ensurePointOfSaleStockRows([id])

  const [stocks, lots] = await Promise.all([
    getPrisma().pointOfSaleStock.findMany({
      where: { pointOfSaleId: id },
      select: { variantId: true, quantity: true },
      orderBy: { quantity: "desc" },
    }),
    // Seuls les lots actifs et non périmés se vendent : la caisse montre ce qui est réellement vendable.
    getPrisma().productionLot.groupBy({
      by: ["variantId"],
      where: { status: "ACTIVE", remainingQuantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: startOfToday() } }] },
      _sum: { remainingQuantity: true },
    }),
  ])
  const sellable = new Map(lots.map((l) => [l.variantId, l._sum.remainingQuantity ?? 0]))

  return NextResponse.json({ stocks: stocks.map((s) => ({ ...s, lotsAvailable: sellable.get(s.variantId) ?? 0 })) })
}
