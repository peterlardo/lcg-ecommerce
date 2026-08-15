"use server"

import Stripe from "stripe"

export type PaymentProvider = "MTN_MOMO" | "AIRTEL_MONEY" | "VISA_CARD"

export interface PaymentInitiationResult {
  success: boolean
  transactionId?: string
  reference?: string
  status?: string
  message?: string
  redirectUrl?: string
}

export interface PaymentStatusResult {
  success: boolean
  status: "PENDING" | "SUCCESSFUL" | "FAILED"
  transactionId?: string
  message?: string
}

const isSimulation = () => process.env.PAYMENT_SIMULATION === "true"

function generateFakeTxId() {
  return `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

// --- Simulation mode ---
async function simulatePayment(
  provider: PaymentProvider,
  amount: number,
  phone: string,
  reference: string
): Promise<PaymentInitiationResult> {
  console.log(`[SIMULATION] ${provider} payment of ${amount} XAF from ${phone} (ref: ${reference})`)
  return { success: true, transactionId: generateFakeTxId(), reference, status: "PENDING" }
}

async function simulateCheckStatus(transactionId: string): Promise<PaymentStatusResult> {
  return { success: true, status: "SUCCESSFUL", transactionId }
}

// --- MTN MoMo (direct fetch) ---
async function getMtnToken(subscriptionKey: string, apiUser: string, apiKey: string): Promise<string> {
  const res = await fetch("https://proxy.momoapi.mtn.com/collection/token/", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString("base64")}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  })
  if (!res.ok) throw new Error(`MTN token error: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

export async function initiateMtnPayment(
  amount: number,
  phone: string,
  reference: string,
  description?: string
): Promise<PaymentInitiationResult> {
  try {
    const subscriptionKey = process.env.MTN_COLLECTION_SUBSCRIPTION_KEY || ""
    const apiUser = process.env.MTN_COLLECTION_API_USER || ""
    const apiKey = process.env.MTN_COLLECTION_API_KEY || ""
    const callbackUrl = process.env.MTN_CALLBACK_URL || ""

    const token = await getMtnToken(subscriptionKey, apiUser, apiKey)
    const referenceId = crypto.randomUUID()
    const msisdn = phone.replace(/[\s+\-()]/g, "").replace(/^242/, "")

    const res = await fetch("https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay", {
      method: "POST",
      headers: {
        "X-Reference-Id": referenceId,
        "X-Target-Environment": "sandbox",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(callbackUrl ? { "X-Callback-Url": callbackUrl } : {}),
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: "XAF",
        externalId: reference,
        payer: { partyIdType: "MSISDN", partyId: msisdn },
        payerMessage: description || `Paiement LCG - ${reference}`,
        payeeNote: `Commande ${reference}`,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("MTN requestToPay error:", err)
      return { success: false, message: `MTN error: ${res.status}` }
    }

    return { success: true, transactionId: referenceId, reference, status: "PENDING" }
  } catch (error) {
    console.error("MTN MoMo error:", error)
    return { success: false, message: error instanceof Error ? error.message : "Erreur MTN MoMo" }
  }
}

export async function checkMtnStatus(transactionId: string): Promise<PaymentStatusResult> {
  try {
    const subscriptionKey = process.env.MTN_COLLECTION_SUBSCRIPTION_KEY || ""
    const apiUser = process.env.MTN_COLLECTION_API_USER || ""
    const apiKey = process.env.MTN_COLLECTION_API_KEY || ""

    const token = await getMtnToken(subscriptionKey, apiUser, apiKey)
    const res = await fetch(`https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay/${transactionId}`, {
      headers: {
        "X-Target-Environment": "sandbox",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) return { success: false, status: "FAILED", transactionId, message: `MTN error: ${res.status}` }
    const data = await res.json()

    if (data.status === "SUCCESSFUL") return { success: true, status: "SUCCESSFUL", transactionId }
    if (data.status === "PENDING") return { success: true, status: "PENDING", transactionId }
    return { success: true, status: "FAILED", transactionId, message: data.reason || data.status }
  } catch (error) {
    return { success: false, status: "FAILED", transactionId, message: String(error) }
  }
}

// --- Airtel Money (direct fetch) ---
async function getAirtelToken(): Promise<string> {
  const res = await fetch("https://openapiuat.airtel.africa/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AIRTEL_CLIENT_ID || "",
      client_secret: process.env.AIRTEL_CLIENT_SECRET || "",
      grant_type: "client_credentials",
    }),
  })
  if (!res.ok) throw new Error(`Airtel token error: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

export async function initiateAirtelPayment(
  amount: number,
  phone: string,
  reference: string,
  description?: string
): Promise<PaymentInitiationResult> {
  try {
    const token = await getAirtelToken()
    const transactionId = crypto.randomUUID()
    const msisdn = phone.replace(/[\s+\-()]/g, "").replace(/^242/, "")

    const res = await fetch("https://openapiuat.airtel.africa/merchant/v1/payments/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Country": "CG",
        "X-Currency": "XAF",
      },
      body: JSON.stringify({
        reference,
        transactionId,
        subscriber: { country: "CG", msisdn },
        amount: { value: amount, currency: "XAF" },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("Airtel payment error:", err)
      return { success: false, message: `Airtel error: ${res.status}` }
    }

    return { success: true, transactionId, reference, status: "PENDING" }
  } catch (error) {
    console.error("Airtel Money error:", error)
    return { success: false, message: error instanceof Error ? error.message : "Erreur Airtel Money" }
  }
}

export async function checkAirtelStatus(transactionId: string): Promise<PaymentStatusResult> {
  try {
    const token = await getAirtelToken()
    const res = await fetch(`https://openapiuat.airtel.africa/standard/v1/payments/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Country": "CG",
        "X-Currency": "XAF",
      },
    })

    if (!res.ok) return { success: false, status: "FAILED", transactionId }
    const data = await res.json()

    if (data.data?.transaction?.status === "TS") return { success: true, status: "SUCCESSFUL", transactionId }
    if (data.data?.transaction?.status === "TO") return { success: true, status: "PENDING", transactionId }
    return { success: true, status: "FAILED", transactionId }
  } catch (error) {
    return { success: false, status: "FAILED", transactionId, message: String(error) }
  }
}

