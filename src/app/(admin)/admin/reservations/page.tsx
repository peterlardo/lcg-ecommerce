"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CalendarRange, Search, ChevronDown, Check, X, Plus, ShoppingCart, Archive, MessageCircle, Store, Truck, ExternalLink } from "lucide-react"
import type { Reservation as StoredReservation } from "@/data/store"
import { DELIVERY_SLOTS, slotLabel, todayInBrazzaville } from "@/lib/delivery-slots"
import { ReservationPlanning, type PlanningAgent } from "./planning"
import type { Product } from "@/data/products"
import { formatPrice } from "@/lib/utils"
import { buildReservationDevisText, buildWaLink } from "@/lib/devis-text"

const statusFilters = ["Toutes", "En attente"]

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
}

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
}

const sourceLabels: Record<string, { label: string; className: string }> = {
  WEB: { label: "En ligne", className: "bg-teal-100 text-teal-700" },
  OPERATOR: { label: "Opérateur", className: "bg-violet-100 text-violet-700" },
}

// Pré-commande telle que renvoyée par l'API (avec zone, créneau et commande liée).
type Reservation = StoredReservation & { ref?: string; zoneName?: string | null }

const reservationTotal = (res: Reservation) => res.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + (res.deliveryFee || 0)

interface DraftItem {
  productId: string
  variantId: string
  quantity: number
}

