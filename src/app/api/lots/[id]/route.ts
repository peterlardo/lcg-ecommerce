import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const { id } = await params
  const lot = await prisma.productionLot.findUnique({
    where: { id },
    include: {
      variant: { include: { product: { include: { category: true } } } },
      createdBy: { select: { name: true, email: true } },
      allocations: { orderBy: { createdAt: "desc" } },
      stockMovements: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!lot) {
    return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  }

  return NextResponse.json({ lot })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const body = await req.json()
    const { status, expiryDate, notes } = body

    const lot = await prisma.productionLot.findUnique({ where: { id } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }

    const updated = await prisma.productionLot.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    })

    return NextResponse.json({ lot: updated })
  } catch (error: any) {
    console.error("PATCH lots error:", error)
    return NextResponse.json({ error: error.message ?? "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const lot = await prisma.productionLot.findUnique({ where: { id }, include: { allocations: true } })
    if (!lot) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    }

    if (lot.allocations.length > 0) {
      return NextResponse.json({ error: "Impossible de supprimer un lot deja utilise" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.deleteMany({ where: { lotId: id } })
      await tx.productVariant.update({
        where: { id: lot.variantId },
        data: { stock: { decrement: lot.remainingQuantity } },
      })
      await tx.productionLot.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("DELETE lots error:", error)
    return NextResponse.json({ error: error.message ?? "Erreur serveur" }, { status: 500 })
  }
}
