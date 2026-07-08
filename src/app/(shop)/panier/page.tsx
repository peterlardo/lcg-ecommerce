"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, Package, CalendarRange, Check, Truck, BadgeCheck, Sparkles, Clock, Users } from "lucide-react"

const eventTypes = [
  "Mariage",
  "Anniversaire",
  "Soirée privée",
  "Séminaire",
  "Fête publique",
  "Autre",
]

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart()
  const [reservationSent, setReservationSent] = useState(false)
  const [resForm, setResForm] = useState({
    client: "",
    telephone: "",
    email: "",
    type: "Mariage",
    date: "",
    heure: "",
    inviteCount: 50,
    notes: "",
  })

  const deliveryFee = 0
  const total = subtotal + deliveryFee

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: resForm.client,
          telephone: resForm.telephone,
          email: resForm.email,
          objet: `Réservation ${resForm.type} — ${resForm.date} à ${resForm.heure} (${resForm.inviteCount} invités)`,
          message: resForm.notes || "Aucune note",
        }),
      })
      setReservationSent(true)
      setResForm({ client: "", telephone: "", email: "", type: "Mariage", date: "", heure: "", inviteCount: 50, notes: "" })
      setTimeout(() => setReservationSent(false), 4000)
    } catch (err) {
      console.error("Erreur:", err)
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ice-gradient text-primary">
          <ShoppingCart className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">Votre panier est vide</h1>
        <p className="mt-3 text-muted-foreground">Parcourez notre catalogue de glaçons en eau minérale et ajoutez vos produits.</p>
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">Mon panier</h1>
        <button onClick={clearCart} className="text-sm text-muted-foreground hover:text-destructive transition-colors">
          Vider le panier
        </button>
      </div>

      <div className="space-y-4 mb-10">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card-soft">
            <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden bg-ice-gradient flex-shrink-0">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs">N/A</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/produits/${item.productId}`}
                className="font-display text-sm sm:text-base font-bold text-foreground hover:text-primary leading-snug"
              >
                {item.name}
              </Link>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{item.format}</p>
              <p className="text-sm font-bold text-primary mt-2">{formatPrice(item.price)}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <button onClick={() => removeItem(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" aria-label="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="flex items-center rounded-lg border border-border">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Diminuer">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-foreground">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Augmenter">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* COLONNE COMMANDE */}
        <div className="rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-card-soft relative">
          <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-frost">
            <Package className="h-3.5 w-3.5" />
            Commande
          </div>
          <div className="mt-3 space-y-4">
            <div>
              <h3 className="font-display text-lg font-extrabold tracking-tight">Acheter maintenant</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Commandez vos glaçons et recevez-les rapidement à votre adresse.
              </p>
            </div>

            <ul className="space-y-2 text-sm">
              {[
                { icon: Truck, text: "Livraison rapide à Brazzaville" },
                { icon: BadgeCheck, text: "Paiement sécurisé" },
                { icon: Clock, text: "Livraison en 24h – 48h" },
              ].map((feat) => {
                const Icon = feat.icon
                return (
                  <li key={feat.text} className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-muted-foreground">{feat.text}</span>
                  </li>
                )
              })}
            </ul>

            <hr className="border-border" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="font-semibold text-foreground">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Livraison</span>
                <span className="font-semibold text-green-600">Gratuite</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between text-base">
                <span className="font-bold text-foreground">Total</span>
                <span className="font-bold text-foreground">{formatPrice(total)}</span>
              </div>
            </div>

            <Link
              href="/commande"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
            >
              Commander
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* COLONNE RÉSERVATION */}
        <div className="rounded-2xl border-2 border-accent/20 bg-card p-6 shadow-card-soft relative">
          <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1 text-xs font-bold text-accent-foreground shadow-frost">
            <CalendarRange className="h-3.5 w-3.5" />
            Réservation
          </div>
          <div className="mt-3 space-y-4">
            <div>
              <h3 className="font-display text-lg font-extrabold tracking-tight">Réserver pour un événement</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Vous organisez un événement ? Réservez vos glaçons à l&apos;avance et obtenez un devis personnalisé.
              </p>
            </div>

            <ul className="space-y-2 text-sm">
              {[
                { icon: Users, text: "Mariages, anniversaires, séminaires…" },
                { icon: Sparkles, text: "Devis personnalisé selon vos besoins" },
                { icon: CalendarRange, text: "Planifiez jusqu&apos;à plusieurs semaines" },
              ].map((feat) => {
                const Icon = feat.icon
                return (
                  <li key={feat.text} className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-muted-foreground">{feat.text}</span>
                  </li>
                )
              })}
            </ul>

            <hr className="border-border" />

            {reservationSent ? (
              <div className="flex flex-col items-center justify-center rounded-xl bg-green-50 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-6 w-6" />
                </div>
                <p className="mt-3 font-display text-sm font-bold text-green-800">Demande envoyée ✓</p>
                <p className="text-xs text-green-600 mt-1">Nous vous recontacterons rapidement.</p>
              </div>
            ) : (
              <form onSubmit={handleReservation} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm font-semibold">
                    Nom complet *
                    <input required value={resForm.client} onChange={(e) => setResForm({ ...resForm, client: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                      placeholder="Votre nom" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Téléphone *
                    <input required type="tel" value={resForm.telephone} onChange={(e) => setResForm({ ...resForm, telephone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                      placeholder="+242 …" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Email
                    <input type="email" value={resForm.email} onChange={(e) => setResForm({ ...resForm, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                      placeholder="vous@exemple.com" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Type d&apos;événement
                    <select value={resForm.type} onChange={(e) => setResForm({ ...resForm, type: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2">
                      {eventTypes.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold">
                    Date *
                    <input required type="date" value={resForm.date} onChange={(e) => setResForm({ ...resForm, date: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Heure
                    <input type="time" value={resForm.heure} onChange={(e) => setResForm({ ...resForm, heure: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2" />
                  </label>
                  <label className="block text-sm font-semibold sm:col-span-2">
                    Nombre d&apos;invités
                    <input type="number" min={1} value={resForm.inviteCount} onChange={(e) => setResForm({ ...resForm, inviteCount: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2" />
                  </label>
                  <label className="block text-sm font-semibold sm:col-span-2">
                    Notes / Besoins spécifiques
                    <textarea rows={3} value={resForm.notes} onChange={(e) => setResForm({ ...resForm, notes: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2 resize-none"
                      placeholder="Dites-nous en plus sur votre événement…" />
                  </label>
                </div>
                <button type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground shadow-frost transition-transform hover:scale-[1.03]">
                  <CalendarRange className="h-4 w-4" />
                  Envoyer la demande
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
