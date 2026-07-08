import Image from "next/image"
import { testimonials } from "@/data/products"
import { Star } from "lucide-react"

const values = [
  {
    emoji: "💎",
    title: "Qualité",
    description: "Une eau minérale rigoureusement sélectionnée pour des glaçons d'une pureté cristalline.",
  },
  {
    emoji: "🧼",
    title: "Hygiène",
    description: "Un process industriel aux normes HACCP, des manipulations stériles et un emballage sous scellé.",
  },
  {
    emoji: "🚚",
    title: "Fiabilité",
    description: "Une flotte de véhicules réfrigérés et une équipe dédiée pour des livraisons ponctuelles.",
  },
  {
    emoji: "🤝",
    title: "Proximité",
    description: "Une entreprise congolaise à l'écoute de ses clients, particuliers comme professionnels.",
  },
]

const processSteps = [
  {
    step: 1,
    title: "Filtration & Traitement",
    description: "L'eau minérale est filtrée et traitée par osmose inverse pour éliminer les impuretés.",
  },
  {
    step: 2,
    title: "Congélation contrôlée",
    description: "La congélation est progressive pour obtenir des glaçons clairs, durs et sans bulles.",
  },
  {
    step: 3,
    title: "Conditionnement stérile",
    description: "Les glaçons sont conditionnés automatiquement en sacs scellés sous atmosphère contrôlée.",
  },
  {
    step: 4,
    title: "Stockage & Livraison",
    description: "Stockage en chambre froide negative et livraison en véhicule isotherme dans Brazzaville.",
  },
]

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
            La Congolaise des Glaçons
          </h1>
          <p className="text-primary-100 text-lg max-w-2xl mx-auto">
            Producteur de glaçons premium à Brazzaville — qualité, hygiène et engagement local.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Notre histoire</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Née à Brazzaville, LCG est le fruit d&apos;une ambition : offrir au Congo des
                  glaçons d&apos;une qualité jusqu&apos;ici inégalée. Fondée par des entrepreneurs
                  congolais passionnés, notre entreprise s&apos;appuie sur des équipements de
                  pointe et un savoir-faire rigoureux.
                </p>
                <p>
                  Nous croyons que la glace ne doit pas être un simple accessoire, mais un
                  véritable marqueur de qualité pour vos boissons, vos réceptions et votre
                  quotidien. Chaque glaçon LCG est le résultat d&apos;un process industriel
                  maîtrisé, de la filtration de l&apos;eau jusqu&apos;à la livraison.
                </p>
                <p>
                  Implantés dans la zone industrielle d&apos;Ouenzé, nous produisons chaque jour
                  des centaines de kilogrammes de glace pour répondre aux besoins des particuliers,
                  des restaurateurs, des hôtels et des organisateurs d&apos;événements.
                </p>
              </div>
            </div>
            <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1581093588404-f3f0ef0e0f3e?w=700&q=85"
                alt="Usine LCG Ouenzé"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Nos valeurs</h2>
            <p className="text-gray-500 max-w-lg mx-auto">Ce qui nous anime au quotidien.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <div className="text-3xl mb-4">{value.emoji}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="production" className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Notre process de production
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              De l&apos;eau minérale au glaçon livré chez vous.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {processSteps.map((step) => (
              <div key={step.step} className="relative bg-white border border-gray-200 rounded-xl p-6">
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {step.step}
                </div>
                <h3 className="font-semibold text-gray-900 mt-2 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Area */}
      <section id="livraison" className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Zone de livraison
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                Nous livrons dans tout Brazzaville et ses environs immédiats. Notre flotte de
                véhicules réfrigérés garantit une chaîne du froid ininterrompue, de l&apos;usine
                jusqu&apos;à votre porte.
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  Livraison sous 2 à 4 heures en moyenne
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  Créneaux de livraison flexibles (matin, après-midi, soir)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  Livraison gratuite dès 10 000 FCFA d&apos;achat
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  Possibilité de planification pour vos événements
                </li>
              </ul>
            </div>
            <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-sm font-medium">Carte de Brazzaville</p>
                <p className="text-xs">Zone de livraison LCG</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Ce que disent nos clients
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">Des clients satisfaits, du particulier au professionnel.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4 italic">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
