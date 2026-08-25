import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"
import { siteConfig } from "@/lib/site"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "LCG — La Congolaise des Glaçons | Glaçons en eau minérale",
    template: "%s | LCG — La Congolaise des Glaçons",
  },
  description: siteConfig.description,
  keywords: [
    "glaçons Brazzaville",
    "glace pilée Congo",
    "glaçons eau minérale",
    "livraison glaçons",
    "LCG",
    "La Congolaise des Glaçons",
    "glace événementiel Brazzaville",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "LCG — La Congolaise des Glaçons | Glaçons en eau minérale",
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "LCG — La Congolaise des Glaçons",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LCG — La Congolaise des Glaçons | Glaçons en eau minérale",
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
        <link rel="icon" type="image/png" href="/favicon-64.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
