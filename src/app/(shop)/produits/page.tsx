"use client"

import { ProductCard } from "@/components/shared/product-card"
import { categories } from "@/data/products"
import { useState, useEffect } from "react"
import { Search } from "lucide-react"

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

export default function ProduitsPage() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

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
    { slug: "all", label: "Tous les produits" },
    ...categories.map((c) => ({ slug: c.slug, label: c.name })),
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Nos produits</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Le catalogue LCG</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Tous nos glaçons sont fabriqués à partir d&apos;eau minérale contrôlée et livrés en conditionnement scellé. Ajoutez vos produits au panier puis choisissez livraison immédiate ou pré-commande à une date donnée.
        </p>
      </div>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {filterButtons.map((f) => (
          <button
            key={f.slug}
            type="button"
            onClick={() => setActiveCategory(f.slug)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
              activeCategory === f.slug
                ? "bg-primary text-primary-foreground shadow-frost"
                : "border border-border bg-card font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-card overflow-hidden">
              <div className="aspect-square bg-muted" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-5 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Aucun produit trouvé</p>
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className="mt-2 text-sm font-bold text-primary hover:text-primary-glow transition-colors"
          >
            Voir tous les produits
          </button>
        </div>
      )}
    </div>
  )
}
