import Link from "next/link"
import Image from "next/image"
import { ProductCard } from "@/components/shared/product-card"
import { products } from "@/data/products"

export default function HomePage() {
  const featuredProducts = products.filter((p) => p.isFeatured).slice(0, 4)

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[500px] flex items-center text-white overflow-hidden">
        <Image
          src="/assets/hero-ice.jpg"
          alt="Glaçons en eau minérale LCG plongeant dans l'eau"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-sm text-white/90 mb-6">
              Brazzaville · Livraison réfrigérée
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
              La fraîcheur pure,<br />livrée chez vous.
            </h1>
            <p className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-xl">
              LCG produit des glaçons haut de gamme à base d&apos;eau minérale : cubes, glace pilée, sphères et blocs. Commandez en ligne ou réservez pour vos événements.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/produits"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Commander des glaçons
              </Link>
              <Link
                href="/professionnels"
                className="inline-flex items-center justify-center px-6 py-3 border border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
              >
                Offres professionnels
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">100 % eau minérale</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Chaque glaçon est produit exclusivement à partir d&apos;eau minérale contrôlée.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Hygiène irréprochable</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Production tracée, conditionnement scellé et chaîne du froid respectée.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Livraison rapide</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Livraison réfrigérée à Brazzaville, du sac 1 kg au big bag 25 kg.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Réservation événement</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Réservez vos volumes à l&apos;avance pour mariages, réceptions et festivals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Catalogue</span>
            <Link href="/produits" className="hidden sm:inline text-sm font-medium text-blue-600 hover:text-blue-700">
              Voir tout le catalogue
            </Link>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
            Nos glaçons phares
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link href="/produits" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Voir tout le catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* Production */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden">
              <Image
                src="/assets/production.jpg"
                alt="Unité de production hygiénique de glaçons LCG"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Notre production</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 mb-4">
                De l&apos;eau minérale au glaçon parfait
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Notre unité de production à Ouenzé, Brazzaville, transforme une eau minérale rigoureusement contrôlée en glaçons cristallins. Chaque lot est tracé, conditionné en sachets scellés et stocké à température négative constante jusqu&apos;à la livraison.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-gray-600 list-disc list-inside">
                <li>Eau minérale filtrée et analysée</li>
                <li>Conditionnements de 1 kg à 25 kg</li>
                <li>Chaîne du froid garantie jusqu&apos;à votre porte</li>
                <li>Capacité de production adaptée aux grands événements</li>
              </ul>
              <Link
                href="/a-propos"
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                Découvrir LCG
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Un événement en préparation ?
          </h2>
          <p className="text-gray-500 text-lg mb-8 max-w-xl mx-auto">
            Réservez vos glaçons à l&apos;avance — mariage, réception, bar éphémère ou festival — et soyez livré à la date et au lieu de votre choix.
          </p>
          <Link
            href="/panier"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Réserver maintenant
          </Link>
        </div>
      </section>
    </div>
  )
}
