import Link from "next/link"
import { formatPrice } from "@/lib/utils"

const zones = [
  { name: "Ouenzé", fee: 0, time: "1 h", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { name: "Bacongo", fee: 500, time: "2 h", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { name: "Makélékélé", fee: 500, time: "2 h", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { name: "Poto-Poto", fee: 1000, time: "2 h", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { name: "Moungali", fee: 1000, time: "2 h", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { name: "Talangaï", fee: 1000, time: "3 h", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { name: "Mfilou", fee: 1500, time: "3 h", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { name: "Centre-ville", fee: 0, time: "1 h", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
]

export default function ZonesLivraisonPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
            Zones de livraison
          </h1>
          <p className="text-primary-100 text-lg max-w-2xl mx-auto">
            Nous livrons dans toute la ville de Brazzaville. Découvrez les zones
            couvertes et les frais de livraison associés.
          </p>
        </div>
      </section>

      {/* Key Info */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">🚚</div>
              <h3 className="font-semibold text-gray-900 mb-1">Livraison sous 4 h max</h3>
              <p className="text-sm text-gray-500">
                Commandez avant 14 h, reçu le jour même dans tout Brazzaville.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">📦</div>
              <h3 className="font-semibold text-gray-900 mb-1">Minimum 1 000 FCFA</h3>
              <p className="text-sm text-gray-500">
                Commande minimum de {formatPrice(1000)} pour toute livraison.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">🎉</div>
              <h3 className="font-semibold text-gray-900 mb-1">Gratuite dès 10 000 FCFA</h3>
              <p className="text-sm text-gray-500">
                Livraison offerte pour toute commande de {formatPrice(10000)} ou plus.
              </p>
            </div>
          </div>

          {/* Zones Grid */}
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
            Nos secteurs de livraison
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {zones.map((zone, i) => (
              <div
                key={i}
                className={`border rounded-xl p-5 text-center ${zone.color}`}
              >
                <h3 className="font-semibold text-base mb-1">{zone.name}</h3>
                <p className="text-sm opacity-80">
                  {zone.time} • {zone.fee === 0 ? "Gratuit" : `${formatPrice(zone.fee)}`}
                </p>
              </div>
            ))}
          </div>

          {/* Fees Table */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6">
              Grille tarifaire
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Zone</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700">Délai estimé</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-700">Frais</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-3 text-gray-900 font-medium">{zone.name}</td>
                      <td className="px-5 py-3 text-gray-500">{zone.time}</td>
                      <td className="px-5 py-3 text-right text-gray-900">
                        {zone.fee === 0
                          ? <span className="text-emerald-600 font-semibold">Gratuit</span>
                          : formatPrice(zone.fee)
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              * Frais de livraison offerts pour toute commande de {formatPrice(10000)} ou plus.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Vous ne trouvez pas votre zone ?
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Contactez-nous pour connaître les possibilités de livraison dans votre secteur.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
          >
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  )
}
