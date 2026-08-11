"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Banknote, BookOpen, Calculator, ChevronDown, Clock, CreditCard, RefreshCw, Smartphone, WalletCards } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface PaymentBreakdown {
  method: string
  total: number
  count: number
}

interface ReportPayload {
  summary: {
    todayRevenue: number
    todayOrders: number
    cashExpected: number
    cashGap: number
  }
  paymentBreakdown: PaymentBreakdown[]
  daily: { name: string; revenu: number; commandes: number }[]
}

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

const paymentLabels: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces / à la livraison",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte bancaire",
}

const paymentIcons: Record<string, typeof Banknote> = {
  CASH_ON_DELIVERY: Banknote,
  MOBILE_MONEY: Smartphone,
  CARD: CreditCard,
}

type Tab = "today" | "journal"

export default function CaissePage() {
  const [tab, setTab] = useState<Tab>("today")
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cashCounted, setCashCounted] = useState("")
  const [closingNote, setClosingNote] = useState("")

  const [journalData, setJournalData] = useState<JournalPayload | null>(null)
  const [journalLoading, setJournalLoading] = useState(true)
  const [journalError, setJournalError] = useState("")
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [journalPage, setJournalPage] = useState(1)
  const JOURNAL_PER_PAGE = 5

  const handleFrom = (v: string) => { setFrom(v); setJournalPage(1) }
  const handleTo = (v: string) => { setTo(v); setJournalPage(1) }

  const load = async () => {
    setError("")
    try {
      const res = await fetch("/api/reports")
      if (!res.ok) throw new Error("Impossible de charger la caisse")
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  const loadJournal = useCallback(async () => {
    setJournalError("")
    setJournalLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/reports/journal-caisse?${params}`)
      if (!res.ok) throw new Error("Impossible de charger le journal")
      setJournalData(await res.json())
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setJournalLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (tab === "journal") void loadJournal()
  }, [tab, loadJournal])

  const cashActual = Number(cashCounted) || 0
  const expected = data?.summary.cashExpected ?? 0
  const countedGap = useMemo(() => cashActual - expected, [cashActual, expected])
  const mobileMoney = data?.paymentBreakdown.find((item) => item.method === "MOBILE_MONEY")?.total ?? 0
  const card = data?.paymentBreakdown.find((item) => item.method === "CARD")?.total ?? 0

  const journalDaily = journalData?.daily ?? []
  const journalTotalPages = Math.max(1, Math.ceil(journalDaily.length / JOURNAL_PER_PAGE))
  const journalCurrentPage = Math.min(journalPage, journalTotalPages)
  const journalPaged = journalDaily.slice((journalCurrentPage - 1) * JOURNAL_PER_PAGE, journalCurrentPage * JOURNAL_PER_PAGE)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caisse</h1>
          <p className="mt-1 text-sm text-gray-500">Encaissements du jour, contrôle espèces et rapprochement.</p>
        </div>
        <button onClick={tab === "today" ? load : loadJournal} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
        <button onClick={() => setTab("today")} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === "today" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Aujourd&apos;hui
        </button>
        <button onClick={() => setTab("journal")} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === "journal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="flex items-center justify-center gap-2"><BookOpen className="h-4 w-4" /> Journal de caisse</span>
        </button>
      </div>

      {tab === "today" && (
        <>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Ventes du jour</p><p className="mt-1 text-xl font-bold text-gray-900">{loading ? "..." : formatPrice(data?.summary.todayRevenue ?? 0)}</p></div>
            <div className="rounded-xl border border-green-200 bg-green-50/40 p-4"><p className="text-xs font-medium text-green-700">Espèces attendues</p><p className="mt-1 text-xl font-bold text-green-800">{formatPrice(expected)}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"><p className="text-xs font-medium text-blue-700">Mobile Money</p><p className="mt-1 text-xl font-bold text-blue-800">{formatPrice(mobileMoney)}</p></div>
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4"><p className="text-xs font-medium text-purple-700">Carte</p><p className="mt-1 text-xl font-bold text-purple-800">{formatPrice(card)}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Rapprochement des paiements</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Mode</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Transactions</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.paymentBreakdown ?? []).map((item) => {
                      const Icon = paymentIcons[item.method] ?? WalletCards

  return (
                        <tr key={item.method}>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"><Icon className="h-4 w-4" /></span><span className="text-sm font-medium text-gray-800">{paymentLabels[item.method] ?? item.method}</span></div></td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{item.count}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatPrice(item.total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Clôture de caisse</h2>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Espèces comptées
                  <input type="number" min={0} value={cashCounted} onChange={(e) => setCashCounted(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="0" />
                </label>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Attendu</span><span className="font-semibold text-gray-900">{formatPrice(expected)}</span></div>
                  <div className="mt-2 flex items-center justify-between text-sm"><span className="text-gray-500">Écart</span><span className={`font-semibold ${countedGap === 0 ? "text-gray-900" : countedGap > 0 ? "text-green-700" : "text-red-700"}`}>{formatPrice(countedGap)}</span></div>
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  Note de clôture
                  <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Justification d'écart, remise banque..." />
                </label>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                  <Calculator className="h-4 w-4" /> Préparer le rapport journalier
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "journal" && (
        <>
          {journalError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{journalError}</div>}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Du
              <input type="date" value={from} onChange={(e) => handleFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Au
              <input type="date" value={to} onChange={(e) => handleTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
            </label>
          </div>

          {journalData?.summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Jours analysés</p><p className="mt-1 text-xl font-bold text-gray-900">{journalData.summary.totalDays}</p></div>
              <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Total ventes</p><p className="mt-1 text-xl font-bold text-gray-900">{formatPrice(journalData.summary.totalRevenue)}</p></div>
              <div className="rounded-xl border border-green-200 bg-green-50/40 p-4"><p className="text-xs font-medium text-green-700">Espèces totales</p><p className="mt-1 text-xl font-bold text-green-800">{formatPrice(journalData.summary.totalCash)}</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"><p className="text-xs font-medium text-blue-700">Mobile Money</p><p className="mt-1 text-xl font-bold text-blue-800">{formatPrice(journalData.summary.totalMobile)}</p></div>
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4"><p className="text-xs font-medium text-purple-700">Carte</p><p className="mt-1 text-xl font-bold text-purple-800">{formatPrice(journalData.summary.totalCard)}</p></div>
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
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Ventes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {journalLoading && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">Chargement...</td></tr>
                  )}
                  {!journalLoading && journalPaged.map((day) => {
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
                  {!journalLoading && (!journalData?.daily || journalData.daily.length === 0) && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500"><BookOpen className="mx-auto mb-2 h-9 w-9 text-gray-300" />Aucune donnée pour cette période.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {journalDaily.length > JOURNAL_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{journalDaily.length} jour(s) · Page {journalCurrentPage}/{journalTotalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setJournalPage(1)} disabled={journalCurrentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
                <button onClick={() => setJournalPage(journalCurrentPage - 1)} disabled={journalCurrentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
                {Array.from({ length: journalTotalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === journalTotalPages || Math.abs(p - journalCurrentPage) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span> : <button key={p} onClick={() => setJournalPage(p)} className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${p === journalCurrentPage ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>)}
                <button onClick={() => setJournalPage(journalCurrentPage + 1)} disabled={journalCurrentPage >= journalTotalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
                <button onClick={() => setJournalPage(journalTotalPages)} disabled={journalCurrentPage >= journalTotalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
