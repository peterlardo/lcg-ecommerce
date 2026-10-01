import { getPrisma } from "@/lib/prisma";
import { products as staticProducts, categories } from "./products"
import type { Product, ProductVariant } from "./products"
import type { Prisma, PaymentMethod, Reservation as PrismaReservation } from "@prisma/client"
import { getActivePromotions, pickPromotion, computePromoPrice, evaluateCoupon } from "@/lib/promotions"
import { resolveDeliveryChoice } from "@/lib/delivery"
import type { ActivePromotion } from "@/lib/promotions"

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
  // Identifiants de la variante : présents pour les pré-commandes récentes (repli sur nom + format sinon).
  productId?: string
  variantId?: string
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
  deliveryMode: "DELIVERY" | "PICKUP"
  zoneId: string | null
  deliveryFee: number
  slot: string
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
  deliveryMode?: string
  deliveryZoneId?: string | null
  deliveryAgentId?: string | null
  couponCode?: string | null
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
  discountAmount: number
  couponCode: string | null
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
  const count = await getPrisma().product.count()
  if (count > 0) return
  for (const cat of categories) {
    await getPrisma().category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: { id: cat.id, name: cat.name, slug: cat.slug, description: cat.description },
    })
  }
  for (const p of staticProducts) {
    await getPrisma().product.upsert({
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

export async function getProducts(options?: { includeInactive?: boolean }): Promise<Product[]> {
  await bootstrapProducts()
  const [db, promos] = await Promise.all([
    getPrisma().product.findMany({
      where: options?.includeInactive ? {} : { isActive: true },
      include: { variants: true, category: true },
      orderBy: { createdAt: "desc" },
    }),
    getActivePromotions(),
  ])
  return db.map((p) => mapProduct(p, promos))
}

export async function getProductById(id: string): Promise<Product | undefined> {
  await bootstrapProducts()
  const p = await getPrisma().product.findUnique({
    where: { id },
    include: { variants: true, category: true },
  })
  if (!p) return undefined
  const promos = await getActivePromotions()
  return mapProduct(p, promos)
}

export interface ProductWriteInput {
  name: string
  subtitle?: string | null
  description?: string | null
  image?: string | null
  categoryId?: string | null
  badge?: string | null
  isFeatured?: boolean
  isActive?: boolean
  // id : variante existante à mettre à jour (édition) ; absent = nouvelle variante.
  variants: { id?: string; format: string; price: number; stock?: number; unit?: string | null }[]
}

/** Variantes impossibles à supprimer : déjà utilisées par des ventes, mouvements de stock ou lots. */
export class VariantInUseError extends Error {
  constructor(public formats: string[]) {
    super(`Variante(s) déjà utilisée(s) dans l'historique : ${formats.join(", ")}`)
  }
}

/** Ids de variantes référencées par l'historique (ventes, stock, production) : clés étrangères sans cascade. */
async function referencedVariantIds(tx: Prisma.TransactionClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const where = { variantId: { in: ids } }
  const select = { variantId: true } as const
  const [orders, movements, lots] = await Promise.all([
    tx.orderItem.findMany({ where, select, distinct: ["variantId"] }),
    tx.stockMovement.findMany({ where, select, distinct: ["variantId"] }),
    tx.productionLot.findMany({ where, select, distinct: ["variantId"] }),
  ])
  return new Set([...orders, ...movements, ...lots].map((r) => r.variantId))
}

export async function createProduct(data: ProductWriteInput): Promise<Product> {
  const p = await getPrisma().product.create({
    data: {
      name: data.name,
      subtitle: data.subtitle,
      description: data.description,
      image: data.image,
      categoryId: data.categoryId,
      badge: data.badge,
      isFeatured: data.isFeatured || false,
      isActive: data.isActive ?? true,
      variants: {
        create: data.variants.map((v) => ({
          format: v.format,
          price: v.price,
          stock: v.stock ?? 0,
          unit: v.unit,
        })),
      },
    },
    include: { variants: true, category: true },
  })
  return mapProduct(p, await getActivePromotions())
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<ProductWriteInput, "variants">> & { variants?: ProductWriteInput["variants"] }
): Promise<boolean> {
  const exists = await getPrisma().product.findUnique({ where: { id } })
  if (!exists) return false

  await getPrisma().$transaction(async (tx) => {
    const updateData: Prisma.ProductUpdateInput = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle
    if (data.description !== undefined) updateData.description = data.description
    if (data.image !== undefined) updateData.image = data.image
    if (data.categoryId !== undefined) updateData.category = data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true }
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.badge !== undefined) updateData.badge = data.badge

    if (data.variants) {
      const existingVariants = await tx.productVariant.findMany({ where: { productId: id } })
      const matchedIds = new Set<string>()
      // Correspondance par id d'abord : renommer un format garde la même variante
      // (stock, historique). Repli sur le format pour les clients qui n'envoient pas l'id.
      const findMatch = (v: ProductWriteInput["variants"][number]) =>
        existingVariants.find((e) => e.id === v.id && !matchedIds.has(e.id)) ??
        (v.id ? undefined : existingVariants.find((e) => e.format === v.format && !matchedIds.has(e.id)))

      // Vérifier avant d'écrire : une variante retirée mais présente dans l'historique ne peut
      // pas être supprimée (clé étrangère) — on refuse plutôt que de la laisser en vitrine.
      const keptIds = new Set(data.variants.map((v) => findMatch(v)?.id).filter(Boolean))
      const leftovers = existingVariants.filter((v) => !keptIds.has(v.id))
      const inUse = await referencedVariantIds(tx, leftovers.map((l) => l.id))
      if (inUse.size > 0) {
        throw new VariantInUseError(leftovers.filter((l) => inUse.has(l.id)).map((l) => l.format))
      }

      for (const v of data.variants) {
        const match = findMatch(v)
        if (match) {
          matchedIds.add(match.id)
          await tx.productVariant.update({
            where: { id: match.id },
            data: {
              format: v.format,
              price: v.price,
              unit: v.unit ?? null,
              ...(v.stock !== undefined ? { stock: v.stock } : {}),
            },
          })
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              format: v.format,
              price: v.price,
              stock: v.stock ?? 0,
              unit: v.unit ?? null,
            },
          })
        }
      }
      if (leftovers.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: leftovers.map((l) => l.id) } } })
      }
    }

    await tx.product.update({ where: { id }, data: updateData })
  })
  return true
}

