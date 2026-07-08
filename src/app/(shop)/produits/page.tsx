"use client"

import { ProductCard } from "@/components/shared/product-card"
import { products, categories } from "@/data/products"
import { useState } from "react"

export default function ProduitsPage() {
  const [activeCategory, setActiveCategory] = useState("all")

  const filtered = activeCategory === "all"
    ? products
    : products.filter((p) => p.categorySlug === activeCategory)

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
          Tous nos glaçons sont fabriqués à partir d&apos;eau minérale contrôlée et livrés en conditionnement scellé. Ajoutez vos produits au panier puis choisissez livraison immédiate ou réservation à une date donnée.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
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

      {filtered.length > 0 ? (
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
