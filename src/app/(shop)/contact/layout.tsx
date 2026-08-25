import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez LCG — La Congolaise des Glaçons à Brazzaville : 97 Rue EWO, Ouenzé. Téléphone : +242 06 739 49 49. Devis, commandes et informations sur nos glaçons.",
  alternates: { canonical: "/contact" },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
