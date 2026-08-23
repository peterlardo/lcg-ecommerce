import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { getReservationById, updateReservationStatus } from "@/data/store"
import { sendReservationConfirmedEmail } from "@/lib/mailer"
import { generateOrderNumber } from "@/lib/utils"
import { allocateStockFIFOTx } from "@/lib/lot-utils"

interface ReservationItem {
  name: string
  format: string
  quantity: number
  price: number
}

async function confirmReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation) throw new Error("Réservation introuvable")
  if (reservation.status !== "PENDING") throw new Error("Cette réservation ne peut plus être confirmée")

  let items: ReservationItem[] = []
  try { items = JSON.parse(reservation.itemsJson || "[]") } catch { items = [] }

  if (items.length === 0) throw new Error("Aucun article dans la réservation")

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const orderNumber = generateOrderNumber()

  // Find matching variants by name + format
  const variantLookups = await Promise.all(
    items.map(async (item) => {
      const variant = await prisma.productVariant.findFirst({
        where: {
          format: item.format,
          product: { name: item.name },
        },
        select: { id: true, stock: true, productId: true },
      })
      return { ...item, variant }
    })
  )

  // Check stock
  for (const v of variantLookups) {
    if (!v.variant) throw new Error(`Variante introuvable pour ${v.name} (${v.format})`)
    if (v.variant.stock < v.quantity) {
      throw new Error(`Stock insuffisant pour ${v.name} ${v.format} (disponible: ${v.variant.stock}, demandé: ${v.quantity})`)
    }
  }

  // Create order + delivery + decrement stock + allocate lots in a transaction
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: reservation.userId,
        customerName: reservation.client,
        customerEmail: reservation.email,
        customerPhone: reservation.telephone,
        paymentMethod: "CASH_ON_DELIVERY",
        status: "PENDING",
        source: "RESERVATION",
        subtotal,
        deliveryFee: 0,
        total: subtotal,
        notes: `Pré-commande ${reservation.id.slice(-6).toUpperCase()} — ${reservation.type} — ${reservation.date} ${reservation.heure}`,
        items: {
          create: variantLookups.map((v) => ({
            productId: v.variant!.productId,
            variantId: v.variant!.id,
            quantity: v.quantity,
            price: v.price,
            total: v.price * v.quantity,
          })),
        },
        delivery: {
          create: {
            address: reservation.address || "À définir",
            city: "Brazzaville",
            notes: `Livraison prévue le ${reservation.date}${reservation.heure ? ` à ${reservation.heure}` : ""}`,
            scheduledDate: new Date(reservation.date),
          },
        },
      },
      include: { items: true, delivery: true },
    })

    // Decrement stock + create stock movements + allocate lots
    for (const v of variantLookups) {
      await tx.productVariant.update({
        where: { id: v.variant!.id },
        data: { stock: { decrement: v.quantity } },
      })
      await tx.stockMovement.create({
        data: {
          variantId: v.variant!.id,
          type: "RESERVATION",
          quantity: v.quantity,
          reason: "Réservation confirmée",
          reference: orderNumber,
        },
      })
      await allocateStockFIFOTx(tx, v.variant!.id, v.quantity, "RESERVATION", orderNumber)
    }

    // Link order to reservation
    await tx.reservation.update({
      where: { id },
      data: { orderId: created.id },
    })

    return created
  })

  // Send confirmation email to client
  if (reservation.email) {
    const ref = `RSV-${reservation.id.slice(-6).toUpperCase()}`
    await sendReservationConfirmedEmail({
      ref,
      orderNumber,
      client: reservation.client,
      telephone: reservation.telephone,
      email: reservation.email,
      date: reservation.date,
      heure: reservation.heure,
      address: reservation.address,
      items,
      total: subtotal,
    })
  }

  return order
}

async function cancelReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation) throw new Error("Réservation introuvable")

  if (reservation.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: reservation.orderId },
      include: { items: true },
    })

    if (order && order.status !== "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        // Les pré-commandes confirmées sont toujours débitées du stock central
        // (confirmReservation), jamais du stock POS — restauration au central uniquement
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              type: "CANCELLATION",
              quantity: item.quantity,
              reason: "Annulation pré-commande",
              reference: order.orderNumber,
            },
          })
        }

        const lotAllocations = await tx.lotAllocation.findMany({
          where: { reference: order.orderNumber },
        })
        for (const alloc of lotAllocations) {
          await tx.productionLot.update({
            where: { id: alloc.lotId },
            data: { remainingQuantity: { increment: alloc.quantity }, status: "ACTIVE" },
          })
        }
        if (lotAllocations.length > 0) {
          await tx.lotAllocation.deleteMany({ where: { reference: order.orderNumber } })
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        })
      })
    }
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const { id } = await ctx.params
  const res = await getReservationById(id)
  if (!res) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 })
  }
  return NextResponse.json(res)
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/reservations/[id]">) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { status, pointOfSaleId } = body

    if (!status || !["PENDING", "CONFIRMED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    if (pointOfSaleId !== undefined) {
      await prisma.reservation.update({ where: { id }, data: { pointOfSaleId: pointOfSaleId || null } })
    }

    const previous = await prisma.reservation.findUnique({ where: { id }, select: { status: true } })

    if (status === "CONFIRMED" && previous?.status === "PENDING") {
      await confirmReservation(id)
    } else if (status === "CANCELLED" && previous?.status === "CONFIRMED") {
      await cancelReservation(id)
    }

    const success = await updateReservationStatus(id, status)
    if (!success) {
      return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reservation update error:", error)
    const message = error instanceof Error ? error.message : "Erreur interne du serveur"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