/**
 * Supprime un produit. S'il a un historique (ventes, stock, production), la suppression
 * est impossible (clés étrangères) : le produit est alors masqué du site (« archived »).
 */
export async function deleteProduct(id: string): Promise<"deleted" | "archived" | "not_found"> {
  const prisma = getPrisma()
  const product = await prisma.product.findUnique({ where: { id }, include: { variants: { select: { id: true } } } })
  if (!product) return "not_found"
  const inUse = await referencedVariantIds(prisma, product.variants.map((v) => v.id))
  const ordered = await prisma.orderItem.count({ where: { productId: id } })
  if (inUse.size > 0 || ordered > 0) {
    await prisma.product.update({ where: { id }, data: { isActive: false } })
    return "archived"
  }
  await prisma.product.delete({ where: { id } })
  return "deleted"
}

type ProductWithRelations = Prisma.ProductGetPayload<{ include: { variants: true; category: true } }>

function mapProduct(p: ProductWithRelations, promos: ActivePromotion[] = []): Product {
  const promo = pickPromotion(promos, p.id, p.categoryId)
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
    isActive: p.isActive,
    badge: p.badge ?? null,
    promo: promo ? { name: promo.name, percent: promo.percent } : null,
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      format: v.format,
      price: v.price,
      stock: v.stock,
      unit: v.unit,
      promoPrice: promo ? computePromoPrice(v.price, promo.percent) : null,
    })),
  }
}

