"use client"

import { useEffect, useState } from "react"
import {
  BarChart3, Banknote, CalendarDays, CalendarRange, Clock, Download, Factory,
  FileSpreadsheet, LayoutDashboard, Package, RefreshCw, ScanBarcode, Search, ShoppingCart, TrendingUp, Truck, WalletCards,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import type { TooltipValueType } from "recharts"
import { formatPrice } from "@/lib/utils"
import {
  exportVentesPDF, exportVentesExcel,
  exportStocksPDF, exportStocksExcel,
  exportApproPDF, exportApproExcel,
  exportCommandesPDF, exportCommandesExcel,
  exportReservationsPDF, exportReservationsExcel,
  exportProductionPDF, exportProductionExcel,
  exportCaissePDF, exportCaisseExcel,
  exportLotsPDF, exportLotsExcel,
  exportJourneePDF, exportJourneeExcel,
  exportGlobalPDF, exportGlobalExcel,
} from "@/lib/report-export"
import type { ReportPayload, JourneeReport, GlobalReport } from "@/lib/report-types"
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-threshold"
import { GlobalReportView } from "@/components/admin/global-report-view"
import { DateRangePicker } from "@/components/admin/date-range-picker"

type Tab = "global" | "journee" | "ventes" | "stocks" | "appro" | "commandes" | "reservations" | "production" | "lots" | "caisse"

const tabList: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "global", label: "Global", icon: LayoutDashboard },
  { id: "journee", label: "Journée", icon: CalendarDays },
  { id: "ventes", label: "Ventes", icon: BarChart3 },
  { id: "stocks", label: "Stocks", icon: Package },
  { id: "appro", label: "Approvisionnements", icon: Truck },
  { id: "commandes", label: "Commandes", icon: ShoppingCart },
  { id: "reservations", label: "Pré-commandes", icon: CalendarRange },
  { id: "production", label: "Production", icon: Factory },
  { id: "lots", label: "Lots", icon: ScanBarcode },
  { id: "caisse", label: "Caisse", icon: Banknote },
]

