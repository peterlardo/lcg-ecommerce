import { getPrisma } from "@/lib/prisma"
import type { PrismaClient, CouponType } from "@prisma/client"

type Db = Pick<PrismaClient, "promotion" | "coupon">

export interface ActivePromotion {
  id: string
  name: string
  percent: number
  productId: string | null
  categoryId: string | null
}

export async function getActivePromotions(db: Db = getPrisma()): Promise<ActivePromotion[]> {
  const now = new Date()
  return db.promotion.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    select: { id: true, name: true, percent: true, productId: true, categoryId: true },
  })
}

export function pickPromotion(
  promos: ActivePromotion[],
  productId: string,
  categoryId: string | null
): ActivePromotion | null {
  const forProduct = promos.filter((p) => p.productId === productId)
  const forCategory = promos.filter((p) => p.categoryId && p.categoryId === categoryId)
  const global = promos.filter((p) => !p.productId && !p.categoryId)
  const candidates = forProduct.length > 0 ? forProduct : forCategory.length > 0 ? forCategory : global
  if (candidates.length === 0) return null
  return candidates.reduce((best, p) => (p.percent > best.percent ? p : best), candidates[0])
}

export function computePromoPrice(price: number, percent: number): number {
  return Math.round(price * (1 - percent / 100))
}

export type CouponEval =
  | { ok: true; couponId: string; code: string; type: CouponType; value: number; discount: number }
  | { ok: false; error: string }

export async function evaluateCoupon(
  code: string,
  subtotal: number,
  db: Db = getPrisma()
): Promise<CouponEval> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return { ok: false, error: "Code promo requis" }
  const coupon = await db.coupon.findUnique({ where: { code: normalized } })
  if (!coupon) return { ok: false, error: "Code promo invalide" }
  if (!coupon.isActive) return { ok: false, error: "Code promo désactivé" }
  const now = new Date()
  if (coupon.startsAt > now) return { ok: false, error: "Code promo pas encore valable" }
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, error: "Code promo expiré" }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
    return { ok: false, error: "Code promo déjà utilisé" }
  if (subtotal < coupon.minSubtotal)
    return { ok: false, error: `Montant minimum pour ce code : ${coupon.minSubtotal} FCFA` }
  const raw =
    coupon.type === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : coupon.value
  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount: Math.min(Math.max(raw, 0), subtotal),
  }
}
