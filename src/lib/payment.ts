"use server"

import Stripe from "stripe"
import { MomoApi, ENVIRONMENT_MTN_CONGO, Config, PaymentRequest } from "@lepresk/momo-api"
import { AirtelApi } from "@lepresk/momo-api"

export type PaymentProvider = "MTN_MOMO" | "AIRTEL_MONEY" | "VISA_CARD"

const isSimulation = () => process.env.PAYMENT_SIMULATION === "true"

function generateFakeTxId() {
  return `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

// --- Simulation mode (no real API calls) ---
async function simulatePayment(
  provider: PaymentProvider,
  amount: number,
  phone: string,
  reference: string
): Promise<PaymentInitiationResult> {
  console.log(`[SIMULATION] ${provider} payment of ${amount} XAF from ${phone} (ref: ${reference})`)
  const txId = generateFakeTxId()
  return { success: true, transactionId: txId, reference, status: "PENDING" }
}

async function simulateCheckStatus(transactionId: string): Promise<PaymentStatusResult> {
  return { success: true, status: "SUCCESSFUL", transactionId }
}

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

// --- MTN MoMo ---
function getMtnCollection() {
  const subscriptionKey = process.env.MTN_COLLECTION_SUBSCRIPTION_KEY || ""
  const apiUser = process.env.MTN_COLLECTION_API_USER || ""
  const apiKey = process.env.MTN_COLLECTION_API_KEY || ""
  const callbackUrl = process.env.MTN_CALLBACK_URL || ""

  const config = Config.collection(subscriptionKey, apiUser, apiKey, callbackUrl)
  return MomoApi.create(ENVIRONMENT_MTN_CONGO).getCollection(config)
}

export async function initiateMtnPayment(
  amount: number,
  phone: string,
  reference: string,
  description?: string
): Promise<PaymentInitiationResult> {
  try {
    const collection = getMtnCollection()
    const msisdn = phone.replace(/[\s+\-()]/g, "").replace(/^242/, "")

    const request = PaymentRequest.make(
      String(amount),
      msisdn,
      reference,
      "XAF",
      description || `Paiement LCG - ${reference}`,
      `Commande ${reference}`
    )

    const referenceId = await collection.requestToPay(request)
    return { success: true, transactionId: referenceId, reference, status: "PENDING" }
  } catch (error) {
    console.error("MTN MoMo error:", error)
    const message = error instanceof Error ? error.message : "Erreur MTN MoMo"
    return { success: false, message }
  }
}

export async function checkMtnStatus(transactionId: string): Promise<PaymentStatusResult> {
  try {
    const collection = getMtnCollection()
    const tx = await collection.getPaymentStatus(transactionId)
    if (tx.isSuccessful()) {
      return { success: true, status: "SUCCESSFUL", transactionId }
    } else if (tx.isPending()) {
      return { success: true, status: "PENDING", transactionId }
    }
    return { success: true, status: "FAILED", transactionId }
  } catch (error) {
    console.error("MTN status check error:", error)
    return { success: false, status: "FAILED", message: String(error) }
  }
}

// --- Airtel Money ---
function getAirtelCollection() {
  const clientId = process.env.AIRTEL_CLIENT_ID || ""
  const clientSecret = process.env.AIRTEL_CLIENT_SECRET || ""

  return AirtelApi.collection("staging", {
    clientId,
    clientSecret,
    country: "CG",
    currency: "XAF",
  })
}

export async function initiateAirtelPayment(
  amount: number,
  phone: string,
  reference: string,
  description?: string
): Promise<PaymentInitiationResult> {
  try {
    const collection = getAirtelCollection()
    const msisdn = phone.replace(/[\s+\-()]/g, "").replace(/^242/, "")

    const externalId = await collection.requestToPay(
      String(amount),
      msisdn,
      reference
    )

    return { success: true, transactionId: externalId, reference, status: "PENDING" }
  } catch (error) {
    console.error("Airtel Money error:", error)
    const message = error instanceof Error ? error.message : "Erreur Airtel Money"
    return { success: false, message }
  }
}

export async function checkAirtelStatus(transactionId: string): Promise<PaymentStatusResult> {
  try {
    const collection = getAirtelCollection()
    const tx = await collection.getPaymentStatus(transactionId)
    if (tx.isSuccessful()) {
      return { success: true, status: "SUCCESSFUL", transactionId }
    } else if (tx.isPending()) {
      return { success: true, status: "PENDING", transactionId }
    }
    return { success: true, status: "FAILED", transactionId }
  } catch (error) {
    console.error("Airtel status check error:", error)
    return { success: false, status: "FAILED", message: String(error) }
  }
}

// --- Stripe (Visa/Card) ---
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-04-30.basil",
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

    return {
      success: true,
      transactionId: session.id,
      reference,
      status: "PENDING",
      redirectUrl: session.url || undefined,
    }
  } catch (error) {
    console.error("Stripe error:", error)
    const message = error instanceof Error ? error.message : "Erreur Stripe"
    return { success: false, message }
  }
}

export async function checkStripeStatus(sessionId: string): Promise<PaymentStatusResult> {
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status === "paid") {
      return { success: true, status: "SUCCESSFUL", transactionId: sessionId }
    } else if (session.status === "open") {
      return { success: true, status: "PENDING", transactionId: sessionId }
    }
    return { success: true, status: "FAILED", transactionId: sessionId }
  } catch (error) {
    console.error("Stripe status check error:", error)
    return { success: false, status: "FAILED", message: String(error) }
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
