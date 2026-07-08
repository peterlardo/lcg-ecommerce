"use client"

import { useState } from "react"
import { ShoppingCart, Check } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { formatPrice } from "@/lib/utils"
import type { Product } from "@/data/products"

interface Props {
  product: Product
}

export function ProductVariantSelector({ product }: Props) {
  const { addItem } = useCart()
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id)
  const [added, setAdded] = useState(false)

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId)

  const handleAddToCart = () => {
    if (!selectedVariant) return
    addItem({
      id: selectedVariant.id,
      productId: product.id,
      name: product.name,
      image: product.image ?? "",
      format: selectedVariant.format,
      price: selectedVariant.price,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  if (product.variants.length === 0) {
    return <p className="text-muted-foreground text-sm">Ce produit est momentanément indisponible.</p>
  }

  return (
    <div className="space-y-6">
      {/* Format Selector */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Choisir un format :</p>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => setSelectedVariantId(variant.id)}
              className={`px-4 py-3 text-sm font-semibold rounded-xl border transition-all ${
                selectedVariantId === variant.id
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <div className="flex items-center gap-2">
                {selectedVariantId === variant.id && <Check className="h-3.5 w-3.5" />}
                <span>{variant.format}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      {selectedVariant && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Prix</p>
          <p className="font-display text-3xl font-bold text-primary">{formatPrice(selectedVariant.price)}</p>
        </div>
      )}

      {/* Add to Cart */}
      <button
        onClick={handleAddToCart}
        className={`inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03] text-base ${
          added ? "bg-green-600" : "bg-primary"
        }`}
      >
        <ShoppingCart className={`h-5 w-5 ${added ? "hidden" : ""}`} />
        {added ? "Ajouté au panier !" : "Ajouter au panier"}
      </button>
    </div>
  )
}
