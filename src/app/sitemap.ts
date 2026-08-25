import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site"
import { getProducts } from "@/data/store"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteConfig.url, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/produits`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteConfig.url}/professionnels`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteConfig.url}/zones-livraison`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteConfig.url}/a-propos`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteConfig.url}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteConfig.url}/contact`, changeFrequency: "monthly", priority: 0.6 },
  ]

  try {
    const products = await getProducts()
    const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${siteConfig.url}/produits/${p.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }))
    return [...staticEntries, ...productEntries]
  } catch {
    return staticEntries
  }
}
