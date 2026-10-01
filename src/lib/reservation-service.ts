import { getPrisma } from "@/lib/prisma"
import type { ReservationItem } from "@/data/store"
import { sendReservationConfirmedEmail } from "@/lib/mailer"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { generateOrderNumber } from "@/lib/utils"
import { getOrCreateStockMobile } from "@/lib/stock-service"
import { slotError, slotLabel, slotStart } from "@/lib/delivery-slots"
import { notifyReservationStep, reservationRef, reservationTrackingUrl } from "@/lib/reservation-notify"

/**
 * Cycle de vie d'une pré-commande traitée comme une livraison à date :
 * confirmation (commande + livraison planifiée), annulation, replanification.
 */
export class ReservationError extends Error {}

export async function confirmReservation(id: string, agentId: string | null) {
  const prisma = getPrisma()
  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation) throw new ReservationError("Réservation introuvable")
  if (reservation.status !== "PENDING") throw new ReservationError("Cette réservation ne peut plus être confirmée")

  let items: ReservationItem[] = []
  try { items = JSON.parse(reservation.itemsJson || "[]") } catch { items = [] }
  if (items.length === 0) throw new ReservationError("Aucun article dans la réservation")

  const isDelivery = reservation.deliveryMode !== "PICKUP"
  if (agentId) {
    if (!isDelivery) throw new ReservationError("Retrait sur place : pas de livreur à assigner")
    const agent = await prisma.deliveryAgent.findFirst({ where: { id: agentId, isActive: true } })
    if (!agent) throw new ReservationError("Livreur introuvable ou désactivé")
    if (!agent.isAvailable) throw new ReservationError(`Le livreur « ${agent.name} » n'est pas disponible`)
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const fee = isDelivery ? reservation.deliveryFee : 0
  const orderNumber = generateOrderNumber()
  const stockMobile = await getOrCreateStockMobile()
  const pointOfSaleId = reservation.pointOfSaleId || stockMobile.id

  // Articles reliés par identifiant de variante ; repli nom + format pour les anciennes pré-commandes.
  // Aucun prélèvement de stock ici : il a lieu à la facturation de la commande.
  const variantLookups = await Promise.all(
    items.map(async (item) => {
      const variant = item.variantId
        ? await prisma.productVariant.findUnique({ where: { id: item.variantId }, select: { id: true, productId: true } })
        : await prisma.productVariant.findFirst({
            where: { format: item.format, product: { name: item.name } },
            select: { id: true, productId: true },
          })
      return { ...item, variant }
    })
  )
  for (const v of variantLookups) {
    if (!v.variant) throw new ReservationError(`Variante introuvable pour ${v.name} (${v.format})`)
  }

  const order = await prisma.$transaction(async (tx) => {
    // On « réserve » la pré-commande avant de créer la commande : une seconde confirmation
    // simultanée (double clic, deux postes) ne trouve plus de pré-commande en attente.
    const claimed = await tx.reservation.updateMany({
      where: { id, status: "PENDING", orderId: null },
      data: { status: "CONFIRMED" },
    })
    if (claimed.count === 0) throw new ReservationError("Cette pré-commande vient déjà d'être confirmée")

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: reservation.userId,
        customerName: reservation.client,
        customerEmail: reservation.email,
        customerPhone: reservation.telephone,
        paymentMethod: "CASH_ON_DELIVERY",
        status: "CONFIRMED",
        source: "RESERVATION",
        pointOfSaleId,
        subtotal,
        deliveryFee: fee,
        total: subtotal + fee,
        notes: `Pré-commande ${reservationRef(reservation.id)} — ${reservation.date}${reservation.slot ? ` ${slotLabel(reservation.slot)}` : reservation.heure ? ` ${reservation.heure}` : ""}`,
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
            mode: isDelivery ? "DELIVERY" : "PICKUP",
            zoneId: isDelivery ? reservation.zoneId : null,
            fee,
            agentId: agentId ?? undefined,
            assignedAt: agentId ? new Date() : undefined,
            status: agentId ? "ASSIGNED" : "PENDING",
            address: reservation.address || "À définir",
            city: "Brazzaville",
            notes: `Pré-commande ${reservationRef(reservation.id)}`,
            scheduledDate: slotStart(reservation.date, reservation.slot) ?? new Date(`${reservation.date}T12:00:00+01:00`),
          },
        },
      },
      include: { items: true, delivery: true },
    })
    await tx.reservation.update({ where: { id }, data: { orderId: created.id } })
    return created
  })

  // Confirmation au client : e-mail + WhatsApp, avec le lien de suivi.
  const ref = reservationRef(reservation.id)
  const trackingUrl = reservationTrackingUrl(reservation.id)
  const when = `${reservation.date}${reservation.slot ? `, créneau ${slotLabel(reservation.slot)}` : reservation.heure ? ` à ${reservation.heure}` : ""}`
  await sendReservationConfirmedEmail({
    ref, orderNumber, client: reservation.client, telephone: reservation.telephone, email: reservation.email,
    date: reservation.date, heure: slotLabel(reservation.slot) || reservation.heure, address: reservation.address,
    items, deliveryFee: fee, total: subtotal + fee, trackingUrl,
  })
  sendWhatsAppMessage(
    reservation.telephone,
    `LCG — Pré-commande confirmée\nBonjour ${reservation.client}, votre pré-commande ${ref} est confirmée pour le ${when}.\n${isDelivery ? `Livraison : ${reservation.address}` : `Retrait : ${reservation.address}`}\nSuivi : ${trackingUrl}`
  ).catch(() => {})

  return order
}

