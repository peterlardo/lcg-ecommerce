import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { ensureOperationalStockLocations } from "@/lib/stock-service"

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT", "COMPTABLE"])
  if (forbidden) return forbidden
  await ensureOperationalStockLocations()

  const points = await getPrisma().pointOfSale.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, type: true, address: true, city: true, phone: true, isActive: true, managerName: true },
  })
  return NextResponse.json(points)
}
