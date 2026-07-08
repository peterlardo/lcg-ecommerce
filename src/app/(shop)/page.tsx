import Link from "next/link"
import Image from "next/image"
import { ProductCard } from "@/components/shared/product-card"
import { products } from "@/data/products"
import { ArrowRight, Shield, Truck, Leaf, Award } from "lucide-react"

export default function HomePage() {
  const featuredProducts = products.filter((p) => p.isFeatured)
  const proProducts = products.filter((p) => p.categorySlug === "professionnel")

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <Image
            src="/assets/hero-ice.jpg"
            alt="Glaçons LCG"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/60 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-sm text-white/90 mb-6">
              <Shield className="h-3.5 w-3.5" />
              Eau minérale · Normes HACCP · Livraison réfrigérée
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              La fraîcheur pure,<br />livrée chez vous
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 leading-relaxed mb-10">
              LCG produit des glaçons premium à base d&apos;eau minérale dans son usine à
              Brazzaville. Fraîcheur, hygiène et fiabilité pour particuliers et professionnels.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/produits"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-base shadow-lg"
              >
                Commander des glaçons
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/professionnels"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-base"
              >
                Solution pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Pourquoi choisir LCG ?
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Nous combinons qualité industrielle et service personnalisé.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Leaf className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">100% eau minérale</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Nos glaçons sont fabriqués à partir d&apos;eau minérale pure, filtrée et contrôlée.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Hygiène irréprochable</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Production en laboratoire certifié, manipulations stériles et emballages scellés.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Truck className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Livraison rapide</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Livraison en véhicule réfrigéré dans tout Brazzaville, sous 2 à 4 heures.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Réservation événement</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Commandez à l&apos;avance pour vos événements et soyez livrés le jour J.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Nos catégories
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Des solutions adaptées à chaque besoin
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link href="/produits?categorie=particuliers" className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🏠</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Particuliers</h3>
                <p className="text-sm text-gray-500">Glaçons pour usage quotidien. Sacs de 1 à 10 kg.</p>
              </div>
            </Link>
            <Link href="/professionnels" className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🏢</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Professionnels</h3>
                <p className="text-sm text-gray-500">Big bags, blocs, livraison programmée.</p>
              </div>
            </Link>
            <Link href="/produits?categorie=evenementiel" className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🎉</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Événementiel</h3>
                <p className="text-sm text-gray-500">Packs spéciaux pour vos fêtes et événements.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Nos produits vedettes
              </h2>
              <p className="text-gray-500">Les glaçons préférés de nos clients</p>
            </div>
            <Link
              href="/produits"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Voir tout <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/produits"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Voir tout <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Production Section */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden">
              <Image
                src="/assets/production.jpg"
                alt="Usine LCG Ouenzé"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Une production locale et maîtrisée
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Basée à Ouenzé, Brazzaville, notre unité de production est équipée de machines
                de dernière génération. Nous produisons chaque lot dans le respect strict des
                normes HACCP, garantissant des glaçons d&apos;une pureté et d&apos;une
                transparence exceptionnelles.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">+50</div>
                  <div className="text-xs text-gray-500 mt-1">Clients actifs</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">8</div>
                  <div className="text-xs text-gray-500 mt-1">Produits disponibles</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-blue-700 to-blue-600 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            Un événement en préparation ?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Mariage, anniversaire, fête d&apos;entreprise ? Nous livrons la quantité qu&apos;il
            vous faut, avec une option de réservation événementielle.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Nous contacter <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
