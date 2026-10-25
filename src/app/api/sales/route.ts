import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess, getUserPointOfSaleIds, seesAllOrders } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { generateOrderNumber } from "@/lib/utils"
import {
  COMPTOIR_CODE,
  consumePointOfSaleStockTx,
  ensureOperationalStockLocations,
} from "@/lib/stock-service"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"
import { logActivity } from "@/lib/activity"
import { applyPartnerDiscount } from "@/lib/partner-cart"

const PAYMENT_METHODS = ["CASH_ON_DELIVERY", "MOBILE_MONEY", "CARD"] as const

type PaymentMethod = (typeof PAYMENT_METHODS)[number]

interface SaleItemInput {
  variantId: string
  quantity: number
  unitPrice?: number
}

interface SaleRequestBody {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  paymentMethod?: string
  notes?: string
  pointOfSaleId?: string
  b2bClientId?: string
  partnerId?: string
  items?: SaleItemInput[]
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : "CASH_ON_DELIVERY"
}

function normalizeItems(value: unknown): SaleItemInput[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>
      const variantId = String(record.variantId || "")
      const quantity = Math.max(1, Number(record.quantity) || 1)
      const rawUnit = Number(record.unitPrice)
      const unitPrice = Number.isFinite(rawUnit) && rawUnit >= 0 ? rawUnit : undefined
      return variantId ? { variantId, quantity, unitPrice } : null
    })
    .filter((item) => Boolean(item)) as SaleItemInput[]
}

