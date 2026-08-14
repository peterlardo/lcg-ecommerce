import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { checkPaymentStatus, type PaymentProvider } from "@/lib/payment"

const PROVIDERS = ["MTN_MOMO", "AIRTEL_MONEY", "VISA_CARD"] as const

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "STOCK_MANAGER"])
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get("provider")
    const transactionId = searchParams.get("transactionId")

    if (!provider || !PROVIDERS.includes(provider as PaymentProvider)) {
      return NextResponse.json({ error: "Fournisseur invalide" }, { status: 400 })
    }

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId requis" }, { status: 400 })
    }

    const result = await checkPaymentStatus(provider as PaymentProvider, transactionId)

    return NextResponse.json({
      success: result.success,
      status: result.status,
      transactionId: result.transactionId,
      message: result.message,
    })
  } catch (error) {
    console.error("Payment status check error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
