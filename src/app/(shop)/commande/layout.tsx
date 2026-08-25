import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Commande",
  robots: { index: false, follow: false },
}

export default function CommandeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
