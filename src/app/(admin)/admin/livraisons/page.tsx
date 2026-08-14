"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import {
  AlertCircle, Calendar, Check, Clock, ChevronLeft, ChevronRight,
  MapPin, Phone, RefreshCw, Search, Truck, UserRound, X, Filter,
} from "lucide-react"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"

interface Delivery {
  id: string
  orderId: string
  orderNumber: string
  customer: string
  address: string
  city: string
  district: string | null
  phone: string
  scheduledDate: string | null
  deliveredAt: string | null
  agentId: string | null
  agent: string
  status: string
  items: string
  total: number
  notes: string
}

interface Agent {
  id: string
  name: string
}

const PAGE_SIZE = 4

const statusSections = [
  { key: "PENDING", label: "À planifier", icon: Calendar },
  { key: "ASSIGNED", label: "Assignées", icon: UserRound },
  { key: "PICKED_UP", label: "Prises en charge", icon: Truck },
  { key: "IN_TRANSIT", label: "En transit", icon: Truck },
  { key: "DELIVERED", label: "Livrées", icon: Check },
  { key: "FAILED", label: "Échecs", icon: AlertCircle },
]

function displayDate(value: string | null) {
  if (!value) return "Non planifiée"
  return new Date(value).toLocaleDateString("fr-FR")
}

