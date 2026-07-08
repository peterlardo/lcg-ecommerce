import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "LCG – La Congolaise des Glaçons",
  description:
    "Producteur et livreur de glaçons haut de gamme à Brazzaville. Eau minérale, hygiène irréprochable, livraison réfrigérée.",
  icons: {
    icon: "/logo.jpeg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white text-[#0f172a] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
