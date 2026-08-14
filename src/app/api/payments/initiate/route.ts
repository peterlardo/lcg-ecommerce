import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { initiatePayment, type PaymentProvider } from "@/lib/payment"

const PROVIDERS = ["MTN_MOMO", "AIRTEL_MONEY", "VISA_CARD"] as const

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const { provider, amount, phone, reference, description } = body as {
      provider: string
      amount: number
      phone: string
      reference: string
      description?: string
    }

    if (!PROVIDERS.includes(provider as PaymentProvider)) {
      return NextResponse.json({ error: "Fournisseur invalide. Utilisez: MTN_MOMO, AIRTEL_MONEY, ou VISA_CARD" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
    }

    if (!reference) {
      return NextResponse.json({ error: "Référence requise" }, { status: 400 })
    }

    if (provider !== "VISA_CARD" && !phone) {
      return NextResponse.json({ error: "Numéro de téléphone requis pour les paiements mobiles" }, { status: 400 })
    }

    const origin = request.headers.get("origin") || undefined
    const result = await initiatePayment(
      provider as PaymentProvider,
      amount,
      phone || "",
      reference,
      description,
      origin
    )

    if (!result.success) {
      return NextResponse.json({ error: result.message || "Échec de l'initiation du paiement" }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      reference: result.reference,
      status: result.status,
      redirectUrl: result.redirectUrl,
    })
  } catch (error) {
    console.error("Payment initiation error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
