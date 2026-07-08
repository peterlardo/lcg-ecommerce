"use client"

import { useState } from "react"
import { ShoppingCart, Check } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { formatPrice, cn } from "@/lib/utils"
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
    return <p className="text-gray-400 text-sm">Ce produit est momentanément indisponible.</p>
  }

  return (
    <div className="space-y-6">
      {/* Format Selector */}
      <div>
        <p className="text-sm font-medium text-gray-900 mb-3">Choisir un format :</p>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => setSelectedVariantId(variant.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium rounded-lg border transition-all",
                selectedVariantId === variant.id
                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
              )}
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
          <p className="text-sm text-gray-500 mb-1">Prix</p>
          <p className="text-3xl font-bold text-gray-900">{formatPrice(selectedVariant.price)}</p>
        </div>
      )}

      {/* Add to Cart */}
      <button
        onClick={handleAddToCart}
        className={cn(
          "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 font-semibold rounded-xl transition-all text-base",
          added
            ? "bg-green-500 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        )}
      >
        <ShoppingCart className={cn("h-5 w-5", added && "hidden")} />
        {added ? "Ajouté au panier !" : "Ajouter au panier"}
      </button>
    </div>
  )
}
