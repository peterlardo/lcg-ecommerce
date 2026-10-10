import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess, MANAGEMENT_ROLES } from "@/lib/api-auth"
import { CASHIER_ROLES } from "@/lib/permissions"
import { ensurePointOfSaleStockRows } from "@/lib/stock-service"

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess([...MANAGEMENT_ROLES, ...CASHIER_ROLES])
  if (forbidden) return forbidden
  const { id } = (await context.params) as { id: string }
  await ensurePointOfSaleStockRows([id])

  const stocks = await getPrisma().pointOfSaleStock.findMany({
    where: { pointOfSaleId: id },
    select: { variantId: true, quantity: true },
    orderBy: { quantity: "desc" },
  })

  return NextResponse.json({ stocks })
}
