import Link from "next/link"
import { ProductCard } from "@/components/shared/product-card"
import { products, categories, getProductsByCategory } from "@/data/products"
import { cn } from "@/lib/utils"

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>
}) {
  const params = await searchParams
  const activeCategory = params.categorie ?? "all"
  const filteredProducts = getProductsByCategory(activeCategory)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Nos produits</h1>
        <p className="text-gray-500">
          Des glaçons premium pour tous les besoins
        </p>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/produits"
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
            activeCategory === "all"
              ? "bg-primary-500 text-white border-primary-500"
              : "bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600"
          )}
        >
          Tous
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/produits?categorie=${cat.slug}`}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
              activeCategory === cat.slug
                ? "bg-primary-500 text-white border-primary-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600"
            )}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Aucun produit trouvé</p>
          <Link href="/produits" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
            Voir tous les produits
          </Link>
        </div>
      )}
    </div>
  )
}
