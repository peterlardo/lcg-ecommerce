import Link from "next/link"
import Image from "next/image"

export default function ProfessionnelsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">Espace B2B</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 mb-4">
            Des glaçons fiables pour votre établissement
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            LCG accompagne les professionnels de Brazzaville avec des volumes garantis, une qualité constante et des livraisons à l&apos;heure. Concentrez-vous sur vos clients, on s&apos;occupe du froid.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-900 mb-2">Tarifs dégressifs</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Grille tarifaire professionnelle dès 25 kg par semaine, remises sur engagement mensuel.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-900 mb-2">Livraisons programmées</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Planifiez des livraisons récurrentes (quotidiennes, hebdomadaires) aux horaires de votre choix.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-900 mb-2">Volumes garantis</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Capacité de production réservée pour vos pics d&apos;activité : week-ends, fêtes, saison chaude.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-900 mb-2">Compte professionnel</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Un interlocuteur dédié, facturation mensuelle et documents comptables sur demande.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who we serve + Image */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Qui servons-nous ?</h2>
              <ul className="space-y-3">
                {[
                  "Bars & night-clubs",
                  "Hôtels & lodges",
                  "Restaurants",
                  "Traiteurs & événementiel",
                  "Poissonneries & marchés",
                  "Industries & laboratoires",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className="mt-8 inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                Demander un devis pro
              </Link>
            </div>
            <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden">
              <Image
                src="/assets/product-sac.jpg"
                alt="Big bag professionnel de glaçons LCG 25 kg"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
