"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { formatPrice, generateOrderNumber } from "@/lib/utils"
import { CreditCard, Smartphone, Banknote, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"

const paymentMethods = [
  { id: "card", label: "Carte bancaire", icon: CreditCard },
  { id: "mobile", label: "Mobile Money", icon: Smartphone },
  { id: "cod", label: "Paiement à la livraison", icon: Banknote },
]

interface FormData {
  name: string
  email: string
  phone: string
  address: string
  city: string
  district: string
  notes: string
}

export default function CommandePage() {
  const router = useRouter()
  const { items, subtotal, clearCart, removeItem, updateQuantity } = useCart()
  const [paymentMethod, setPaymentMethod] = useState("cod")
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Brazzaville",
    district: "",
    notes: "",
  })

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const deliveryFee = 0
  const total = subtotal + deliveryFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const order = {
      number: generateOrderNumber(),
      items,
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
      customer: form,
      createdAt: new Date().toISOString(),
    }

    console.log("Nouvelle commande :", order)

    await new Promise((r) => setTimeout(r, 1000))
    clearCart()
    router.push(`/commande/succes?order=${order.number}`)
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Votre panier est vide</h1>
        <p className="text-gray-500 mb-8">Ajoutez des produits avant de commander.</p>
        <Link
          href="/produits"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
        >
          Voir les produits
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="mb-8">
        <Link
          href="/panier"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au panier
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">Finaliser la commande</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Form Fields */}
          <div className="lg:col-span-2 space-y-8">
            {/* Customer Info */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet *
                  </label>
                  <input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="votre@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="+242 XX XXX XXX"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                    Ville *
                  </label>
                  <input
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Brazzaville"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse *
                  </label>
                  <input
                    id="address"
                    required
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Numéro, rue, quartier"
                  />
                </div>
                <div>
                  <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
                    Quartier / Arrondissement
                  </label>
                  <input
                    id="district"
                    value={form.district}
                    onChange={(e) => updateField("district", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Ex : Moungali"
                  />
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    id="notes"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Instructions particulières"
                  />
                </div>
              </div>
            </section>

            {/* Payment Method */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Moyen de paiement</h2>
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon
                  return (
                    <label
                      key={method.id}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        paymentMethod === method.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="accent-primary-500"
                      />
                      <Icon className="h-5 w-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">{method.label}</span>
                    </label>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-24 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Récapitulatif</h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.image && (
                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.format}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">x{item.quantity}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-300 hover:text-red-500 self-start"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <hr className="border-gray-200" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sous-total</span>
                  <span className="font-medium text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Livraison</span>
                  <span className="font-medium text-green-600">Gratuite</span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between text-base">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">{formatPrice(total)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Traitement en cours..." : "Confirmer la commande"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
