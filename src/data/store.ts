import { prisma } from "@/lib/prisma"
import { products as staticProducts, categories } from "./products"
import type { Product, ProductVariant } from "./products"
import { allocateStockFIFO } from "@/lib/lot-utils"

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

export interface ReservationItem {
  name: string
  format: string
  quantity: number
  price: number
}

export interface Reservation {
  id: string
  userId?: string | null
  orderId?: string | null
  client: string
  telephone: string
  email: string
  type: string
  date: string
  heure: string
  inviteCount: number
  address: string
  items: ReservationItem[]
  notes: string
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
  source: string
  createdAt: string
}

export interface OrderItemInput {
  productId: string
  variantId: string
  name: string
  format: string
  quantity: number
  price: number
}

export interface OrderInput {
  orderNumber: string
  userId?: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  address: string
  city: string
  district?: string
  paymentMethod: string
  source?: string
  notes?: string
  deliveryFee?: number
  items: OrderItemInput[]
}

export interface OrderRecord {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  total: number
  notes: string | null
  source: string
  createdAt: string
  items: { productId: string; variantId: string; quantity: number; price: number; total: number }[]
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
      badge: data.badge,
      isFeatured: data.isFeatured || false,
      isActive: true,
    variants: {
        create: data.variants.map((v) => ({
          format: v.format,
          price: v.price,
          stock: 0,
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
    const existingVariants = await prisma.productVariant.findMany({ where: { productId: id } })
    const existingStockMap = new Map(existingVariants.map((v) => [v.format, v.stock]))
    await prisma.productVariant.deleteMany({ where: { productId: id } })
    await prisma.productVariant.createMany({
      data: data.variants.map((v) => ({
        productId: id,
        format: v.format,
        price: v.price,
        stock: existingStockMap.get(v.format) ?? 0,
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
  return rows.map(mapReservation)
}

export async function getReservationById(id: string): Promise<Reservation | undefined> {
  const r = await prisma.reservation.findUnique({ where: { id } })
  if (!r) return undefined
  return mapReservation(r)
}

function mapReservation(r: any): Reservation {
  let items: ReservationItem[] = []
  try {
    items = JSON.parse(r.itemsJson || "[]")
  } catch {
    items = []
  }
  return {
    id: r.id,
    userId: r.userId || null,
    orderId: r.orderId || null,
    client: r.client,
    telephone: r.telephone,
    email: r.email,
    type: r.type,
    date: r.date,
    heure: r.heure,
    inviteCount: r.inviteCount,
    address: r.address || "",
    items,
    notes: r.notes,
    status: r.status as "PENDING" | "CONFIRMED" | "CANCELLED",
    source: r.source || "WEB",
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
      userId: (res as any).userId || null,
      client: res.client,
      telephone: res.telephone,
      email: res.email,
      type: res.type,
      date: res.date,
      heure: res.heure,
      inviteCount: res.inviteCount,
      address: res.address || "",
      itemsJson: JSON.stringify(res.items || []),
      notes: res.notes,
      source: res.source || "WEB",
    },
  })
  return mapReservation(r)
}

export async function createOrder(input: OrderInput): Promise<OrderRecord> {
  await bootstrapProducts()

  const subtotal = input.items.reduce((s, i) => s + i.price * i.quantity, 0)

  const order = await prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
      include: { product: true },
    })
    const variantMap = new Map(variants.map((v) => [v.id, v]))

    for (const item of input.items) {
      const variant = variantMap.get(item.variantId)
      if (!variant) throw new Error("Produit introuvable")
    }

    const created = await tx.order.create({
      data: {
        orderNumber: input.orderNumber,
        userId: input.userId || null,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        paymentMethod: input.paymentMethod as any,
        source: input.source || "WEB",
        subtotal,
        deliveryFee: input.deliveryFee || 0,
        total: subtotal + (input.deliveryFee || 0),
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            total: i.price * i.quantity,
          })),
        },
        delivery: {
          create: {
            address: input.address,
            city: input.city,
            district: input.district || null,
            notes: input.notes || null,
          },
        },
      },
      include: { items: true },
    })

    return created
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    status: order.status,
    paymentMethod: order.paymentMethod ?? "",
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    notes: order.notes,
    source: order.source || "WEB",
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
      price: i.price,
      total: i.total,
    })),
  }
}


