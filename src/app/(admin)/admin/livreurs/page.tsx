"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bike, Building2, CircleAlert, CircleCheck, MapPin, Pencil, Phone,
  Plus, RefreshCw, Trash2, Truck, UserRound, Users, Wallet, X, Car, Check,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

type AgentFee = { zoneId: string; fee: number }

type Agent = {
  id: string
  name: string
  kind: "MAISON" | "PARTNER"
  userId: string | null
  user: { id: string; name: string; email: string; isActive: boolean } | null
  companyName: string | null
  phone: string | null
  vehicle: string | null
  plateNumber: string | null
  zonesLabel: string | null
  isAvailable: boolean
  isActive: boolean
  notes: string | null
  activeDeliveries: number
  fees: AgentFee[]
  createdAt: string
}

type Zone = { id: string; name: string; baseFee: number; isActive: boolean }
type ZoneStat = Zone & { sortOrder: number; deliveries: number; agents: number }
type AppUser = { id: string; name: string; email: string; role: string }

type AgentForm = {
  name: string
  kind: "MAISON" | "PARTNER"
  companyName: string
  phone: string
  vehicle: string
  plateNumber: string
  zonesLabel: string
  userId: string
  isAvailable: boolean
  isActive: boolean
  notes: string
  fees: Record<string, string>
}

const EMPTY_FORM: AgentForm = {
  name: "", kind: "MAISON", companyName: "", phone: "", vehicle: "", plateNumber: "",
  zonesLabel: "", userId: "", isAvailable: true, isActive: true, notes: "", fees: {},
}

type ZoneForm = { name: string; baseFee: string; sortOrder: string; isActive: boolean }
const EMPTY_ZONE: ZoneForm = { name: "", baseFee: "0", sortOrder: "0", isActive: true }

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#16489f] focus:ring-2 focus:ring-[#16489f]/20"
const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500"

function displayName(agent: Agent) {
  return agent.kind === "PARTNER" && agent.companyName ? agent.companyName : agent.name
}

