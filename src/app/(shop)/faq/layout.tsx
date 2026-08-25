import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FAQ — Questions fréquentes",
  description:
    "Réponses aux questions fréquentes sur nos glaçons : délais de livraison, zones desservies à Brazzaville, formats disponibles, commande minimum et réservation pour événements.",
  alternates: { canonical: "/faq" },
}

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
