import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getProductById, getProducts } from "@/data/store"
import { ProductCard } from "@/components/shared/product-card"
import { ProductVariantSelector } from "./variant-selector"
import { siteConfig } from "@/lib/site"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = await getProductById(id)

  if (!product) {
    return { title: "Produit introuvable" }
  }

  const description =
    product.description ??
    `${product.name} en eau minérale — ${product.categoryName}. Disponible en plusieurs formats avec livraison rapide à Brazzaville.`

  return {
    title: product.name,
    description,
    alternates: { canonical: `/produits/${product.id}` },
    openGraph: {
      title: `${product.name} | LCG`,
      description,
      images: product.image ? [product.image] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProductById(id)

  if (!product) {
    notFound()
  }

  const allProducts = await getProducts()
  const related = allProducts
    .filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id)
    .slice(0, 4)

  const minPrice = product.variants.length
    ? Math.min(...product.variants.map((v) => v.price))
    : undefined

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.name,
    image: product.image ? `${siteConfig.url}${product.image}` : undefined,
    category: product.categoryName ?? undefined,
    brand: {
      "@type": "Brand",
      name: "LCG — La Congolaise des Glaçons",
    },
    ...(minPrice !== undefined && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "XAF",
        lowPrice: minPrice,
        availability:
          product.variants.some((v) => v.stock > 0)
            ? "https://schema.org/InStock"
            : "https://schema.org/PreOrder",
      },
    }),
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

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
