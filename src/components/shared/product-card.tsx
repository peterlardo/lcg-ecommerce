"use client"

import Link from "next/link"
import Image from "next/image"
import { Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useCart } from "@/contexts/cart-context"
import { useState } from "react"

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

  const badgeClass = product.badge === "Best-seller"
    ? "bg-amber-100 text-amber-800"
    : product.badge === "Premium"
    ? "bg-purple-100 text-purple-800"
    : product.badge === "Pro"
    ? "bg-blue-100 text-blue-800"
    : ""

  return (
    <Link
      href={`/produits/${product.id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-md"
    >
      <div className="relative h-48 bg-gray-50 overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <Package className="h-12 w-12" />
          </div>
        )}
        {product.badge && (
          <span className={`absolute top-3 left-3 px-2 py-0.5 text-xs font-semibold rounded-full ${badgeClass}`}>
            {product.badge}
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-4">
        <h3 className="font-semibold text-sm text-gray-900 leading-snug mb-1">
          {product.name}
        </h3>
        {product.subtitle && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">
            {product.subtitle}
          </p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <span className="font-bold text-sm text-gray-900">
              {formatPrice(firstVar.price)}
            </span>
            <span className="block text-xs text-gray-400">{firstVar.format}</span>
          </div>
          <button
            onClick={handleAdd}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              added
                ? "bg-green-500 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {added ? "Ajouté ✓" : "Ajouter"}
          </button>
        </div>
      </div>
    </Link>
  )
}
