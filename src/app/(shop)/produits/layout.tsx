import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Nos produits",
  description:
    "Découvrez notre gamme de glaçons en eau minérale : glaçons creux, cubes, pilés et pleins. Formats 1kg, 2kg et 5kg pour particuliers, professionnels et événements à Brazzaville.",
  alternates: { canonical: "/produits" },
}

export default function ProduitsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
