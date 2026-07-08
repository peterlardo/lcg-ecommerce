"use client"

import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight } from "lucide-react"

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart()
  const deliveryFee = 0
  const total = subtotal + deliveryFee

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-4">
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

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft sticky top-24">
            <h2 className="font-display text-lg font-bold mb-4">Résumé de la commande</h2>
            <div className="space-y-3 text-sm">
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
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
            >
              Commander
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