// --- Stripe (Visa/Card) ---
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-07-29.dahlia",
  })
}

export async function initiateStripePayment(
  amount: number,
  phone: string,
  reference: string,
  description?: string,
  origin?: string
): Promise<PaymentInitiationResult> {
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "xaf",
            product_data: {
              name: description || `Commande LCG ${reference}`,
              description: `Paiement par carte - ${reference}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: { reference, phone },
      success_url: `${origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin/ventes?payment=success&ref=${reference}`,
      cancel_url: `${origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin/ventes?payment=cancelled&ref=${reference}`,
    })

    return { success: true, transactionId: session.id, reference, status: "PENDING", redirectUrl: session.url || undefined }
  } catch (error) {
    console.error("Stripe error:", error)
    return { success: false, message: error instanceof Error ? error.message : "Erreur Stripe" }
  }
}

export async function checkStripeStatus(sessionId: string): Promise<PaymentStatusResult> {
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status === "paid") return { success: true, status: "SUCCESSFUL", transactionId: sessionId }
    if (session.status === "open") return { success: true, status: "PENDING", transactionId: sessionId }
    return { success: true, status: "FAILED", transactionId: sessionId }
  } catch (error) {
    return { success: false, status: "FAILED", transactionId: sessionId, message: String(error) }
  }
}

// --- Unified interface ---
export async function initiatePayment(
  provider: PaymentProvider,
  amount: number,
  phone: string,
  reference: string,
  description?: string,
  origin?: string
): Promise<PaymentInitiationResult> {
  if (isSimulation()) return simulatePayment(provider, amount, phone, reference)
  switch (provider) {
    case "MTN_MOMO":
      return initiateMtnPayment(amount, phone, reference, description)
    case "AIRTEL_MONEY":
      return initiateAirtelPayment(amount, phone, reference, description)
    case "VISA_CARD":
      return initiateStripePayment(amount, phone, reference, description, origin)
    default:
      return { success: false, message: "Fournisseur de paiement inconnu" }
  }
}

export async function checkPaymentStatus(
  provider: PaymentProvider,
  transactionId: string
): Promise<PaymentStatusResult> {
  if (isSimulation()) return simulateCheckStatus(transactionId)
  switch (provider) {
    case "MTN_MOMO":
      return checkMtnStatus(transactionId)
    case "AIRTEL_MONEY":
      return checkAirtelStatus(transactionId)
    case "VISA_CARD":
      return checkStripeStatus(transactionId)
    default:
      return { success: false, status: "FAILED", message: "Fournisseur inconnu" }
  }
}
