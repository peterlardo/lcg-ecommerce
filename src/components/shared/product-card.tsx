import Link from "next/link"
import Image from "next/image"
import { Package } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ProductCardProps {
  product: {
    id: string
    name: string
    subtitle: string | null
    image: string | null
    variants: { id: string; format: string; price: number }[]
  }
}

export function ProductCard({ product }: ProductCardProps) {
  const minPrice = Math.min(...product.variants.map((v) => v.price))

  return (
    <Link
      href={`/produits/${product.id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-lg"
    >
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Package className="h-12 w-12" />
          </div>
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
          <span className="font-bold text-sm text-gray-900">
            {formatPrice(minPrice)}
          </span>
          <span className="text-xs text-gray-500">à partir de</span>
        </div>
      </div>
    </Link>
  )
}

