"use client"

import { useState, useEffect } from "react"
import { CalendarRange, Search, ChevronDown, Check, X } from "lucide-react"
import type { Reservation } from "@/data/store"

const statusFilters = ["Toutes", "En attente", "Confirmée", "Annulée"]

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

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("Toutes")
  const [expanded, setExpanded] = useState<string | null>(null)

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
    fetchReservations()
  }, [])

  const handleStatusChange = async (id: string, status: "PENDING" | "CONFIRMED" | "CANCELLED") => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      )
    }
  }

  const filtered = reservations.filter((r) => {
    const matchesTab =
      activeTab === "Toutes" || statusLabels[r.status] === activeTab
    const matchesSearch =
      r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Réservations</h1>
        <p className="text-sm text-gray-500">
          {reservations.filter((r) => r.status === "CONFIRMED").length} confirmée
          {reservations.filter((r) => r.status === "CONFIRMED").length > 1 ? "s" : ""}
          {" · "}
          {reservations.filter((r) => r.status === "PENDING").length} en attente
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une réservation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((res) => (
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
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarRange className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">{res.client}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[res.status]}`}>
                        {statusLabels[res.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {res.type} · {res.date} à {res.heure} · {res.inviteCount} invités
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
                          Notes
                        </h4>
                        <p className="text-sm text-gray-700">{res.notes || "Aucune note"}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Statut
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {res.status !== "CONFIRMED" && (
                          <button
                            onClick={() => handleStatusChange(res.id, "CONFIRMED")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" /> Confirmer
                          </button>
                        )}
                        {res.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleStatusChange(res.id, "CANCELLED")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" /> Annuler
                          </button>
                        )}
                        {res.status !== "PENDING" && (
                          <button
                            onClick={() => handleStatusChange(res.id, "PENDING")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                          >
                            Remettre en attente
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
              <p className="text-sm text-gray-500">Aucune réservation trouvée</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
