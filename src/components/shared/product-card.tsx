"use client"

import Link from "next/link"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import { useState } from "react"
import { Plus } from "lucide-react"

interface ProductCardProps {
  product: {
    id: string
    name: string
    subtitle: string | null
    image: string | null
    badge: string | null
    variants: { id: string; format: string; price: number; unit: string | null }[]
  }
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const firstVar = product.variants[0]

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem({
      id: firstVar.id,
      productId: product.id,
      name: product.name,
      image: product.image || "",
      format: firstVar.format,
      price: firstVar.price,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <Link
      href={`/produits/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-frost"
    >
      <div className="relative aspect-square overflow-hidden bg-ice-gradient">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            width="800"
            height="800"
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
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-base font-bold leading-snug">{product.name}</h3>
        {product.subtitle && (
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{product.subtitle}</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-primary">{formatPrice(firstVar.price)}</p>
            <p className="text-xs text-muted-foreground">{firstVar.format}</p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-105 ${
              added
                ? "bg-green-600 text-white"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Plus className="h-4 w-4" />
            {added ? "Ajouté ✓" : "Ajouter"}
          </button>
        </div>
      </div>
    </Link>
  )
}
