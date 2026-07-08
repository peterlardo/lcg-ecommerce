"use client"

import { useState } from "react"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import {
  ShoppingCart, Truck, CalendarClock, Plus, Minus, Trash2,
  ArrowRight, CircleCheck,
} from "lucide-react"

const modes = [
  { id: "commande", label: "Commande", icon: Truck },
  { id: "reservation", label: "Réservation", icon: CalendarClock },
]

export default function CartPage() {
  const { items, subtotal, itemCount, removeItem, updateQuantity, clearCart } = useCart()
  const [mode, setMode] = useState("commande")
  const [success, setSuccess] = useState<{ mode: string; ref: string } | null>(null)
  const [nom, setNom] = useState("")
  const [telephone, setTelephone] = useState("")
  const [date, setDate] = useState("")
  const [heure, setHeure] = useState("")
  const [adresse, setAdresse] = useState("")
  const [notes, setNotes] = useState("")

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
          {success.mode === "reservation" ? "Réservation enregistrée !" : "Commande enregistrée !"}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Référence <strong className="text-foreground">{success.ref}</strong>. Notre équipe vous contactera très rapidement pour confirmer{" "}
          {success.mode === "reservation" ? "votre réservation" : "la livraison"} et le paiement (espèces ou Mobile Money).
        </p>
        <Link
          href="/produits"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
        >
          Continuer mes achats
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ref = `LCG-${Date.now().toString(36).toUpperCase().slice(-6)}`
    clearCart()
    setSuccess({ mode, ref })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        Votre panier
      </h1>
      <p className="mt-2 text-muted-foreground">
        {itemCount} article{itemCount > 1 ? "s" : ""} — choisissez livraison immédiate ou réservation à date.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        {/* Left — items + total */}
        <div className="space-y-4 lg:col-span-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card-soft"
            >
              <img
                src={item.image}
                alt={item.name}
                width={80}
                height={80}
                loading="lazy"
                className="h-20 w-20 rounded-xl object-cover"
              />
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

          <div className="flex items-center justify-between rounded-2xl bg-ice-gradient px-6 py-4">
            <span className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="font-display text-2xl font-extrabold text-primary">
              {formatPrice(subtotal)}
            </span>
          </div>
        </div>

        {/* Right — form */}
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-3xl border border-border bg-card p-7 shadow-card-soft lg:col-span-2"
        >
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

            <label className="block text-sm font-semibold">
              {mode === "reservation" ? "Lieu de livraison / retrait *" : "Adresse de livraison *"}
              <input
                required
                name="adresse"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                placeholder="Quartier, rue, repère…"
              />
            </label>

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
            className="mt-6 w-full rounded-full bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.02]"
          >
            {mode === "reservation" ? "Confirmer la réservation" : "Valider la commande"}
            {' — '}
            {formatPrice(subtotal)}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Paiement à la livraison : espèces ou Mobile Money.
          </p>
        </form>
      </div>
    </div>
  )
}
