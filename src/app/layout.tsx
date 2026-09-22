import type { Metadata, Viewport } from "next"
import { Sora, Manrope } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { siteConfig } from "@/lib/site"
import { PwaRegister } from "@/components/pwa-register"

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
})

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "LCG — La Congolaise des Glaçons | Glaçons en eau minérale",
    template: "%s | LCG — La Congolaise des Glaçons",
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LCG",
  },
  applicationName: "LCG",
  formatDetection: { telephone: false },
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

export const viewport: Viewport = {
  themeColor: "#063d62",
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
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${sora.variable} ${manrope.variable} min-h-screen flex flex-col bg-background text-foreground antialiased`}>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  )
}
