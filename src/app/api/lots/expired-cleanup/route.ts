import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess(undefined, [["production", "lots"], "delete"])
  if (forbidden) return forbidden

  try {
    const body = await req.json().catch(() => ({}))
    const variantIds = Array.isArray(body.variantIds) ? body.variantIds.filter((v: unknown) => typeof v === "string") : []

    if (variantIds.length === 0) {
      return NextResponse.json({ error: "Aucun format sélectionné" }, { status: 400 })
    }

    const prisma = getPrisma()

    const result = await prisma.$transaction(async (tx) => {
      const lots = await tx.productionLot.findMany({
        where: {
          variantId: { in: variantIds },
          status: "EXPIRED",
          remainingQuantity: { gt: 0 },
        },
        select: {
          id: true,
          lotNumber: true,
          variantId: true,
          remainingQuantity: true,
          initialQuantity: true,
        },
      })

      if (lots.length === 0) return { deleted: 0, lots: [] }

      await tx.lotAllocation.deleteMany({ where: { lotId: { in: lots.map((l) => l.id) } } })
      await tx.productionLot.deleteMany({ where: { id: { in: lots.map((l) => l.id) } } })

      for (const lot of lots) {
        await logActivity({
          module: "production",
          action: "suppression",
          entity: "ProductionLot",
          entityId: lot.id,
          summary: `Suppression du lot périmé ${lot.lotNumber} (${lot.initialQuantity} unités produites, reste ${lot.remainingQuantity}) - nettoyé depuis onglet Cohérence (SANS LOT)`,
        })
      }

      return { deleted: lots.length, lots }
    })

    return NextResponse.json({ ok: true, deleted: result.deleted })
  } catch (error) {
    console.error("POST lots/expired-cleanup error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 })
  }
}
