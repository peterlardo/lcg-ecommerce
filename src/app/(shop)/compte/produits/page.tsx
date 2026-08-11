"use client"

import { ProductCard } from "@/components/shared/product-card"
import { categories } from "@/data/products"
import { useState, useEffect } from "react"
import { Search, ShoppingCart, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"

interface Product {
  id: string
  name: string
  subtitle: string | null
  description: string | null
  image: string | null
  categoryId: string | null
  categorySlug: string | null
  categoryName: string | null
  isFeatured: boolean
  badge: string | null
  variants: { id: string; format: string; price: number; stock: number; unit: string | null }[]
}

export default function CompteProduitsPage() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { itemCount } = useCart()

  useEffect(() => {
    fetch("/api/produits")
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const q = searchQuery.toLowerCase().trim()

  const filtered = products
    .filter((p) => activeCategory === "all" || p.categorySlug === activeCategory)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.subtitle && p.subtitle.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)))

  const filterButtons = [
    { slug: "all", label: "Tous" },
    ...categories.map((c) => ({ slug: c.slug, label: c.name })),
  ]

  return (
    <div className="p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
            Nos produits
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Parcourez notre catalogue et ajoutez vos glaçons au panier.
          </p>
        </div>
        <Link
          href="/panier"
          className="inline-flex items-center gap-2 rounded-full bg-[#1f4fa3] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#1f4fa3]/25 transition-all hover:shadow-lg"
        >
          <ShoppingCart className="h-4 w-4" />
          Panier
          {itemCount > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              {itemCount}
            </span>
          )}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm outline-none shadow-sm transition focus:border-[#1f4fa3] focus:ring-1 focus:ring-[#1f4fa3]"
        />
      </div>

      {/* Category filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {filterButtons.map((f) => (
          <button
            key={f.slug}
            type="button"
            onClick={() => setActiveCategory(f.slug)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              activeCategory === f.slug
                ? "bg-[#1f4fa3] text-white shadow-md shadow-[#1f4fa3]/25"
                : "border border-border bg-white text-gray-500 hover:border-[#1f4fa3] hover:text-[#1f4fa3]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
              <div className="aspect-square bg-gray-100" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-5 bg-gray-100 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-lg font-semibold text-gray-500">Aucun produit trouvé</p>
          <button
            type="button"
            onClick={() => { setActiveCategory("all"); setSearchQuery("") }}
            className="mt-2 text-sm font-bold text-[#1f4fa3] hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  )
}
