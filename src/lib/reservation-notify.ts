import { getPrisma } from "@/lib/prisma"
import { siteConfig } from "@/lib/site"
import { sendReservationStepEmail } from "@/lib/mailer"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { slotLabel } from "@/lib/delivery-slots"

export type ReservationStep = "IN_TRANSIT" | "DELIVERED" | "FAILED" | "RESCHEDULED"

export function reservationRef(id: string): string {
  return `RSV-${id.slice(-6).toUpperCase()}`
}

/** Lien public de suivi (l'identifiant complet n'est pas devinable, contrairement à la référence courte). */
export function reservationTrackingUrl(id: string): string {
  return `${siteConfig.url}/suivi/${id}`
}

function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00+01:00`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

/**
 * Prévient le client (WhatsApp + e-mail) d'une étape de sa pré-commande.
 * Ne lève jamais : un échec d'envoi ne doit pas bloquer l'action de l'équipe.
 */
export async function notifyReservationStep(
  where: { reservationId: string } | { orderId: string },
  step: ReservationStep,
  extra: { failedReason?: string } = {}
): Promise<void> {
  try {
    const reservation = await getPrisma().reservation.findFirst({
      where: "reservationId" in where ? { id: where.reservationId } : { orderId: where.orderId },
    })
    if (!reservation) return

    const ref = reservationRef(reservation.id)
    const url = reservationTrackingUrl(reservation.id)
    const pickup = reservation.deliveryMode === "PICKUP"
    const when = `${formatDay(reservation.date)}${reservation.slot ? `, ${slotLabel(reservation.slot)}` : ""}`

    const messages: Record<ReservationStep, { title: string; message: string }> = {
      IN_TRANSIT: {
        title: "Votre livreur est en route",
        message: "Votre pré-commande a quitté notre site : le livreur arrive bientôt. Préparez le paiement (espèces ou Mobile Money).",
      },
      DELIVERED: {
        title: pickup ? "Pré-commande retirée" : "Pré-commande livrée",
        message: pickup ? "Votre pré-commande a bien été retirée. Merci pour votre confiance !" : "Votre pré-commande a bien été livrée. Merci pour votre confiance !",
      },
      FAILED: {
        title: "Livraison non effectuée",
        message: `Nous n'avons pas pu effectuer la livraison${extra.failedReason ? ` (${extra.failedReason})` : ""}. Notre équipe vous contacte pour convenir d'un nouveau créneau.`,
      },
      RESCHEDULED: {
        title: pickup ? "Retrait replanifié" : "Livraison replanifiée",
        message: `Nouveau rendez-vous : ${when}.`,
      },
    }
    const { title, message } = messages[step]

    await Promise.all([
      sendWhatsAppMessage(reservation.telephone, `LCG — ${title}\nBonjour ${reservation.client}, ${message}\nRéférence ${ref}\nSuivi : ${url}`).catch(() => false),
      sendReservationStepEmail({ email: reservation.email, client: reservation.client, ref, title, message, trackingUrl: url }),
    ])
  } catch (error) {
    console.error("notifyReservationStep:", error)
  }
}
