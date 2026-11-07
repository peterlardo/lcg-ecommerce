import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { requireManagementAccess } from "@/lib/api-auth"
import { CASHIER_ROLES } from "@/lib/permissions"
import { logActivity } from "@/lib/activity"

const METHODS = ["CASH_ON_DELIVERY","MOBILE_MONEY","CARD","BANK_TRANSFER","CHEQUE"] as const
type PaymentMethod = (typeof METHODS)[number]

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN","STOCK_MANAGER","COMPTABLE","OPERATEUR_ACCUEIL", ...CASHIER_ROLES])
  if (forbidden) return forbidden
  const { id } = await params
  const order = await getPrisma().order.findUnique({ where: { id }, select: { id: true, total: true, paymentStatus: true, orderNumber: true } })
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
  const payments = await getPrisma().customerPayment.findMany({ where: { orderId: id, b2bDocumentId: null }, select: { amount: true, validationStatus: true } })
  const paid = payments.filter(p=>p.validationStatus==="VALIDATED").reduce((s,p)=>s+p.amount,0)
  const pending = payments.filter(p=>p.validationStatus==="PENDING").reduce((s,p)=>s+p.amount,0)
  const balance = Math.max(0, Math.round((order.total - paid - pending) * 100) / 100)
  return NextResponse.json({ id: order.id, orderNumber: order.orderNumber, total: order.total, paymentStatus: order.paymentStatus, paid, pending, balance })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(["ADMIN","STOCK_MANAGER","COMPTABLE","OPERATEUR_ACCUEIL", ...CASHIER_ROLES])
  if (forbidden) return forbidden
  const session = await auth()
  const { id } = await params
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const raw = Number(body.amount)
    const method: PaymentMethod = typeof body.method === "string" && METHODS.includes(body.method as PaymentMethod) ? (body.method as PaymentMethod) : "CASH_ON_DELIVERY"
    const notes = String(body.notes || "").trim().slice(0, 500)
    const result = await getPrisma().$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, select: { id: true, total: true, paymentStatus: true, orderNumber: true } })
      if (!order) throw Object.assign(new Error("Commande introuvable"), { status: 404 })
      const payments = await tx.customerPayment.findMany({ where: { orderId: id, b2bDocumentId: null }, select: { amount: true, validationStatus: true } })
      const paid = payments.filter(p=>p.validationStatus==="VALIDATED").reduce((s,p)=>s+p.amount,0)
      const pending = payments.filter(p=>p.validationStatus==="PENDING").reduce((s,p)=>s+p.amount,0)
      const balance = Math.max(0, Math.round((order.total - paid - pending) * 100)/100)
      if (balance <= 0.005) throw Object.assign(new Error("Aucun solde a encaisser"), { status: 400 })
      const amount = Number.isFinite(raw) ? Math.min(balance, Math.max(0, Math.round(raw*100)/100)) : balance
      if (amount <= 0.005) throw Object.assign(new Error("Montant invalide"), { status: 400 })
      if (Number.isFinite(raw) && raw > balance + 0.01) throw Object.assign(new Error(`Le montant depasse le solde (${balance} FCFA)`), { status: 400 })
      const now = new Date()
      await tx.customerPayment.create({ data: { orderId: id, amount, method, notes: notes || "Encaissement solde commande", receivedById: session?.user?.id || null, validationStatus: "VALIDATED", validatedById: session?.user?.id || null, validatedAt: now } })
      const paidAfter = Math.round((paid + amount)*100)/100
      const newStatus = paidAfter >= order.total - 0.005 ? "PAID" : "PENDING"
      if (newStatus !== order.paymentStatus) await tx.order.update({ where: { id }, data: { paymentStatus: newStatus } })
      const newBalance = Math.max(0, Math.round((order.total - paidAfter - pending)*100)/100)
      return { orderNumber: order.orderNumber, amount, paymentStatus: newStatus, balance: newBalance }
    })
    await logActivity({ module: "ventes", action: "encaissement", entity: "Order", entityId: id, summary: `Encaissement ${result.amount} FCFA sur ${result.orderNumber} (solde ${result.balance})` })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    const err = e as { message?: string; status?: number }
    return NextResponse.json({ error: err?.message || "Erreur" }, { status: err?.status || 500 })
  }
}
