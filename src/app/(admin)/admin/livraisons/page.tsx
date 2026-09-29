"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  RefreshCw, Search, Filter, PackageOpen, Bike, MapPin, Store,
  Truck, CircleAlert, CircleCheck, Users, Phone, X, CalendarClock,
} from "lucide-react"

type Agent = {
  id: string
  name: string
  kind: string
  companyName: string | null
  isAvailable: boolean
  vehicle: string | null
}

type Zone = { id: string; name: string; baseFee: number; isActive: boolean }

type Delivery = {
  id: string
  orderNumber: string
  customer: string
  phone: string
  address: string
  city: string
  district: string | null
  mode: "DELIVERY" | "PICKUP"
  fee: number
  zoneId: string | null
  zone: string
  scheduledDate: string | null
  assignedAt: string | null
  deliveredAt: string | null
  failedReason: string
  agentId: string | null
  agent: string
  agentKind: string
  status: string
  items: string
  total: number
  notes: string
  createdAt: string
}

const STATUS_META: Record<string, { label: string; chip: string; icon: typeof Truck }> = {
  PENDING: { label: "À planifier", chip: "bg-gray-100 text-gray-700", icon: CalendarClock },
  ASSIGNED: { label: "Assignées", chip: "bg-blue-100 text-blue-700", icon: Users },
  PICKED_UP: { label: "Prises en charge", chip: "bg-indigo-100 text-indigo-700", icon: PackageOpen },
  IN_TRANSIT: { label: "En transit", chip: "bg-orange-100 text-orange-700", icon: Truck },
  DELIVERED: { label: "Livrées", chip: "bg-green-100 text-green-700", icon: CircleCheck },
  FAILED: { label: "Échecs", chip: "bg-red-100 text-red-700", icon: CircleAlert },
}

const BOARD_SECTIONS = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "FAILED"] as const
const PAGE_SIZE = 8

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })
}

