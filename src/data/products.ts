export const categories = [
  { id: "cat-1", name: "Particuliers", slug: "particuliers", description: "Glaçons pour usage quotidien" },
  { id: "cat-2", name: "Professionnels", slug: "professionnel", description: "Conditionnements professionnels" },
  { id: "cat-3", name: "Événementiel", slug: "evenementiel", description: "Solutions pour vos événements" },
]

export interface ProductVariant {
  id: string
  format: string
  price: number
  stock: number
  unit: string | null
}

export interface Product {
  id: string
  name: string
  subtitle: string | null
  description: string | null
  image: string | null
  categoryId: string | null
  categorySlug: string | null
  categoryName: string | null
  isFeatured: boolean
  badge: string | null
  variants: ProductVariant[]
}

export const products: Product[] = [
  {
    id: "prod-1",
    name: "Glaçon Creux",
    subtitle: "Tube",
    description: "Glaçons creux en forme de tube, idéaux pour vos boissons. Leur forme unique permet une fonte lente et régulière, maintenant vos boissons fraîches plus longtemps.",
    image: "/assets/product-creux.jpg",
    categoryId: "cat-1",
    categorySlug: "particuliers",
    categoryName: "Particuliers",
    isFeatured: true,
    badge: "Best-seller",
    variants: [
      { id: "var-1-1", format: "1kg", price: 1000, stock: 100, unit: "sac" },
      { id: "var-1-2", format: "2kg", price: 1500, stock: 80, unit: "sac" },
      { id: "var-1-3", format: "5kg", price: 4000, stock: 50, unit: "sac" },
    ],
  },
  {
    id: "prod-2",
    name: "Glaçon Cubes",
    subtitle: null,
    description: "Glaçons classiques en forme de cubes, parfaits pour toutes vos boissons. La forme cubique garantit une surface de contact optimale pour un refroidissement rapide.",
    image: "/assets/product-cubes.jpg",
    categoryId: "cat-1",
    categorySlug: "particuliers",
    categoryName: "Particuliers",
    isFeatured: true,
    badge: null,
    variants: [
      { id: "var-2-1", format: "1kg", price: 1000, stock: 100, unit: "sac" },
      { id: "var-2-2", format: "2kg", price: 1500, stock: 80, unit: "sac" },
      { id: "var-2-3", format: "5kg", price: 4000, stock: 50, unit: "sac" },
    ],
  },
  {
    id: "prod-3",
    name: "Glaçon Pilé",
    subtitle: null,
    description: "Glaçons pilés, parfaits pour les cocktails, smoothies et barres à jus. Leur texture granuleuse se marie parfaitement avec les boissons froides et les présentations créatives.",
    image: "/assets/product-pilee.jpg",
    categoryId: "cat-3",
    categorySlug: "evenementiel",
    categoryName: "Événementiel",
    isFeatured: true,
    badge: null,
    variants: [
      { id: "var-3-1", format: "1kg", price: 2000, stock: 60, unit: "sac" },
      { id: "var-3-2", format: "2kg", price: 2500, stock: 45, unit: "sac" },
      { id: "var-3-3", format: "5kg", price: 4500, stock: 30, unit: "sac" },
    ],
  },
  {
    id: "prod-4",
    name: "Glaçon Plein",
    subtitle: null,
    description: "Glaçons pleins, fondent lentement pour une fraîcheur durable. Idéaux pour les événements et réceptions où les boissons doivent rester fraîches pendant de longues heures.",
    image: "/assets/product-bloc.jpg",
    categoryId: "cat-3",
    categorySlug: "evenementiel",
    categoryName: "Événementiel",
    isFeatured: true,
    badge: null,
    variants: [
      { id: "var-4-1", format: "1kg", price: 1500, stock: 60, unit: "sac" },
      { id: "var-4-2", format: "2kg", price: 2500, stock: 45, unit: "sac" },
      { id: "var-4-3", format: "5kg", price: 5500, stock: 30, unit: "sac" },
    ],
  },
]

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}

export function getProductsByCategory(slug: string | null): Product[] {
  if (!slug || slug === "all") return products
  return products.filter((p) => p.categorySlug === slug)
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.isFeatured)
}

export const testimonials = [
  {
    id: 1,
    name: "Jean-Paul M.",
    role: "Restaurateur à Brazzaville",
    text: "LCG est mon fournisseur de glaçons depuis 6 mois. Qualité irréprochable et livraison toujours à l'heure. Je recommande !",
    rating: 5,
  },
  {
    id: 2,
    name: "Marie K.",
    role: "Particulière",
    text: "Les glaçons cylindriques sont parfaits pour mes cocktails. Je ne peux plus m'en passer !",
    rating: 5,
  },
  {
    id: 3,
    name: "Hôtel Émeraude",
    role: "Client professionnel",
    text: "Un service fiable et des glaçons d'une qualité exceptionnelle. L'eau minérale fait vraiment la différence.",
    rating: 5,
  },
]
