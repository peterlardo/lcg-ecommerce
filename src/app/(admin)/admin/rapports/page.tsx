"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle, BarChart3, Banknote, CalendarRange, Clock, Download, Factory,
  FileSpreadsheet, Package, RefreshCw, ScanBarcode, ShoppingCart, TrendingUp, Truck, WalletCards,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
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
} from "@/lib/report-export"

type Tab = "ventes" | "stocks" | "appro" | "commandes" | "reservations" | "production" | "lots" | "caisse"

const tabList: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
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
const STATUS_LBL: Record<string, string> = { PENDING: "En attente", CONFIRMED: "Confirmee", PROCESSING: "En cours", READY: "Prete", OUT_FOR_DELIVERY: "En livraison", DELIVERED: "Livre", CANCELLED: "Annulee" }
const STATUS_BG: Record<string, string> = { PENDING: "bg-yellow-100 text-yellow-800", CONFIRMED: "bg-blue-100 text-blue-800", PROCESSING: "bg-indigo-100 text-indigo-800", READY: "bg-green-100 text-green-800", OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800", DELIVERED: "bg-green-100 text-green-800", CANCELLED: "bg-red-100 text-red-800" }
const SUPPLY_LBL: Record<string, string> = { IN: "Entree", PRODUCTION: "Production", TRANSFER_IN: "Transfert", RETURN: "Retour" }
const LOT_STATUS: Record<string, string> = { ACTIVE: "Actif", EXHAUSTED: "Epuise", EXPIRED: "Expire" }

const ax = { tick: { fontSize: 12 }, stroke: "#9ca3af" }
const tt = { contentStyle: { borderRadius: "8px", border: "1px solid #e5e7eb" } }

export default function RapportsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("ventes")
  const [period, setPeriod] = useState<string>("month")

  const periods = [
    { id: "week", label: "Semaine" },
    { id: "month", label: "Mois" },
    { id: "quarter", label: "Trimestre" },
  ]

  const load = async (p?: string) => {
    setError("")
    const effectivePeriod = p ?? period
    try {
      const res = await fetch(`/api/reports?period=${effectivePeriod}`)
      if (!res.ok) throw new Error("Impossible de charger les rapports")
      setData(await res.json())
    } catch (err: any) {
      setError(err.message ?? "Erreur")
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    setLoading(true)
    load(newPeriod)
  }

  useEffect(() => { void load() }, [])

  const s = data?.summary

  const exportPDF = () => {
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rapports</h1>
          <p className="mt-1 text-sm text-gray-500">Tableaux de bord detailles par domaine.</p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
        {!loading && data && (
          <div className="flex items-center gap-2">
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

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500">Période :</span>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
          {periods.map((p) => (
            <button key={p.id} onClick={() => handlePeriodChange(p.id)} className={`rounded-md px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${period === p.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {data?.periodLabel && <span className="text-xs text-gray-400">({data.periodLabel})</span>}
      </div>

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

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">Chargement...</div>
      ) : (
        <>
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
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.daily7 ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" {...ax} /><YAxis {...ax} /><Tooltip formatter={(v: any) => [formatPrice(Number(v)), "Revenu"]} {...tt} /><Bar dataKey="revenu" fill="#1f4fa3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><TrendingUp className="h-4 w-4" /> Ventes ({data?.periodLabel ?? "30j"})</h2>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.salesByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis {...ax} /><Tooltip formatter={(v: any) => [formatPrice(Number(v)), "Ventes"]} {...tt} /><Bar dataKey="ventes" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><Package className="h-4 w-4" /> Top produits</h2>
                  <div className="space-y-2">{(data?.topProducts ?? []).slice(0, 8).map((p: any) => <div key={p.name} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm"><span className="font-medium text-gray-800">{p.name}</span><div className="text-right"><span className="font-semibold">{p.quantity}</span><p className="text-xs text-gray-500">{formatPrice(p.revenue)}</p></div></div>)}</div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><WalletCards className="h-4 w-4" /> Paiements ({data?.periodLabel ?? "30j"})</h2>
                  <div className="space-y-2">{(data?.paymentBreakdown30 ?? []).map((p: any) => <div key={p.method} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 sm:p-3 text-xs sm:text-sm"><div><p className="font-medium">{PAYMENT[p.method] ?? p.method}</p><p className="text-xs text-gray-500">{p.count} tx(s)</p></div><span className="font-semibold">{formatPrice(p.total)}</span></div>)}</div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><WalletCards className="h-4 w-4" /> Repartition</h2>
                  <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data?.paymentBreakdown30 ?? []} dataKey="total" nameKey="method" innerRadius={40} outerRadius={65} paddingAngle={3}>{(data?.paymentBreakdown30 ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatPrice(Number(v))} /></PieChart></ResponsiveContainer></div>
                </section>
              </div>
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
                  <div className="space-y-2 max-h-64 overflow-y-auto">{(data?.stockAlerts ?? []).map((a: any) => <div key={a.variantId} className={`flex items-center justify-between rounded-lg p-2 sm:p-3 text-xs sm:text-sm ${a.stock <= 0 ? "bg-red-50" : "bg-yellow-50"}`}><div><p className="font-medium">{a.productName}</p><p className="text-xs text-gray-500">{a.format}</p></div><span className={`font-bold ${a.stock <= 0 ? "text-red-600" : "text-yellow-700"}`}>{a.stock}</span></div>)}</div>
                </section>
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Toutes les variantes</h2>
                <div className="overflow-x-auto max-h-80"><table className="w-full text-xs sm:text-sm"><thead className="sticky top-0 bg-gray-50/80"><tr><th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Produit</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Format</th><th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Categorie</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Stock</th></tr></thead><tbody className="divide-y divide-gray-100">{(data?.allStockVariants ?? []).map((v: any, i: number) => <tr key={i} className={v.stock <= 0 ? "bg-red-50/40" : v.stock <= 10 ? "bg-yellow-50/40" : ""}><td className="px-2 py-2 sm:px-4 sm:py-2">{v.productName}</td><td className="px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{v.format}</td><td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-gray-600">{v.categoryName}</td><td className={`px-2 py-2 sm:px-4 sm:py-2 text-right font-bold ${v.stock <= 0 ? "text-red-600" : v.stock <= 10 ? "text-yellow-700" : ""}`}>{v.stock}</td></tr>)}</tbody></table></div>
              </section>
            </div>
          )}

          {tab === "appro" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(data?.supplyByType ?? []).filter((t: any) => t.quantity > 0).map((t: any) => <div key={t.type} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">{SUPPLY_LBL[t.type] ?? t.type}</p><p className="mt-1 text-lg font-bold text-gray-900">{t.quantity} u.</p><p className="text-xs text-gray-500">{t.count} mvmt(s)</p></div>)}
              </div>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Approvisionnements ({data?.periodLabel ?? "Mois"})</h2>
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.supplyByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="quantity" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Mouvements</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">{(data?.supplyMovements ?? []).map((m: any) => <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"><div><p className="font-medium">{m.productName} ({m.format})</p><p className="text-xs text-gray-500">{m.reason || m.reference || "-"}</p></div><div className="flex items-center gap-2 sm:gap-3"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{SUPPLY_LBL[m.type] ?? m.type}</span><span className="font-bold">+{m.quantity}</span><span className="text-xs text-gray-500"><Clock className="inline h-3 w-3" /> {new Date(m.createdAt).toLocaleDateString("fr-FR")}</span></div></div>)}</div>
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
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.ordersByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="commandes" fill="#1f4fa3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </section>
                <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                  <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Par statut</h2>
                  <div className="space-y-3">{(data?.ordersByStatus ?? []).map((item: any) => <div key={item.status} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[item.status] ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LBL[item.status] ?? item.status}</span><div className="text-right"><p className="font-semibold">{item.count} cmd(s)</p><p className="text-xs text-gray-500">{formatPrice(item.total)}</p></div></div>)}</div>
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
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.reservationsByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="reservations" fill="#7c3aed" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Dernières pré-commandes</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">{(data?.reservations ?? []).map((r: any) => <div key={r.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"><div><p className="font-medium">{r.client}</p><p className="text-xs text-gray-500">{r.type} - {r.date} a {r.heure}</p></div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BG[r.status] ?? "bg-gray-100"}`}>{STATUS_LBL[r.status] ?? r.status}</span></div>)}</div>
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
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.productionByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="quantity" fill="#0f766e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Dernieres productions</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">{(data?.productionMovements ?? []).map((m: any) => <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"><div><p className="font-medium">{m.productName} ({m.format})</p><p className="text-xs text-gray-500">{m.reason || "-"}</p></div><div className="flex items-center gap-2 sm:gap-3"><span className="font-bold">+{m.quantity}</span><span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleDateString("fr-FR")}</span></div></div>)}</div>
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
                <div className="overflow-x-auto max-h-96">                <table className="w-full text-xs sm:text-sm"><thead className="sticky top-0 bg-gray-50/80"><tr>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Numero</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Produit</th>
                  <th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Produit (qte)</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Restant</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-2 text-center text-xs font-semibold uppercase text-gray-500">Statut</th>
                  <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-center text-xs font-semibold uppercase text-gray-500">Allocations</th>
                  <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Production</th>
                  <th className="hidden md:table-cell px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Expiration</th>
                </tr></thead><tbody className="divide-y divide-gray-100">{(data?.lots ?? []).map((l: any) => <tr key={l.id}>
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
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.cashSessionsByDay ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis {...ax} /><Tooltip {...tt} /><Bar dataKey="sessions" fill="#1f4fa3" radius={[4, 4, 0, 0]} name="Sessions" /></BarChart></ResponsiveContainer></div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="mb-4 text-xs sm:text-sm font-semibold text-gray-900">Recapitulatif</h2>
                <div className="overflow-x-auto max-h-80"><table className="w-full text-xs sm:text-sm"><thead className="sticky top-0 bg-gray-50/80"><tr><th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th><th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Sessions</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Ouverture</th><th className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Cloture</th><th className="px-2 py-2 sm:px-4 sm:py-2 text-right text-xs font-semibold uppercase text-gray-500">Ecart</th></tr></thead><tbody className="divide-y divide-gray-100">{(data?.cashSessionsByDay ?? []).map((d: any) => <tr key={d.date}><td className="px-2 py-2 sm:px-4 sm:py-2">{d.name}</td><td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right">{d.sessions}</td><td className="px-2 py-2 sm:px-4 sm:py-2 text-right">{formatPrice(d.openingTotal)}</td><td className="hidden sm:table-cell px-2 py-2 sm:px-4 sm:py-2 text-right">{d.closingTotal !== null ? formatPrice(d.closingTotal) : "-"}</td><td className={`px-2 py-2 sm:px-4 sm:py-2 text-right font-bold ${d.gap === null || d.gap === 0 ? "" : d.gap > 0 ? "text-blue-600" : "text-red-600"}`}>{d.gap !== null ? (d.gap > 0 ? "+" : "") + formatPrice(d.gap) : "-"}</td></tr>)}</tbody></table></div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