export async function cancelReservation(id: string) {
  const prisma = getPrisma()
  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation) throw new ReservationError("Réservation introuvable")
  if (!reservation.orderId) return

  const order = await prisma.order.findUnique({
    where: { id: reservation.orderId },
    select: { id: true, status: true, orderNumber: true, delivery: { select: { status: true } } },
  })
  if (!order || order.status === "CANCELLED") return
  if (order.delivery?.status === "DELIVERED") throw new ReservationError("Pré-commande déjà livrée : elle ne peut plus être annulée")

  // La confirmation ne prélève pas de stock : seule la commande liée (non facturée) est annulée.
  const sale = await prisma.stockMovement.findFirst({ where: { reference: order.orderNumber, type: "SALE" }, select: { id: true } })
  if (sale) throw new ReservationError("Commande déjà facturée : annulez-la depuis la page Commandes (retour en stock)")
  await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } })
}

/** Change la date et/ou le créneau ; une livraison en échec repart dans le circuit. */
export async function rescheduleReservation(id: string, date: string, slot: string) {
  const prisma = getPrisma()
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { order: { select: { id: true, status: true, delivery: { select: { id: true, status: true, agentId: true } } } } },
  })
  if (!reservation) throw new ReservationError("Réservation introuvable")
  if (reservation.status === "CANCELLED") throw new ReservationError("Pré-commande annulée : impossible de la replanifier")
  const delivery = reservation.order?.delivery
  if (delivery?.status === "DELIVERED") throw new ReservationError("Pré-commande déjà livrée")
  if (delivery && ["PICKED_UP", "IN_TRANSIT"].includes(delivery.status)) {
    throw new ReservationError("Livraison en route : marquez-la livrée ou en échec avant de la replanifier")
  }
  const problem = slotError(date, slot)
  if (problem) throw new ReservationError(problem)

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { date, slot, heure: slotLabel(slot) } })
    if (delivery) {
      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          scheduledDate: slotStart(date, slot),
          ...(delivery.status === "FAILED" ? { status: delivery.agentId ? "ASSIGNED" : "PENDING", failedReason: null } : {}),
        },
      })
    }
  })
  await notifyReservationStep({ reservationId: id }, "RESCHEDULED")
}

