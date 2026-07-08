import Link from "next/link"
import Image from "next/image"
import { ProductCard } from "@/components/shared/product-card"
import { products, categories } from "@/data/products"
import { cn } from "@/lib/utils"

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>
}) {
  const params = await searchParams
  const activeCategory = params.categorie ?? "all"
  const filteredProducts = activeCategory === "all"
    ? products
    : products.filter((p) => p.categorySlug === activeCategory)

  const filterLinks = [
    { slug: "all", label: "Tous les produits" },
    ...categories.map((c) => ({ slug: c.slug, label: c.name })),
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">Nos produits</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 mb-4">
            Le catalogue LCG
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Tous nos glaçons sont fabriqués à partir d&apos;eau minérale contrôlée et livrés en conditionnement scellé. Ajoutez vos produits au panier puis choisissez livraison immédiate ou réservation à une date donnée.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filterLinks.map((f) => (
            <Link
              key={f.slug}
              href={f.slug === "all" ? "/produits" : `/produits?categorie=${f.slug}`}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                activeCategory === f.slug
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Aucun produit trouvé</p>
            <Link href="/produits" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              Voir tous les produits
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
