"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CalendarRange, Search, ChevronDown, ArrowLeft } from "lucide-react"
import type { Reservation } from "@/data/store"

const statusStyles: Record<string, string> = {
  CANCELLED: "bg-red-100 text-red-800",
}

const sourceLabels: Record<string, { label: string; className: string }> = {
  WEB: { label: "En ligne", className: "bg-teal-100 text-teal-700" },
  OPERATOR: { label: "Opérateur", className: "bg-violet-100 text-violet-700" },
}

export default function ReservationsArchivePage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 5

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/reservations", { signal: controller.signal })
        if (res.ok) setReservations(await res.json())
      } catch (err) {
        if (!controller.signal.aborted) console.error("Erreur:", err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  const archived = reservations.filter((r) => r.status === "CANCELLED")
  const filtered = archived.filter((r) => {
    if (!search) return true
    return (
      r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/reservations" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pré-commandes archivées</h1>
        </div>
        <p className="text-sm text-gray-500">{archived.length} archivée{archived.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une pré-commande archivée..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paged.map((res) => (
            <div key={res.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === res.id ? null : res.id)}
                className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarRange className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">{res.client}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[res.status]}`}>Annulée</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sourceLabels[res.source]?.className || "bg-gray-100 text-gray-600"}`}>
                        {sourceLabels[res.source]?.label || res.source || "En ligne"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {res.type} · {res.date} à {res.heure}
                      {res.address ? ` · ${res.address}` : ""}
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform shrink-0 ${expanded === res.id ? "rotate-180" : ""}`} />
                </div>
              </button>
              {expanded === res.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Coordonnées</h4>
                        <p className="text-sm text-gray-700"><span className="font-medium text-gray-500">Tél: </span>{res.telephone}</p>
                        {res.email && <p className="text-sm text-gray-700 mt-1"><span className="font-medium text-gray-500">Email: </span>{res.email}</p>}
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Articles réservés</h4>
                        {res.items.length > 0 ? (
                          <div className="space-y-1.5">
                            {res.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{item.name}{item.format ? ` — ${item.format}` : ""}</span>
                                <span className="text-gray-500">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-gray-500">Aucun article</p>}
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                        <p className="text-sm text-gray-700">{res.notes || "Aucune note"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Cette pré-commande est archivée (annulée).</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CalendarRange className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Aucune pré-commande archivée</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{filtered.length} résultat(s) · Page {currentPage}/{totalPages}</p>
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
      )}
    </div>
  )
}