export default function LivraisonsPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState("ALL")
  const [status, setStatus] = useState("ALL")
  const [agentId, setAgentId] = useState("ALL")
  const [zoneId, setZoneId] = useState("ALL")
  const [date, setDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [deliveredPage, setDeliveredPage] = useState(1)

  const load = useCallback(async (params: URLSearchParams) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/deliveries?${params.toString()}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Erreur de chargement")
      setDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : [])
      setAgents(Array.isArray(data?.agents) ? data.agents : [])
      setZones(Array.isArray(data?.zones) ? data.zones : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (mode !== "ALL") params.set("mode", mode)
    if (status !== "ALL") params.set("status", status)
    if (agentId !== "ALL") params.set("agentId", agentId)
    if (zoneId !== "ALL") params.set("zoneId", zoneId)
    if (date) params.set("date", date)
    const timer = setTimeout(() => {
      setDeliveredPage(1)
      void load(params)
    }, query ? 350 : 0)
    return () => clearTimeout(timer)
  }, [load, query, mode, status, agentId, zoneId, date])

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const activeFilterCount = [mode, status, agentId, zoneId, date].filter((v) => v !== "ALL" && v !== "").length + (query ? 1 : 0)

  function resetFilters() {
    setSearch(""); setQuery(""); setMode("ALL"); setStatus("ALL"); setAgentId("ALL"); setZoneId("ALL"); setDate("")
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Mise a jour impossible")
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (mode !== "ALL") params.set("mode", mode)
      if (status !== "ALL") params.set("status", status)
      if (agentId !== "ALL") params.set("agentId", agentId)
      if (zoneId !== "ALL") params.set("zoneId", zoneId)
      if (date) params.set("date", date)
      await load(params)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible")
      return false
    } finally {
      setBusyId("")
    }
  }

  const today = new Date().toDateString()
  const kpi = useMemo(() => {
    const courier = deliveries.filter((d) => d.mode === "DELIVERY")
    const inProgress = courier.filter((d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)).length
    const toPlan = courier.filter((d) => d.status === "PENDING").length
    const deliveredToday = deliveries.filter((d) => d.deliveredAt && new Date(d.deliveredAt).toDateString() === today).length
    const failed = deliveries.filter((d) => d.status === "FAILED").length
    const pickups = deliveries.filter((d) => d.mode === "PICKUP" && d.status !== "DELIVERED").length
    const fees = courier.reduce((s, d) => s + (d.fee || 0), 0)
    return { toPlan, inProgress, deliveredToday, failed, pickups, fees }
  }, [deliveries, today])

  const agentLoad = useMemo(() => {
    const map = new Map<string, { active: number; delivered: number }>()
    agents.forEach((a) => map.set(a.id, { active: 0, delivered: 0 }))
    for (const d of deliveries) {
      if (!d.agentId) continue
      const entry = map.get(d.agentId) ?? { active: 0, delivered: 0 }
      if (["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)) entry.active += 1
      if (d.status === "DELIVERED") entry.delivered += 1
      map.set(d.agentId, entry)
    }
    return map
  }, [agents, deliveries])

  const pickupsPending = deliveries.filter((d) => d.mode === "PICKUP" && d.status !== "DELIVERED")
  const deliveredList = deliveries.filter((d) => d.status === "DELIVERED")
  const deliveredPages = Math.max(1, Math.ceil(deliveredList.length / PAGE_SIZE))
  const safePage = Math.min(deliveredPage, deliveredPages)
  const deliveredShown = deliveredList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Livraisons</h1>
          <p className="mt-1 text-sm text-gray-500">
            Retrait sur place ou livraison a domicile, livreurs maison et partenaires, suivi terrain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/livreurs"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" /> Livreurs & zones
          </Link>
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (query) params.set("q", query)
              if (mode !== "ALL") params.set("mode", mode)
              if (status !== "ALL") params.set("status", status)
              if (agentId !== "ALL") params.set("agentId", agentId)
              if (zoneId !== "ALL") params.set("zoneId", zoneId)
              if (date) params.set("date", date)
              void load(params)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "A planifier", value: kpi.toPlan, tone: "border-gray-200 bg-white text-gray-900", sub: "livraisons a domicile" },
          { label: "En cours", value: kpi.inProgress, tone: "border-orange-200 bg-orange-50/50 text-orange-800", sub: "chez le livreur" },
          { label: "Livrees aujourd'hui", value: kpi.deliveredToday, tone: "border-green-200 bg-green-50/50 text-green-800", sub: `${formatPrice(kpi.fees)} de frais` },
          { label: "Echecs", value: kpi.failed, tone: "border-red-200 bg-red-50/50 text-red-800", sub: "a rejouer" },
          { label: "Retraits en attente", value: kpi.pickups, tone: "border-blue-200 bg-blue-50/50 text-blue-800", sub: "clients au comptoir" },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border p-3 sm:p-4 ${card.tone}`}>
            <p className="text-xs font-medium opacity-80">{card.label}</p>
            <p className="mt-1 text-lg font-bold sm:text-xl">{card.value}</p>
            <p className="mt-0.5 text-xs opacity-70">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (n° commande, client, adresse, quartier)…"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Filter className="h-4 w-4" /> Filtres
            {activeFilterCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block text-xs font-medium text-gray-600">
              Mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="ALL">Tous</option>
                <option value="DELIVERY">Livraison a domicile</option>
                <option value="PICKUP">Retrait sur place</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Statut
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="ALL">Tous</option>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Livreur
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="ALL">Tous</option>
                <option value="none">Non affectee</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.kind === "PARTNER" ? a.companyName || a.name : a.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Zone
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="ALL">Toutes</option>
                <option value="none">Sans zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Date prevue
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="self-end text-xs font-medium text-red-600 hover:text-red-700 sm:col-span-2 lg:col-span-5">
                Reinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Chargement des livraisons…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            {BOARD_SECTIONS.map((key) => {
              const meta = STATUS_META[key]
              const Icon = meta.icon
              const items = deliveries.filter((d) => d.status === key)
              return (
                <section key={key}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <h2 className="text-sm font-semibold text-gray-700">{meta.label}</h2>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-xs text-gray-400">
                      Aucune livraison
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((d) => (
                        <DeliveryCard
                          key={d.id}
                          delivery={d}
                          agents={agents}
                          busy={busyId === d.id}
                          canReassign={agents.length > 1}
                          onPatch={patch}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}

            <section>
              <div className="mb-3 flex items-center gap-2">
                <CircleCheck className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Livrees</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{deliveredList.length}</span>
              </div>
              {deliveredList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-xs text-gray-400">
                  Aucune livraison cloturee
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveredShown.map((d) => (
                    <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900">{d.orderNumber}</span>
                        <ModeBadge mode={d.mode} />
                        {d.zone && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{d.zone}</span>}
                        <span className="ml-auto text-xs text-gray-500">Livree le {formatDate(d.deliveredAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{d.customer} <span className="text-xs text-gray-400">· {d.phone}</span></p>
                      <p className="mt-0.5 text-xs text-gray-500">{d.address}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {d.agent ? `Livreur : ${d.agent}` : "Sans livreur"} · {formatPrice(d.fee)} de livraison
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {deliveredPages > 1 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
                  <button
                    onClick={() => setDeliveredPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {Array.from({ length: deliveredPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setDeliveredPage(i + 1)}
                      className={`h-7 w-7 rounded-lg text-xs font-semibold ${
                        safePage === i + 1 ? "bg-primary text-primary-foreground" : "border border-gray-200 bg-white text-gray-600"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setDeliveredPage((p) => Math.min(deliveredPages, p + 1))}
                    disabled={safePage === deliveredPages}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Users className="h-4 w-4 text-gray-500" /> Livreurs
                </h2>
                <Link href="/admin/livreurs" className="text-xs font-medium text-primary hover:underline">Gerer</Link>
              </div>
              {agents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">
                  Aucun livreur enregistre. Ajoutez un livreur maison ou partenaire pour affecter les commandes.
                </p>
              ) : (
                <div className="space-y-2">
                  {agents.map((a) => {
                    const stats = agentLoad.get(a.id) ?? { active: 0, delivered: 0 }
                    return (
                      <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5">
                        <span className={`rounded-lg p-2 ${a.kind === "PARTNER" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                          {a.kind === "PARTNER" ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-800">
                            {a.kind === "PARTNER" ? a.companyName || a.name : a.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {stats.active} en cours · {stats.delivered} livrees
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          a.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {a.isAvailable ? "Disponible" : "Indisponible"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Store className="h-4 w-4 text-gray-500" /> Retraits en attente
              </h2>
              {pickupsPending.length === 0 ? (
                <p className="text-xs text-gray-500">Aucun client attendu au comptoir.</p>
              ) : (
                <div className="space-y-2">
                  {pickupsPending.map((d) => (
                    <div key={d.id} className="rounded-lg border border-gray-100 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-800">{d.orderNumber}</span>
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => patch(d.id, { status: "DELIVERED" })}
                          className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Retire
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">{d.customer} · {d.phone}</p>
                      <p className="text-xs text-gray-500">Depuis le {formatDate(d.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <MapPin className="h-4 w-4 text-gray-500" /> Zones
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {zones.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucune zone configuree.</p>
                ) : (
                  zones.map((z) => (
                    <span key={z.id} className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      z.isActive ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-400 line-through"
                    }`}>
                      {z.name} · {formatPrice(z.baseFee)}
                    </span>
                  ))
                )}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Retrait gratuit au 97 Rue EWO (site LCG).
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function ModeBadge({ mode }: { mode: "DELIVERY" | "PICKUP" }) {
  return mode === "PICKUP" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
      <Store className="h-3 w-3" /> Retrait
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
      <Truck className="h-3 w-3" /> A domicile
    </span>
  )
}

function formatPrice(value: number) {
  return `${Math.round(value || 0).toLocaleString("fr-FR")} FCFA`
}

function DeliveryCard({
  delivery,
  agents,
  busy,
  canReassign,
  onPatch,
}: {
  delivery: Delivery
  agents: Agent[]
  busy: boolean
  canReassign: boolean
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [editDate, setEditDate] = useState(delivery.scheduledDate ? delivery.scheduledDate.slice(0, 10) : "")
  const [editNotes, setEditNotes] = useState(delivery.notes)
  const [failedMode, setFailedMode] = useState(false)
  const [failedReason, setFailedReason] = useState(delivery.failedReason)

  const transitions: { to: string; label: string; className: string }[] = []
  if (delivery.mode === "PICKUP") {
    transitions.push({ to: "DELIVERED", label: "Client retire", className: "bg-green-600 hover:bg-green-700" })
    if (delivery.status === "FAILED") {
      transitions.push({ to: "PENDING", label: "Remettre en attente", className: "bg-gray-600 hover:bg-gray-700" })
    }
  } else {
    if (delivery.status === "PENDING") transitions.push({ to: "ASSIGNED", label: "Planifier", className: "bg-blue-600 hover:bg-blue-700" })
    if (delivery.status === "ASSIGNED") transitions.push({ to: "PICKED_UP", label: "Prise en charge", className: "bg-indigo-600 hover:bg-indigo-700" })
    if (delivery.status === "PICKED_UP") transitions.push({ to: "IN_TRANSIT", label: "En route", className: "bg-orange-600 hover:bg-orange-700" })
    if (["PICKED_UP", "IN_TRANSIT"].includes(delivery.status)) transitions.push({ to: "DELIVERED", label: "Livree", className: "bg-green-600 hover:bg-green-700" })
    if (["PENDING", "ASSIGNED"].includes(delivery.status)) transitions.push({ to: "FAILED", label: "Echec", className: "bg-red-600 hover:bg-red-700" })
    if (delivery.status === "FAILED") transitions.push({ to: "PENDING", label: "Rejouer", className: "bg-gray-600 hover:bg-gray-700" })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-gray-900">{delivery.orderNumber}</span>
        <ModeBadge mode={delivery.mode} />
        {delivery.zone && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{delivery.zone}</span>
        )}
        {delivery.fee > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            {formatPrice(delivery.fee)}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">
          {delivery.scheduledDate ? `Prevue le ${formatDate(delivery.scheduledDate)}` : `Creee le ${formatDate(delivery.createdAt)}`}
        </span>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{delivery.customer}</p>
          {delivery.phone && (
            <p className="flex items-center gap-1 text-xs text-gray-500">
              <Phone className="h-3 w-3" /> {delivery.phone}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-600">{delivery.address}</p>
          {delivery.district && <p className="text-xs text-gray-500">{delivery.district}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-gray-500">{delivery.items || "—"}</p>
          <p className="mt-1 text-sm font-bold text-gray-900">{formatPrice(delivery.total)}</p>
          <p className="text-xs text-gray-400">
            {delivery.agent
              ? `Livreur : ${delivery.agent}${delivery.agentKind === "PARTNER" ? " (partenaire)" : ""}`
              : "Aucun livreur affecte"}
          </p>
        </div>
      </div>

      {delivery.status === "FAILED" && delivery.failedReason && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Motif : {delivery.failedReason}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {delivery.mode === "DELIVERY" && canReassign && (
          <select
            value={delivery.agentId ?? ""}
            disabled={busy}
            onChange={(e) => onPatch(delivery.id, { agentId: e.target.value || null })}
            className="w-full max-w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-primary sm:w-auto"
          >
            <option value="">— Affecter un livreur —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.isAvailable}>
                {a.kind === "PARTNER" ? a.companyName || a.name : a.name}{!a.isAvailable ? " (indisponible)" : ""}
              </option>
            ))}
          </select>
        )}

        {transitions.filter((t) => t.to !== "FAILED").map((t) => (
          <button
            key={t.to}
            type="button"
            disabled={busy}
            onClick={() => onPatch(delivery.id, { status: t.to })}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${t.className}`}
          >
            {t.label}
          </button>
        ))}

        {transitions.some((t) => t.to === "FAILED") && !failedMode && (
          <button
            type="button"
            onClick={() => setFailedMode(true)}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Echec
          </button>
        )}

        {failedMode && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
            <input
              value={failedReason}
              onChange={(e) => setFailedReason(e.target.value)}
              placeholder="Motif (client absent, adresse incorrecte…)"
              className="min-w-0 flex-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-red-400"
            />
            <button
              type="button"
              disabled={busy || !failedReason.trim()}
              onClick={async () => {
                const ok = await onPatch(delivery.id, { status: "FAILED", failedReason })
                if (ok) { setFailedMode(false); setOpen(true) }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => setFailedMode(false)}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700"
            >
              Annuler
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          {open ? "Masquer" : "Details"}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600">
            Date prevue
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Notes internes
            <input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onPatch(delivery.id, { scheduledDate: editDate || null, notes: editNotes })}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
