"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Check, Clock, PackageCheck, RefreshCw, Truck } from "lucide-react"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"

interface OrderItem {
  name: string
  format: string
  quantity: number
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  status: string
  total: number
  createdAt: string
  items: OrderItem[]
  delivery: { address: string; city: string; district: string | null; status?: string } | null
}

interface Delivery {
  id: string
  orderNumber: string
  customer: string
  address: string
  city: string
  status: string
  agent: string
  total: number
  items: string
}

interface DeliveryPayload {
  deliveries: Delivery[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR")
}

export default function DistributionPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setError("")
    try {
      const [ordersRes, deliveriesRes] = await Promise.all([fetch("/api/orders"), fetch("/api/deliveries")])
      if (!ordersRes.ok || !deliveriesRes.ok) throw new Error("Impossible de charger la distribution")
      setOrders(await ordersRes.json())
      const deliveryPayload = (await deliveriesRes.json()) as DeliveryPayload
      setDeliveries(deliveryPayload.deliveries ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const distributionOrders = useMemo(
    () => orders.filter((order) => ["PROCESSING", "READY", "OUT_FOR_DELIVERY"].includes(order.status)),
    [orders]
  )
  const readyOrders = distributionOrders.filter((order) => order.status === "READY")
  const inTransit = deliveries.filter((delivery) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(delivery.status))
  const deliveredToday = deliveries.filter((delivery) => delivery.status === "DELIVERED").length

  const updateOrder = async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error || "Mise à jour impossible")
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distribution</h1>
          <p className="mt-1 text-sm text-gray-500">Préparation, transfert et suivi des commandes à distribuer.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">À distribuer</p><p className="mt-1 text-xl font-bold text-gray-900">{distributionOrders.length}</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"><p className="text-xs font-medium text-blue-700">Prêtes</p><p className="mt-1 text-xl font-bold text-blue-800">{readyOrders.length}</p></div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4"><p className="text-xs font-medium text-orange-700">En cours</p><p className="mt-1 text-xl font-bold text-orange-800">{inTransit.length}</p></div>
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-4"><p className="text-xs font-medium text-green-700">Livrées</p><p className="mt-1 text-xl font-bold text-green-800">{deliveredToday}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><PackageCheck className="h-4 w-4" /> Bons à préparer</h2>
          <div className="space-y-3">
            {loading && <p className="text-sm text-gray-500">Chargement...</p>}
            {!loading && distributionOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-gray-900">{order.orderNumber}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span></div>
                    <p className="mt-1 text-sm font-medium text-gray-700">{order.customerName || "Client"}</p>
                    <p className="mt-1 text-xs text-gray-500">{order.delivery ? `${order.delivery.address}, ${order.delivery.city}` : "Retrait / comptoir"}</p>
                    <p className="mt-2 text-xs text-gray-500">{order.items.map((item) => `${item.name} ${item.format} x${item.quantity}`).join(", ")}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end"><span className="text-sm font-semibold text-gray-900">{formatPrice(order.total)}</span><span className="text-xs text-gray-500">{formatDate(order.createdAt)}</span>{order.status === "PROCESSING" && <button onClick={() => updateOrder(order.id, "READY")} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700">Marquer prête</button>}{order.status === "READY" && <button onClick={() => updateOrder(order.id, "OUT_FOR_DELIVERY")} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">Sortie distribution</button>}</div>
                </div>
              </div>
            ))}
            {!loading && distributionOrders.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Aucun bon à distribuer.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><Truck className="h-4 w-4" /> Distribution en cours</h2>
          <div className="space-y-3">
            {inTransit.map((delivery) => (
              <div key={delivery.id} className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-gray-900">{delivery.orderNumber}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(delivery.status)}`}>{getStatusLabel(delivery.status)}</span></div>
                    <p className="mt-1 text-sm text-gray-700">{delivery.customer}</p>
                    <p className="mt-1 text-xs text-gray-500">{delivery.address}, {delivery.city}</p>
                    <p className="mt-2 text-xs text-gray-500">{delivery.items}</p>
                  </div>
                  <div className="text-right"><p className="text-sm font-semibold text-gray-900">{formatPrice(delivery.total)}</p><p className="mt-1 text-xs text-gray-500">{delivery.agent || "Non assignée"}</p></div>
                </div>
              </div>
            ))}
            {inTransit.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Aucune distribution en cours.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
