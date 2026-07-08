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
  variants: ProductVariant[]
}

export const categories = [
  { id: "cat-1", name: "Particuliers", slug: "particuliers", description: "Glaçons pour usage quotidien" },
  { id: "cat-2", name: "Professionnels", slug: "professionnel", description: "Conditionnements professionnels" },
  { id: "cat-3", name: "Événementiel", slug: "evenementiel", description: "Solutions pour vos événements" },
]

export const products: Product[] = [
  {
    id: "prod-1",
    name: "Glaçons cubes — Sac 1 kg",
    subtitle: "Cubes classiques en eau minérale, parfaits pour vos boissons au quotidien.",
    description: "Nos glaçons standards, parfaits pour tous les usages quotidiens. Fabriqués à partir d'eau minérale pure, ils sont clairs, durs et fondent lentement.",
    image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&q=85",
    categoryId: "cat-1",
    categorySlug: "particuliers",
    categoryName: "Particuliers",
    isFeatured: true,
    variants: [
      { id: "var-1-1", format: "sac de 1 kg", price: 1000, stock: 100, unit: "sac" },
      { id: "var-1-2", format: "sac de 2 kg", price: 1500, stock: 80, unit: "sac" },
      { id: "var-1-3", format: "sac de 5 kg", price: 4000, stock: 50, unit: "sac" },
    ],
  },
  {
    id: "prod-2",
    name: "Glaçons cubes — Sac 5 kg",
    subtitle: "Format familial ou petit événement, cubes translucides longue tenue.",
    description: "Grand format familial pour vos événements et barbecues. Des glaçons translucides qui fondent lentement.",
    image: "https://images.unsplash.com/photo-1607920592513-3e5f6e9f6b9a?w=600&q=85",
    categoryId: "cat-1",
    categorySlug: "particuliers",
    categoryName: "Particuliers",
    isFeatured: true,
    variants: [
      { id: "var-2-1", format: "sac de 5 kg", price: 4000, stock: 40, unit: "sac" },
      { id: "var-2-2", format: "sac de 10 kg", price: 7000, stock: 25, unit: "sac" },
      { id: "var-2-3", format: "sac de 25 kg", price: 15000, stock: 10, unit: "sac" },
    ],
  },
  {
    id: "prod-3",
    name: "Glaçons cylindriques — Sac 2 kg",
    subtitle: "Fonte lente, idéaux pour bars, cocktails et boissons premium.",
    description: "Glaçons cylindriques à la fonte lente, idéaux pour les whiskies et cocktails haut de gamme.",
    image: "https://images.unsplash.com/photo-1517048676732-d65bc93767c7?w=600&q=85",
    categoryId: "cat-3",
    categorySlug: "evenementiel",
    categoryName: "Événementiel",
    isFeatured: true,
    variants: [
      { id: "var-3-1", format: "sac de 2 kg", price: 2500, stock: 60, unit: "sac" },
      { id: "var-3-2", format: "sac de 5 kg", price: 5500, stock: 30, unit: "sac" },
    ],
  },
  {
    id: "prod-4",
    name: "Glace pilée — Sac 2 kg",
    subtitle: "Glace concassée fine pour cocktails, buffets froids et présentation poissonnerie.",
    description: "Glace pilée fine et homogène, parfaite pour les cocktails tropicaux, les smoothies et la présentation de fruits de mer.",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=85",
    categoryId: "cat-3",
    categorySlug: "evenementiel",
    categoryName: "Événementiel",
    isFeatured: true,
    variants: [
      { id: "var-4-1", format: "sac de 2 kg", price: 2000, stock: 45, unit: "sac" },
      { id: "var-4-2", format: "sac de 5 kg", price: 4500, stock: 20, unit: "sac" },
    ],
  },
  {
    id: "prod-5",
    name: "Sphères premium — Boîte de 6",
    subtitle: "Sphères cristallines à fonte très lente, pour spiritueux et cocktails signature.",
    description: "Glaçons sphériques grande taille pour une fonte ultra-lente. Idéaux pour les spiritueux précieux.",
    image: "https://images.unsplash.com/photo-1581093588404-f3f0ef0e0f3e?w=600&q=85",
    categoryId: "cat-3",
    categorySlug: "evenementiel",
    categoryName: "Événementiel",
    isFeatured: false,
    variants: [
      { id: "var-5-1", format: "boîte de 6", price: 3500, stock: 30, unit: "boîte" },
      { id: "var-5-2", format: "boîte de 12", price: 6000, stock: 20, unit: "boîte" },
      { id: "var-5-3", format: "boîte de 24", price: 10000, stock: 10, unit: "boîte" },
    ],
  },
  {
    id: "prod-6",
    name: "Bloc de glace grand format",
    subtitle: "Bloc massif pour sculptures, buffets, conservation longue durée.",
    description: "Blocs de glace grand format pour buffets, présentations, sculpteurs sur glace et besoins professionnels.",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&q=85",
    categoryId: "cat-2",
    categorySlug: "professionnel",
    categoryName: "Professionnels",
    isFeatured: false,
    variants: [
      { id: "var-6-1", format: "bloc ±10 kg", price: 5000, stock: 15, unit: "bloc" },
      { id: "var-6-2", format: "bloc ±25 kg", price: 10000, stock: 8, unit: "bloc" },
    ],
  },
  {
    id: "prod-7",
    name: "Big bag pro — 25 kg",
    subtitle: "Conditionnement professionnel pour restaurants, hôtels et traiteurs.",
    description: "Conditionnement spécial pour professionnels. Glaçons standards en sacs de grande capacité. Livraison programmée.",
    image: "https://images.unsplash.com/photo-1571019113559-33ae8e2a5f3a?w=600&q=85",
    categoryId: "cat-2",
    categorySlug: "professionnel",
    categoryName: "Professionnels",
    isFeatured: false,
    variants: [
      { id: "var-7-1", format: "big bag 25 kg", price: 15000, stock: 20, unit: "big bag" },
    ],
  },
  {
    id: "prod-8",
    name: "Pack Événementiel",
    subtitle: "Pack complet pour vos fêtes : cubes, cylindres et glace pilée.",
    description: "Pack complet pour vos événements : 5 kg de glaçons standards, 2 kg de glace pilée et 1 kg de glaçons cylindriques. Livraison incluse.",
    image: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&q=85",
    categoryId: "cat-3",
    categorySlug: "evenementiel",
    categoryName: "Événementiel",
    isFeatured: true,
    variants: [
      { id: "var-8-1", format: "pack Standard", price: 12000, stock: 15, unit: "pack" },
      { id: "var-8-2", format: "pack Premium", price: 20000, stock: 10, unit: "pack" },
      { id: "var-8-3", format: "pack VIP", price: 35000, stock: 5, unit: "pack" },
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