export async function GET() {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", "COMMERCIAL", "COMPTABLE", "OPERATEUR_ACCUEIL", ...CASHIER_ROLES])
  if (forbidden) return forbidden

  const session = await auth()
  const seesAll = seesAllOrders(session?.user?.role)
  const isComptableRole = session?.user?.role === "COMPTABLE"

  const posFilter = await getUserPointOfSaleIds()
  const posIds = posFilter?.posIds ?? null

  const selfId = session!.user!.id
  const sales = await getPrisma().order.findMany({
    where: {
      AND: [
        // Une vente = une vente saisie au comptoir, ou une commande encaissée à la caisse (ticket établi).
        // Sans la seconde, tout le parcours opérateur d'accueil -> caissière manquait à l'historique.
        { OR: [{ notes: { startsWith: "Vente comptoir" } }, { ticketGenerated: true }] },
        isComptableRole
          ? // Filtre strict B2B : le comptable ne voit que les ventes rattachées à un client B2B.
            { b2bClientId: { not: null } }
          : seesAll
            ? posIds !== null
              ? { pointOfSaleId: posIds.length > 0 ? { in: posIds } : { in: [] } }
              : {}
            : isCashierRole(session?.user?.role)
              ? // la caissière : ses ventes et les commandes qu'un opérateur lui a transmises
                { OR: [{ userId: selfId }, { cashierId: selfId }] }
              : { userId: selfId },
      ],
    },
    include: {
      pointOfSale: { select: { id: true, name: true, code: true } },
      user: { select: { id: true, name: true } },
      cashier: { select: { id: true, name: true } },
      items: { include: { variant: { include: { product: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    sales.map((sale) => ({
      id: sale.id,
      orderNumber: sale.orderNumber,
      customerName: sale.customerName || "Client comptoir",
      customerPhone: sale.customerPhone || "",
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      status: sale.status,
      total: sale.total,
      notes: sale.notes,
      createdAt: sale.createdAt.toISOString(),
      seller: sale.user ? { id: sale.user.id, name: sale.user.name } : null,
      // caissière qui a encaissé une commande transmise par un opérateur
      cashier: sale.cashier ? { id: sale.cashier.id, name: sale.cashier.name } : null,
      pointOfSale: sale.pointOfSale,
      items: sale.items.map((item) => ({
        id: item.id,
        name: item.variant?.product?.name ?? "Produit",
        format: item.variant?.format ?? "",
        unit: item.variant?.unit ?? null,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
    }))
  )
}

export async function POST(request: Request) {
  // commerciaux : commandes et ventes en lecture seule (2026-10-16)
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER", ...CASHIER_ROLES])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const sellerId = session?.user?.id ?? null

    const body = (await request.json()) as SaleRequestBody
    const items = normalizeItems(body.items)

    if (items.length === 0) {
      return NextResponse.json({ error: "Au moins un article est requis" }, { status: 400 })
    }

    const stockLocations = await ensureOperationalStockLocations()
    const defaultPointOfSaleId = stockLocations.find((location) => location.code === COMPTOIR_CODE)?.id
    const pointOfSaleId = body.pointOfSaleId || defaultPointOfSaleId

    if (!pointOfSaleId) {
      return NextResponse.json({ error: "Moyen de stockage requis" }, { status: 400 })
    }

    if (isCashierRole(session?.user?.role) && pointOfSaleId !== defaultPointOfSaleId) {
      return NextResponse.json(
        { error: "Les caissières ne peuvent vendre qu'au Comptoir LCG" },
        { status: 403 }
      )
    }

    const point = await getPrisma().pointOfSale.findUnique({ where: { id: pointOfSaleId } })
    if (!point || !point.isActive) return NextResponse.json({ error: "Moyen de stockage invalide ou inactif" }, { status: 400 })

    const variants = await getPrisma().productVariant.findMany({
      where: { id: { in: items.map((item) => item.variantId) } },
      include: { product: true },
    })
    const variantMap = new Map(variants.map((v) => [v.id, v]))

    // Partenaire + tarif preferentiel par produit (avec repli sur la remise %)
    const partnerId = typeof body.partnerId === "string" && body.partnerId ? body.partnerId : null
    let partner: { id: string; name: string; discountPercent: number } | null = null
    let partnerPrices = new Map<string, number>()
    if (partnerId) {
      const found = await getPrisma().partner.findFirst({
        where: { id: partnerId, isActive: true },
        select: { id: true, name: true, discountPercent: true, prices: { select: { variantId: true, price: true } } },
      })
      if (!found) return NextResponse.json({ error: "Partenaire introuvable ou inactif." }, { status: 400 })
      partner = { id: found.id, name: found.name, discountPercent: found.discountPercent }
      partnerPrices = new Map(found.prices.map((p) => [p.variantId, p.price]))
    }

    // Prix appliqué par ligne : avec partenaire → tarif preferentiel du produit ?? prix remisé (%)
    // ?? prix public ; sans partenaire → prix public
    const pricedItems = items.map((item) => {
      const variant = variantMap.get(item.variantId)
      if (!variant) throw new Error("Produit introuvable")
      const publicPrice = variant.price
      const preferred = partner ? partnerPrices.get(item.variantId) : undefined
      const discounted = partner ? applyPartnerDiscount(publicPrice, partner.discountPercent) : undefined
      const requested = item.unitPrice
      const applied = partner ? (requested ?? preferred ?? discounted ?? publicPrice) : publicPrice
      return { variant, quantity: item.quantity, applied, publicPrice }
    })

    const orderNumber = generateOrderNumber()

    const order = await getPrisma().$transaction(async (tx) => {
      const subtotal = pricedItems.reduce((sum, it) => sum + it.applied * it.quantity, 0)

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: sellerId,
          customerName: body.customerName?.trim() || "Client comptoir",
          customerEmail: body.customerEmail?.trim() || "",
          customerPhone: body.customerPhone?.trim() || "",
          b2bClientId: body.b2bClientId || null,
          partnerId: partner?.id || null,
          paymentMethod: normalizePaymentMethod(body.paymentMethod),
          paymentStatus: "PAID",
          status: "DELIVERED",
          subtotal,
          deliveryFee: 0,
          total: subtotal,
          notes: ["Vente comptoir", body.notes?.trim()].filter(Boolean).join(" - "),
          pointOfSaleId,
          source: "CAISSE",
          items: {
            create: pricedItems.map((it) => ({
              productId: it.variant.productId,
              variantId: it.variant.id,
              quantity: it.quantity,
              price: it.applied,
              total: it.applied * it.quantity,
            })),
          },
        },
        include: { items: { include: { variant: { include: { product: true } } } } },
      })

      for (const item of items) {
        // Stock physiquement au point de vente : c'est la seule source. Le
        // vendeur ne detient aucun stock reserve, tout est preleve ici.
        const fifoResult = await consumePointOfSaleStockTx(tx, {
          variantId: item.variantId,
          pointOfSaleId,
          quantity: item.quantity,
          type: "SALE",
          reason: "Vente comptoir",
          reference: orderNumber,
          userId: sellerId,
        })
        const lotId = fifoResult.allocations[0]?.lotId ?? null

        if (lotId) {
          await tx.orderItem.updateMany({
            where: { orderId: createdOrder.id, variantId: item.variantId },
            data: { lotId },
          })
        }
      }

      return createdOrder
    })

    // Journaliser si un prix ≠ public a été appliqué
    const adjusted = pricedItems.filter((it) => it.applied !== it.publicPrice)
    if (adjusted.length) {
      await logActivity({
        module: "ventes",
        action: "ajustement-prix",
        entity: "Order",
        entityId: order.id,
        summary: `Vente ${order.orderNumber}${partner ? ` (partenaire ${partner.name})` : ""} : ${adjusted.length} ligne(s) à prix ajusté (${adjusted.map((i) => `${i.variant.format}: ${i.publicPrice}->${i.applied}`).join(", ")})`,
      })
    }

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone || "",
        seller: session?.user?.name ?? null,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        subtotal: order.subtotal,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.variant?.product?.name ?? "Produit",
          format: item.variant?.format ?? "",
          unit: item.variant?.unit ?? null,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne du serveur"
    const status = message.includes("Stock") || message.includes("introuvable") ? 400 : 500
    console.error("POST sale error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
