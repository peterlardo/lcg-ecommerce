import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const { prices } = await request.json() as { prices: { variantId: string; price: number }[] }

    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json({ error: "Aucun prix fourni" }, { status: 400 })
    }

    const updates = prices.map((p) =>
      getPrisma().productVariant.update({
        where: { id: p.variantId },
        data: { price: Number(p.price) },
      })
    )

    await getPrisma().$transaction(updates)

    return NextResponse.json({ success: true, updated: prices.length })
  } catch (error) {
    console.error("Price sync error:", error)
    return NextResponse.json({ error: "Erreur lors de la synchronisation" }, { status: 500 })
  }
}
