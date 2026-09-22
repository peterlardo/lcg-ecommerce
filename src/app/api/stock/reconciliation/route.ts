import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth"
import { OPERATIONAL_STOCK_CODES, ensureOperationalStockLocations } from "@/lib/stock-service"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden
  await ensureOperationalStockLocations()

  const variants = await getPrisma().productVariant.findMany({
    include: {
      product: { select: { name: true } },
      pointOfSaleStocks: {
        where: { pointOfSale: { code: { in: [...OPERATIONAL_STOCK_CODES] } } },
        include: { pointOfSale: { select: { id: true, name: true, code: true } } },
      },
      productionLots: { where: { status: "ACTIVE" }, select: { remainingQuantity: true } },
    },
    orderBy: { product: { name: "asc" } },
  })

  const reconciliation = variants.map((v) => {
    const globalStock = v.stock
    const posTotal = v.pointOfSaleStocks.reduce((sum, ps) => sum + ps.quantity, 0)
    const lotsRemaining = v.productionLots.reduce((sum, l) => sum + l.remainingQuantity, 0)

    return {
      variantId: v.id,
      productName: v.product.name,
      format: v.format,
      globalStock,
      posStocks: v.pointOfSaleStocks.map((ps) => ({
        pointOfSaleId: ps.pointOfSale.id,
        pointOfSaleName: ps.pointOfSale.name,
        pointOfSaleCode: ps.pointOfSale.code,
        quantity: ps.quantity,
      })),
      posTotal,
      lotsRemaining,
      hasDiscrepancy: globalStock < 0 || v.pointOfSaleStocks.some((ps) => ps.quantity < 0) || lotsRemaining !== globalStock || posTotal !== globalStock,
    }
  })

  const discrepancies = reconciliation.filter((r) => r.hasDiscrepancy)

  return NextResponse.json({
    variants: reconciliation,
    summary: {
      totalVariants: variants.length,
      discrepancies: discrepancies.length,
      totalGlobalStock: reconciliation.reduce((s, r) => s + r.globalStock, 0),
      totalPOSStock: reconciliation.reduce((s, r) => s + r.posTotal, 0),
      totalLotsRemaining: reconciliation.reduce((s, r) => s + r.lotsRemaining, 0),
    },
  })
}
