"use client"

import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react"

interface Variant {
  id: string
  format: string
  price: number
  unit: string | null
  promoPrice?: number | null
}

interface ProductCardProps {
  product: {
    id: string
    name: string
    subtitle: string | null
    image: string | null
    badge: string | null
    promo?: { name: string; percent: number } | null
    variants: Variant[]
  }
}

const finalPrice = (v: Variant) => v.promoPrice ?? v.price

// "2kg" -> "sac 2 kg"
const variantLabel = (v: Variant) => [v.unit, v.format.replace(/(\d)\s*([a-zA-Z])/g, "$1 $2")].filter(Boolean).join(" ")

/**
 * Carte vitrine : le produit seul, sans format. Le choix de la variante (sac 1 kg,
 * 2 kg, 5 kg…) se fait au moment de commander, dans la fenêtre ouverte par « Commander ».
 */
export function ProductCard({ product }: ProductCardProps) {
  const [picking, setPicking] = useState(false)
  const [added, setAdded] = useState(false)
  const cheapest = product.variants.reduce<Variant | null>((min, v) => (!min || finalPrice(v) < finalPrice(min) ? v : min), null)
  const several = product.variants.length > 1

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-frost">
      <Link href={`/produits/${product.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden bg-ice-gradient">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              width={800}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-4xl">🧊</div>
          )}
          {product.badge && (
            <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
              {product.badge}
            </span>
          )}
          {product.promo && (
            <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              -{product.promo.percent}%
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-5 pt-5">
          <h3 className="font-display text-base font-bold leading-snug">{product.name}</h3>
          {product.subtitle && (
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{product.subtitle}</p>
          )}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-4">
        {cheapest ? (
          <div>
            {several && <p className="text-xs text-muted-foreground">À partir de</p>}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-display text-lg font-bold text-primary">{formatPrice(finalPrice(cheapest))}</p>
              {cheapest.promoPrice != null && (
                <p className="text-xs text-muted-foreground line-through">{formatPrice(cheapest.price)}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Momentanément indisponible</p>
        )}
        {cheapest && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-105 ${
              added ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
            }`}
          >
            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {added ? "Ajouté" : "Commander"}
          </button>
        )}
      </div>
      {picking && (
        <VariantPicker
          product={product}
          onClose={() => setPicking(false)}
          onAdded={() => {
            setPicking(false)
            setAdded(true)
            setTimeout(() => setAdded(false), 1500)
          }}
        />
      )}
    </div>
  )
}

function VariantPicker({
  product,
  onClose,
  onAdded,
}: {
  product: ProductCardProps["product"]
  onClose: () => void
  onAdded: () => void
}) {
  const { addItem } = useCart()
  // Du plus petit au plus grand conditionnement (l'ordre en base n'est pas garanti).
  const variants = [...product.variants].sort((a, b) => finalPrice(a) - finalPrice(b))
  // Une quantité par variante : le client compose sa commande (ex. 3 × sac 1 kg + 2 × sac 5 kg).
  // Produit à variante unique : 1 d'office.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    variants.length === 1 ? { [variants[0].id]: 1 } : {}
  )
  const qty = (id: string) => quantities[id] ?? 0
  const setQty = (id: string, n: number) => setQuantities((q) => ({ ...q, [id]: Math.max(0, n) }))
  const totalUnits = variants.reduce((sum, v) => sum + qty(v.id), 0)
  const totalPrice = variants.reduce((sum, v) => sum + qty(v.id) * finalPrice(v), 0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const handleAdd = () => {
    for (const variant of variants) {
      for (let i = 0; i < qty(variant.id); i++) {
        addItem({
          id: variant.id,
          productId: product.id,
          name: product.name,
          image: product.image || "",
          format: variant.format,
          price: finalPrice(variant),
        })
      }
    }
    onAdded()
  }

  // Portail vers <body> : la carte a un transform au survol, qui piégerait un position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Commander ${product.name}`}
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-frost"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Commander</p>
            <h3 className="mt-1 font-display text-lg font-bold">{product.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm font-semibold">Choisissez vos formats et quantités :</p>
        <div className="mt-2 space-y-2">
          {variants.map((variant) => {
            const n = qty(variant.id)
            return (
              <div
                key={variant.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  n > 0 ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border"
                }`}
              >
                <div>
                  <p className={`font-semibold ${n > 0 ? "text-primary" : ""}`}>{variantLabel(variant)}</p>
                  <p>
                    <span className="font-bold text-primary">{formatPrice(finalPrice(variant))}</span>
                    {variant.promoPrice != null && (
                      <span className="ml-2 text-xs text-muted-foreground line-through">{formatPrice(variant.price)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(variant.id, n - 1)}
                    disabled={n === 0}
                    aria-label={`Retirer un ${variantLabel(variant)}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:border-primary disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-bold" aria-live="polite">{n}</span>
                  <button
                    type="button"
                    onClick={() => setQty(variant.id, n + 1)}
                    aria-label={`Ajouter un ${variantLabel(variant)}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:border-primary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={totalUnits === 0}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <ShoppingCart className="h-5 w-5" />
          {totalUnits === 0 ? "Choisissez une quantité" : `Ajouter ${totalUnits} article${totalUnits > 1 ? "s" : ""} · ${formatPrice(totalPrice)}`}
        </button>
      </div>
    </div>,
    document.body
  )
}
