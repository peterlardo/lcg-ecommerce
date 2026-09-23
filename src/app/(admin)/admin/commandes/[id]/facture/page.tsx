"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Printer, Receipt } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { buildTicketHtml, type TicketData } from "@/lib/ticket-template"

interface OrderItem {
  id: string
  productId: string
  variantId: string
  name: string
  format: string
  quantity: number
  price: number
  total: number
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  paymentMethod: string
  paymentStatus: string
  source: string
  total: number
  subtotal: number
  deliveryFee: number
  createdAt: string
  notes: string | null
  pointOfSaleId: string | null
  pointOfSale: { id: string; name: string; code: string } | null
  delivery: { address: string; city: string; district: string | null; notes: string | null } | null
  items: OrderItem[]
}

interface PointOfSale {
  id: string
  name: string
  code: string
  isActive: boolean
}

export default function FacturePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const orderId = params.id

  const [order, setOrder] = useState<Order | null>(null)
  const [points, setPoints] = useState<PointOfSale[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [selectedPos, setSelectedPos] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [alreadyInvoiced, setAlreadyInvoiced] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [orderRes, posRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`),
        fetch("/api/points-de-vente/list"),
      ])
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => null)
        throw new Error(err?.error || "Commande introuvable")
      }
      const data: Order = await orderRes.json()
      setOrder(data)
      const q: Record<string, number> = {}
      data.items.forEach((it) => {
        q[it.id] = it.quantity
      })
      setQuantities(q)
      if (data.pointOfSaleId) setSelectedPos(data.pointOfSaleId)

      if (posRes.ok) {
        const posData = await posRes.json()
        const list: PointOfSale[] = Array.isArray(posData) ? posData : posData.points ?? []
        setPoints(list.filter((p) => p.isActive))
        if (!data.pointOfSaleId && list.length > 0) {
          const active = list.filter((p) => p.isActive)
          if (active.length === 1) setSelectedPos(active[0].id)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const subtotal = order ? order.items.reduce((sum, it) => sum + it.price * (quantities[it.id] ?? it.quantity), 0) : 0
  const deliveryFee = order?.deliveryFee ?? 0
  const total = subtotal + deliveryFee

  const handleQuantity = (itemId: string, value: number) => {
    const v = Math.max(1, Math.floor(Number(value) || 1))
    setQuantities((prev) => ({ ...prev, [itemId]: v }))
  }

  const handleInvoice = async () => {
    if (!selectedPos) {
      setError("Veuillez sélectionner un point de vente")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const items = Object.entries(quantities).map(([orderItemId, quantity]) => ({
        orderItemId,
        quantity,
      }))
      const res = await fetch(`/api/orders/${orderId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointOfSaleId: selectedPos, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de la facturation")
      setTicket(data.ticket as TicketData)
      setAlreadyInvoiced(Boolean(data.alreadyInvoiced))
      // Refresh order to reflect new totals
      if (data.order) {
        setOrder((prev) => (prev ? { ...prev, total: data.order.total, paymentStatus: data.order.paymentStatus, pointOfSaleId: selectedPos } : prev))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur interne")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrint = () => {
    const iframe = document.getElementById("ticket-iframe") as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Chargement de la commande...</p>
        </div>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="space-y-4">
        <Link href="/admin/commandes" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Retour aux commandes
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/commandes" className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Établir la facture</h1>
          <p className="text-sm text-gray-500">
            {order.orderNumber} · {order.customerName} · {new Date(order.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {alreadyInvoiced && ticket && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
          Cette commande avait déjà été facturée — le stock n&apos;a pas été re-débité. Le ticket est régénéré ci-dessous.
        </div>
      )}

      {!ticket ? (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Client</h2>
              <p className="text-sm text-gray-700">
                {order.customerName} · {order.customerPhone} {order.customerEmail ? `· ${order.customerEmail}` : ""}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {order.delivery ? `${order.delivery.address}${order.delivery.district ? ` — ${order.delivery.district}` : ""} (${order.delivery.city})` : "Adresse non renseignée"}
              </p>
              <p className="text-xs text-gray-500">
                Paiement : {order.paymentMethod} · {order.paymentStatus === "PAID" ? "Réglée" : order.paymentStatus === "REFUNDED" ? "Remboursée" : "En attente"}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Articles — ajustez les quantités selon les choix du client</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.name}
                        {item.format ? ` — ${item.format}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">{formatPrice(item.price)} / unité</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-500">Qté</label>
                      <input
                        type="number"
                        min={1}
                        value={quantities[item.id] ?? item.quantity}
                        onChange={(e) => handleQuantity(item.id, Number(e.target.value))}
                        className="w-20 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-center font-semibold"
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-28 text-right">
                      {formatPrice(item.price * (quantities[item.id] ?? item.quantity))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm font-semibold pt-3 mt-3 border-t border-gray-200">
                <span className="text-gray-900">Sous-total</span>
                <span className="text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-gray-600">Frais de livraison</span>
                  <span className="text-gray-900">{formatPrice(deliveryFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-gray-200 mt-2">
                <span className="text-gray-900">Total à facturer</span>
                <span className="text-gray-900">{formatPrice(total)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Point de vente * (stock à décrémenter)
              </label>
              <select
                value={selectedPos}
                onChange={(e) => setSelectedPos(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
              >
                <option value="">-- Choisir un point de vente --</option>
                {points.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.name} ({pos.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Le stock sera décrémenté à ce point de vente lors de la facturation.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push("/admin/commandes")}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleInvoice}
              disabled={submitting || !selectedPos}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-lg disabled:opacity-50"
            >
              <Receipt className="h-4 w-4" />
              {submitting ? "Facturation..." : "Établir la facture"}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-3">
            <span>Facture établie avec succès — ticket généré.</span>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
            >
              <Printer className="h-4 w-4" />
              Imprimer le ticket
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <iframe
              id="ticket-iframe"
              title="Ticket de vente"
              className="w-full border-0 rounded-lg"
              style={{ height: "560px" }}
              ref={(el) => {
                if (el && ticket) {
                  try {
                    el.contentDocument?.open()
                    el.contentDocument?.write(buildTicketHtml(ticket))
                    el.contentDocument?.close()
                  } catch {}
                }
              }}
            />
          </div>

          <div className="flex justify-between gap-3">
            <Link href="/admin/commandes" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Retour aux commandes
            </Link>
            <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-lg">
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
