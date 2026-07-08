import Link from "next/link"
import { ArrowRight } from "lucide-react"

const faqItems = [
  {
    q: "Quels sont les délais de livraison ?",
    a: "À Ouenzé, comptez 30 à 45 minutes. Dans les autres arrondissements de Brazzaville, entre 45 et 90 minutes selon la zone. Pour les gros volumes ou les zones éloignées, commandez la veille.",
  },
  {
    q: "Comment conserver mes glaçons ?",
    a: "Placez vos glaçons dans un congélateur à -18 °C dans leur emballage d'origine. Une fois le sachet ouvert, refermez-le soigneusement. Nos sacs sous atmosphère contrôlée préservent la qualité et empêchent l'absorption des odeurs.",
  },
  {
    q: "Vos glaçons sont-ils vraiment en eau minérale ?",
    a: "Oui, tous nos glaçons sont fabriqués exclusivement à partir d'eau minérale contrôlée et filtrée. Nous n'utilisons pas d'eau du robinet. C'est ce qui garantit leur transparence, leur neutralité gustative et leur qualité alimentaire.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Nous acceptons Mobile Money (Airtel Money, MTN MoMo), Wave, carte bancaire (Visa, Mastercard) et espèces à la livraison. Pour les professionnels, la facturation mensuelle est possible.",
  },
  {
    q: "Puis-je réserver des glaçons pour un événement ?",
    a: "Absolument. Vous pouvez réserver jusqu'à 30 jours à l'avance via notre pack Événementiel (Standard, Premium ou VIP). Livraison garantie le jour J, même pour de grands volumes.",
  },
  {
    q: "Puis-je modifier ou annuler ma commande ?",
    a: "Tant que votre commande n'est pas en cours de préparation, vous pouvez la modifier ou l'annuler depuis votre compte. Une fois en livraison, contactez-nous directement.",
  },
  {
    q: "Livrez-vous en dehors de Brazzaville ?",
    a: "Pour les gros volumes et les événements, nous étudions les livraisons hors Brazzaville. Contactez-nous pour une demande spécifique.",
  },
  {
    q: "Proposez-vous des tarifs professionnels ?",
    a: "Oui, nous avons une grille tarifaire dégressive pour les restaurants, hôtels, bars et traiteurs. Bénéficiez de livraisons programmées et d'un compte avec facturation mensuelle sans engagement.",
  },
]

export default function FaqPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">FAQ</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 mb-4">
            Questions fréquentes
          </h1>
          <p className="text-blue-100 text-lg max-w-xl mx-auto">
            Délais, conservation, hygiène, paiement… tout ce qu&apos;il faut savoir avant de commander.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <details key={i} className="group bg-white border border-gray-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                  <span>{item.q}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg shrink-0 ml-4">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
