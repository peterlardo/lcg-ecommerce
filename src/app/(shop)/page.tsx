import Link from "next/link"
import Image from "next/image"
import { ProductCard } from "@/components/shared/product-card"
import { getFeaturedProducts } from "@/data/products"
import { ArrowRight } from "lucide-react"

const features = [
  {
    icon: <span className="text-3xl">💎</span>,
    title: "100% eau minérale",
    description: "Nos glaçons sont fabriqués à partir d'eau minérale pure, filtrée et contrôlée.",
  },
  {
    icon: <span className="text-3xl">🧊</span>,
    title: "Hygiène irréprochable",
    description: "Production en laboratoire certifié, manipulations stériles et emballages scellés.",
  },
  {
    icon: <span className="text-3xl">🚚</span>,
    title: "Livraison rapide",
    description: "Livraison en véhicule réfrigéré dans tout Brazzaville, sous 2 à 4 heures.",
  },
  {
    icon: <span className="text-3xl">🎉</span>,
    title: "Réservation événement",
    description: "Commandez à l'avance pour vos événements et soyez livrés le jour J.",
  },
]

export default function HomePage() {
  const featuredProducts = getFeaturedProducts()

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=700&q=85"
            alt="Glaçons LCG"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              La fraîcheur pure, livrée chez vous
            </h1>
            <p className="text-lg sm:text-xl text-primary-100 leading-relaxed mb-10">
              LCG produit des glaçons premium à partir d&apos;eau minérale, dans une usine
              aux normes HACCP à Brazzaville. Fraîcheur, hygiène et fiabilité.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/produits"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-colors text-base"
              >
                Commander des glaçons
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/a-propos"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-base"
              >
                Découvrir LCG
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-20 bg-gray-50">
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
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
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
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Voir tout <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/produits"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
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
                src="https://images.unsplash.com/photo-1581093588404-f3f0ef0e0f3e?w=700&q=85"
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
                  <div className="text-2xl font-bold text-primary-600">+50</div>
                  <div className="text-xs text-gray-500 mt-1">Clients actifs</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">8</div>
                  <div className="text-xs text-gray-500 mt-1">Produits disponibles</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-primary-800 to-primary-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            Un événement en préparation ?
          </h2>
          <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
            Mariage, anniversaire, fête d&apos;entreprise ? Nous livrons la quantité qu&apos;il
            vous faut, avec une option de réservation événementielle.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-colors"
          >
            Nous contacter <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
