import Link from "next/link"

const faqItems = [
  {
    category: "Livraison",
    questions: [
      {
        q: "Quels sont les délais de livraison ?",
        a: "Nous livrons sous 2 à 4 heures en moyenne dans tout Brazzaville. Si vous commandez avant 14h, votre colis est livré le jour même.",
      },
      {
        q: "Livrez-vous le week-end ?",
        a: "Oui, nous livrons du lundi au samedi. Les livraisons du dimanche sont possibles sur rendez-vous pour les événements.",
      },
      {
        q: "Puis-je choisir mon créneau de livraison ?",
        a: "Absolument. Lors de votre commande, vous pouvez sélectionner une tranche horaire : matin (8h-12h), après-midi (12h-17h) ou soir (17h-20h).",
      },
    ],
  },
  {
    category: "Commande minimum",
    questions: [
      {
        q: "Quel est le montant minimum de commande ?",
        a: "La commande minimum est de 1 000 FCFA, soit un sac de 1 kg de glaçons.",
      },
      {
        q: "Y a-t-il des frais de livraison ?",
        a: "Pour les commandes de moins de 10 000 FCFA, des frais de livraison de 500 à 1 500 FCFA s'appliquent selon la zone. La livraison est gratuite dès 10 000 FCFA d'achat.",
      },
    ],
  },
  {
    category: "Paiement",
    questions: [
      {
        q: "Quels moyens de paiement acceptez-vous ?",
        a: "Nous acceptons Mobile Money (Airtel Money, MTN MoMo), Wave, carte bancaire (Visa, Mastercard) et espèces à la livraison.",
      },
      {
        q: "Puis-je payer à la livraison ?",
        a: "Oui, le paiement à la livraison est disponible en espèces ou par Mobile Money.",
      },
      {
        q: "Proposez-vous la facturation mensuelle pour les pros ?",
        a: "Oui, les clients professionnels peuvent bénéficier d'une facturation mensuelle avec paiement à 30 jours sous réserve d'éligibilité.",
      },
    ],
  },
  {
    category: "Conservation",
    questions: [
      {
        q: "Comment conserver mes glaçons ?",
        a: "Placez vos glaçons dans un congélateur à -18°C. Une fois le sac ouvert, refermez-le soigneusement pour éviter l'absorption d'odeurs.",
      },
      {
        q: "Combien de temps les glaçons se conservent-ils ?",
        a: "Dans un congélateur à -18°C, nos glaçons se conservent plusieurs mois sans altération de leur qualité.",
      },
      {
        q: "Les glaçons prennent-ils le goût du congélateur ?",
        a: "Non. Nos sacs sous atmosphère contrôlée protègent les glaçons des odeurs. Une fois ouverts, nous recommandons de bien refermer le sac.",
      },
    ],
  },
  {
    category: "Événements",
    questions: [
      {
        q: "Proposez-vous des packs pour les événements ?",
        a: "Oui, notre pack Événementiel est disponible en trois formats : Standard, Premium et VIP. Il comprend un assortiment de glaçons cubes, cylindriques et glace pilée.",
      },
      {
        q: "Puis-je réserver une livraison pour une date ultérieure ?",
        a: "Oui, vous pouvez planifier votre livraison jusqu'à 30 jours à l'avance. Idéal pour les mariages, anniversaires et fêtes.",
      },
      {
        q: "Livrez-vous en dehors de Brazzaville pour les événements ?",
        a: "Pour les événements spéciaux, contactez-nous directement. Nous étudions les demandes de livraison dans les localités voisines.",
      },
    ],
  },
  {
    category: "Comptes professionnels",
    questions: [
      {
        q: "Comment créer un compte professionnel ?",
        a: "Remplissez le formulaire de contact ou appelez notre équipe commerciale. Un conseiller vous accompagnera dans la création de votre compte.",
      },
      {
        q: "Quels sont les avantages d'un compte professionnel ?",
        a: "Tarifs dégressifs, livraison programmée, facturation mensuelle, accès à la plateforme pro et priorité de livraison.",
      },
      {
        q: "Y a-t-il un engagement ?",
        a: "Aucun engagement de durée. Vous pouvez commander selon vos besoins, sans minimum mensuel imposé.",
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
            Foire aux questions
          </h1>
          <p className="text-primary-100 text-lg max-w-xl mx-auto">
            Tout ce que vous devez savoir sur LCG, nos produits et nos services.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {faqItems.map((section, i) => (
            <div key={i} className="mb-12 last:mb-0">
              <h2 className="text-xl font-bold text-gray-900 mb-5 pb-2 border-b border-gray-200">
                {section.category}
              </h2>
              <div className="space-y-3">
                {section.questions.map((item, j) => (
                  <details
                    key={j}
                    className="group bg-white border border-gray-200 rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                      <span>{item.q}</span>
                      <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg shrink-0 ml-4">
                        ▾
                      </span>
                    </summary>
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Vous avez d&apos;autres questions ?
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Notre équipe est à votre disposition pour vous renseigner.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
          >
            Contactez-nous
          </Link>
        </div>
      </section>
    </div>
  )
}
