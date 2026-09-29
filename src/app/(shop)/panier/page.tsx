"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { useToast } from "@/contexts/toast-context"
import { formatPrice } from "@/lib/utils"
import {
  ShoppingCart, Truck, CalendarClock, Plus, Minus, Trash2,
  ArrowRight, CircleCheck,
} from "lucide-react"
import { useCartValidation } from "@/hooks/use-cart-validation"
import DeliveryChoiceBlock, { PICKUP_PLACE, type DeliveryChoice } from "@/components/shop/delivery-choice"

const modes = [
  { id: "commande", label: "Commande", icon: Truck },
  { id: "reservation", label: "Pré-commande", icon: CalendarClock },
]

export default function CartPage() {
  const { items, subtotal, itemCount, removeItem, updateQuantity, clearCart } = useCart()
  const { showToast } = useToast()
  const [mode, setMode] = useState("commande")
  const [success, setSuccess] = useState<{ mode: string; ref: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [nom, setNom] = useState("")
  const [telephone, setTelephone] = useState("")
  const [email, setEmail] = useState("")
  const [date, setDate] = useState("")
  const [heure, setHeure] = useState("")
  const [adresse, setAdresse] = useState("")
  const [notes, setNotes] = useState("")
  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const [delivery, setDelivery] = useState<DeliveryChoice>({ mode: "DELIVERY", zoneId: null, agentId: null, fee: 0 })

  useCartValidation((names) => {
    showToast(
      "error",
      "Panier mis à jour",
      `Article(s) plus disponible(s) retiré(s) : ${names.join(", ")}. Merci de recommencer votre sélection.`
    )
  })

  const appliedCode = appliedCoupon?.code ?? ""
  const discount = mode === "commande" ? appliedCoupon?.discount ?? 0 : 0
  const deliveryFee = mode === "commande" ? delivery.fee : 0
  const orderTotal = Math.max(0, subtotal - discount) + deliveryFee

  useEffect(() => {
    if (!appliedCode) return
    const init = async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: appliedCode, subtotal }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) {
          setAppliedCoupon({ code: data.code, discount: data.discount })
        } else {
          setAppliedCoupon(null)
          setCouponMsg({ type: "error", text: data?.error || "Code promo invalide." })
        }
      } catch {
        // réseau indisponible : on garde le dernier état connu
      }
    }
    void init()
  }, [subtotal, appliedCode])

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCheckingCoupon(true)
    setCouponMsg(null)
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setAppliedCoupon({ code: data.code, discount: data.discount })
        setCouponMsg({ type: "ok", text: `Code ${data.code} appliqué : − ${formatPrice(data.discount)}` })
      } else {
        setAppliedCoupon(null)
        setCouponMsg({ type: "error", text: data?.error || "Code promo invalide." })
      }
    } catch {
      setCouponMsg({ type: "error", text: "Erreur réseau, réessayez." })
    } finally {
      setCheckingCoupon(false)
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null)
    setCouponMsg(null)
    setCouponInput("")
  }

  if (items.length === 0 && !success) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ice-gradient text-primary">
          <ShoppingCart className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
          Votre panier est vide
        </h1>
        <p className="mt-3 text-muted-foreground">
          Parcourez notre catalogue de glaçons en eau minérale et ajoutez vos produits.
        </p>
        <Link
          href="/produits"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
        >
          Voir le catalogue
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ice-gradient text-primary">
          <CircleCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
          {success.mode === "reservation" ? "Pré-commande enregistrée !" : "Commande enregistrée !"}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Référence <strong className="text-foreground">{success.ref}</strong>. Notre équipe vous contactera très rapidement pour confirmer{" "}
          {success.mode === "reservation" ? "votre pré-commande" : "la livraison"} et le paiement (espèces ou Mobile Money).
        </p>
        <Link
          href="/produits"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
        >
          Continuer mes achats
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (mode === "commande" && delivery.mode === "DELIVERY") {
      if (!delivery.zoneId) {
        setError("Choisissez une zone de livraison.")
        return
      }
      if (!adresse.trim()) {
        setError("Adresse de livraison requise.")
        return
      }
    }

    setSubmitting(true)
    setError("")

    const payload = {
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.id,
        name: i.name,
        format: i.format,
        quantity: i.quantity,
        price: i.price,
      })),
    }

    try {
      let ref: string
      if (mode === "reservation") {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            client: nom,
            telephone,
            email: email.trim(),
            type: "Pré-commande de glaçons",
            date,
            heure,
            address: adresse,
            notes,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || "Erreur lors de l'enregistrement de la pré-commande")
        }
        const data = await res.json()
        ref = data.ref || `LCG-${Date.now().toString(36).toUpperCase().slice(-6)}`
      } else {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            orderNumber: `LCG-${Date.now().toString(36).toUpperCase().slice(-6)}`,
            customerName: nom,
            customerPhone: telephone,
            customerEmail: email.trim(),
            address: delivery.mode === "PICKUP" ? PICKUP_PLACE : adresse,
            city: "Brazzaville",
            paymentMethod: "CASH_ON_DELIVERY",
            deliveryMode: delivery.mode,
            deliveryZoneId: delivery.mode === "DELIVERY" ? delivery.zoneId : null,
            deliveryAgentId: delivery.mode === "DELIVERY" ? delivery.agentId : null,
            couponCode: appliedCoupon?.code || undefined,
            notes,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || "Erreur lors de l'enregistrement de la commande")
        }
        const data = await res.json()
        ref = data.orderNumber
      }
      clearCart()
      setSuccess({ mode, ref })
      showToast(
        "success",
        mode === "reservation" ? "Pré-commande enregistrée !" : "Commande enregistrée !",
        `Référence ${ref} — Notre équipe vous contactera rapidement.`
      )
    } catch (err) {
      console.error("Erreur :", err)
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Veuillez réessayer.")
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        Votre panier
      </h1>
      <p className="mt-2 text-muted-foreground">
        {itemCount} article{itemCount > 1 ? "s" : ""} — choisissez livraison immédiate ou pré-commande à date.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        {/* Left — items + total */}
        <div className="space-y-4 lg:col-span-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card-soft"
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-2xl">🧊</div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-sm font-bold">
                  {item.name}
                </h2>
                <p className="text-xs text-muted-foreground">{item.format}</p>
                <p className="mt-1 text-sm font-bold text-primary">
                  {formatPrice(item.price)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Diminuer"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-bold">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label="Augmenter"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Retirer du panier"
                onClick={() => removeItem(item.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {mode === "commande" && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card-soft">
              <p className="text-sm font-semibold mb-2">Code promo</p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-green-600">
                    {appliedCoupon.code} — − {formatPrice(appliedCoupon.discount)}
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-xs font-semibold text-muted-foreground underline hover:text-foreground"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon() } }}
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase outline-none ring-ring transition-shadow focus:ring-2"
                    placeholder="EX : BIENVENUE10"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={checkingCoupon}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03] disabled:opacity-50"
                  >
                    {checkingCoupon ? "…" : "Appliquer"}
                  </button>
                </div>
              )}
              {couponMsg && !appliedCoupon && (
                <p className={`mt-2 text-xs font-medium ${couponMsg.type === "ok" ? "text-green-600" : "text-destructive"}`}>
                  {couponMsg.text}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 rounded-2xl bg-ice-gradient px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>Remise ({appliedCoupon?.code})</span>
                <span className="font-semibold">− {formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {mode === "reservation"
                  ? "Livraison"
                  : delivery.mode === "PICKUP"
                    ? "Retrait sur place"
                    : "Livraison"}
              </span>
              <span className={`font-semibold ${deliveryFee === 0 ? "text-green-600" : ""}`}>
                {deliveryFee > 0 ? formatPrice(deliveryFee) : "Gratuite"}
              </span>
            </div>
            <hr className="border-border" />
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Total
              </span>
              <span className="font-display text-2xl font-extrabold text-primary">
                {formatPrice(orderTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="h-fit rounded-3xl border border-border bg-card p-7 shadow-card-soft lg:col-span-2">
          <form onSubmit={handleSubmit}>
            {/* Segmented control */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
              {modes.map((m) => {
                const Icon = m.icon
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={
                      active
                        ? "flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
                        : "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                Nom complet *
                <input
                  required
                  name="nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Votre nom"
                />
              </label>

              <label className="block text-sm font-semibold">
                Téléphone *
                <input
                  required
                  name="telephone"
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="+242 …"
                />
              </label>

              <label className="block text-sm font-semibold">
                Email <span className="font-normal text-muted-foreground">(pour recevoir le devis)</span>
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="vous@exemple.com"
                />
              </label>

              {mode === "reservation" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-semibold">
                    Date *
                    <input
                      required
                      name="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Heure *
                    <input
                      required
                      name="heure"
                      type="time"
                      value={heure}
                      onChange={(e) => setHeure(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                    />
                  </label>
                </div>
              )}

              {mode === "commande" ? (
                <>
                  <DeliveryChoiceBlock value={delivery} onChange={setDelivery} />
                  {delivery.mode === "DELIVERY" && (
                    <label className="block text-sm font-semibold">
                      Adresse de livraison *
                      <input
                        required
                        name="adresse"
                        value={adresse}
                        onChange={(e) => setAdresse(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                        placeholder="Quartier, rue, repère…"
                      />
                    </label>
                  )}
                </>
              ) : (
                <label className="block text-sm font-semibold">
                  Lieu de livraison / retrait *
                  <input
                    required
                    name="adresse"
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                    placeholder="Quartier, rue, repère…"
                  />
                </label>
              )}

              <label className="block text-sm font-semibold">
                Notes
                <textarea
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Précisions utiles (événement, accès, volume…)"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-full bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Traitement..."
                : `${mode === "reservation" ? "Confirmer la pré-commande" : "Valider la commande"} — ${formatPrice(mode === "reservation" ? subtotal + deliveryFee : orderTotal)}`
              }
            </button>

            {error && (
              <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Paiement à la livraison : espèces ou Mobile Money.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
