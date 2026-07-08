import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const values = [
  {
    title: "Pureté",
    description: "Uniquement de l'eau minérale contrôlée, pour des glaçons au goût neutre et cristallins.",
  },
  {
    title: "Rigueur industrielle",
    description: "Processus hygiénique tracé de la production au conditionnement scellé.",
  },
  {
    title: "Proximité",
    description: "Une entreprise congolaise au service des familles et des professionnels de Brazzaville.",
  },
  {
    title: "Responsabilité",
    description: "Gestion raisonnée de l'eau et emballages PET recyclables.",
  },
]

const steps = [
  {
    num: "01",
    title: "Eau minérale",
    desc: "Sélection et analyse d'une eau minérale de qualité.",
  },
  {
    num: "02",
    title: "Congélation",
    desc: "Congélation lente pour des glaçons denses et translucides.",
  },
  {
    num: "03",
    title: "Conditionnement",
    desc: "Ensachage scellé en environnement hygiénique contrôlé.",
  },
  {
    num: "04",
    title: "Livraison froide",
    desc: "Transport réfrigéré jusqu'au client, sans rupture de chaîne.",
  },
]

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">Qui sommes-nous</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 mb-4">
            La Congolaise des Glaçons
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Basée au 97 Rue EWO à Ouenzé, Brazzaville, <strong>LCG-SARL</strong> est une société spécialisée dans la production et la vente de tout type de glaçons fabriqués à partir d&apos;eau minérale.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Née d&apos;un constat simple — la commande de glaçons se faisait uniquement par téléphone ou en boutique — LCG modernise l&apos;accès au froid de qualité : catalogue en ligne, commande en quelques clics et réservation anticipée pour les événements.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Notre ambition : devenir la référence du glaçon premium en République du Congo, au service des particuliers, restaurateurs, hôtels, bars, traiteurs et industriels.
              </p>
            </div>
            <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden">
              <Image
                src="/assets/production.jpg"
                alt="Production de glaçons LCG en environnement contrôlé"
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
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">Nos valeurs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">Notre processus de fabrication</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.num} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                <span className="text-2xl font-bold text-blue-600 mb-2 block">{s.num}</span>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
