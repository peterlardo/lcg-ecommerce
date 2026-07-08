import Link from "next/link"
const zones = [
  { name: "Ouenzé", time: "30 – 45 min", desc: "Zone de production — livraison prioritaire" },
  { name: "Talangaï", time: "45 – 60 min", desc: "Livraison quotidienne" },
  { name: "Poto-Poto", time: "45 – 60 min", desc: "Livraison quotidienne" },
  { name: "Moungali", time: "45 – 60 min", desc: "Livraison quotidienne" },
  { name: "Centre-ville / Plateau", time: "60 – 90 min", desc: "Créneaux matin et après-midi" },
  { name: "Bacongo", time: "60 – 90 min", desc: "Créneaux matin et après-midi" },
  { name: "Makélékélé", time: "60 – 90 min", desc: "Créneaux matin et après-midi" },
  { name: "Mfilou / Djiri", time: "Sur réservation", desc: "Commande la veille recommandée" },
]

export default function ZonesLivraisonPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">Livraison</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 mb-4">
            Nos zones de livraison
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Nos véhicules réfrigérés couvrent l&apos;ensemble de Brazzaville depuis notre site de production d&apos;Ouenzé. Retrait sur place également possible au 97 Rue EWO.
          </p>
        </div>
      </section>

      {/* Zones Grid */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {zones.map((zone, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-gray-900 mb-1">{zone.name}</h3>
                <p className="text-sm font-medium text-blue-600 mb-1">{zone.time}</p>
                <p className="text-xs text-gray-500">{zone.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Votre quartier n&apos;est pas listé ?
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Contactez-nous : nous étudions toute demande de livraison ponctuelle ou récurrente, y compris hors Brazzaville pour les gros volumes.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  )
}
