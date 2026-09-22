import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { ensurePointOfSaleStockRows } from "@/lib/stock-service"

export async function GET(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess()
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
