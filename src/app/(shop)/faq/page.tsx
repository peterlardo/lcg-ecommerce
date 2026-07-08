"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

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
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">FAQ</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Questions fréquentes</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Délais, conservation, hygiène, paiement… tout ce qu&apos;il faut savoir avant de commander.
      </p>
      <div className="mt-10 space-y-3">
        {faqItems.map((item, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card-soft">
            <button
              type="button"
              onClick={() => toggle(i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-display text-sm font-bold"
              aria-expanded={openIndex === i}
            >
              {item.q}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-primary transition-transform ${openIndex === i ? "rotate-180" : ""}`}
              />
            </button>
            {openIndex === i && (
              <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
