import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getProductById, getProductsByCategory } from "@/data/products"
import { ProductCard } from "@/components/shared/product-card"
import { ProductVariantSelector } from "./variant-selector"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = getProductById(id)

  if (!product) {
    notFound()
  }

  const related = getProductsByCategory(product.categorySlug).filter(
    (p) => p.id !== product.id
  ).slice(0, 4)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-blue-600 transition-colors">Accueil</Link>
        <span>/</span>
        <Link href="/produits" className="hover:text-blue-600 transition-colors">Produits</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      {/* Product Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
        <div className="relative h-72 sm:h-96 lg:h-[500px] rounded-xl overflow-hidden bg-gray-100">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-lg">
              Image non disponible
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <p className="text-sm text-blue-600 font-medium mb-2">{product.categoryName}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>
          {product.subtitle && (
            <p className="text-gray-500 mb-6">{product.subtitle}</p>
          )}
          {product.description && (
            <p className="text-gray-600 leading-relaxed mb-8">{product.description}</p>
          )}

          <ProductVariantSelector product={product} />
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
            Produits associés
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
