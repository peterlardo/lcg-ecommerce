"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShoppingCart,
  ChevronDown,
  Search,
  Plus,
  X,
} from "lucide-react"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"
import { products } from "@/data/products"

const statusFilters = [
  "Toutes",
  "En attente",
  "Confirmée",
  "En production",
  "Prête",
  "En livraison",
  "Livrée",
  "Annulée",
]

const statusMap: Record<string, string> = {
  "En attente": "PENDING",
  Confirmée: "CONFIRMED",
  "En production": "PROCESSING",
  Prête: "READY",
  "En livraison": "OUT_FOR_DELIVERY",
  Livrée: "DELIVERED",
  Annulée: "CANCELLED",
}

interface OrderItem {
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
  source: string
  total: number
  createdAt: string
  items: OrderItem[]
  delivery: { address: string; city: string; district: string | null; notes: string | null } | null
}

const paymentLabels: Record<string, string> = {
  CARD: "Carte bancaire",
  MOBILE_MONEY: "Mobile Money",
  CASH_ON_DELIVERY: "Paiement à la livraison",
}

const sourceLabels: Record<string, { label: string; className: string }> = {
  WEB: { label: "En ligne", className: "bg-teal-100 text-teal-700" },
  OPERATOR: { label: "Opérateur", className: "bg-violet-100 text-violet-700" },
}

