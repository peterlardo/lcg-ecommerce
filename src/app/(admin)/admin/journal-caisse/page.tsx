"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, ChevronDown, Clock, Filter, Minus, Plus, RefreshCw } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface CashSession {
  id: string
  status: string
  openingBalance: number
  closingBalance: number | null
  openedAt: string
  closedAt: string | null
}

interface DayEntry {
  date: string
  label: string
  pointOfSale: { id: string; name: string; code: string } | null
  sessions: CashSession[]
  openingBalance: number
  closingBalance: number | null
  cashTotal: number
  mobileMoneyTotal: number
  cardTotal: number
  totalRevenue: number
  orderCount: number
  expectedCash: number
  gap: number | null
}

interface JournalPayload {
  summary: {
    totalDays: number
    totalOrders: number
    totalRevenue: number
    totalCash: number
    totalMobile: number
    totalCard: number
  }
  daily: DayEntry[]
}

export default function JournalCaissePage() {
  const [data, setData] = useState<JournalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError("")
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/reports/journal-caisse?${params}`)
      if (!res.ok) throw new Error("Impossible de charger le journal")
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal de caisse</h1>
          <p className="mt-1 text-sm text-gray-500">Historique des sessions de caisse, rapprochement et écarts quotidiens.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          Du
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          Au
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
        </label>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Jours analysés</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{summary.totalDays}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Total ventes</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{formatPrice(summary.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/40 p-4">
            <p className="text-xs font-medium text-green-700">Espèces totales</p>
            <p className="mt-1 text-xl font-bold text-green-800">{formatPrice(summary.totalCash)}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <p className="text-xs font-medium text-blue-700">Mobile Money</p>
            <p className="mt-1 text-xl font-bold text-blue-800">{formatPrice(summary.totalMobile)}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
            <p className="text-xs font-medium text-purple-700">Carte</p>
            <p className="mt-1 text-xl font-bold text-purple-800">{formatPrice(summary.totalCard)}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Point de vente</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ouverture</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Espèces</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Mobile M.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Carte</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Clôture</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Écart</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">Chargement...</td></tr>
              )}
              {!loading && data?.daily.map((day) => {
                const isExpanded = expandedDay === day.date
                return (
                  <>
                    <tr key={day.date} className="cursor-pointer hover:bg-gray-50/50" onClick={() => setExpandedDay(isExpanded ? null : day.date)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          <span className="text-sm font-medium text-gray-900">{day.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{day.pointOfSale ? `${day.pointOfSale.name} (${day.pointOfSale.code})` : "-"}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{formatPrice(day.openingBalance)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">{formatPrice(day.cashTotal)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-blue-700">{formatPrice(day.mobileMoneyTotal)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-purple-700">{formatPrice(day.cardTotal)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatPrice(day.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{day.closingBalance !== null ? formatPrice(day.closingBalance) : "-"}</td>
                      <td className="px-4 py-3 text-right">
                        {day.gap !== null ? (
                          <span className={`text-sm font-bold ${day.gap === 0 ? "text-green-600" : day.gap > 0 ? "text-blue-600" : "text-red-600"}`}>
                            {day.gap > 0 ? "+" : ""}{formatPrice(day.gap)}
                          </span>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{day.orderCount} vente(s)</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${day.date}-detail`}>
                        <td colSpan={10} className="bg-gray-50/60 px-6 py-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-xs font-medium text-gray-500">Solde d&apos;ouverture</p>
                                <p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(day.openingBalance)}</p>
                              </div>
                              <div className="rounded-lg border border-green-200 bg-green-50/40 p-3">
                                <p className="text-xs font-medium text-green-700">Espèces attendues</p>
                                <p className="mt-1 text-lg font-bold text-green-800">{formatPrice(day.expectedCash)}</p>
                              </div>
                              <div className={`rounded-lg border p-3 ${day.gap !== null && day.gap !== 0 ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"}`}>
                                <p className={`text-xs font-medium ${day.gap !== null && day.gap !== 0 ? "text-red-700" : "text-gray-500"}`}>Écart</p>
                                <p className={`mt-1 text-lg font-bold ${day.gap === null || day.gap === 0 ? "text-gray-900" : day.gap > 0 ? "text-blue-700" : "text-red-700"}`}>
                                  {day.gap !== null ? (day.gap > 0 ? "+" : "") + formatPrice(day.gap) : "Non clôturé"}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Sessions de caisse</p>
                              {day.sessions.map((session) => (
                                <div key={session.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">
                                  <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${session.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                      <Clock className="h-3 w-3" />
                                      {session.status === "OPEN" ? "Ouverte" : "Fermée"}
                                    </span>
                                    <span className="text-gray-500">Ouverture : {formatPrice(session.openingBalance)}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {session.closingBalance !== null && <span>Clôture : {formatPrice(session.closingBalance)}</span>}
                                    <span>Ouverte le {new Date(session.openedAt).toLocaleString("fr-FR")}</span>
                                    {session.closedAt && <span>Fermée le {new Date(session.closedAt).toLocaleString("fr-FR")}</span>}
                                  </div>
                                </div>
                              ))}
                              {day.sessions.length === 0 && (
                                <p className="text-sm text-gray-500">Aucune session de caisse ce jour.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {!loading && (!data?.daily || data.daily.length === 0) && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500"><BookOpen className="mx-auto mb-2 h-9 w-9 text-gray-300" />Aucune donnée pour cette période.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
