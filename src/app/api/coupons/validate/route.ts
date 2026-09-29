import { NextResponse } from "next/server"
import { evaluateCoupon } from "@/lib/promotions"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const code = typeof body.code === "string" ? body.code : ""
    const subtotal = Number(body.subtotal)

    if (!code.trim()) return NextResponse.json({ ok: false, error: "Code promo requis" }, { status: 400 })
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ ok: false, error: "Sous-total invalide" }, { status: 400 })
    }

    const result = await evaluateCoupon(code, subtotal)
    if (!result.ok) return NextResponse.json(result, { status: 400 })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Coupon validate error:", error)
    return NextResponse.json({ ok: false, error: "Erreur interne du serveur" }, { status: 500 })
  }
}
