"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"
import { formatPrice, generateOrderNumber } from "@/lib/utils"
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, CreditCard, Smartphone, Banknote, CalendarRange } from "lucide-react"

const paymentMethods = [
  { id: "card", label: "Carte bancaire", icon: CreditCard },
  { id: "mobile", label: "Mobile Money", icon: Smartphone },
  { id: "cod", label: "Paiement à la livraison", icon: Banknote },
]

const tabs = [
  { id: "commande", label: "Commander", icon: ShoppingCart },
  { id: "reservation", label: "Réserver", icon: CalendarRange },
]

interface OrderForm {
  name: string
  email: string
  phone: string
  address: string
  city: string
  district: string
  notes: string
}

export default function CartPage() {
  const router = useRouter()
  const { items, subtotal, clearCart, removeItem, updateQuantity } = useCart()
  const [tab, setTab] = useState("commande")

  const [paymentMethod, setPaymentMethod] = useState("cod")
  const [submitting, setSubmitting] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderForm>({
    name: "", email: "", phone: "", address: "", city: "Brazzaville", district: "", notes: "",
  })

  const [contactForm, setContactForm] = useState({
    nom: "", telephone: "", email: "", objet: "Réservation événement", message: "",
  })
  const [sent, setSent] = useState(false)

  const deliveryFee = 0
  const total = subtotal + deliveryFee

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const order = {
      number: generateOrderNumber(), items, subtotal, deliveryFee, total, paymentMethod, customer: orderForm,
      createdAt: new Date().toISOString(),
    }
    console.log("Nouvelle commande :", order)
    await new Promise((r) => setTimeout(r, 1000))
    clearCart()
    router.push(`/commande/succes?order=${order.number}`)
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      })
      if (!res.ok) throw new Error("Erreur lors de l'envoi")
      setSent(true)
      setContactForm({ nom: "", telephone: "", email: "", objet: "Réservation événement", message: "" })
      setTimeout(() => setSent(false), 3000)
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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
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
                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border-2 border-primary/20 bg-card p-1 shadow-card-soft">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-frost"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Formulaire actif */}
      <div className="mt-6 rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-card-soft">
        {tab === "commande" ? (
          <form onSubmit={handleOrderSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom complet *</label>
                <input required value={orderForm.name} onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Votre nom" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email *</label>
                <input required type="email" value={orderForm.email} onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="votre@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Téléphone *</label>
                <input required type="tel" value={orderForm.phone} onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="+242 XX XXX XXX" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Ville *</label>
                <input required value={orderForm.city} onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Brazzaville" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold mb-1">Adresse *</label>
                <input required value={orderForm.address} onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Numéro, rue, quartier" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Quartier</label>
                <input value={orderForm.district} onChange={(e) => setOrderForm({ ...orderForm, district: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Ex : Moungali" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Notes</label>
                <input value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Instructions" />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Moyen de paiement</p>
              <div className="space-y-2">
                {paymentMethods.map((method) => {
                  const Icon = method.icon
                  return (
                    <label key={method.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === method.id ? "border-primary/40 bg-primary/5" : "border-border hover:border-muted-foreground/30"
                      }`}>
                      <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id}
                        onChange={(e) => setPaymentMethod(e.target.value)} className="accent-primary" />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{method.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <hr className="border-border" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span className="font-semibold text-foreground">{formatPrice(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Livraison</span><span className="font-semibold text-green-600">Gratuite</span></div>
              <hr className="border-border" />
              <div className="flex justify-between text-base"><span className="font-bold text-foreground">Total</span><span className="font-bold text-foreground">{formatPrice(total)}</span></div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03] disabled:opacity-50">
              {submitting ? "Traitement..." : "Confirmer la commande"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm font-semibold sm:col-span-2">
                Nom complet *
                <input required value={contactForm.nom} onChange={(e) => setContactForm({ ...contactForm, nom: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Votre nom" />
              </label>
              <label className="block text-sm font-semibold">
                Téléphone *
                <input required type="tel" value={contactForm.telephone} onChange={(e) => setContactForm({ ...contactForm, telephone: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="+242 …" />
              </label>
              <label className="block text-sm font-semibold">
                E-mail
                <input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="vous@exemple.com" />
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Objet
                <select value={contactForm.objet} onChange={(e) => setContactForm({ ...contactForm, objet: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2">
                  <option>Question générale</option>
                  <option>Devis professionnel</option>
                  <option>Réservation événement</option>
                  <option>Suivi de commande</option>
                </select>
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Message *
                <textarea required rows={5} value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2 resize-none"
                  placeholder="Votre message…" />
              </label>
            </div>
            <button type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]">
              {sent ? "Message envoyé ✓" : "Envoyer le message"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