export default function LivraisonsPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [deliveredSearch, setDeliveredSearch] = useState("")
  const [deliveredDateFrom, setDeliveredDateFrom] = useState("")
  const [deliveredDateTo, setDeliveredDateTo] = useState("")
  const [deliveredPage, setDeliveredPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/deliveries")
      if (!res.ok) throw new Error("Impossible de charger les livraisons")
      const data = await res.json()
      setDeliveries(data.deliveries ?? [])
      setAgents(data.agents ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const patchDelivery = async (deliveryId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || "Mise à jour impossible")
      return
    }
    await load()
  }

  const activeCount = deliveries.filter((d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)).length
  const deliveredToday = deliveries.filter((d) => d.status === "DELIVERED" && d.deliveredAt && new Date(d.deliveredAt).toDateString() === new Date().toDateString()).length

  const allDelivered = useMemo(
    () => deliveries.filter((d) => d.status === "DELIVERED"),
    [deliveries]
  )

  const filteredDelivered = useMemo(() => {
    let list = allDelivered
    if (deliveredSearch) {
      const q = deliveredSearch.toLowerCase()
      list = list.filter(
        (d) =>
          d.orderNumber.toLowerCase().includes(q) ||
          d.customer.toLowerCase().includes(q) ||
          d.address.toLowerCase().includes(q) ||
          d.agent?.toLowerCase().includes(q)
      )
    }
    if (deliveredDateFrom) {
      const from = new Date(deliveredDateFrom).getTime()
      list = list.filter((d) => d.deliveredAt && new Date(d.deliveredAt).getTime() >= from)
    }
    if (deliveredDateTo) {
      const to = new Date(deliveredDateTo).setHours(23, 59, 59, 999)
      list = list.filter((d) => d.deliveredAt && new Date(d.deliveredAt).getTime() <= to)
    }
    return list
  }, [allDelivered, deliveredSearch, deliveredDateFrom, deliveredDateTo])

  const deliveredTotalPages = Math.max(1, Math.ceil(filteredDelivered.length / PAGE_SIZE))
  const safeDeliveredPage = Math.min(deliveredPage, deliveredTotalPages)
  const paginatedDelivered = filteredDelivered.slice(
    (safeDeliveredPage - 1) * PAGE_SIZE,
    safeDeliveredPage * PAGE_SIZE
  )

  useEffect(() => {
    setDeliveredPage(1)
  }, [deliveredSearch, deliveredDateFrom, deliveredDateTo])

  const hasActiveFilters = deliveredSearch || deliveredDateFrom || deliveredDateTo

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Livraisons</h1>
          <p className="mt-1 text-sm text-gray-500">Suivi distribution, affectation des livreurs et statut terrain.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Livraisons</p><p className="mt-1 text-lg sm:text-xl font-bold text-gray-900">{deliveries.length}</p></div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3 sm:p-4"><p className="text-xs font-medium text-orange-700">En cours</p><p className="mt-1 text-lg sm:text-xl font-bold text-orange-800">{activeCount}</p></div>
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-3 sm:p-4"><p className="text-xs font-medium text-green-700">Livrées aujourd'hui</p><p className="mt-1 text-lg sm:text-xl font-bold text-green-800">{deliveredToday}</p></div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Chargement des livraisons...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            {statusSections.map((section) => {
              const Icon = section.icon
              const items = section.key === "DELIVERED" ? [] : deliveries.filter((d) => d.status === section.key)
              const isDeliveredSection = section.key === "DELIVERED"

              return (
                <section key={section.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <h2 className="text-sm font-semibold text-gray-700">{section.label}</h2>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {isDeliveredSection ? filteredDelivered.length : items.length}
                    </span>
                    {isDeliveredSection && (
                      <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          showFilters || hasActiveFilters
                            ? "bg-primary text-primary-foreground"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Filter className="h-3.5 w-3.5" />
                        Filtres
                        {hasActiveFilters && (
                          <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                            {[deliveredSearch, deliveredDateFrom, deliveredDateTo].filter(Boolean).length}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {isDeliveredSection && showFilters && (
                    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={deliveredSearch}
                            onChange={(e) => setDeliveredSearch(e.target.value)}
                            placeholder="Rechercher (n°, client, adresse, livreur)..."
                            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <label className="block text-xs font-medium text-gray-600">
                          À partir du
                          <input
                            type="date"
                            value={deliveredDateFrom}
                            onChange={(e) => setDeliveredDateFrom(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </label>
                        <label className="block text-xs font-medium text-gray-600">
                          Jusqu&apos;au
                          <input
                            type="date"
                            value={deliveredDateTo}
                            onChange={(e) => setDeliveredDateTo(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </label>
                      </div>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={() => { setDeliveredSearch(""); setDeliveredDateFrom(""); setDeliveredDateTo("") }}
                          className="mt-3 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    {isDeliveredSection ? (
                      <>
                        {paginatedDelivered.map((delivery) => (
                          <DeliveredCard key={delivery.id} delivery={delivery} />
                        ))}
                        {filteredDelivered.length === 0 && (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
                            {hasActiveFilters ? "Aucune livraison ne correspond aux filtres" : "Aucune livraison terminée"}
                          </div>
                        )}
                        {filteredDelivered.length > 0 && (
                          <Pagination
                            page={safeDeliveredPage}
                            totalPages={deliveredTotalPages}
                            onPageChange={setDeliveredPage}
                            totalItems={filteredDelivered.length}
                            pageSize={PAGE_SIZE}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        {items.map((delivery) => (
                          <DeliveryCard key={delivery.id} delivery={delivery} agents={agents} onPatch={patchDelivery} />
                        ))}
                        {items.length === 0 && (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
                            Aucune livraison dans cette étape
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )
            })}
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Livreurs</h3>
              <div className="space-y-2">
                {agents.map((agent) => {
                  const assigned = deliveries.filter((d) => d.agentId === agent.id && d.status !== "DELIVERED" && d.status !== "FAILED").length
                  return (
                    <div key={agent.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm">
                      <span className="text-gray-700">{agent.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${assigned ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                        {assigned ? `${assigned} active(s)` : "Disponible"}
                      </span>
                    </div>
                  )
                })}
                {agents.length === 0 && <p className="text-sm text-gray-500">Créez des utilisateurs avec le rôle livreur pour activer l&apos;assignation.</p>}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function DeliveryCard({ delivery, agents, onPatch }: { delivery: Delivery; agents: Agent[]; onPatch: (id: string, body: Record<string, unknown>) => void }) {
  const [showDetail, setShowDetail] = useState(false)
  const [editDate, setEditDate] = useState(delivery.scheduledDate ? delivery.scheduledDate.slice(0, 10) : "")
  const [editNotes, setEditNotes] = useState(delivery.notes)

  return (
    <>
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-900">{delivery.orderNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(delivery.status)}`}>{getStatusLabel(delivery.status)}</span>
          </div>
          <p className="text-sm font-medium text-gray-700">{delivery.customer}</p>
          <p className="flex items-start gap-1.5 text-xs text-gray-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{delivery.address}{delivery.district ? `, ${delivery.district}` : ""} ({delivery.city})</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3.5 w-3.5" />{delivery.phone || "Téléphone non renseigné"}</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{displayDate(delivery.scheduledDate)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{delivery.deliveredAt ? `Livrée ${displayDate(delivery.deliveredAt)}` : "En attente"}</span>
          </div>
          <p className="text-xs text-gray-400">{delivery.items || "Articles non renseignés"} - {formatPrice(delivery.total)}</p>
          {delivery.notes && <p className="text-xs text-gray-400 italic">📝 {delivery.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {delivery.agent && <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-700"><Truck className="h-3.5 w-3.5" />{delivery.agent}</span>}
          {["PENDING", "ASSIGNED"].includes(delivery.status) && (
            <select value={delivery.agentId ?? ""} onChange={(e) => onPatch(delivery.id, { deliveryAgentId: e.target.value })} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs">
              <option value="">{agents.length ? "Assigner un livreur" : "Aucun livreur"}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {delivery.status === "PENDING" && <button onClick={() => onPatch(delivery.id, { status: "ASSIGNED" })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Planifier</button>}
          {delivery.status === "ASSIGNED" && <button onClick={() => onPatch(delivery.id, { status: "PICKED_UP" })} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">Prise en charge</button>}
          {delivery.status === "PICKED_UP" && <button onClick={() => onPatch(delivery.id, { status: "IN_TRANSIT" })} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">En transit</button>}
          {delivery.status === "IN_TRANSIT" && (
            <div className="flex gap-2">
              <button onClick={() => onPatch(delivery.id, { status: "DELIVERED" })} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"><Check className="mr-1 inline h-3.5 w-3.5" />Livrée</button>
              <button onClick={() => onPatch(delivery.id, { status: "FAILED" })} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"><X className="mr-1 inline h-3.5 w-3.5" />Échec</button>
            </div>
          )}
          <button onClick={() => setShowDetail(!showDetail)} className="text-xs font-medium text-primary hover:underline">
            {showDetail ? "Masquer" : "Détails"}
          </button>
        </div>
      </div>
      {showDetail && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-600">
              Date prévue
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Notes
              <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes de livraison..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
          </div>
          <div className="flex justify-end">
            <button onClick={() => onPatch(delivery.id, { scheduledDate: editDate || null, notes: editNotes })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function DeliveredCard({ delivery }: { delivery: Delivery }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/30 p-3 sm:p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-900">{delivery.orderNumber}</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Livrée</span>
          </div>
          <p className="text-sm font-medium text-gray-700">{delivery.customer}</p>
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {delivery.address}{delivery.district ? `, ${delivery.district}` : ""} ({delivery.city})
          </p>
          {delivery.agent && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Truck className="h-3.5 w-3.5" /> {delivery.agent}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {delivery.deliveredAt && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <Check className="h-3.5 w-3.5" />
                {new Date(delivery.deliveredAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{delivery.items || "Articles non renseignés"} - {formatPrice(delivery.total)}</p>
        </div>
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  totalItems: number
  pageSize: number
}) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">
        Affichage <span className="font-medium text-gray-700">{from}–{to}</span> sur{" "}
        <span className="font-medium text-gray-700">{totalItems}</span> livraison{totalItems > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
              p === page
                ? "bg-primary text-primary-foreground"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