export default function LivreursPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneStats, setZoneStats] = useState<ZoneStat[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState("")
  const [tab, setTab] = useState<"agents" | "zones">("agents")
  const [kindFilter, setKindFilter] = useState("ALL")

  const [agentForm, setAgentForm] = useState<AgentForm | null>(null)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [zoneForm, setZoneForm] = useState<ZoneForm | null>(null)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch("/api/delivery-agents"),
        fetch("/api/delivery-zones"),
      ])
      const agentsData = await agentsRes.json().catch(() => null)
      if (!agentsRes.ok) throw new Error(agentsData?.error || "Erreur de chargement des livreurs")
      setAgents(Array.isArray(agentsData?.agents) ? agentsData.agents : [])
      setZones(Array.isArray(agentsData?.zones) ? agentsData.zones : [])

      const statsData = await statsRes.json().catch(() => null)
      if (statsRes.ok && Array.isArray(statsData?.zones)) setZoneStats(statsData.zones)

      // La liste des utilisateurs est réservée aux administrateurs : son absence
      // ne doit pas bloquer la gestion des livreurs partenaires.
      const usersRes = await fetch("/api/users")
      if (usersRes.ok) {
        const usersData = await usersRes.json().catch(() => null)
        if (Array.isArray(usersData)) setUsers(usersData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await load()
    }
    void init()
  }, [load])

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])
  const linkedUserIds = useMemo(() => new Set(agents.map((a) => a.userId).filter(Boolean) as string[]), [agents])

  const stats = useMemo(
    () => ({
      total: agents.filter((a) => a.isActive).length,
      maison: agents.filter((a) => a.isActive && a.kind === "MAISON").length,
      partners: agents.filter((a) => a.isActive && a.kind === "PARTNER").length,
      available: agents.filter((a) => a.isActive && a.isAvailable).length,
      onRoad: agents.reduce((sum, a) => sum + a.activeDeliveries, 0),
      zones: zones.filter((z) => z.isActive).length,
    }),
    [agents, zones]
  )

  const visibleAgents = useMemo(
    () => (kindFilter === "ALL" ? agents : agents.filter((a) => a.kind === kindFilter)),
    [agents, kindFilter]
  )

  function openAgentForm(agent: Agent | null) {
    if (agent) {
      setEditingAgentId(agent.id)
      setAgentForm({
        name: agent.name,
        kind: agent.kind,
        companyName: agent.companyName ?? "",
        phone: agent.phone ?? "",
        vehicle: agent.vehicle ?? "",
        plateNumber: agent.plateNumber ?? "",
        zonesLabel: agent.zonesLabel ?? "",
        userId: agent.userId ?? "",
        isAvailable: agent.isAvailable,
        isActive: agent.isActive,
        notes: agent.notes ?? "",
        fees: Object.fromEntries(agent.fees.map((f) => [f.zoneId, String(f.fee)])),
      })
    } else {
      setEditingAgentId(null)
      setAgentForm({ ...EMPTY_FORM })
    }
    setError("")
    setNotice("")
  }

  function setFormField<K extends keyof AgentForm>(key: K, value: AgentForm[K]) {
    setAgentForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function saveAgent() {
    if (!agentForm) return
    setBusy("agent")
    setError("")
    setNotice("")
    try {
      const fees = Object.entries(agentForm.fees)
        .filter(([, fee]) => String(fee).trim() !== "")
        .map(([zoneId, fee]) => ({ zoneId, fee: Math.max(0, Number(fee) || 0) }))

      const res = await fetch(editingAgentId ? `/api/delivery-agents/${editingAgentId}` : "/api/delivery-agents", {
        method: editingAgentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentForm.name,
          kind: agentForm.kind,
          companyName: agentForm.kind === "PARTNER" ? agentForm.companyName : "",
          phone: agentForm.phone,
          vehicle: agentForm.vehicle,
          plateNumber: agentForm.plateNumber,
          zonesLabel: agentForm.zonesLabel,
          userId: agentForm.kind === "PARTNER" ? "" : agentForm.userId,
          isAvailable: agentForm.isAvailable,
          isActive: agentForm.isActive,
          notes: agentForm.notes,
          fees,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Enregistrement impossible")
      setNotice(editingAgentId ? "Livreur mis à jour." : "Livreur créé.")
      setAgentForm(null)
      setEditingAgentId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible")
    } finally {
      setBusy("")
    }
  }

  async function patchAgent(agent: Agent, body: Record<string, unknown>) {
    setBusy(agent.id)
    setError("")
    setNotice("")
    try {
      const res = await fetch(`/api/delivery-agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Mise a jour impossible")
      setNotice("Livreur mis à jour.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible")
    } finally {
      setBusy("")
    }
  }

  async function removeAgent(agent: Agent) {
    if (!window.confirm(`Supprimer le livreur « ${displayName(agent)} » ?`)) return
    setBusy(agent.id)
    setError("")
    setNotice("")
    try {
      const res = await fetch(`/api/delivery-agents/${agent.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Suppression impossible")
      setNotice("Livreur supprimé.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible")
    } finally {
      setBusy("")
    }
  }

  function openZoneForm(zone: ZoneStat | null) {
    if (zone) {
      setEditingZoneId(zone.id)
      setZoneForm({
        name: zone.name,
        baseFee: String(zone.baseFee),
        sortOrder: String(zone.sortOrder),
        isActive: zone.isActive,
      })
    } else {
      setEditingZoneId(null)
      setZoneForm({ ...EMPTY_ZONE, sortOrder: String(zones.length + 1) })
    }
    setError("")
    setNotice("")
  }

  async function saveZone() {
    if (!zoneForm) return
    setBusy("zone")
    setError("")
    setNotice("")
    try {
      const res = await fetch(editingZoneId ? `/api/delivery-zones/${editingZoneId}` : "/api/delivery-zones", {
        method: editingZoneId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: zoneForm.name,
          baseFee: Math.max(0, Number(zoneForm.baseFee) || 0),
          sortOrder: Number(zoneForm.sortOrder) || 0,
          isActive: zoneForm.isActive,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Enregistrement impossible")
      setNotice(editingZoneId ? "Zone mise à jour." : "Zone créée.")
      setZoneForm(null)
      setEditingZoneId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible")
    } finally {
      setBusy("")
    }
  }

  async function toggleZone(zone: ZoneStat) {
    setBusy(zone.id)
    setError("")
    setNotice("")
    try {
      const res = await fetch(`/api/delivery-zones/${zone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !zone.isActive }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Mise a jour impossible")
      setNotice("Zone mise à jour.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible")
    } finally {
      setBusy("")
    }
  }

  async function removeZone(zone: ZoneStat) {
    if (!window.confirm(`Supprimer la zone « ${zone.name} » ?`)) return
    setBusy(zone.id)
    setError("")
    setNotice("")
    try {
      const res = await fetch(`/api/delivery-zones/${zone.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Suppression impossible")
      setNotice("Zone supprimée.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible")
    } finally {
      setBusy("")
    }
  }

  const kpis = [
    { label: "Livreurs actifs", value: stats.total, icon: Users, chip: "bg-blue-100 text-blue-700" },
    { label: "Livreurs LCG", value: stats.maison, icon: Bike, chip: "bg-indigo-100 text-indigo-700" },
    { label: "Partenaires", value: stats.partners, icon: Building2, chip: "bg-purple-100 text-purple-700" },
    { label: "Disponibles", value: stats.available, icon: CircleCheck, chip: "bg-green-100 text-green-700" },
    { label: "Livraisons en cours", value: stats.onRoad, icon: Truck, chip: "bg-orange-100 text-orange-700" },
    { label: "Zones actives", value: stats.zones, icon: MapPin, chip: "bg-gray-100 text-gray-700" },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livreurs &amp; zones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Livreurs maison ou partenaires, véhicule, disponibilité et tarifs par zone de livraison.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          {tab === "agents" ? (
            <button
              type="button"
              onClick={() => openAgentForm(null)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#16489f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#123b82]"
            >
              <Plus className="h-4 w-4" />
              Nouveau livreur
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openZoneForm(null)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#16489f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#123b82]"
            >
              <Plus className="h-4 w-4" />
              Nouvelle zone
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg p-1.5 ${kpi.chip}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{kpi.value}</p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
        {([
          { id: "agents", label: `Livreurs (${agents.length})` },
          { id: "zones", label: `Zones (${zones.length})` },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === item.id ? "bg-[#16489f] text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </button>
        ))}
        {tab === "agents" && (
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            className="ml-auto rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
            aria-label="Filtrer par type"
          >
            <option value="ALL">Tous les types</option>
            <option value="MAISON">Livreurs LCG</option>
            <option value="PARTNER">Partenaires</option>
          </select>
        )}
      </div>

      {tab === "agents" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleAgents.length === 0 && !loading && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Aucun livreur. Créez vos livreurs LCG ou ajoutez des partenaires pour proposer la livraison à domicile.
            </p>
          )}
          {visibleAgents.map((agent) => {
            const Icon = agent.kind === "PARTNER" ? Building2 : Bike
            return (
              <div
                key={agent.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  agent.isActive ? "border-gray-200" : "border-gray-200 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`rounded-lg p-2 ${
                        agent.kind === "PARTNER" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{displayName(agent)}</p>
                      <p className="truncate text-xs text-gray-500">
                        {agent.kind === "PARTNER" ? `Partenaire — ${agent.name}` : "Livreur LCG"}
                        {agent.zonesLabel ? ` · ${agent.zonesLabel}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        agent.kind === "PARTNER" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {agent.kind === "PARTNER" ? "Partenaire" : "LCG"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        agent.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {agent.isAvailable ? "Disponible" : "Indisponible"}
                    </span>
                    {!agent.isActive && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Désactivé
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  {agent.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span className="truncate">{agent.phone}</span>
                    </div>
                  )}
                  {(agent.vehicle || agent.plateNumber) && (
                    <div className="flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-gray-400" />
                      <span className="truncate">
                        {[agent.vehicle, agent.plateNumber].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-gray-400" />
                    <span className="truncate">
                      {agent.user ? `${agent.user.name || agent.user.email} (compte LCG)` : "Aucun compte lié"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-gray-400" />
                    <span>
                      {agent.activeDeliveries} livraison(s) en cours
                    </span>
                  </div>
                </dl>

                <div className="mt-3 rounded-lg bg-gray-50 p-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Wallet className="h-3.5 w-3.5" />
                    Tarifs par zone
                  </p>
                  {agent.fees.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Tarif unique : tarif de base de chaque zone.
                    </p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {agent.fees.map((fee) => (
                        <li
                          key={fee.zoneId}
                          className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                        >
                          {zoneById.get(fee.zoneId)?.name ?? "Zone supprimée"} : {formatPrice(fee.fee)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAgentForm(agent)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={busy === agent.id}
                    onClick={() => void patchAgent(agent, { isAvailable: !agent.isAvailable })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {agent.isAvailable ? "Rendre indisponible" : "Rendre disponible"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === agent.id}
                    onClick={() => void patchAgent(agent, { isActive: !agent.isActive })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {agent.isActive ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === agent.id || agent.activeDeliveries > 0}
                    onClick={() => void removeAgent(agent)}
                    title={agent.activeDeliveries > 0 ? "Réaffectez ses livraisons avant de le supprimer" : "Supprimer"}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === "zones" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {zoneStats.length === 0 && !loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              Aucune zone de livraison. Créez les zones desservies pour calibrer les frais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Zone</th>
                    <th className="px-4 py-3 font-semibold">Tarif de base</th>
                    <th className="px-4 py-3 font-semibold">Tarifs livreurs</th>
                    <th className="px-4 py-3 font-semibold">Livraisons</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zoneStats.map((zone) => (
                    <tr key={zone.id} className={zone.isActive ? "" : "bg-gray-50 text-gray-400"}>
                      <td className="px-4 py-3 font-medium text-gray-900">{zone.name}</td>
                      <td className="px-4 py-3 text-gray-700">{formatPrice(zone.baseFee)}</td>
                      <td className="px-4 py-3 text-gray-700">{zone.agents} tarif(s) personnalisé(s)</td>
                      <td className="px-4 py-3 text-gray-700">{zone.deliveries}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            zone.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {zone.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openZoneForm(zone)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            disabled={busy === zone.id}
                            onClick={() => void toggleZone(zone)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {zone.isActive ? "Désactiver" : "Activer"}
                          </button>
                          <button
                            type="button"
                            disabled={busy === zone.id || zone.deliveries > 0}
                            onClick={() => void removeZone(zone)}
                            title={zone.deliveries > 0 ? "Des livraisons référencent cette zone" : "Supprimer"}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {agentForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
              <h2 className="text-base font-semibold text-gray-900">
                {editingAgentId ? "Modifier le livreur" : "Nouveau livreur"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAgentForm(null)
                  setEditingAgentId(null)
                }}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={labelClass}>Type</span>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "MAISON", label: "Livreur LCG" },
                      { id: "PARTNER", label: "Partenaire" },
                    ] as const).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setFormField("kind", option.id)}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                          agentForm.kind === option.id
                            ? "border-[#16489f] bg-[#16489f] text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="agent-name">
                    {agentForm.kind === "PARTNER" ? "Contact du partenaire" : "Nom du livreur"}
                  </label>
                  <input
                    id="agent-name"
                    className={inputClass}
                    value={agentForm.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Ex. Jean Mbemba"
                  />
                </div>
              </div>

              {agentForm.kind === "PARTNER" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="agent-company">
                      Raison sociale <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="agent-company"
                      className={inputClass}
                      value={agentForm.companyName}
                      onChange={(event) => setFormField("companyName", event.target.value)}
                      placeholder="Ex. Express Congo"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="agent-phone">
                      Téléphone
                    </label>
                    <input
                      id="agent-phone"
                      className={inputClass}
                      value={agentForm.phone}
                      onChange={(event) => setFormField("phone", event.target.value)}
                      placeholder="+242 ..."
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="agent-vehicle">
                    Véhicule
                  </label>
                  <input
                    id="agent-vehicle"
                    className={inputClass}
                    value={agentForm.vehicle}
                    onChange={(event) => setFormField("vehicle", event.target.value)}
                    placeholder="Moto, vélo, camion…"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="agent-plate">
                    Immatriculation
                  </label>
                  <input
                    id="agent-plate"
                    className={inputClass}
                    value={agentForm.plateNumber}
                    onChange={(event) => setFormField("plateNumber", event.target.value)}
                    placeholder="XX 1234 AB"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="agent-zones">
                    Secteurs couverts
                  </label>
                  <input
                    id="agent-zones"
                    className={inputClass}
                    value={agentForm.zonesLabel}
                    onChange={(event) => setFormField("zonesLabel", event.target.value)}
                    placeholder="Moungali, Bacongo…"
                  />
                </div>
              </div>

              {agentForm.kind === "MAISON" && (
                <div>
                  <label className={labelClass} htmlFor="agent-user">
                    Compte utilisateur LCG (pour le suivi terrain)
                  </label>
                  <select
                    id="agent-user"
                    className={inputClass}
                    value={agentForm.userId}
                    onChange={(event) => setFormField("userId", event.target.value)}
                  >
                    <option value="">Aucun compte lié</option>
                    {users
                      .filter((user) => user.role !== "CUSTOMER" || agentForm.userId === user.id)
                      .map((user) => (
                        <option
                          key={user.id}
                          value={user.id}
                          disabled={linkedUserIds.has(user.id) && agentForm.userId !== user.id}
                        >
                          {user.name || user.email} ({user.role})
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Le compte permet au livreur de ne voir que ses propres tournées sur les livraisons.
                  </p>
                </div>
              )}

              <div>
                <label className={labelClass} htmlFor="agent-notes">
                  Notes internes
                </label>
                <textarea
                  id="agent-notes"
                  className={`${inputClass} min-h-20`}
                  value={agentForm.notes}
                  onChange={(event) => setFormField("notes", event.target.value)}
                  placeholder="Capacité, horaires, contraintes…"
                />
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Tarifs personnalisés
                  </p>
                  <p className="text-xs text-gray-500">Vide = tarif de base de la zone</p>
                </div>
                {zones.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">
                    Aucune zone de livraison : créez d&apos;abord vos zones dans l&apos;onglet « Zones ».
                  </p>
                ) : (
                  <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{zone.name}</p>
                          <p className="text-xs text-gray-500">Base : {formatPrice(zone.baseFee)}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm sm:w-32 sm:px-3"
                          placeholder={String(zone.baseFee)}
                          value={agentForm.fees[zone.id] ?? ""}
                          onChange={(event) =>
                            setAgentForm((prev) => {
                              if (!prev) return prev
                              const fees = { ...prev.fees }
                              if (event.target.value === "") delete fees[zone.id]
                              else fees[zone.id] = event.target.value
                              return { ...prev, fees }
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agentForm.isAvailable}
                    onChange={(event) => setFormField("isAvailable", event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Disponible
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agentForm.isActive}
                    onChange={(event) => setFormField("isActive", event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Actif (proposé au client)
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setAgentForm(null)
                  setEditingAgentId(null)
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy === "agent"}
                onClick={() => void saveAgent()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#16489f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123b82] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {editingAgentId ? "Enregistrer" : "Créer le livreur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoneForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
              <h2 className="text-base font-semibold text-gray-900">
                {editingZoneId ? "Modifier la zone" : "Nouvelle zone"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setZoneForm(null)
                  setEditingZoneId(null)
                }}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className={labelClass} htmlFor="zone-name">
                  Nom de la zone
                </label>
                <input
                  id="zone-name"
                  className={inputClass}
                  value={zoneForm.name}
                  onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })}
                  placeholder="Ex. Bacongo"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="zone-fee">
                    Tarif de base (FCFA)
                  </label>
                  <input
                    id="zone-fee"
                    type="number"
                    min={0}
                    step={100}
                    className={inputClass}
                    value={zoneForm.baseFee}
                    onChange={(event) => setZoneForm({ ...zoneForm, baseFee: event.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="zone-order">
                    Ordre d&apos;affichage
                  </label>
                  <input
                    id="zone-order"
                    type="number"
                    className={inputClass}
                    value={zoneForm.sortOrder}
                    onChange={(event) => setZoneForm({ ...zoneForm, sortOrder: event.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={zoneForm.isActive}
                  onChange={(event) => setZoneForm({ ...zoneForm, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Zone proposée au client
              </label>
            </div>
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setZoneForm(null)
                  setEditingZoneId(null)
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy === "zone"}
                onClick={() => void saveZone()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#16489f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123b82] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {editingZoneId ? "Enregistrer" : "Créer la zone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
