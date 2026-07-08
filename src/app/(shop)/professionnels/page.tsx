import Link from "next/link"
import Image from "next/image"
import { products } from "@/data/products"
import { formatPrice } from "@/lib/utils"

const proProducts = products.filter((p) => p.categorySlug === "professionnel")

const features = [
  {
    title: "Livraison programmée",
    description: "Recevez vos glaçons aux jours et heures de votre choix, sans rupture.",
    icon: "📅",
  },
  {
    title: "Tarifs dégressifs",
    description: "Plus vous commandez, moins vous payez. Jusqu'à -20 % sur les gros volumes.",
    icon: "💰",
  },
  {
    title: "Facturation mensuelle",
    description: "Un relevé mensuel unique pour simplifier votre comptabilité.",
    icon: "📄",
  },
  {
    title: "Accès à la plateforme pro",
    description: "Espace dédié pour suivre vos commandes, historiques et factures.",
    icon: "🔒",
  },
]

const faqItems = [
  {
    q: "Quel est le volume minimum de commande pour un professionnel ?",
    a: "Le minimum est de 25 kg par commande, avec possibilité de planification hebdomadaire ou bi-mensuelle.",
  },
  {
    q: "Comment sont facturées les livraisons professionnelles ?",
    a: "Nos tarifs sont dégressifs selon le volume. La livraison est offerte dès 10 000 FCFA. Une facture mensuelle récapitulative vous est adressée.",
  },
  {
    q: "Puis-je commander en urgence ?",
    a: "Oui, contactez notre service pro au +242 05 555 55 55. Nous assurons une livraison sous 2 heures pour les commandes urgentes.",
  },
  {
    q: "Proposez-vous des glaçons spéciaux pour les professionnels ?",
    a: "Absolument. Nous livrons des big bags de 25 kg, des blocs de glace grand format, ainsi que des conditionnements sur mesure selon votre activité.",
  },
  {
    q: "Comment créer un compte professionnel ?",
    a: "Rendez-vous sur notre page de contact ou appelez-nous. Un commercial vous accompagnera dans la création de votre compte et la mise en place de vos tournées.",
  },
]

export default function ProfessionnelsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
            Solution professionnelle
          </h1>
          <p className="text-primary-100 text-lg max-w-2xl mx-auto">
            Des glaçons premium pour les restaurants, hôtels, bars et traiteurs.
            Bénéficiez de tarifs dégressifs et de livraisons programmées adaptées à votre activité.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Pourquoi choisir LCG Pro ?
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Une offre taillée pour les besoins des professionnels.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Nos produits professionnels
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Des conditionnements adaptés à vos volumes.
            </p>
          </div>
          {proProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {proProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/produits/${product.id}`}
                  className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-md"
                >
                  <div className="relative h-48 bg-gray-50 overflow-hidden">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300 text-4xl">
                        🧊
                      </div>
                    )}
                    {product.badge && (
                      <span className="absolute top-3 left-3 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {product.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 p-4">
                    <h3 className="font-semibold text-sm text-gray-900 leading-snug mb-1">
                      {product.name}
                    </h3>
                    {product.subtitle && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">
                        {product.subtitle}
                      </p>
                    )}
                    <p className="text-xs text-primary-600 font-medium">
                      À partir de {formatPrice(Math.min(...product.variants.map((v) => v.price)))}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">Aucun produit professionnel disponible pour le moment.</p>
            </div>
          )}
          <div className="text-center mt-8">
            <Link
              href="/produits?categorie=professionnel"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold text-sm"
            >
              Voir tous les produits pro →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Questions fréquentes — Pro
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Tout ce que vous devez savoir avant de devenir client professionnel.
            </p>
          </div>
          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <details key={i} className="group bg-white border border-gray-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                  <span>{item.q}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Prêt à passer commande ?
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Contactez notre équipe commerciale pour établir un devis personnalisé et
            planifier vos livraisons.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
            >
              Nous contacter
            </Link>
            <Link
              href="/produits?categorie=professionnel"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-primary-300 transition-colors"
            >
              Voir les produits
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
