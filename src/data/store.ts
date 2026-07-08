import { products as initialProducts, categories } from "./products"
import type { Product, ProductVariant } from "./products"

export interface ContactMessage {
  id: string
  nom: string
  telephone: string
  email: string
  objet: string
  message: string
  lu: boolean
  createdAt: string
}

export interface Reservation {
  id: string
  client: string
  telephone: string
  email: string
  type: string
  date: string
  heure: string
  inviteCount: number
  notes: string
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
  createdAt: string
}

export type { Product, ProductVariant }
export { categories }

let messages: ContactMessage[] = []
let reservations: Reservation[] = [
  {
    id: "res-1",
    client: "Hôtel Émeraude",
    telephone: "+242 05 345 67 89",
    email: "contact@hotelemeraude.cg",
    type: "Mariage",
    date: "15/08/2026",
    heure: "14:00",
    inviteCount: 200,
    notes: "Buffet cocktail en extérieur, besoin de glaçons cylindriques et glace pilée.",
    status: "CONFIRMED",
    createdAt: "01/07/2026",
  },
  {
    id: "res-2",
    client: "Mairie de Brazzaville",
    telephone: "+242 05 901 23 45",
    email: "service.event@mairie-bzv.cg",
    type: "Fête publique",
    date: "22/08/2026",
    heure: "09:00",
    inviteCount: 500,
    notes: "Fête de l'indépendance sur la place centrale. Gros volume requis.",
    status: "CONFIRMED",
    createdAt: "28/06/2026",
  },
  {
    id: "res-3",
    client: "Restaurant Le Palais",
    telephone: "+242 06 456 78 90",
    email: "contact@lepalais.cg",
    type: "Anniversaire",
    date: "05/09/2026",
    heure: "19:00",
    inviteCount: 80,
    notes: "Soirée anniversaire privée. Sphères premium et glaçons cylindriques.",
    status: "PENDING",
    createdAt: "05/07/2026",
  },
  {
    id: "res-4",
    client: "Traiteur Élégance",
    telephone: "+242 06 678 90 12",
    email: "info@traiteurelegance.cg",
    type: "Séminaire",
    date: "12/09/2026",
    heure: "08:00",
    inviteCount: 150,
    notes: "Séminaire d'entreprise sur deux jours. Rafraîchissements continus.",
    status: "PENDING",
    createdAt: "07/07/2026",
  },
  {
    id: "res-5",
    client: "Bar L'Éclipse",
    telephone: "+242 06 890 12 34",
    email: "barleclipse@example.com",
    type: "Soirée privée",
    date: "20/07/2026",
    heure: "21:00",
    inviteCount: 60,
    notes: "Annulé faute de disponibilité du lieu.",
    status: "CANCELLED",
    createdAt: "10/06/2026",
  },
]

// Product store (mutable copy of initial products)
let productsStore: Product[] = [...initialProducts]
let nextProductId = `prod-${Date.now()}`
let nextVariantId = `var-${Date.now()}`

export function getProducts(): Product[] {
  return [...productsStore]
}

export function getProductById(id: string): Product | undefined {
  return productsStore.find((p) => p.id === id)
}

export function createProduct(data: Omit<Product, "id" | "variants"> & { variants: Omit<ProductVariant, "id">[] }): Product {
  const newProduct: Product = {
    ...data,
    id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    variants: data.variants.map((v) => ({
      ...v,
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    })),
  }
  productsStore.unshift(newProduct)
  return newProduct
}

export function updateProduct(id: string, data: Partial<Omit<Product, "id" | "variants">> & { variants?: Omit<ProductVariant, "id">[] }): boolean {
  const index = productsStore.findIndex((p) => p.id === id)
  if (index === -1) return false
  const existing = productsStore[index]
  productsStore[index] = {
    ...existing,
    ...data,
    variants: data.variants
      ? data.variants.map((v) => ({
          ...v,
          id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        }))
      : existing.variants,
  }
  return true
}

export function deleteProduct(id: string): boolean {
  const index = productsStore.findIndex((p) => p.id === id)
  if (index === -1) return false
  productsStore.splice(index, 1)
  return true
}

// Messages
export function getMessages(): ContactMessage[] {
  return [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getMessageById(id: string): ContactMessage | undefined {
  return messages.find((m) => m.id === id)
}

export function addMessage(msg: Omit<ContactMessage, "id" | "lu" | "createdAt">): ContactMessage {
  const newMsg: ContactMessage = {
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    lu: false,
    createdAt: new Date().toLocaleDateString("fr-FR"),
  }
  messages.unshift(newMsg)
  return newMsg
}

export function markMessageAsRead(id: string): boolean {
  const msg = messages.find((m) => m.id === id)
  if (msg) {
    msg.lu = true
    return true
  }
  return false
}

export function deleteMessage(id: string): boolean {
  const index = messages.findIndex((m) => m.id === id)
  if (index !== -1) {
    messages.splice(index, 1)
    return true
  }
  return false
}

// Reservations
export function getReservations(): Reservation[] {
  return [...reservations]
}

export function getReservationById(id: string): Reservation | undefined {
  return reservations.find((r) => r.id === id)
}

export function updateReservationStatus(id: string, status: "PENDING" | "CONFIRMED" | "CANCELLED"): boolean {
  const res = reservations.find((r) => r.id === id)
  if (res) {
    res.status = status
    return true
  }
  return false
}

export function addReservation(res: Omit<Reservation, "id" | "status" | "createdAt">): Reservation {
  const newRes: Reservation = {
    ...res,
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    status: "PENDING",
    createdAt: new Date().toLocaleDateString("fr-FR"),
  }
  reservations.unshift(newRes)
  return newRes
}