export async function getMessages(): Promise<ContactMessage[]> {
  const rows = await getPrisma().message.findMany({ orderBy: { createdAt: "desc" } })
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
  const m = await getPrisma().message.findUnique({ where: { id } })
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
  const m = await getPrisma().message.create({
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
    await getPrisma().message.update({ where: { id }, data: { lu: true } })
    return true
  } catch {
    return false
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  try {
    await getPrisma().message.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

export async function getReservations(): Promise<Reservation[]> {
  const rows = await getPrisma().reservation.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map(mapReservation)
}

export async function getReservationById(id: string): Promise<Reservation | undefined> {
  const r = await getPrisma().reservation.findUnique({ where: { id } })
  if (!r) return undefined
  return mapReservation(r)
}

function mapReservation(r: PrismaReservation): Reservation {
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
    deliveryMode: r.deliveryMode === "PICKUP" ? "PICKUP" : "DELIVERY",
    zoneId: r.zoneId ?? null,
    deliveryFee: r.deliveryFee ?? 0,
    slot: r.slot ?? "",
    createdAt: r.createdAt.toISOString(),
  }
}

export async function updateReservationStatus(
  id: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
): Promise<boolean> {
  try {
    await getPrisma().reservation.update({ where: { id }, data: { status } })
    return true
  } catch {
    return false
  }
}

export async function addReservation(
  res: Omit<Reservation, "id" | "status" | "createdAt">
): Promise<Reservation> {
  const r = await getPrisma().reservation.create({
    data: {
      userId: res.userId || null,
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
      deliveryMode: res.deliveryMode,
      zoneId: res.zoneId,
      deliveryFee: res.deliveryFee,
      slot: res.slot,
    },
  })
  return mapReservation(r)
}

export async function createOrder(input: OrderInput): Promise<OrderRecord> {
  await bootstrapProducts()

  const order = await getPrisma().$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
      include: { product: true },
    })
    const variantMap = new Map(variants.map((v) => [v.id, v]))

    const missing = input.items.filter((item) => !variantMap.has(item.variantId))
    if (missing.length > 0) {
      console.error(
        "createOrder — variante(s) introuvable(s) :",
        missing.map((item) => `${item.variantId} (${item.name} ${item.format})`).join(", ")
      )
      throw new Error(
        `Produit introuvable : ${missing.map((item) => `${item.name} ${item.format}`).join(", ")}`
      )
    }

    const promos = await getActivePromotions(tx)
    const priced = input.items.map((item) => {
      const variant = variantMap.get(item.variantId)!
      const promo = pickPromotion(promos, variant.productId, variant.product.categoryId)
      const unitPrice = promo ? computePromoPrice(variant.price, promo.percent) : variant.price
      return { item, unitPrice, total: unitPrice * item.quantity }
    })
    const subtotal = priced.reduce((s, i) => s + i.total, 0)

    let discount = 0
    let couponCode: string | null = null
    if (input.couponCode && input.couponCode.trim()) {
      const evaluated = await evaluateCoupon(input.couponCode, subtotal, tx)
      if (!evaluated.ok) throw new Error(evaluated.error)
      discount = evaluated.discount
      couponCode = evaluated.code
      await tx.coupon.update({
        where: { id: evaluated.couponId },
        data: { usedCount: { increment: 1 } },
      })
    }

    const deliveryChoice = await resolveDeliveryChoice({
      mode: input.deliveryMode,
      zoneId: input.deliveryZoneId,
      agentId: input.deliveryAgentId,
    })

    const deliveryFee = deliveryChoice.fee
    const total = Math.max(0, subtotal - discount) + deliveryFee

    const created = await tx.order.create({
      data: {
        orderNumber: input.orderNumber,
        userId: input.userId || null,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        paymentMethod: input.paymentMethod as PaymentMethod,
        source: input.source || "WEB",
        subtotal,
        deliveryFee,
        discountAmount: discount,
        couponCode,
        total,
        items: {
          create: priced.map(({ item, unitPrice, total: lineTotal }) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: unitPrice,
            total: lineTotal,
          })),
        },
        delivery: {
          create: {
            mode: deliveryChoice.mode,
            agentId: deliveryChoice.agentId,
            zoneId: deliveryChoice.zoneId,
            fee: deliveryChoice.fee,
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
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
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