const PAYMENT: Record<string, string> = { CASH_ON_DELIVERY: "Especes", MOBILE_MONEY: "Mobile Money", CARD: "Carte" }
const COLORS = ["#1f4fa3", "#0f766e", "#7c3aed"]
const STATUS_LBL: Record<string, string> = { PENDING: "En attente", SENT_TO_CASHIER: "Envoyee a la caisse", CONFIRMED: "Confirmee", PROCESSING: "En cours", READY: "Prete", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livre", CANCELLED: "Annulee" }
const STATUS_BG: Record<string, string> = { PENDING: "bg-yellow-100 text-yellow-800", SENT_TO_CASHIER: "bg-sky-100 text-sky-800", CONFIRMED: "bg-blue-100 text-blue-800", PROCESSING: "bg-indigo-100 text-indigo-800", READY: "bg-green-100 text-green-800", OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800", DELIVERED: "bg-green-100 text-green-800", CANCELLED: "bg-red-100 text-red-800" }

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const SUPPLY_LBL: Record<string, string> = { IN: "Entree", PRODUCTION: "Production", TRANSFER_IN: "Transfert", RETURN: "Retour" }
const LOT_STATUS: Record<string, string> = { ACTIVE: "Actif", EXHAUSTED: "Epuise", EXPIRED: "Expire", DISABLED: "Désactivé" }

const ax = { tick: { fontSize: 12 }, stroke: "#9ca3af" }
const tt = { contentStyle: { borderRadius: "8px", border: "1px solid #e5e7eb" } }

export default function RapportsPage() {
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("ventes")
  const [period, setPeriod] = useState<string>("month")
  // Période personnalisée (calendrier) : bornes de dates.
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")
  // "all" = tous les points de vente, sinon id du point de vente.
  const [pos, setPos] = useState<string>("all")
  // Onglet « Journée » : date sélectionnée + rapport consolidé du jour.
  const [dayDate, setDayDate] = useState<string>(todayIso)
  const [dayData, setDayData] = useState<JourneeReport | null>(null)
  const [dayError, setDayError] = useState("")
  // Onglet « Global » : synthèse consolidée de tous les processus.
  const [globalData, setGlobalData] = useState<GlobalReport | null>(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalError, setGlobalError] = useState("")
  // Onglet « Ventes » : détail par article vendu (recherche + affichage étendu).
  const [salesDetailQuery, setSalesDetailQuery] = useState("")
  const [salesDetailsAll, setSalesDetailsAll] = useState(false)

  const periods = [
    { id: "day", label: "Journée" },
    { id: "week", label: "Semaine" },
    { id: "month", label: "Mois" },
    { id: "quarter", label: "Trimestre" },
    { id: "custom", label: "Personnalisée" },
  ]

  const periodParams = (p: string, posId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ period: p, pos: posId })
    if (p === "custom") {
      if (from) params.set("from", from)
      if (to) params.set("to", to)
    }
    return params
  }

  const load = async (p?: string, posId?: string, from?: string, to?: string) => {
    const params = periodParams(p ?? period, posId ?? pos, from ?? fromDate, to ?? toDate)
    try {
      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) throw new Error("Impossible de charger les rapports")
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    if (newPeriod === "custom" && (!fromDate || !toDate)) return
    setLoading(true)
    load(newPeriod)
  }

  const handleRangeChange = (range: { from: string; to: string }) => {
    setFromDate(range.from)
    setToDate(range.to)
    if (range.from && range.to) {
      setPeriod("custom")
      setLoading(true)
      load("custom", undefined, range.from, range.to)
    }
  }

  const handlePosChange = (posId: string) => {
    setPos(posId)
    setLoading(true)
    load(undefined, posId)
  }

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/reports?period=month", { signal: controller.signal })
        if (!res.ok) throw new Error("Impossible de charger les rapports")
        setData(await res.json())
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Erreur")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (tab !== "journee") return
    const controller = new AbortController()
    const init = async () => {
      try {
        const params = new URLSearchParams({ date: dayDate, pos })
        const res = await fetch(`/api/reports/journee?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error("Impossible de charger le rapport du jour")
        setDayData(await res.json())
        setDayError("")
      } catch (err) {
        if (!controller.signal.aborted) {
          setDayError(err instanceof Error ? err.message : "Erreur")
        }
      }
    }
    void init()
    return () => controller.abort()
  }, [tab, dayDate, pos])

  const refreshDay = async () => {
    try {
      const params = new URLSearchParams({ date: dayDate, pos })
      const res = await fetch(`/api/reports/journee?${params}`)
      if (!res.ok) throw new Error("Impossible de charger le rapport du jour")
      setDayData(await res.json())
      setDayError("")
    } catch (err) {
      setDayError(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleDayDateChange = (value: string) => {
    setDayDate(value)
    setDayData(null)
  }

  const fetchGlobal = async (signal?: AbortSignal) => {
    try {
      const params = periodParams(period, pos)
      const res = await fetch(`/api/reports/global?${params}`, { signal })
      if (!res.ok) throw new Error("Impossible de charger le rapport global")
      setGlobalData(await res.json())
      setGlobalError("")
    } catch (err) {
      if (!signal?.aborted) setGlobalError(err instanceof Error ? err.message : "Erreur")
    } finally {
      if (!signal?.aborted) setGlobalLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== "global") return
    const controller = new AbortController()
    const init = async () => {
      setGlobalLoading(true)
      await fetchGlobal(controller.signal)
    }
    void init()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, period, pos, fromDate, toDate])

  const s = data?.summary
  // Colonnes de stock par point de vente, quand le rapport couvre tous les points de vente.
  const posColumns = pos === "all" && (data?.pointsOfSale.length ?? 0) > 1 ? data!.pointsOfSale : []

  const exportPDF = () => {
    if (tab === "global") { if (globalData) exportGlobalPDF(globalData); return }
    if (tab === "journee") { if (dayData) exportJourneePDF(dayData); return }
    if (!data) return
    switch (tab) {
      case "ventes": exportVentesPDF(data); break
      case "stocks": exportStocksPDF(data); break
      case "appro": exportApproPDF(data); break
      case "commandes": exportCommandesPDF(data); break
      case "reservations": exportReservationsPDF(data); break
      case "production": exportProductionPDF(data); break
      case "caisse": exportCaissePDF(data); break
      case "lots": exportLotsPDF(data); break
    }
  }

  const exportExcel = () => {
    if (tab === "global") { if (globalData) exportGlobalExcel(globalData); return }
    if (tab === "journee") { if (dayData) exportJourneeExcel(dayData); return }
    if (!data) return
    switch (tab) {
      case "ventes": exportVentesExcel(data); break
      case "stocks": exportStocksExcel(data); break
      case "appro": exportApproExcel(data); break
      case "commandes": exportCommandesExcel(data); break
      case "reservations": exportReservationsExcel(data); break
      case "production": exportProductionExcel(data); break
      case "caisse": exportCaisseExcel(data); break
      case "lots": exportLotsExcel(data); break
    }
  }

  // Détail des ventes (une ligne par article vendu) : recherche + pagination d'affichage.
  const salesDetails = data?.salesDetails ?? []
  const salesDetailQueryTrim = salesDetailQuery.trim().toLowerCase()
  const salesDetailFiltered = salesDetailQueryTrim
    ? salesDetails.filter((line) =>
        [line.productName, line.format, line.orderNumber, line.customerName, line.cashier].some((value) =>
          (value ?? "").toLowerCase().includes(salesDetailQueryTrim),
        ),
      )
    : salesDetails
  const salesDetailShown = salesDetailsAll ? salesDetailFiltered : salesDetailFiltered.slice(0, 100)
  const salesDetailDate = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rapports</h1>
          <p className="mt-1 text-sm text-gray-500">Tableaux de bord detailles par domaine.</p>
        </div>
        <button onClick={() => (tab === "journee" ? refreshDay() : tab === "global" ? fetchGlobal() : load())} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
        {!loading && (data || (tab === "global" && globalData)) && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportPDF} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
              <Download className="h-4 w-4" /> PDF
            </button>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs sm:text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 sm:px-4 sm:py-3 text-sm text-red-700">{error}</div>}

      {tab !== "journee" && (
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm font-medium text-gray-500">Période :</span>
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
          {periods.map((p) => (
            <button key={p.id} onClick={() => handlePeriodChange(p.id)} className={`rounded-md px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${period === p.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <DateRangePicker
            value={{ from: fromDate, to: toDate }}
            onChange={handleRangeChange}
            max={new Date()}
          />
        )}
        {data?.periodLabel && <span className="min-w-0 text-xs text-gray-400">({data.periodLabel})</span>}
      </div>
      )}

      {((tab === "global" ? globalData?.pointsOfSale.length : data?.pointsOfSale.length) ?? 0) > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="shrink-0 text-sm font-medium text-gray-500">Point de vente :</span>
          <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
            {[{ id: "all", name: "Tous" }, ...((tab === "global" ? globalData?.pointsOfSale : data?.pointsOfSale) ?? [])].map((p) => (
              <button key={p.id} onClick={() => handlePosChange(p.id)} className={`rounded-md px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${pos === p.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {(data?.byPointOfSale.length ?? 0) > 1 && (
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Par point de vente ({data?.periodLabel ?? "Mois"})</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data?.byPointOfSale.map((p) => {
              const totalRevenue = data.byPointOfSale.reduce((sum, x) => sum + x.revenue, 0)
              const share = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0
              return (
                <button key={p.id} onClick={() => handlePosChange(pos === p.id ? "all" : p.id)} className={`rounded-lg border p-3 text-left transition-colors ${pos === p.id ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-gray-500">CA</p><p className="font-bold text-gray-900">{formatPrice(p.revenue)}</p><p className="text-gray-400">{share} %</p></div>
                    <div><p className="text-gray-500">Commandes</p><p className="font-bold text-gray-900">{p.orders}</p></div>
                    <div><p className="text-gray-500">Stock</p><p className="font-bold text-gray-900">{p.stockUnits} u.</p></div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-100 p-1">
        {tabList.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-2 sm:px-4 sm:py-2 text-sm font-medium transition-colors ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === "journee" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <span className="shrink-0 text-sm font-medium text-gray-500">Journée :</span>
          <input
            type="date"
            value={dayDate}
            max={todayIso()}
            onChange={(e) => handleDayDateChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none"
          />
          {dayData && <span className="text-xs text-gray-400">({dayData.label})</span>}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">Chargement...</div>
      ) : (
        <>
          {tab === "global" && (
            globalError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</div>
            ) : !globalData ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">
                {globalLoading ? "Chargement du rapport global..." : "Aucune donnée."}
              </div>
            ) : (
              <GlobalReportView data={globalData} />
            )
          )}

          {tab === "journee" && (
            dayError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dayError}</div>
            ) : !dayData ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">Chargement du rapport du jour...</div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">CA du jour</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(dayData.summary.revenue)}</p></div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Commandes</p><p className="mt-1 text-lg font-bold text-gray-900">{dayData.summary.orders}</p></div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Articles vendus</p><p className="mt-1 text-lg font-bold text-gray-900">{dayData.summary.items}</p></div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Panier moyen</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(dayData.summary.avgOrder)}</p></div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                  <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><WalletCards className="h-4 w-4" /> Encaissements par mode</h2>
                    <div className="space-y-2">
                      {dayData.paymentBreakdown.length === 0 && <p className="text-sm text-gray-400">Aucun encaissement.</p>}
                      {dayData.paymentBreakdown.map((p) => (
                        <div key={p.method} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm">
                          <div className="min-w-0"><p className="truncate font-medium">{PAYMENT[p.method] ?? p.method}</p><p className="text-xs text-gray-500">{p.count} tx(s)</p></div>
                          <span className="font-semibold">{formatPrice(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><ShoppingCart className="h-4 w-4" /> Commandes par statut</h2>
                    <div className="space-y-2">
                      {dayData.ordersByStatus.length === 0 && <p className="text-sm text-gray-400">Aucune commande.</p>}
                      {dayData.ordersByStatus.map((item) => (
                        <div key={item.status} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[item.status] ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LBL[item.status] ?? item.status}</span>
                          <div className="text-right"><p className="font-semibold">{item.count} cmd(s)</p><p className="text-xs text-gray-500">{formatPrice(item.total)}</p></div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                  <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                    <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Par point de vente</h2>
                    <div className="space-y-2">
                      {dayData.byPointOfSale.length === 0 && <p className="text-sm text-gray-400">Aucune donnée.</p>}
                      {dayData.byPointOfSale.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm">
                          <span className="font-medium text-gray-800">{p.name}</span>
                          <div className="text-right"><p className="font-semibold">{formatPrice(p.revenue)}</p><p className="text-xs text-gray-500">{p.orders} cmd(s)</p></div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                    <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Par caissier</h2>
                    <div className="space-y-2">
                      {dayData.byCashier.length === 0 && <p className="text-sm text-gray-400">Aucune donnée.</p>}
                      {dayData.byCashier.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm">
                          <span className="font-medium text-gray-800">{c.name}</span>
                          <div className="text-right"><p className="font-semibold">{formatPrice(c.revenue)}</p><p className="text-xs text-gray-500">{c.orders} cmd(s)</p></div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><Package className="h-4 w-4" /> Top produits du jour</h2>
                  <div className="space-y-2">
                    {dayData.topProducts.length === 0 && <p className="text-sm text-gray-400">Aucune vente.</p>}
                    {dayData.topProducts.map((p) => (
                      <div key={p.name} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <div className="text-right"><span className="font-semibold">{p.quantity}</span><p className="text-xs text-gray-500">{formatPrice(p.amount)}</p></div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Sessions de caisse</h2>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="sticky top-0 bg-gray-50/80"><tr>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Caissier</th>
                        <th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">PDV</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-center text-xs font-semibold uppercase text-gray-500">Statut</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Fond</th>
                        <th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Cloture</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Ecart</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {dayData.cashSessions.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-center text-gray-400">Aucune session.</td></tr>}
                        {dayData.cashSessions.map((c) => (
                          <tr key={c.id}>
                            <td className="px-2 py-2 sm:px-4 sm:py-2">{c.cashier ?? "-"}</td>
                            <td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{c.pointOfSale}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.status === "OPEN" ? "Ouverte" : "Fermee"}</span></td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-right">{formatPrice(c.openingBalance)}</td>
                            <td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right">{c.closingBalance !== null ? formatPrice(c.closingBalance) : "-"}</td>
                            <td className={`px-2 py-2 sm:px-4 sm:py-2 text-right font-bold ${c.gap === null || c.gap === 0 ? "" : c.gap > 0 ? "text-blue-600" : "text-red-600"}`}>{c.gap !== null ? (c.gap > 0 ? "+" : "") + formatPrice(c.gap) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Détail des commandes ({dayData.orders.length})</h2>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full min-w-[720px] text-xs sm:text-sm">
                      <thead className="sticky top-0 bg-gray-50/80"><tr>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Heure</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">N°</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Client</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Caissier</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Art.</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Paiement</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-center text-xs font-semibold uppercase text-gray-500">Statut</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Montant</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {dayData.orders.length === 0 && <tr><td colSpan={8} className="px-4 py-3 text-center text-gray-400">Aucune commande ce jour.</td></tr>}
                        {dayData.orders.map((o) => (
                          <tr key={o.id}>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-gray-500">{new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 font-mono text-xs font-semibold text-primary-700">{o.orderNumber}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2">{o.customerName ?? "-"}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{o.cashier ?? "-"}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-right">{o.items}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{PAYMENT[o.paymentMethod ?? ""] ?? o.paymentMethod ?? "-"}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[o.status] ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LBL[o.status] ?? o.status}</span></td>
                            <td className="px-2 py-2 sm:px-4 sm:py-2 text-right font-bold">{formatPrice(o.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )
          )}

          {tab === "ventes" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">CA 7j</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(s?.revenue7 ?? 0)}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">CA {data?.periodLabel ?? "Mois"}</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(s?.revenue30 ?? 0)}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Commandes {data?.periodLabel ?? "Mois"}</p><p className="mt-1 text-lg font-bold text-gray-900">{s?.orders30 ?? 0}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Panier moyen</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(s?.avgOrder ?? 0)}</p></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><BarChart3 className="h-4 w-4" /> CA (7j)</h2>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.daily7 ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" {...ax} /><YAxis {...ax} /><Tooltip formatter={(v: TooltipValueType | undefined) => [formatPrice(Number(v)), "Revenu"]} {...tt} /><Bar dataKey="revenu" fill="#1f4fa3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><TrendingUp className="h-4 w-4" /> Ventes ({data?.periodLabel ?? "30j"})</h2>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.salesByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={8} interval="preserveStartEnd" /><YAxis {...ax} /><Tooltip formatter={(v: TooltipValueType | undefined) => [formatPrice(Number(v)), "Ventes"]} {...tt} /><Bar dataKey="ventes" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><Package className="h-4 w-4" /> Top produits</h2>
                  <div className="space-y-2">{(data?.topProducts ?? []).slice(0, 8).map((p) => <div key={p.name} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm"><span className="font-medium text-gray-800">{p.name}</span><div className="text-right"><span className="font-semibold">{p.quantity}</span><p className="text-xs text-gray-500">{formatPrice(p.revenue)}</p></div></div>)}</div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><WalletCards className="h-4 w-4" /> Paiements ({data?.periodLabel ?? "30j"})</h2>
                  <div className="space-y-2">{(data?.paymentBreakdown30 ?? []).map((p) => <div key={p.method} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm"><div className="min-w-0"><p className="truncate font-medium">{PAYMENT[p.method] ?? p.method}</p><p className="text-xs text-gray-500">{p.count} tx(s)</p></div><span className="font-semibold">{formatPrice(p.total)}</span></div>)}</div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><WalletCards className="h-4 w-4" /> Repartition</h2>
                  <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data?.paymentBreakdown30 ?? []} dataKey="total" nameKey="method" innerRadius={40} outerRadius={65} paddingAngle={3}>{(data?.paymentBreakdown30 ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: TooltipValueType | undefined) => formatPrice(Number(v))} /></PieChart></ResponsiveContainer></div>
                </section>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><Package className="h-4 w-4" /> Détail des ventes</h2>
                  <span className="text-xs text-gray-500">{salesDetailFiltered.length} article(s) vendu(s)</span>
                </div>
                <div className="relative mb-3 max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={salesDetailQuery}
                    onChange={(e) => { setSalesDetailQuery(e.target.value); setSalesDetailsAll(false) }}
                    placeholder="Produit, format, client, caissière..."
                    className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm focus:border-primary focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
                        <th className="px-2 py-2 font-medium">Date</th>
                        <th className="px-2 py-2 font-medium">Produit</th>
                        <th className="px-2 py-2 font-medium">Format</th>
                        <th className="px-2 py-2 text-right font-medium">Qté</th>
                        <th className="px-2 py-2 text-right font-medium">Montant</th>
                        <th className="px-2 py-2 font-medium">Client</th>
                        <th className="px-2 py-2 font-medium">Caissière</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {salesDetailShown.map((line) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-2 py-2 text-gray-500">{salesDetailDate(line.createdAt)}</td>
                          <td className="px-2 py-2 font-medium text-gray-900">{line.productName}</td>
                          <td className="px-2 py-2 text-gray-700">{line.format}</td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900">{line.quantity}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums text-gray-900">{formatPrice(line.amount)}</td>
                          <td className="px-2 py-2 text-gray-700">{line.customerName || <span className="text-gray-400">—</span>}</td>
                          <td className="px-2 py-2 text-gray-700">{line.cashier || <span className="text-gray-400">—</span>}</td>
                        </tr>
                      ))}
                      {salesDetailShown.length === 0 && (
                        <tr><td colSpan={7} className="px-2 py-8 text-center text-sm text-gray-400">Aucune vente sur la période.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {salesDetailFiltered.length > 100 && (
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">
                      {salesDetailsAll ? `${salesDetailFiltered.length} ligne(s) affichée(s)` : `100 premières lignes sur ${salesDetailFiltered.length}`}
                      {(data?.salesDetailsTotal ?? 0) > salesDetails.length && ` · ${data?.salesDetailsTotal} au total`}
                    </p>
                    <button
                      onClick={() => setSalesDetailsAll(!salesDetailsAll)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {salesDetailsAll ? "Réduire" : "Tout afficher"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === "stocks" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Unites stock</p><p className="mt-1 text-lg font-bold text-gray-900">{s?.stockUnits ?? 0}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Variantes</p><p className="mt-1 text-lg font-bold text-gray-900">{s?.totalVariants ?? 0}</p></div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4"><p className="text-xs font-medium text-yellow-700">Stock faible</p><p className="mt-1 text-lg font-bold text-yellow-800">{s?.lowStock ?? 0}</p></div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4"><p className="text-xs font-medium text-red-700">Rupture</p><p className="mt-1 text-lg font-bold text-red-800">{s?.outOfStock ?? 0}</p></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Stock par categorie</h2>
                  <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.stockByCategory ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" {...ax} /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="totalStock" fill="#1f4fa3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Alertes stock</h2>
                  <div className="space-y-2 max-h-64 overflow-y-auto">{(data?.stockAlerts ?? []).map((a) => <div key={a.variantId} className={`flex items-center justify-between rounded-lg p-2 sm:p-3 text-xs sm:text-sm ${a.stock <= 0 ? "bg-red-50" : "bg-yellow-50"}`}><div><p className="font-medium">{a.productName}</p><p className="text-xs text-gray-500">{a.format}</p></div><span className={`font-bold ${a.stock <= 0 ? "text-red-600" : "text-yellow-700"}`}>{a.stock}</span></div>)}</div>
                </section>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Toutes les variantes</h2>
                <div className="overflow-x-auto max-h-80"><table className="w-full text-xs sm:text-sm"><thead className="sticky top-0 bg-gray-50/80"><tr><th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Produit</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Format</th><th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Categorie</th>{posColumns.map((p) => <th key={p.id} className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">{p.name}</th>)}<th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">{posColumns.length > 0 ? "Total" : "Stock"}</th></tr></thead><tbody className="divide-y divide-gray-100">{(data?.allStockVariants ?? []).map((v, i) => <tr key={i} className={v.stock <= 0 ? "bg-red-50/40" : v.stock <= LOW_STOCK_THRESHOLD ? "bg-yellow-50/40" : ""}><td className="px-2 py-2 sm:px-4 sm:py-2">{v.productName}</td><td className="px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{v.format}</td><td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{v.categoryName}</td>{posColumns.map((p) => <td key={p.id} className="px-2 py-2 sm:px-4 sm:py-2 text-right text-gray-700">{v.stockByPos?.[p.id] ?? 0}</td>)}<td className={`px-2 py-2 sm:px-4 sm:py-2 text-right font-bold ${v.stock <= 0 ? "text-red-600" : v.stock <= LOW_STOCK_THRESHOLD ? "text-yellow-700" : ""}`}>{v.stock}</td></tr>)}</tbody></table></div>
              </section>
            </div>
          )}

          {tab === "appro" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(data?.supplyByType ?? []).filter((t) => t.quantity > 0).map((t) => <div key={t.type} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">{SUPPLY_LBL[t.type] ?? t.type}</p><p className="mt-1 text-lg font-bold text-gray-900">{t.quantity} u.</p><p className="text-xs text-gray-500">{t.count} mvmt(s)</p></div>)}
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Approvisionnements ({data?.periodLabel ?? "Mois"})</h2>
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.supplyByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={8} interval="preserveStartEnd" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="quantity" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Mouvements</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">{(data?.supplyMovements ?? []).map((m) => <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"><div className="min-w-0"><p className="truncate font-medium">{m.productName} ({m.format})</p><p className="text-xs text-gray-500">{m.reason || m.reference || "-"}</p></div><div className="flex items-center gap-2 sm:gap-3"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{SUPPLY_LBL[m.type] ?? m.type}</span><span className="font-bold">+{m.quantity}</span><span className="text-xs text-gray-500"><Clock className="inline h-3 w-3" /> {new Date(m.createdAt).toLocaleDateString("fr-FR")}</span></div></div>)}</div>
              </section>
            </div>
          )}

          {tab === "commandes" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Commandes {data?.periodLabel ?? "Mois"}</p><p className="mt-1 text-lg font-bold text-gray-900">{s?.orders30 ?? 0}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">CA commandes</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(s?.revenue30 ?? 0)}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Aujourd&apos;hui</p><p className="mt-1 text-lg font-bold text-gray-900">{s?.todayOrders ?? 0}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">En livraison</p><p className="mt-1 text-lg font-bold text-gray-900">{s?.deliveriesInProgress ?? 0}</p></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Commandes / jour</h2>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.ordersByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={8} interval="preserveStartEnd" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="commandes" fill="#1f4fa3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Par statut</h2>
                  <div className="space-y-3">{(data?.ordersByStatus ?? []).map((item) => <div key={item.status} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[item.status] ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LBL[item.status] ?? item.status}</span><div className="text-right"><p className="font-semibold">{item.count} cmd(s)</p><p className="text-xs text-gray-500">{formatPrice(item.total)}</p></div></div>)}</div>
                </section>
              </div>
            </div>
          )}

          {tab === "reservations" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Total</p><p className="mt-1 text-lg font-bold text-gray-900">{data?.reservationsByStatus?.total ?? 0}</p></div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4"><p className="text-xs font-medium text-yellow-700">En attente</p><p className="mt-1 text-lg font-bold text-yellow-800">{data?.reservationsByStatus?.pending ?? 0}</p></div>
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4"><p className="text-xs font-medium text-green-700">Confirmees</p><p className="mt-1 text-lg font-bold text-green-800">{data?.reservationsByStatus?.confirmed ?? 0}</p></div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4"><p className="text-xs font-medium text-red-700">Annulees</p><p className="mt-1 text-lg font-bold text-red-800">{data?.reservationsByStatus?.cancelled ?? 0}</p></div>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Pré-commandes / jour</h2>
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.reservationsByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={8} interval="preserveStartEnd" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="reservations" fill="#7c3aed" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Dernières pré-commandes</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">{(data?.reservations ?? []).map((r) => <div key={r.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"><div className="min-w-0"><p className="truncate font-medium">{r.client}</p><p className="text-xs text-gray-500">{r.type} - {r.date} a {r.heure}</p></div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[r.status] ?? "bg-gray-100"}`}>{STATUS_LBL[r.status] ?? r.status}</span></div>)}</div>
              </section>
            </div>
          )}

          {tab === "production" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Total produit ({data?.periodLabel ?? "Mois"})</p><p className="mt-1 text-lg font-bold text-gray-900">{data?.productionSummary?.totalProduced ?? 0}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Ordres</p><p className="mt-1 text-lg font-bold text-gray-900">{data?.productionSummary?.productionCount ?? 0}</p></div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4"><p className="text-xs font-medium text-blue-700">Entrees stock</p><p className="mt-1 text-lg font-bold text-blue-800">{data?.productionSummary?.totalIn ?? 0}</p></div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4"><p className="text-xs font-medium text-red-700">Pertes</p><p className="mt-1 text-lg font-bold text-red-800">{data?.productionSummary?.totalLoss ?? 0}</p></div>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Production / jour</h2>
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.productionByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={8} interval="preserveStartEnd" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="quantity" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Dernieres productions</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">{(data?.productionMovements ?? []).map((m) => <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"><div className="min-w-0"><p className="truncate font-medium">{m.productName} ({m.format})</p><p className="text-xs text-gray-500">{m.reason || "-"}</p></div><div className="flex items-center gap-2 sm:gap-3"><span className="font-bold">+{m.quantity}</span><span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleDateString("fr-FR")}</span></div></div>)}</div>
              </section>
            </div>
          )}

          {tab === "lots" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Total lots</p><p className="mt-1 text-lg font-bold text-gray-900">{data?.lotSummary?.totalLots ?? 0}</p></div>
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4"><p className="text-xs font-medium text-green-700">Lots actifs</p><p className="mt-1 text-lg font-bold text-green-800">{data?.lotSummary?.activeLots ?? 0}</p></div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4"><p className="text-xs font-medium text-blue-700">Total produit</p><p className="mt-1 text-lg font-bold text-blue-800">{data?.lotSummary?.totalProduced ?? 0}</p></div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4"><p className="text-xs font-medium text-orange-700">Stock restant</p><p className="mt-1 text-lg font-bold text-orange-800">{data?.lotSummary?.totalRemaining ?? 0}</p></div>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Tous les lots</h2>
                <div className="overflow-x-auto max-h-96">                <table className="w-full min-w-[520px] text-xs sm:text-sm"><thead className="sticky top-0 bg-gray-50/80"><tr>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Numero</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Produit</th>
                  <th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Produit (qte)</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Restant</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-center text-xs font-semibold uppercase text-gray-500">Statut</th>
                  <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-center text-xs font-semibold uppercase text-gray-500">Allocations</th>
                  <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Production</th>
                  <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Expiration</th>
                </tr></thead><tbody className="divide-y divide-gray-100">{(data?.lots ?? []).map((l) => <tr key={l.id}>
                  <td className="px-2 py-2 sm:px-4 sm:py-2 font-mono text-xs font-semibold text-primary-700">{l.lotNumber}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-2">{l.productName}</td>
                  <td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right">{l.initialQuantity}</td>
                  <td className={`px-2 py-2 sm:px-4 sm:py-2 text-right font-bold ${l.remainingQuantity === 0 ? "text-gray-400" : ""}`}>{l.remainingQuantity}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-2 text-center"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${l.status === "ACTIVE" ? "bg-green-100 text-green-700" : l.status === "EXPIRED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{LOT_STATUS[l.status] ?? l.status}</span></td>
                  <td className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-center text-gray-500">{l.allocationCount}</td>
                  <td className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-gray-500">{new Date(l.productionDate).toLocaleDateString("fr-FR")}</td>
                  <td className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-gray-500">{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("fr-FR") : "-"}</td>
                </tr>)}</tbody></table></div>
              </section>
            </div>
          )}

          {tab === "caisse" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Sessions</p><p className="mt-1 text-lg font-bold text-gray-900">{data?.cashSessionsSummary?.totalSessions ?? 0}</p></div>
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4"><p className="text-xs font-medium text-green-700">Ouvertes</p><p className="mt-1 text-lg font-bold text-green-800">{data?.cashSessionsSummary?.openSessions ?? 0}</p></div>
                <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Fermees</p><p className="mt-1 text-lg font-bold text-gray-900">{data?.cashSessionsSummary?.closedSessions ?? 0}</p></div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4"><p className="text-xs font-medium text-blue-700">Solde total</p><p className="mt-1 text-lg font-bold text-blue-800">{formatPrice(data?.cashSessionsSummary?.totalOpening ?? 0)}</p></div>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Sessions / jour</h2>
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.cashSessionsByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={8} interval="preserveStartEnd" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="sessions" fill="#1f4fa3" radius={[4, 4, 0, 0]} name="Sessions" /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Recapitulatif</h2>
                <div className="overflow-x-auto max-h-80"><table className="w-full text-xs sm:text-sm"><thead className="sticky top-0 bg-gray-50/80"><tr><th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th><th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Sessions</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Ouverture</th><th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Cloture</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Ecart</th></tr></thead><tbody className="divide-y divide-gray-100">{(data?.cashSessionsByDay ?? []).map((d) => <tr key={d.date}><td className="px-2 py-2 sm:px-4 sm:py-2">{d.name}</td><td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right">{d.sessions}</td><td className="px-2 py-2 sm:px-4 sm:py-2 text-right">{formatPrice(d.openingTotal)}</td><td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right">{d.closingTotal !== null ? formatPrice(d.closingTotal) : "-"}</td><td className={`px-2 py-2 sm:px-4 sm:py-2 text-right font-bold ${d.gap === null || d.gap === 0 ? "" : d.gap > 0 ? "text-blue-600" : "text-red-600"}`}>{d.gap !== null ? (d.gap > 0 ? "+" : "") + formatPrice(d.gap) : "-"}</td></tr>)}</tbody></table></div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
