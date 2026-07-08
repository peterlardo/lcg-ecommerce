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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
        <span>/</span>
        <Link href="/produits" className="hover:text-primary transition-colors">Produits</Link>
        <span>/</span>
        <span className="text-foreground font-semibold">{product.name}</span>
      </nav>

      {/* Product Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
        <div className="overflow-hidden rounded-3xl shadow-frost">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              width="1200"
              height="1200"
              className="h-full w-full object-cover"
              priority
            />
          ) : (
            <div className="flex items-center justify-center h-96 text-muted-foreground text-lg bg-muted">
              Image non disponible
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{product.categoryName}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-3">
            {product.name}
          </h1>
          {product.subtitle && (
            <p className="text-muted-foreground mb-6">{product.subtitle}</p>
          )}
          {product.description && (
            <p className="text-muted-foreground leading-relaxed mb-8">{product.description}</p>
          )}

          <ProductVariantSelector product={product} />
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-6">
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
