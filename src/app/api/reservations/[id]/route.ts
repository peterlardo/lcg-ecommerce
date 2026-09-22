import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma";
import { getReservationById, updateReservationStatus } from "@/data/store"
import { sendReservationConfirmedEmail } from "@/lib/mailer"
import { generateOrderNumber } from "@/lib/utils"
import {
  consumePointOfSaleStockTx,
  getOrCreateStockMobile,
  restoreLotAllocationsByReferenceTx,
  restockPointOfSaleStockTx,
} from "@/lib/stock-service"

interface ReservationItem {
  name: string
  format: string
  quantity: number
  price: number
}

async function confirmReservation(id: string) {
  const reservation = await getPrisma().reservation.findUnique({ where: { id } })
  if (!reservation) throw new Error("Réservation introuvable")
  if (reservation.status !== "PENDING") throw new Error("Cette réservation ne peut plus être confirmée")

  let items: ReservationItem[] = []
  try { items = JSON.parse(reservation.itemsJson || "[]") } catch { items = [] }

  if (items.length === 0) throw new Error("Aucun article dans la réservation")

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const orderNumber = generateOrderNumber()
  const stockMobile = await getOrCreateStockMobile()
  const pointOfSaleId = reservation.pointOfSaleId || stockMobile.id

  // Find matching variants by name + format
  const variantLookups = await Promise.all(
    items.map(async (item) => {
      const variant = await getPrisma().productVariant.findFirst({
        where: {
          format: item.format,
          product: { name: item.name },
        },
        select: { id: true, stock: true, productId: true },
      })
      return { ...item, variant }
    })
  )

  // Check global stock before the transaction. The selected storage is checked
  // again atomically when consumed below.
  for (const v of variantLookups) {
    if (!v.variant) throw new Error(`Variante introuvable pour ${v.name} (${v.format})`)
    if (v.variant.stock < v.quantity) {
      throw new Error(`Stock insuffisant pour ${v.name} ${v.format} (disponible: ${v.variant.stock}, demandé: ${v.quantity})`)
    }
  }

  // Create order + delivery + decrement stock + allocate lots in a transaction
  const order = await getPrisma().$transaction(async (tx) => {
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
        pointOfSaleId,
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
      const fifoResult = await consumePointOfSaleStockTx(tx, {
        variantId: v.variant!.id,
        pointOfSaleId,
        quantity: v.quantity,
        type: "RESERVATION",
        reason: "Réservation confirmée",
        reference: orderNumber,
      })

      const orderItem = created.items.find((item) => item.variantId === v.variant!.id)
      if (orderItem && fifoResult.allocations.length > 0) {
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: { lotId: fifoResult.allocations[0].lotId },
        })
      }
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
  const reservation = await getPrisma().reservation.findUnique({ where: { id } })
  if (!reservation) throw new Error("Réservation introuvable")

  if (reservation.orderId) {
    const order = await getPrisma().order.findUnique({
      where: { id: reservation.orderId },
      include: { items: true },
    })

    if (order && order.status !== "CANCELLED") {
      await getPrisma().$transaction(async (tx) => {
        for (const item of order.items) {
          if (order.pointOfSaleId) {
            await restockPointOfSaleStockTx(tx, {
              variantId: item.variantId,
              pointOfSaleId: order.pointOfSaleId,
              quantity: item.quantity,
              type: "CANCELLATION",
              reason: "Annulation pré-commande",
              reference: order.orderNumber,
            })
          } else {
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
        }

        await restoreLotAllocationsByReferenceTx(tx, order.orderNumber)

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
      await getPrisma().reservation.update({ where: { id }, data: { pointOfSaleId: pointOfSaleId || null } })
    }

    const previous = await getPrisma().reservation.findUnique({ where: { id }, select: { status: true } })

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