interface DraftItem {
  productId: string
  variantId: string
  quantity: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR")
}

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("Toutes")
  const [searchName, setSearchName] = useState("")
  const [searchCode, setSearchCode] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    address: "",
    district: "",
    paymentMethod: "CASH_ON_DELIVERY",
    notes: "",
  })
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ productId: "", variantId: "", quantity: 1 }])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [page, setPage] = useState(1)
  const PER_PAGE = 5

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orders")
      if (res.ok) setOrders(await res.json())
    } catch (error) {
      console.error("Erreur chargement commandes:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = orders.filter((order) => {
    const matchesTab =
      activeTab === "Toutes" || getStatusLabel(order.status) === activeTab
    const matchesName =
      !searchName || order.customerName.toLowerCase().includes(searchName.toLowerCase())
    const matchesCode =
      !searchCode || order.orderNumber.toLowerCase().includes(searchCode.toLowerCase())
    return matchesTab && matchesName && matchesCode
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const handleSearchName = (v: string) => { setSearchName(v); setPage(1) }
  const handleSearchCode = (v: string) => { setSearchCode(v); setPage(1) }
  const handleTab = (t: string) => { setActiveTab(t); setPage(1) }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await load()
    } catch (error) {
      console.error(`Erreur mise à jour commande ${orderId}:`, error)
    }
  }

  const addDraftItem = () => {
    setDraftItems([...draftItems, { productId: "", variantId: "", quantity: 1 }])
  }

  const updateDraftItem = (index: number, patch: Partial<DraftItem>) => {
    setDraftItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  const removeDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)
    try {
      const items = draftItems
        .filter((item) => item.productId && item.variantId)
        .map((item) => {
          const product = products.find((p) => p.id === item.productId)
          const variant = product?.variants.find((v) => v.id === item.variantId)
          return {
            productId: item.productId,
            variantId: item.variantId,
            name: product?.name || "Produit",
            format: variant?.format || "",
            quantity: item.quantity,
            price: variant?.price || 0,
          }
        })

      if (!form.customerName || !form.customerPhone || !form.address || items.length === 0) {
        setFormError("Client, téléphone, adresse et au moins un article sont requis")
        setSubmitting(false)
        return
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "OPERATOR",
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || "Erreur lors de la création")
        setSubmitting(false)
        return
      }
      setShowModal(false)
      setForm({ customerName: "", customerPhone: "", customerEmail: "", address: "", district: "", paymentMethod: "CASH_ON_DELIVERY", notes: "" })
      setDraftItems([{ productId: "", variantId: "", quantity: 1 }])
      await load()
    } catch (error) {
      console.error("Erreur création commande:", error)
      setFormError("Erreur interne, réessayez")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Nom du client..."
              value={searchName}
              onChange={(e) => handleSearchName(e.target.value)}
              className="w-full sm:w-56 pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Code commande..."
              value={searchCode}
              onChange={(e) => handleSearchCode(e.target.value)}
              className="w-full sm:w-56 pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle commande
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab}
            {tab !== "Toutes" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({orders.filter((o) => getStatusLabel(o.status) === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">Chargement des commandes...</p>
          </div>
        )}
        {!loading && paged.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        sourceLabels[order.source]?.className || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {sourceLabels[order.source]?.label || order.source || "En ligne"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{order.customerName}</p>
                </div>
                <div className="flex items-center gap-4 sm:text-right">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatPrice(order.total)}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expanded === order.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            </button>

            {expanded === order.id && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Articles
                    </h4>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm bg-white p-2 rounded-lg border border-gray-100"
                        >
                          <span className="text-gray-700">
                            {item.name}
                            {item.format ? ` — ${item.format}` : ""}
                          </span>
                          <span className="text-gray-500">x{item.quantity}</span>
                          <span className="font-medium text-gray-900">
                            {formatPrice(item.total)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                        <span className="text-gray-900">Total</span>
                        <span className="text-gray-900">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Informations de livraison
                    </h4>
                    <div className="space-y-2 text-sm bg-white p-3 rounded-lg border border-gray-100">
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Adresse: </span>
                        {order.delivery
                          ? `${order.delivery.address}${order.delivery.district ? ` — ${order.delivery.district}` : ""} (${order.delivery.city})`
                          : "—"}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Paiement: </span>
                        {paymentLabels[order.paymentMethod] || order.paymentMethod || "—"}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Client: </span>
                        {order.customerEmail || "email non renseigné"} | {order.customerPhone}
                      </p>
                      {order.delivery?.notes && (
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-500">Notes: </span>
                          {order.delivery.notes}
                        </p>
                      )}
                    </div>

                    {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Mettre à jour le statut
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const statuses = [
                              "CONFIRMED",
                              "PROCESSING",
                              "READY",
                              "OUT_FOR_DELIVERY",
                              "DELIVERED",
                              "CANCELLED",
                            ]
                            const currentIdx = statuses.indexOf(order.status)
                            const nextStatuses = statuses.slice(currentIdx + 1)
                            if (currentIdx > 0) nextStatuses.unshift("PENDING")
                            return nextStatuses.slice(0, 4).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(order.id, s)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                  s === "CANCELLED"
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : s === "DELIVERED"
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                {getStatusLabel(s)}
                              </button>
                            ))
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucune commande trouvée</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""} · Page {currentPage}/{totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
              <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span> : <button key={p} onClick={() => setPage(p)} className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${p === currentPage ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>)}
              <button onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nouvelle commande</h2>
                <p className="text-xs text-gray-500 mt-0.5">Saisie opérateur — source : Opérateur</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Client *</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="Nom du client"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Téléphone *</label>
                  <input
                    type="text"
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="+242..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="optionnel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Paiement</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                  >
                    <option value="CASH_ON_DELIVERY">Paiement à la livraison</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CARD">Carte bancaire</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Adresse de livraison *</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="Quartier, rue..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Quartier / District</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Articles *</label>
                  <button
                    type="button"
                    onClick={addDraftItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter un article
                  </button>
                </div>
                <div className="space-y-2">
                  {draftItems.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId)
                    const variants = product?.variants || []
                    const variant = variants.find((v) => v.id === item.variantId)
                    return (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const productId = e.target.value
                            const firstVariant = products.find((p) => p.id === productId)?.variants[0]
                            updateDraftItem(index, { productId, variantId: firstVariant?.id || "" })
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none"
                        >
                          <option value="">Produit...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={item.variantId}
                          onChange={(e) => updateDraftItem(index, { variantId: e.target.value })}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none"
                          disabled={!item.productId}
                        >
                          <option value="">Format...</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.format} — {formatPrice(v.price)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateDraftItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none"
                        />
                        <span className="text-sm font-semibold text-gray-900 w-28 text-right sm:text-left">
                          {variant ? formatPrice(variant.price * item.quantity) : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDraftItem(index)}
                          disabled={draftItems.length === 1}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? "Création..." : "Créer la commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
