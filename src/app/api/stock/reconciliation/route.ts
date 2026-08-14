import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const variants = await prisma.productVariant.findMany({
    include: {
      product: { select: { name: true } },
      pointOfSaleStocks: { include: { pointOfSale: { select: { id: true, name: true, code: true } } } },
      productionLots: { where: { status: "ACTIVE" }, select: { remainingQuantity: true } },
    },
    orderBy: { product: { name: "asc" } },
  })

  const reconciliation = variants.map((v) => {
    const centralStock = v.stock
    const posTotal = v.pointOfSaleStocks.reduce((sum, ps) => sum + ps.quantity, 0)
    const lotsRemaining = v.productionLots.reduce((sum, l) => sum + l.remainingQuantity, 0)
    const totalAll = centralStock + posTotal

    return {
      variantId: v.id,
      productName: v.product.name,
      format: v.format,
      centralStock,
      posStocks: v.pointOfSaleStocks.map((ps) => ({
        pointOfSaleId: ps.pointOfSale.id,
        pointOfSaleName: ps.pointOfSale.name,
        pointOfSaleCode: ps.pointOfSale.code,
        quantity: ps.quantity,
      })),
      posTotal,
      lotsRemaining,
      totalAll,
      hasDiscrepancy: centralStock < 0 || v.pointOfSaleStocks.some((ps) => ps.quantity < 0) || (lotsRemaining > 0 && Math.abs(lotsRemaining - totalAll) > 0),
    }
  })

  const discrepancies = reconciliation.filter((r) => r.hasDiscrepancy)

  return NextResponse.json({
    variants: reconciliation,
    summary: {
      totalVariants: variants.length,
      discrepancies: discrepancies.length,
      totalCentralStock: reconciliation.reduce((s, r) => s + r.centralStock, 0),
      totalPOSStock: reconciliation.reduce((s, r) => s + r.posTotal, 0),
      totalLotsRemaining: reconciliation.reduce((s, r) => s + r.lotsRemaining, 0),
    },
  })
}
