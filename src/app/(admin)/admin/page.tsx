"use client"

import { useCallback, useEffect, useMemo, useState, Fragment } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  MapPin,
  Package,
  Plus,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import { NotificationToast } from "@/components/notification-toast"

interface ReportData {
  summary: { todayRevenue: number; todayOrders: number; todayOrdersDelivered: number; stockUnits: number; deliveriesInProgress: number; lowStock: number; pendingReservations: number; totalReservations: number; totalDeliveries: number; deliveredToday: number; todayDeliveries: number; todayReservations: number; todayReservationsPending: number; cashExpected: number; revenue7: number; revenue30: number; orders7: number; orders30: number; avgOrder: number; topProduct: string; todayInDelivery: number; todayConfirmed: number }
  daily: { name: string; revenu: number; commandes: number }[]
  salesByDay: { name: string; revenu: number; commandes: number }[]
  paymentBreakdown: { method: string; total: number; count: number }[]
  paymentBreakdown30: { method: string; total: number; count: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  ordersByStatus: { status: string; count: number; total: number }[]
  reservationsByStatus: { pending: number; confirmed: number; cancelled: number; total: number }
  reservations: { id: string; client: string; type: string; date: string; heure: string; status: string }[]
  weeklyCommandes: { name: string; date: string; commandes: number; montant: number; details: { orderNumber: string; customerName: string; total: number; paymentMethod: string }[] }[]
  weeklyPrecommandes: { name: string; date: string; precommandes: number }[]
  weeklyLivraisons: { name: string; date: string; livraisons: number; livrees: number; details: { orderNumber: string; customer: string; status: string; address: string }[] }[]
  stockAlerts: { variantId: string; productName: string; format: string; stock: number; categoryName: string }[]
  periodLabel: string
  weekOffset: number
  weekStart: string
  weekEnd: string
  livraisonWeekStart: string
  livraisonWeekEnd: string
}

interface Order {
  id: string; orderNumber: string; customerName: string; status: string; total: number;
  createdAt: string; source: string; paymentMethod: string; paymentStatus: string;
  pointOfSaleId: string | null; pointOfSale?: { name: string } | null;
  items: { name: string; format: string; quantity: number; price: number; total: number }[]
}

interface Reservation { id: string; client: string; type: string; date: string; heure: string; status: string; source: string }

const paymentLabels: Record<string, string> = { CASH_ON_DELIVERY: "Espèces", MOBILE_MONEY: "Mobile Money", CARD: "Carte" }
const paymentColors = ["var(--primary)", "var(--primary-glow)", "var(--accent)"]
const sourceLabels: Record<string, { label: string; className: string }> = {
  WEB: { label: "En ligne", className: "bg-teal-100 text-teal-700" },
  OPERATOR: { label: "Opérateur", className: "bg-violet-100 text-violet-700" },
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrateur",
  STOCK_MANAGER: "Gestionnaire de stock",
  DELIVERY_AGENT: "Agent de livraison",
  CUSTOMER: "Client",
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [report, setReport] = useState<ReportData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState<"revenu" | "confirmees" | "production" | "livrees">("revenu")
  const [encaissementsTab, setEncaissementsTab] = useState<"aujourdhui" | "semaine">("aujourdhui")
  const [weekOffset, setWeekOffset] = useState(0)
  const [livraisonWeekOffset, setLivraisonWeekOffset] = useState(0)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [recentStatusFilter, setRecentStatusFilter] = useState<string | null>(null)
  const [recentTab, setRecentTab] = useState<"commandes" | "precommandes">("commandes")
  const { notifications, newCount, dismiss, dismissAll } = useNotifications(15000)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadData = useCallback(() => {
    Promise.all([fetch(`/api/reports?weekOffset=${weekOffset}&livraisonWeekOffset=${livraisonWeekOffset}`), fetch("/api/orders"), fetch("/api/reservations")])
      .then(async ([reportRes, ordersRes, reservationsRes]) => {
        if (reportRes.ok) setReport(await reportRes.json())
        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (reservationsRes.ok) setReservations(await reservationsRes.json())
        setLastRefresh(new Date())
      })
      .catch((error) => console.error("Erreur dashboard:", error))
      .finally(() => setLoading(false))
  }, [weekOffset, livraisonWeekOffset])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  const role = session?.user?.role
  const isAdmin = role === "ADMIN"
  const userPermissions = session?.user?.permissions ?? []
  const visibleModules = isAdmin ? [] : userPermissions.filter((p) => p.canView).map((p) => p.module)

  const summary = report?.summary
  const stats = [
    { label: "En livraison", value: String(summary?.todayInDelivery ?? 0), detail: "Commandes en cours de livraison", icon: Truck, tone: "text-orange-600 bg-orange-100" },
    { label: "Confirmé", value: String(summary?.todayConfirmed ?? 0), detail: "Commandes confirmées aujourd'hui", icon: CheckCircle2, tone: "text-green-600 bg-green-100" },
    { label: "Commandes totales", value: String(summary?.todayOrders ?? 0), detail: `${formatPrice(summary?.todayRevenue ?? 0)} de ventes`, icon: ShoppingCart, tone: "text-primary bg-primary/10" },
    { label: "Ventes du jour", value: formatPrice(summary?.todayRevenue ?? 0), detail: `${summary?.todayOrdersDelivered ?? 0} livrée(s)`, icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-100" },
    { label: "Commandes", value: String(summary?.orders30 ?? 0), detail: `${report?.periodLabel ?? "Mois"} — ${summary?.todayOrders ?? 0} aujourd'hui`, icon: ClipboardList, tone: "text-blue-600 bg-blue-100" },
  ]

  const paymentData = useMemo(() => (report?.paymentBreakdown ?? []).map((item) => ({ ...item, name: paymentLabels[item.method] ?? item.method })), [report])
  const recentOrders = useMemo(() => {
    const list = recentStatusFilter ? orders.filter((o) => o.status === recentStatusFilter) : orders
    return list.slice(0, 6)
  }, [orders, recentStatusFilter])
  const recentStatuses = useMemo(() => Array.from(new Set(orders.map((o) => o.status))), [orders])
  const confirmedOrders = useMemo(() => orders.filter((o) => o.status === "CONFIRMED"), [orders])
  const productionOrders = useMemo(() => orders.filter((o) => o.status === "PROCESSING"), [orders])
  const deliveredOrders = useMemo(() => orders.filter((o) => o.status === "DELIVERED"), [orders])
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  return (
    <div className="space-y-4 overflow-x-hidden sm:space-y-6">
      <NotificationToast notifications={notifications} onDismiss={dismiss} />
      {newCount > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <button onClick={dismissAll} className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-semibold shadow-lg hover:opacity-90 transition-opacity sm:gap-2 sm:px-4 sm:py-2 sm:text-xs">
            <Bell className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {newCount} nouvelle(s) commande(s)
          </button>
        </div>
      )}
      <div className="space-y-1">
        <h3 className="-mt-[3px] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Bonjour, <span className="text-primary">{session?.user?.name || "Administrateur"}</span></h3>
        {!isAdmin && role && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <MapPin className="h-3.5 w-3.5" />
            {roleLabels[role] || role}
            {visibleModules.length > 0 && <span className="text-muted-foreground">· {visibleModules.length} module(s)</span>}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs text-muted-foreground sm:text-sm">Vue d&apos;ensemble</p><h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Tableau de bord{!isAdmin ? " personnel" : ""}</h1></div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-refresh 15s
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {stats.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p><p className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{stat.value}</p></div><div className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 ${stat.tone}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div></div><p className="mt-3 text-xs text-muted-foreground sm:mt-4">{stat.detail}</p></div> })}
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card-soft">
        <div className="flex items-center justify-between border-b border-border p-3 sm:p-5">
          <div><h2 className="font-semibold text-foreground">Statut des commandes</h2><p className="mt-1 text-xs text-muted-foreground">Vue d&apos;ensemble de toutes les commandes du système</p></div>
          <Link href="/admin/commandes" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:gap-4 sm:p-5 sm:grid-cols-3 lg:grid-cols-7">
          {(report?.ordersByStatus ?? []).map((item) => (
            <div key={item.status} className="rounded-xl border border-border bg-muted/40 p-2 text-center sm:p-4">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>
              <p className="mt-2 text-xl font-bold text-foreground sm:mt-3 sm:text-2xl">{item.count}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">{formatPrice(item.total)}</p>
            </div>
          ))}
          {report?.reservationsByStatus && report.reservationsByStatus.pending > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-center sm:p-4">
              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 sm:px-2.5 sm:py-1 sm:text-xs">Précommande en attente</span>
              <p className="mt-2 text-xl font-bold text-blue-900 sm:mt-3 sm:text-2xl">{report.reservationsByStatus.pending}</p>
            </div>
          )}
          {report?.reservationsByStatus && report.reservationsByStatus.confirmed > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-2 text-center sm:p-4">
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 sm:px-2.5 sm:py-1 sm:text-xs">Précommande confirmée</span>
              <p className="mt-2 text-xl font-bold text-green-900 sm:mt-3 sm:text-2xl">{report.reservationsByStatus.confirmed}</p>
            </div>
          )}
          {!loading && (report?.ordersByStatus ?? []).length === 0 && (!report?.reservationsByStatus || (report.reservationsByStatus.pending + report.reservationsByStatus.confirmed) === 0) && <p className="col-span-full py-6 text-center text-sm text-muted-foreground sm:py-8">Aucune commande.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-foreground">Statistiques des ventes</h2><p className="mt-1 text-xs text-muted-foreground">Vue d&apos;ensemble des ventes et commandes</p></div><div className="flex overflow-x-auto rounded-lg border border-border bg-muted p-1"><button onClick={() => setChartMode("revenu")} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${chartMode === "revenu" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Revenus</button><button onClick={() => setChartMode("confirmees")} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${chartMode === "confirmees" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Confirmées ({confirmedOrders.length})</button><button onClick={() => setChartMode("production")} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${chartMode === "production" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>En production ({productionOrders.length})</button><button onClick={() => setChartMode("livrees")} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${chartMode === "livrees" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Livrées ({deliveredOrders.length})</button></div></div>
          {chartMode === "confirmees" || chartMode === "production" || chartMode === "livrees" ? (() => {
            const list = chartMode === "confirmees" ? confirmedOrders : chartMode === "production" ? productionOrders : deliveredOrders
            const emptyMsg = chartMode === "confirmees" ? "Aucune commande confirmée." : chartMode === "production" ? "Aucune commande en production." : "Aucune commande livrée."
            return (
              <div className="mt-4">
                {list.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-muted-foreground border-b border-border">
                        <tr>
                          <th className="pb-2 font-medium">Commande</th>
                          <th className="pb-2 font-medium">Client</th>
                          <th className="pb-2 font-medium">Statut</th>
                          <th className="pb-2 font-medium">POS</th>
                          <th className="pb-2 font-medium text-right">Montant</th>
                          <th className="pb-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {list.map((o) => (
                          <Fragment key={o.id}>
                            <tr className="hover:bg-muted/40 cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}>
                              <td className="py-2.5 font-medium text-foreground">{o.orderNumber}</td>
                              <td className="py-2.5 text-muted-foreground">{o.customerName || "—"}</td>
                              <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span></td>
                              <td className="py-2.5 text-muted-foreground">{o.pointOfSale?.name || "—"}</td>
                              <td className="py-2.5 text-right font-semibold text-foreground">{formatPrice(o.total)}</td>
                              <td className="py-2.5 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                            </tr>
                            {expandedOrder === o.id && (
                              <tr><td colSpan={6} className="bg-muted/20 px-4 py-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Articles</p>
                                    <div className="space-y-1">{o.items.map((item, idx) => <div key={idx} className="flex justify-between"><span className="text-foreground">{item.name}{item.format ? ` — ${item.format}` : ""} x{item.quantity}</span><span className="font-medium">{formatPrice(item.total)}</span></div>)}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Détails</p>
                                    <p className="text-muted-foreground">Paiement : <span className="text-foreground">{paymentLabels[o.paymentMethod] || o.paymentMethod || "—"}</span></p>
                                    <p className="text-muted-foreground">Source : <span className="text-foreground">{o.source === "WEB" ? "En ligne" : "Opérateur"}</span></p>
                                    {o.pointOfSale && <p className="text-muted-foreground">Point de vente : <span className="text-foreground">{o.pointOfSale.name}</span></p>}
                                  </div>
                                </div>
                              </td></tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })() : (
            <>
              <div className="mt-6 h-56 sm:h-72">{loading ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement...</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={report?.daily ?? []} barCategoryGap="28%"><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(value) => chartMode === "revenu" ? `${Math.round(Number(value) / 1000)}k` : String(value)} /><Tooltip formatter={(value) => [chartMode === "revenu" ? formatPrice(Number(value)) : value, chartMode === "revenu" ? "Revenu" : "Commandes"]} /><Bar dataKey={chartMode} fill="var(--primary)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}</div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-lg bg-muted/50 p-2 sm:p-3"><p className="text-[10px] text-muted-foreground sm:text-xs">CA 7 jours</p><p className="mt-1 text-base font-bold text-foreground sm:text-lg">{formatPrice(summary?.revenue7 ?? 0)}</p></div>
            <div className="rounded-lg bg-muted/50 p-2 sm:p-3"><p className="text-[10px] text-muted-foreground sm:text-xs">CA {report?.periodLabel ?? "Mois"}</p><p className="mt-1 text-base font-bold text-foreground sm:text-lg">{formatPrice(summary?.revenue30 ?? 0)}</p></div>
            <div className="rounded-lg bg-muted/50 p-2 sm:p-3"><p className="text-[10px] text-muted-foreground sm:text-xs">Commandes {report?.periodLabel ?? "Mois"}</p><p className="mt-1 text-base font-bold text-foreground sm:text-lg">{summary?.orders30 ?? 0}</p></div>
            <div className="rounded-lg bg-muted/50 p-2 sm:p-3"><p className="text-[10px] text-muted-foreground sm:text-xs">Panier moyen</p><p className="mt-1 text-base font-bold text-foreground sm:text-lg">{formatPrice(summary?.avgOrder ?? 0)}</p></div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paiements du jour</h3>
              <div className="space-y-2">{(report?.paymentBreakdown ?? []).filter((p) => p.total > 0).map((item, index) => <div key={item.method} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{paymentLabels[item.method] ?? item.method} <span className="text-xs text-muted-foreground">({item.count})</span></span><span className="font-semibold text-foreground">{formatPrice(item.total)}</span></div>)}{(report?.paymentBreakdown ?? []).filter((p) => p.total > 0).length === 0 && <p className="text-xs text-muted-foreground">Aucun encaissement aujourd&apos;hui.</p>}</div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paiements {report?.periodLabel ?? "Mois"}</h3>
              <div className="space-y-2">{(report?.paymentBreakdown30 ?? []).filter((p) => p.total > 0).map((item, index) => <div key={item.method} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{paymentLabels[item.method] ?? item.method} <span className="text-xs text-muted-foreground">({item.count})</span></span><span className="font-semibold text-foreground">{formatPrice(item.total)}</span></div>)}{(report?.paymentBreakdown30 ?? []).filter((p) => p.total > 0).length === 0 && <p className="text-xs text-muted-foreground">Aucun encaissement.</p>}</div>
            </div>
           </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="font-semibold text-foreground">Encaissements, Commandes et livraisons par semaine</h2><p className="mt-1 text-xs text-muted-foreground">Suivi des paiements, commandes et livraisons</p></div>
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 flex rounded-lg border border-border bg-muted p-1">
            <button onClick={() => setEncaissementsTab("aujourdhui")} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${encaissementsTab === "aujourdhui" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Aujourd&apos;hui</button>
            <button onClick={() => setEncaissementsTab("semaine")} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${encaissementsTab === "semaine" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Historique semaine</button>
          </div>

          {encaissementsTab === "aujourdhui" ? (
            <>
              <div className="mt-4 h-36 sm:h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentData} dataKey="total" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3}>{paymentData.map((entry, index) => <Cell key={entry.method} fill={paymentColors[index % paymentColors.length]} />)}</Pie><Tooltip formatter={(value) => [formatPrice(Number(value)), "Total"]} /></PieChart></ResponsiveContainer></div>
              <div className="space-y-2">{paymentData.map((item, index) => <div key={item.method} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{item.name}</span><span className="font-semibold text-foreground">{formatPrice(item.total)}</span></div>)}{paymentData.length === 0 && <p className="text-center text-sm text-muted-foreground">Aucun encaissement aujourd&apos;hui.</p>}</div>
            </>
          ) : (
            <div className="mt-5 space-y-4 sm:space-y-6">
              <div className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5">
                <button onClick={() => { setWeekOffset((o) => o + 1); setExpandedDay(null) }} className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" /> <span className="hidden sm:inline">Semaine précédente</span><span className="sm:hidden">Préc.</span>
                </button>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground sm:text-sm">
                    {report?.weekStart && report?.weekEnd
                      ? `${new Date(report.weekStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${new Date(report.weekEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                      : "Cette semaine"}
                  </p>
                  {weekOffset > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{weekOffset} semaine(s) précédente(s)</p>}
                </div>
                <button onClick={() => { setWeekOffset((o) => Math.max(0, o - 1)); setExpandedDay(null) }} disabled={weekOffset === 0} className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="hidden sm:inline">Semaine suivante</span><span className="sm:hidden">Suiv.</span> <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commandes de la semaine</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Jour</th><th className="pb-2 font-medium text-right">Commandes</th><th className="pb-2 font-medium text-right">Montant</th><th className="pb-2 font-medium w-8"></th></tr></thead>
                    <tbody className="divide-y divide-border/50">
                      {(report?.weeklyCommandes ?? []).map((d) => (
                        <Fragment key={d.date}>
                          <tr className="hover:bg-muted/40 cursor-pointer" onClick={() => setExpandedDay(expandedDay === d.date ? null : d.date)}>
                            <td className="py-2 font-medium text-foreground">{d.name} <span className="text-[10px] text-muted-foreground font-normal ml-1">{new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span></td>
                            <td className="py-2 text-right">{d.commandes}</td>
                            <td className="py-2 text-right font-semibold">{formatPrice(d.montant)}</td>
                            <td className="py-2 text-right text-xs text-muted-foreground">{d.commandes > 0 ? (expandedDay === d.date ? "▲" : "▼") : ""}</td>
                          </tr>
                          {expandedDay === d.date && d.details.length > 0 && (
                            <tr><td colSpan={4} className="bg-muted/20 px-4 py-3">
                              <div className="space-y-1.5">
                                {d.details.map((cmd, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-foreground">{cmd.orderNumber}</span>
                                    <span className="text-muted-foreground">{cmd.customerName || "Client"}</span>
                                    <span className="text-muted-foreground">{paymentLabels[cmd.paymentMethod] || cmd.paymentMethod || "—"}</span>
                                    <span className="font-semibold text-foreground">{formatPrice(cmd.total)}</span>
                                  </div>
                                ))}
                              </div>
                            </td></tr>
                          )}
                          {expandedDay === d.date && d.details.length === 0 && (
                            <tr><td colSpan={4} className="bg-muted/20 px-4 py-2 text-center text-xs text-muted-foreground">Aucune commande ce jour.</td></tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex justify-end text-xs font-semibold text-foreground">
                  Total : {formatPrice((report?.weeklyCommandes ?? []).reduce((s, d) => s + d.montant, 0))} — {(report?.weeklyCommandes ?? []).reduce((s, d) => s + d.commandes, 0)} commande(s)
                </div>
              </div>
              <div>
                <div className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5">
                  <button onClick={() => { setLivraisonWeekOffset((o) => o + 1); setExpandedDay(null) }} className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" /> <span className="hidden sm:inline">Semaine précédente</span><span className="sm:hidden">Préc.</span>
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground sm:text-sm">
                      {report?.livraisonWeekStart && report?.livraisonWeekEnd
                        ? `${new Date(report.livraisonWeekStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${new Date(report.livraisonWeekEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                        : "Cette semaine"}
                    </p>
                    {livraisonWeekOffset > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{livraisonWeekOffset} semaine(s) précédente(s)</p>}
                  </div>
                  <button onClick={() => { setLivraisonWeekOffset((o) => Math.max(0, o - 1)); setExpandedDay(null) }} disabled={livraisonWeekOffset === 0} className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <span className="hidden sm:inline">Semaine suivante</span><span className="sm:hidden">Suiv.</span> <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Livraisons de la semaine</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Jour</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium text-right">Livrées</th><th className="pb-2 font-medium w-8"></th></tr></thead>
                    <tbody className="divide-y divide-border/50">
                      {(report?.weeklyLivraisons ?? []).map((d) => (
                        <Fragment key={d.date}>
                          <tr className="hover:bg-muted/40 cursor-pointer" onClick={() => setExpandedDay(expandedDay === `del-${d.date}` ? null : `del-${d.date}`)}>
                            <td className="py-2 font-medium text-foreground">{d.name} <span className="text-[10px] text-muted-foreground font-normal ml-1">{new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span></td>
                            <td className="py-2 text-right">{d.livraisons}</td>
                            <td className="py-2 text-right text-green-600 font-semibold">{d.livrees}</td>
                            <td className="py-2 text-right text-xs text-muted-foreground">{d.livraisons > 0 ? (expandedDay === `del-${d.date}` ? "▲" : "▼") : ""}</td>
                          </tr>
                          {expandedDay === `del-${d.date}` && d.details.length > 0 && (
                            <tr><td colSpan={4} className="bg-muted/20 px-4 py-3">
                              <div className="space-y-1.5">
                                {d.details.map((dl, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-foreground">{dl.orderNumber}</span>
                                    <span className="text-muted-foreground">{dl.customer || "Client"}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dl.status === "DELIVERED" ? "bg-green-100 text-green-700" : dl.status === "IN_TRANSIT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{dl.status === "DELIVERED" ? "Livrée" : dl.status === "IN_TRANSIT" ? "En transit" : dl.status === "PICKED_UP" ? "Récupérée" : dl.status}</span>
                                    <span className="text-muted-foreground truncate max-w-[150px]">{dl.address || "—"}</span>
                                  </div>
                                ))}
                              </div>
                            </td></tr>
                          )}
                          {expandedDay === `del-${d.date}` && d.details.length === 0 && (
                            <tr><td colSpan={4} className="bg-muted/20 px-4 py-2 text-center text-xs text-muted-foreground">Aucune livraison ce jour.</td></tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex justify-end text-xs font-semibold text-foreground">
                  Total : {(report?.weeklyLivraisons ?? []).reduce((s, d) => s + d.livraisons, 0)} livraison(s) — {(report?.weeklyLivraisons ?? []).reduce((s, d) => s + d.livrees, 0)} livrée(s)
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card shadow-card-soft">
          <div className="flex items-center justify-between border-b border-border p-3 sm:p-5">
            <div><h2 className="font-semibold text-foreground">Commandes récentes</h2><p className="mt-1 text-xs text-muted-foreground">Suivi des dernières ventes enregistrées</p></div>
            <Link href={recentTab === "commandes" ? "/admin/commandes" : "/admin/reservations"} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="flex gap-1.5 border-b border-border px-3 pt-2 pb-0 sm:px-5 sm:pt-3">
            <button onClick={() => setRecentTab("commandes")} className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${recentTab === "commandes" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>Commandes ({orders.length})</button>
            <button onClick={() => setRecentTab("precommandes")} className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${recentTab === "precommandes" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>Précommandes ({reservations.length})</button>
          </div>
          {recentTab === "commandes" ? (
            <>
              <div className="flex flex-wrap gap-1.5 border-b border-border px-3 pt-2 pb-0 sm:px-5 sm:pt-3">
                <button onClick={() => setRecentStatusFilter(null)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${recentStatusFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>Tous ({orders.length})</button>
                {recentStatuses.map((s) => (
                  <button key={s} onClick={() => setRecentStatusFilter(recentStatusFilter === s ? null : s)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${recentStatusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                    {getStatusLabel(s)} ({orders.filter((o) => o.status === s).length})
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Commande</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell sm:px-5 sm:py-3">Client</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell sm:px-5 sm:py-3">Provenance</th>
                      <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Montant</th>
                      <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/40">
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground sm:px-5 sm:py-3">{order.orderNumber}</td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell sm:px-5 sm:py-3">{order.customerName || "Client"}</td>
                        <td className="hidden px-3 py-2.5 sm:table-cell sm:px-5 sm:py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceLabels[order.source]?.className || "bg-gray-100 text-gray-600"}`}>{sourceLabels[order.source]?.label || order.source || "En ligne"}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-foreground sm:px-5 sm:py-3">{formatPrice(order.total)}</td>
                        <td className="px-3 py-2.5 sm:px-5 sm:py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span></td>
                      </tr>
                    ))}
                    {!loading && recentOrders.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground sm:px-5 sm:py-8">Aucune commande{recentStatusFilter ? " pour ce statut" : " récente"}.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Client</th>
                    <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Type</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell sm:px-5 sm:py-3">Date</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell sm:px-5 sm:py-3">Provenance</th>
                    <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-muted/40">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground sm:px-5 sm:py-3">{res.client}</td>
                      <td className="px-3 py-2.5 text-muted-foreground sm:px-5 sm:py-3">{res.type}</td>
                      <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell sm:px-5 sm:py-3">{res.date} à {res.heure || "—"}</td>
                      <td className="hidden px-3 py-2.5 sm:table-cell sm:px-5 sm:py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceLabels[res.source]?.className || "bg-gray-100 text-gray-600"}`}>{sourceLabels[res.source]?.label || res.source || "En ligne"}</span>
                      </td>
                      <td className="px-3 py-2.5 sm:px-5 sm:py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:py-1 sm:text-xs ${getStatusColor(res.status)}`}>{getStatusLabel(res.status)}</span></td>
                    </tr>
                  ))}
                  {!loading && reservations.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground sm:px-5 sm:py-8">Aucune précommande récente.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Produits les plus vendus</h2><p className="mt-1 text-xs text-muted-foreground">Sur les sept derniers jours</p></div><BarChart3 className="h-5 w-5 text-primary" /></div><div className="mt-3 space-y-3 sm:mt-5 sm:space-y-4">{(report?.topProducts ?? []).map((product, index) => <div key={product.name}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-foreground">{product.name}</span><span className="text-muted-foreground">{product.quantity} unités</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(8, product.quantity * 12))}%` }} /></div></div>)}{!loading && !report?.topProducts.length && <p className="text-sm text-muted-foreground">Pas encore de ventes.</p>}</div></section>
      </div>

      {(report?.stockAlerts ?? []).length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 shadow-card-soft sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100"><AlertCircle className="h-4 w-4 text-orange-600" /></div>
              <div><h2 className="font-semibold text-orange-900">Alertes stock bas</h2><p className="mt-0.5 text-xs text-orange-700">{report!.stockAlerts.length} produit(s) en rupture ou stock faible</p></div>
            </div>
            <Link href="/admin/stock" className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline">Gérer le stock <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report!.stockAlerts.map((alert) => (
              <div key={alert.variantId} className="flex items-center justify-between rounded-lg border border-orange-200 bg-white px-3 py-2 sm:px-4 sm:py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{alert.productName}</p>
                  <p className="text-xs text-muted-foreground">{alert.format} · {alert.categoryName}</p>
                </div>
                <div className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${alert.stock <= 0 ? "bg-red-100 text-red-700" : alert.stock <= 10 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {alert.stock <= 0 ? "Rupture" : `${alert.stock} unités`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Dernières pré-commandes</h2><p className="mt-1 text-xs text-muted-foreground">Pré-commandes les plus récentes</p></div><Link href="/admin/reservations" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="mt-3 divide-y divide-border sm:mt-4">{reservations.slice(0, 5).map((res) => <div key={res.id} className="flex items-center justify-between gap-2 py-2.5 text-sm sm:gap-3 sm:py-3"><div className="min-w-0"><p className="truncate font-medium text-foreground">{res.client}</p><p className="text-xs text-muted-foreground">{res.type} · {res.date} à {res.heure || "-"}</p></div><div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><span className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block ${sourceLabels[res.source]?.className || "bg-gray-100 text-gray-600"}`}>{sourceLabels[res.source]?.label || res.source || "En ligne"}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:px-2.5 sm:text-xs">{res.status}</span></div></div>)}{!loading && reservations.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground sm:py-8">Aucune pré-commande pour le moment.</p>}</div></section>

      <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Actions rapides</h2><p className="mt-1 text-xs text-muted-foreground">Accéder aux opérations courantes</p></div><CheckCircle2 className="h-5 w-5 text-primary" /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-5"><Link href="/admin/ventes" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><ShoppingCart className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Nouvelle vente</span></Link><Link href="/admin/produits" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><Plus className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Produit</span></Link><Link href="/admin/stock" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><ClipboardList className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Stock</span></Link><Link href="/admin/production" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><Factory className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Production</span></Link><Link href="/admin/rapports" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><Package className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Rapports</span></Link></div></section>
    </div>
  )
}
