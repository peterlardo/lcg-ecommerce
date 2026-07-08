import { prisma } from "@/lib/prisma"
import { products as staticProducts, categories } from "./products"
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

let bootstrapDone = false

async function bootstrapProducts() {
  if (bootstrapDone) return
  bootstrapDone = true
  const count = await prisma.product.count()
  if (count > 0) return
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: { id: cat.id, name: cat.name, slug: cat.slug, description: cat.description },
    })
  }
  for (const p of staticProducts) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        image: p.image,
        categoryId: p.categoryId,
        isFeatured: p.isFeatured,
        isActive: true,
        variants: {
          create: p.variants.map((v) => ({
            id: v.id,
            format: v.format,
            price: v.price,
            stock: v.stock,
            unit: v.unit,
          })),
        },
      },
    })
  }
}

export async function getProducts(): Promise<Product[]> {
  await bootstrapProducts()
  const db = await prisma.product.findMany({
    include: { variants: true, category: true },
    orderBy: { createdAt: "desc" },
  })
  return db.map(mapProduct)
}

export async function getProductById(id: string): Promise<Product | undefined> {
  await bootstrapProducts()
  const p = await prisma.product.findUnique({
    where: { id },
    include: { variants: true, category: true },
  })
  return p ? mapProduct(p) : undefined
}

export async function createProduct(
  data: Omit<Product, "id" | "variants"> & { variants: Omit<ProductVariant, "id">[] }
): Promise<Product> {
  const p = await prisma.product.create({
    data: {
      name: data.name,
      subtitle: data.subtitle,
      description: data.description,
      image: data.image,
      categoryId: data.categoryId,
      isFeatured: data.isFeatured || false,
      isActive: true,
      variants: {
        create: data.variants.map((v) => ({
          format: v.format,
          price: v.price,
          stock: v.stock,
          unit: v.unit,
        })),
      },
    },
    include: { variants: true, category: true },
  })
  return mapProduct(p)
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id" | "variants">> & { variants?: Omit<ProductVariant, "id">[] }
): Promise<boolean> {
  const exists = await prisma.product.findUnique({ where: { id } })
  if (!exists) return false
  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.subtitle !== undefined) updateData.subtitle = data.subtitle
  if (data.description !== undefined) updateData.description = data.description
  if (data.image !== undefined) updateData.image = data.image
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured
  if (data.badge !== undefined) updateData.badge = data.badge
  if (data.variants) {
    await prisma.productVariant.deleteMany({ where: { productId: id } })
    await prisma.productVariant.createMany({
      data: data.variants.map((v) => ({
        productId: id,
        format: v.format,
        price: v.price,
        stock: v.stock,
        unit: v.unit,
      })),
    })
  }
  await prisma.product.update({ where: { id }, data: updateData })
  return true
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await prisma.product.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

function mapProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    description: p.description,
    image: p.image,
    categoryId: p.categoryId,
    categorySlug: p.category?.slug ?? null,
    categoryName: p.category?.name ?? null,
    isFeatured: p.isFeatured,
    badge: (p as any).badge ?? null,
    variants: (p.variants ?? []).map((v: any) => ({
      id: v.id,
      format: v.format,
      price: v.price,
      stock: v.stock,
      unit: v.unit,
    })),
  }
}

export async function getMessages(): Promise<ContactMessage[]> {
  const rows = await prisma.message.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map((m) => ({
    id: m.id,
    nom: m.nom,
    telephone: m.telephone,
    email: m.email,
    objet: m.objet,
    message: m.message,
    lu: m.lu,
    createdAt: m.createdAt.toISOString(),
  }))
}

export async function getMessageById(id: string): Promise<ContactMessage | undefined> {
  const m = await prisma.message.findUnique({ where: { id } })
  if (!m) return undefined
  return {
    id: m.id,
    nom: m.nom,
    telephone: m.telephone,
    email: m.email,
    objet: m.objet,
    message: m.message,
    lu: m.lu,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function addMessage(
  msg: Omit<ContactMessage, "id" | "lu" | "createdAt">
): Promise<ContactMessage> {
  const m = await prisma.message.create({
    data: {
      nom: msg.nom,
      telephone: msg.telephone,
      email: msg.email,
      objet: msg.objet,
      message: msg.message,
    },
  })
  return {
    id: m.id,
    nom: m.nom,
    telephone: m.telephone,
    email: m.email,
    objet: m.objet,
    message: m.message,
    lu: m.lu,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function markMessageAsRead(id: string): Promise<boolean> {
  try {
    await prisma.message.update({ where: { id }, data: { lu: true } })
    return true
  } catch {
    return false
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  try {
    await prisma.message.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

export async function getReservations(): Promise<Reservation[]> {
  const rows = await prisma.reservation.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map((r) => ({
    id: r.id,
    client: r.client,
    telephone: r.telephone,
    email: r.email,
    type: r.type,
    date: r.date,
    heure: r.heure,
    inviteCount: r.inviteCount,
    notes: r.notes,
    status: r.status as "PENDING" | "CONFIRMED" | "CANCELLED",
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getReservationById(id: string): Promise<Reservation | undefined> {
  const r = await prisma.reservation.findUnique({ where: { id } })
  if (!r) return undefined
  return {
    id: r.id,
    client: r.client,
    telephone: r.telephone,
    email: r.email,
    type: r.type,
    date: r.date,
    heure: r.heure,
    inviteCount: r.inviteCount,
    notes: r.notes,
    status: r.status as "PENDING" | "CONFIRMED" | "CANCELLED",
    createdAt: r.createdAt.toISOString(),
  }
}

export async function updateReservationStatus(
  id: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
): Promise<boolean> {
  try {
    await prisma.reservation.update({ where: { id }, data: { status } })
    return true
  } catch {
    return false
  }
}

export async function addReservation(
  res: Omit<Reservation, "id" | "status" | "createdAt">
): Promise<Reservation> {
  const r = await prisma.reservation.create({
    data: {
      client: res.client,
      telephone: res.telephone,
      email: res.email,
      type: res.type,
      date: res.date,
      heure: res.heure,
      inviteCount: res.inviteCount,
      notes: res.notes,
    },
  })
  return {
    id: r.id,
    client: r.client,
    telephone: r.telephone,
    email: r.email,
    type: r.type,
    date: r.date,
    heure: r.heure,
    inviteCount: r.inviteCount,
    notes: r.notes,
    status: r.status as "PENDING" | "CONFIRMED" | "CANCELLED",
    createdAt: r.createdAt.toISOString(),
  }
}
