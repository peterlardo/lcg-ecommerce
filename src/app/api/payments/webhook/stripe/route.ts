import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getPrisma } from "@/lib/prisma";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: "2026-07-29.dahlia" })
}

export async function POST(request: Request) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || "")
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const reference = session.metadata?.reference
    if (reference) {
      try {
        await getPrisma().order.updateMany({
          where: { orderNumber: reference },
          data: { paymentStatus: "PAID" },
        })
        console.log(`Stripe payment confirmed for order ${reference}`)
      } catch (err) {
        console.error("Failed to update order after Stripe payment:", err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
