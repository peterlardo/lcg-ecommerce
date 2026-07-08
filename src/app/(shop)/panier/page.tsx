"use client"

import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react"

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart()
  const deliveryFee = 0
  const total = subtotal + deliveryFee

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Votre panier est vide</h1>
        <p className="text-gray-500 mb-8">Parcourez notre catalogue de glaçons en eau minérale et ajoutez vos produits.</p>
        <Link
          href="/produits"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Voir le catalogue <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mon panier</h1>
        <button onClick={clearCart} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
          Vider le panier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300 text-xs">N/A</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/produits/${item.productId}`}
                  className="font-semibold text-sm sm:text-base text-gray-900 hover:text-blue-600 line-clamp-1"
                >
                  {item.name}
                </Link>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{item.format}</p>
                <p className="text-sm font-semibold text-gray-900 mt-2">{formatPrice(item.price)}</p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Diminuer">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Augmenter">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-24">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé de la commande</h2>
            <div className="space-y-3 text-sm">
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
            <Link
              href="/commande"
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Commander <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