function reservationWaLink(res: Reservation): string {
  const total = reservationTotal(res)
  return buildWaLink(
    res.telephone,
    buildReservationDevisText({
      ref: `RSV-${res.id.slice(-6).toUpperCase()}`,
      createdAt: res.createdAt,
      client: res.client,
      telephone: res.telephone,
      email: res.email || "",
      type: res.type,
      date: res.date,
      heure: res.heure || "",
      address: res.address || "",
      source: res.source || "WEB",
      notes: res.notes || "",
      items: res.items,
      deliveryFee: res.deliveryFee,
      total,
      trackingUrl: typeof window !== "undefined" ? `${window.location.origin}/suivi/${res.id}` : undefined,
    })
  )
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("Toutes")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const emptyForm = {
    client: "",
    telephone: "",
    email: "",
    type: "Pré-commande événement",
    date: "",
    slot: "",
    deliveryMode: "DELIVERY" as "DELIVERY" | "PICKUP",
    zoneId: "",
    address: "",
    notes: "",
  }
  const [form, setForm] = useState(emptyForm)
  const [view, setView] = useState<"liste" | "planning">("liste")
  const [agents, setAgents] = useState<PlanningAgent[]>([])
  const [zones, setZones] = useState<{ id: string; name: string; baseFee: number; isActive: boolean }[]>([])
  // Livreur choisi à la confirmation, par pré-commande.
  const [confirmAgent, setConfirmAgent] = useState<Record<string, string>>({})
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ productId: "", variantId: "", quantity: 1 }])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [page, setPage] = useState(1)
  const [statusPending, setStatusPending] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState("")
  const [statusError, setStatusError] = useState("")
  const [createdOrder, setCreatedOrder] = useState<{ id: string; orderNumber: string } | null>(null)
  const PER_PAGE = 5

  const fetchReservations = async () => {
    try {
      const res = await fetch("/api/reservations")
      if (res.ok) setReservations(await res.json())
    } catch (err) {
      console.error("Erreur:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/reservations", { signal: controller.signal })
        if (res.ok) setReservations(await res.json())
        const prodRes = await fetch("/api/produits?all=1", { signal: controller.signal })
        if (!controller.signal.aborted && prodRes.ok) setProducts(await prodRes.json())
        const agentsRes = await fetch("/api/delivery-agents", { signal: controller.signal })
        if (!controller.signal.aborted && agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(Array.isArray(data.agents) ? data.agents : [])
          setZones(Array.isArray(data.zones) ? data.zones : [])
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Erreur:", err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  const handleStatusChange = async (id: string, status: "CONFIRMED" | "CANCELLED") => {
    setStatusError("")
    setStatusPending(`${id}:${status}`)
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(status === "CONFIRMED" && confirmAgent[id] ? { agentId: confirmAgent[id] } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // Confirmée → devient commande, Annulée → archivée : disparaît de la liste principale
        setReservations((prev) => prev.filter((r) => r.id !== id))
        if (expanded === id) setExpanded(null)
        if (status === "CONFIRMED") {
          const orderId = (data as { orderId?: string }).orderId
          const orderNumber = (data as { orderNumber?: string }).orderNumber
          setCreatedOrder(orderId ? { id: orderId, orderNumber: orderNumber || "" } : null)
          setStatusMsg(
            orderId
              ? `Pré-commande confirmée. La commande ${orderNumber || ""} est créée, il reste à la facturer.`
              : "Pré-commande confirmée. La commande est créée, il reste à la facturer."
          )
        } else {
          setCreatedOrder(null)
          setStatusMsg("Pré-commande annulée et archivée.")
        }
      } else {
        setCreatedOrder(null)
        setStatusError(
          (data as { error?: string }).error ||
            (status === "CONFIRMED"
              ? "Impossible de confirmer la pré-commande"
              : "Impossible d'annuler la pré-commande")
        )
      }
    } catch (error) {
      console.error("Erreur changement de statut:", error)
      setStatusError("Erreur réseau, réessayez")
    } finally {
      setStatusPending(null)
    }
  }

  const filtered = reservations.filter((r) => {
    if (r.status === "CONFIRMED" || r.status === "CANCELLED") return false
    const matchesTab =
      activeTab === "Toutes" || statusLabels[r.status] === activeTab
    const matchesSearch =
      r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleTab = (t: string) => { setActiveTab(t); setPage(1) }

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

  const handleCreate = async (e: React.FormEvent) => {
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

      if (!form.client || !form.telephone || !form.date || !form.slot) {
        setFormError("Client, téléphone, date et créneau sont requis")
        setSubmitting(false)
        return
      }
      if (form.deliveryMode === "DELIVERY" && (!form.zoneId || !form.address.trim())) {
        setFormError("Zone et adresse de livraison requises (ou choisissez le retrait sur place)")
        setSubmitting(false)
        return
      }

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          inviteCount: 0,
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
      setForm(emptyForm)
      setDraftItems([{ productId: "", variantId: "", quantity: 1 }])
      await fetchReservations()
    } catch (error) {
      console.error("Erreur création pré-commande:", error)
      setFormError("Erreur interne, réessayez")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pré-commandes</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>{reservations.filter((r) => r.status === "PENDING").length} en attente</span>
            <Link
              href="/admin/reservations/archive"
              className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-gray-600 hover:text-primary transition-colors"
            >
              <Archive className="h-3.5 w-3.5" />
              {reservations.filter((r) => r.status === "CANCELLED").length} archivée{reservations.filter((r) => r.status === "CANCELLED").length > 1 ? "s" : ""} → Voir archive
            </Link>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle pré-commande
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit">
        {([["liste", "À confirmer"], ["planning", "Planning"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${view === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "planning" ? <ReservationPlanning agents={agents} /> : (<>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une pré-commande..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
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
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <span>{statusMsg}</span>
          <span className="flex items-center gap-3 shrink-0">
            {createdOrder && (
              <Link
                href={`/admin/commandes/${createdOrder.id}/facture`}
                className="inline-flex items-center gap-1.5 font-semibold text-green-800 hover:underline"
              >
                <ShoppingCart className="h-4 w-4" /> Établir la facture
              </Link>
            )}
            <button onClick={() => setStatusMsg("")} className="text-green-500 hover:text-green-700">
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}
      {statusError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{statusError}</span>
          <button onClick={() => setStatusError("")} className="text-red-500 hover:text-red-700 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paged.map((res) => (
            <div
              key={res.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === res.id ? null : res.id)}
                className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <CalendarRange className="h-4 w-4 text-gray-400" />
                      <span className="break-words text-sm font-semibold text-gray-900">{res.client}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[res.status]}`}>
                        {statusLabels[res.status]}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          sourceLabels[res.source]?.className || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {sourceLabels[res.source]?.label || res.source || "En ligne"}
                      </span>
                    </div>
                    <p className="break-words text-sm text-gray-500">
                      {res.ref ? <span className="font-mono">{res.ref} · </span> : null}
                      {res.date}{res.slot ? `, ${slotLabel(res.slot)}` : res.heure ? ` à ${res.heure}` : ""}
                      {" · "}
                      {res.deliveryMode === "PICKUP" ? (
                        <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" />Retrait sur place</span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{res.zoneName ?? "Zone à définir"}{res.address ? ` · ${res.address}` : ""}</span>
                      )}
                      {" · "}<span className="font-semibold text-gray-700">{formatPrice(reservationTotal(res))}</span>
                      {res.deliveryFee > 0 ? <span className="text-xs"> (dont livraison {formatPrice(res.deliveryFee)})</span> : null}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform shrink-0 ${
                      expanded === res.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {expanded === res.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Coordonnées
                        </h4>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium text-gray-500">Tél: </span>{res.telephone}
                        </p>
                        {res.email && (
                          <p className="text-sm text-gray-700 mt-1">
                            <span className="font-medium text-gray-500">Email: </span>{res.email}
                          </p>
                        )}
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Articles réservés
                        </h4>
                        {res.items.length > 0 ? (
                          <div className="space-y-1.5">
                            {res.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="min-w-0 break-words text-gray-700">
                                  {item.name}
                                  {item.format ? ` — ${item.format}` : ""}
                                </span>
                                <span className="text-gray-500">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Aucun article</p>
                        )}
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Notes
                        </h4>
                        <p className="text-sm text-gray-700">{res.notes || "Aucune note"}</p>
                      </div>
                      {res.status === "CONFIRMED" && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                          <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">
                            Commande liée
                          </h4>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-mono font-medium text-green-800">
                              {res.orderId ? `Commande créée automatiquement` : "En cours de création..."}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-green-600">
                            La commande est maintenant gérée depuis la page Commandes.
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Statut
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const waLink = reservationWaLink(res)
                          return waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Envoyer le devis au client sur WhatsApp"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> Devis WhatsApp
                            </a>
                          ) : null
                        })()}
                        <a
                          href={`/suivi/${res.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Page de suivi client
                        </a>
                        {res.status === "PENDING" && res.deliveryMode === "DELIVERY" && (
                          <select
                            value={confirmAgent[res.id] ?? ""}
                            onChange={(e) => setConfirmAgent((prev) => ({ ...prev, [res.id]: e.target.value }))}
                            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                            aria-label="Livreur à assigner à la confirmation"
                          >
                            <option value="">Livreur : à assigner plus tard</option>
                            {agents.filter((a) => a.isActive && a.isAvailable).map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        )}
                        {res.status !== "CONFIRMED" && (
                          <button
                            onClick={() => handleStatusChange(res.id, "CONFIRMED")}
                            disabled={statusPending === `${res.id}:CONFIRMED`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {statusPending === `${res.id}:CONFIRMED` ? "Confirmation..." : "Confirmer"}
                          </button>
                        )}
                        {res.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleStatusChange(res.id, "CANCELLED")}
                            disabled={statusPending === `${res.id}:CANCELLED`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <X className="h-3.5 w-3.5" /> Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CalendarRange className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Aucune pré-commande trouvée</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{filtered.length} résultat(s) · Page {currentPage}/{totalPages}</p>
              <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto">
                <button onClick={() => setPage(1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
                <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span> : <button key={p} onClick={() => setPage(p)} className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${p === currentPage ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>)}
                <button onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
                <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
              </div>
            </div>
          )}
        </div>
      )}

      </>)}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-2 sm:p-4 overflow-y-auto">
          <div className="flex max-h-[92dvh] w-full max-w-full flex-col overflow-hidden rounded-2xl shadow-xl mx-2 sm:mx-0 sm:max-w-2xl my-8">
            <div className="flex shrink-0 items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nouvelle pré-commande</h2>
                <p className="text-xs text-gray-500 mt-0.5">Saisie opérateur — source : Opérateur</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Client *</label>
                  <input
                    type="text"
                    value={form.client}
                    onChange={(e) => setForm({ ...form, client: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="Nom du client"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Téléphone *</label>
                  <input
                    type="text"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="+242..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="optionnel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                  >
                    <option>Pré-commande événement</option>
                    <option>Pré-commande particuliers</option>
                    <option>Pré-commande professionnels</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date *</label>
                  <input
                    type="date"
                    min={todayInBrazzaville()}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Créneau *</label>
                  <select
                    value={form.slot}
                    onChange={(e) => setForm({ ...form, slot: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                  >
                    <option value="">Choisir…</option>
                    {DELIVERY_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                  {([["DELIVERY", "Livraison"], ["PICKUP", "Retrait sur place"]] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm({ ...form, deliveryMode: mode })}
                      className={`min-h-11 rounded-lg border-2 px-3 text-sm font-semibold transition-colors ${
                        form.deliveryMode === mode ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.deliveryMode === "DELIVERY" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Zone de livraison *</label>
                      <select
                        value={form.zoneId}
                        onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                      >
                        <option value="">Choisir une zone…</option>
                        {zones.filter((z) => z.isActive).map((z) => (
                          <option key={z.id} value={z.id}>{z.name} — {formatPrice(z.baseFee)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Adresse *</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                        placeholder="Quartier, rue, repère…"
                      />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Articles réservés</label>
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
                        <span className="w-28 break-words text-right text-sm font-semibold text-gray-900 tabular-nums sm:text-left">
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

              <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-100">
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
                  {submitting ? "Création..." : "Créer la pré-commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
