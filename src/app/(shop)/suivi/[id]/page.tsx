import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Check, CircleAlert, Clock, MapPin, Store, Truck } from "lucide-react"
import { getPrisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/utils"
import { slotLabel } from "@/lib/delivery-slots"
import { reservationRef } from "@/lib/reservation-notify"
import type { ReservationItem } from "@/data/store"

export const dynamic = "force-dynamic"

// Page personnelle : jamais indexée.
export const metadata: Metadata = {
  title: "Suivi de pré-commande",
  robots: { index: false, follow: false },
}

type StepState = "done" | "current" | "todo" | "failed"

function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00+01:00`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

export default async function SuiviPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const reservation = await getPrisma().reservation.findUnique({
    where: { id },
    include: {
      zone: { select: { name: true } },
      order: { select: { status: true, delivery: { select: { status: true, agentId: true, failedReason: true } } } },
    },
  })
  if (!reservation) notFound()

  let items: ReservationItem[] = []
  try { items = JSON.parse(reservation.itemsJson || "[]") } catch { items = [] }
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const pickup = reservation.deliveryMode === "PICKUP"
  const delivery = reservation.order?.delivery
  const cancelled = reservation.status === "CANCELLED" || reservation.order?.status === "CANCELLED"
  const failed = delivery?.status === "FAILED"

  // Étapes : reçue → confirmée → (livreur assigné) → en route → livrée / retirée.
  const reached = {
    received: true,
    confirmed: reservation.status === "CONFIRMED",
    assigned: !pickup && !!delivery?.agentId,
    onTheWay: delivery ? ["PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(delivery.status) : false,
    delivered: delivery?.status === "DELIVERED",
  }
  const steps: { label: string; reached: boolean }[] = [
    { label: "Pré-commande reçue", reached: reached.received },
    { label: "Confirmée par notre équipe", reached: reached.confirmed },
    ...(pickup ? [] : [{ label: "Livreur attribué", reached: reached.assigned }, { label: "En route", reached: reached.onTheWay }]),
    { label: pickup ? "Retirée" : "Livrée", reached: reached.delivered },
  ]
  const lastReached = steps.map((s) => s.reached).lastIndexOf(true)
  const stateOf = (i: number): StepState =>
    i <= lastReached ? (i === lastReached && failed ? "failed" : "done") : i === lastReached + 1 && !cancelled ? "current" : "todo"

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Suivi de pré-commande</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{reservationRef(reservation.id)}</h1>
      <p className="mt-2 text-muted-foreground">Bonjour {reservation.client.split(" ")[0]}, voici l&apos;état de votre pré-commande.</p>

      {cancelled && (
        <div className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Cette pré-commande a été annulée. Contactez-nous pour toute question.
        </div>
      )}
      {failed && !cancelled && (
        <div className="mt-6 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          La livraison n&apos;a pas pu être effectuée{delivery?.failedReason ? ` (${delivery.failedReason})` : ""}. Notre équipe vous contacte pour un nouveau créneau.
        </div>
      )}

      <ol className="mt-8 space-y-4">
        {steps.map((step, i) => {
          const state = stateOf(i)
          return (
            <li key={step.label} className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  state === "done" ? "border-primary bg-primary text-primary-foreground"
                    : state === "failed" ? "border-amber-500 bg-amber-500 text-white"
                    : state === "current" ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : state === "failed" ? <CircleAlert className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
              </span>
              <span className={`text-sm ${state === "todo" ? "text-muted-foreground" : "font-semibold"}`}>{step.label}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-muted-foreground">Rendez-vous</p><p className="font-semibold capitalize">{formatDay(reservation.date)}</p><p>{slotLabel(reservation.slot) || reservation.heure}</p></div>
        </div>
        <div className="flex items-start gap-2">
          {pickup ? <Store className="mt-0.5 h-4 w-4 text-primary" /> : <Truck className="mt-0.5 h-4 w-4 text-primary" />}
          <div>
            <p className="text-xs text-muted-foreground">{pickup ? "Retrait sur place" : "Livraison"}</p>
            <p className="font-semibold">{pickup ? reservation.address : reservation.zone?.name ?? "Zone à confirmer"}</p>
            {!pickup && <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> Brazzaville</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-sm">
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{item.name} {item.format} × {item.quantity}</span>
              <span className="font-semibold">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 text-muted-foreground">
            <span>Livraison</span>
            <span>{reservation.deliveryFee > 0 ? formatPrice(reservation.deliveryFee) : "Gratuite"}</span>
          </li>
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-base font-bold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(subtotal + reservation.deliveryFee)}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Paiement à la livraison ou au retrait : espèces ou Mobile Money.</p>
      </div>

      <Link href="/produits" className="mt-8 inline-block text-sm font-bold text-primary hover:underline">← Retour au catalogue</Link>
    </div>
  )
}
