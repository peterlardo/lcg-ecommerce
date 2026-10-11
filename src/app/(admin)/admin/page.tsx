"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  MapPin,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ReportData {
  summary: { todayRevenue: number; todayOrders: number; todayOrdersDelivered: number; stockUnits: number; deliveriesInProgress: number; lowStock: number; pendingReservations: number; totalReservations: number; totalDeliveries: number; deliveredToday: number; todayDeliveries: number; todayReservations: number; todayReservationsPending: number; cashExpected: number; revenue7: number; revenue30: number; orders7: number; orders30: number; avgOrder: number; topProduct: string; todayInDelivery: number; todayConfirmed: number; todayItems: number; yesterdayItems: number }
  daily: { name: string; revenu: number; commandes: number }[]
  salesByDay: { name: string; revenu: number; commandes: number }[]
  paymentBreakdown: { method: string; total: number; count: number }[]
  paymentBreakdown30: { method: string; total: number; count: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  trendDays: { label: string; commandes: number; montant: number }[]
  trendWeeks: { label: string; range?: string; commandes: number; montant: number; details: { orderNumber: string; customerName: string; total: number; paymentMethod: string }[] }[]
  trendMonths: { label: string; commandes: number; montant: number }[]
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
  userId?: string | null; userName?: string | null;
  items: { name: string; format: string; quantity: number; price: number; total: number }[]
}

interface Reservation { id: string; client: string; type: string; date: string; heure: string; status: string; source: string }

const sourceLabels: Record<string, { label: string; className: string }> = {
  WEB: { label: "En ligne", className: "bg-teal-100 text-teal-700" },
  OPERATOR: { label: "Opérateur", className: "bg-violet-100 text-violet-700" },
}

function formatSaleTime(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrateur",
  STOCK_MANAGER: "Gestionnaire de stock",
  DELIVERY_AGENT: "Agent de livraison",
  CUSTOMER: "Client",
}

const SALES_PER_PAGE = 6
const TREND_PER_PAGE = 4

export default function DashboardPage() {
  const { data: session } = useSession()
  const [report, setReport] = useState<ReportData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [trendMode, setTrendMode] = useState<"jour" | "semaine" | "mois">("semaine")
  const [saleClient, setSaleClient] = useState("")
  const [saleDate, setSaleDate] = useState("")
  const [saleUserId, setSaleUserId] = useState("")
  const [salesPage, setSalesPage] = useState(1)
  const [trendClient, setTrendClient] = useState("")
  const [trendDate, setTrendDate] = useState("")
  const [trendUserId, setTrendUserId] = useState("")
  const [trendPage, setTrendPage] = useState(1)
  const [realTimeScope,setRealTimeScope]=useState("formats")
  const [realTimeFormats,setRealTimeFormats]=useState<any[]>([])
  const [realTimeCommandees,setRealTimeCommandees]=useState<any[]>([])
  const [realTimeVendeurs,setRealTimeVendeurs]=useState<any[]>([])
  const [realTimeOperateurs,setRealTimeOperateurs]=useState<any[]>([])
  const [realTimeLoading,setRealTimeLoading]=useState(false)
  const [realTimePage, setRealTimePage] = useState(1)
  const RT_PER_PAGE = 5 as const

  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string }[]>([])
  const deferredTrendClient = useDeferredValue(trendClient.trim())

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") return
    const controller = new AbortController()
    fetch("/api/users", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setTeamUsers(data.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))) })
      .catch(() => {})
    return () => { controller.abort() }
  }, [session?.user?.role])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const trendQuery = new URLSearchParams()
        if (deferredTrendClient) trendQuery.set("client", deferredTrendClient)
        if (trendDate) trendQuery.set("date", trendDate)
        if (session?.user?.role === "ADMIN" && trendUserId) trendQuery.set("userId", trendUserId)
        const trendUrl = trendQuery.toString() ? `/api/reports?${trendQuery.toString()}` : "/api/reports"
        const [reportRes, ordersRes, reservationsRes] = await Promise.all([
          fetch(trendUrl, { signal: controller.signal }),
          fetch("/api/orders", { signal: controller.signal }),
          fetch("/api/reservations", { signal: controller.signal }),
        ])
        if (reportRes.ok) setReport(await reportRes.json())
        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (reservationsRes.ok) setReservations(await reservationsRes.json())
      } catch (error) {
        if (!controller.signal.aborted) console.error("Erreur dashboard:", error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    const interval = setInterval(() => { void init() }, 15000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [deferredTrendClient, trendDate, trendUserId, session?.user?.role])
  const loadRealTime = async (signal?: AbortSignal) => {
    try {
      setRealTimeLoading(true)
      const [ordersRes, salesRes] = await Promise.all([
        fetch('/api/orders?limit=1000', { signal }),
        fetch('/api/sales?limit=1000', { signal }),
      ])
      const orders = ordersRes.ok ? await ordersRes.json() : []
      const sales = salesRes.ok ? await salesRes.json() : []
      const ords = Array.isArray(orders) ? orders : (orders?.orders || [])
      const aggFormats = new Map<string, any>()
      for (const o of ords) {
        for (const it of (o.items||[])) {
          const key = String(it.format||'')
          const a = aggFormats.get(key)||{format:key,count:0,qty:0,total:0}
          a.count++; a.qty+=Number(it.quantity||0); a.total+=Number(it.total||0)
          aggFormats.set(key,a)
        }
      }
      setRealTimeFormats(Array.from(aggFormats.values()) as unknown as any[])
      setRealTimeCommandees(ords.slice(0,200))
      const aggV = new Map<string, any>()
      for (const o of ords) {
        const key = o.userId || o.userName || 'unknown'
        const a = aggV.get(key)||{key,name:o.userName||o.userId||'Vendeur inconnu',count:0,qty:0,total:0}
        a.count++; a.total+=Number(o.total||0); a.qty+=(o.items||[]) .reduce((s:any,i:any)=>s+Number(i.quantity||0),0)
        aggV.set(key,a)
      }
      setRealTimeVendeurs(Array.from(aggV.values()))
      const aggO = new Map<string, any>()
      for (const o of ords) {
        const key = o.openedById || o.userId || 'unknown'
        const a = aggO.get(key)||{key,name:o.openedByName||o.userName||'Opérateur inconnu',count:0,qty:0,total:0}
        a.count++; a.total+=Number(o.total||0); a.qty+=(o.items||[]) .reduce((s:any,i:any)=>s+Number(i.quantity||0),0)
        aggO.set(key,a)
      }
      setRealTimeOperateurs(Array.from(aggO.values()))
    } finally {
      setRealTimeLoading(false)
    }
  }

  useEffect(() => {
    const c = new AbortController()
    void loadRealTime(c.signal)
    const t = setInterval(()=>void loadRealTime(c.signal), 30000)
    return ()=>{c.abort(); clearInterval(t)}
  }, [])

  const role = session?.user?.role
  const isAdmin = role === "ADMIN"
  const userPermissions = session?.user?.permissions ?? []
  const visibleModules = isAdmin ? [] : userPermissions.filter((p) => p.canView).map((p) => p.module)

  const summary = report?.summary
  const stats = [
    { label: "En livraison", value: String(summary?.todayInDelivery ?? 0), detail: "Commandes en cours de livraison", icon: Truck, tone: "text-orange-600 bg-orange-100" },
    { label: "Articles vendus", value: String(summary?.todayItems ?? 0), detail: `Hier : ${summary?.yesterdayItems ?? 0} article${(summary?.yesterdayItems ?? 0) > 1 ? "s" : ""}`, icon: Boxes, tone: "text-green-600 bg-green-100" },
    { label: "Commandes totales", value: String(summary?.todayOrders ?? 0), detail: `${formatPrice(summary?.todayRevenue ?? 0)} de ventes`, icon: ShoppingCart, tone: "text-primary bg-primary/10" },
    { label: "Ventes du jour", value: formatPrice(summary?.todayRevenue ?? 0), detail: `${summary?.todayOrdersDelivered ?? 0} livrée(s)`, icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-100" },
    { label: "Commandes", value: String(summary?.orders30 ?? 0), detail: `${report?.periodLabel ?? "Mois"} — ${summary?.todayOrders ?? 0} aujourd'hui`, icon: ClipboardList, tone: "text-blue-600 bg-blue-100" },
  ]

  const filteredSales = useMemo(() => {
    const query = saleClient.trim().toLowerCase()
    return orders.filter((order) => {
      if (query && !order.customerName.toLowerCase().includes(query)) return false
      if (saleDate && new Date(order.createdAt).toDateString() !== new Date(`${saleDate}T00:00:00`).toDateString()) return false
      if (saleUserId && order.userId !== saleUserId) return false
      return true
    })
  }, [orders, saleClient, saleDate, saleUserId])

  const isSalesFiltered = Boolean(saleClient.trim() || saleDate || saleUserId)
  const salesTotalPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE))
  const salesPageIndex = Math.min(salesPage, salesTotalPages)
  const pagedSales = useMemo(
    () => filteredSales.slice((salesPageIndex - 1) * SALES_PER_PAGE, salesPageIndex * SALES_PER_PAGE),
    [filteredSales, salesPageIndex]
  )
  const memberOptions = useMemo(() => {
    if (!isAdmin) return []
    if (teamUsers.length > 0) return teamUsers
    const map = new Map<string, string>()
    for (const order of orders) {
      if (order.userId && order.userName && !map.has(order.userId)) map.set(order.userId, order.userName)
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [isAdmin, teamUsers, orders])

  const emptySalesMessage = isSalesFiltered
    ? "Aucune vente ne correspond à ces critères."
    : "Aucune vente pour le moment."

  const trendRows = useMemo(() => {
    const rows = trendMode === "jour"
      ? (report?.trendDays ?? [])
      : trendMode === "semaine" ? (report?.trendWeeks ?? []) : (report?.trendMonths ?? [])
    return [...rows].reverse()
  }, [report, trendMode])

  const isTrendFiltered = Boolean(trendClient.trim() || trendDate || trendUserId)
  const trendTotalPages = Math.max(1, Math.ceil(trendRows.length / TREND_PER_PAGE))
  const trendPageIndex = Math.min(trendPage, trendTotalPages)
  const pagedTrend = useMemo(
    () => trendRows.slice((trendPageIndex - 1) * TREND_PER_PAGE, trendPageIndex * TREND_PER_PAGE),
    [trendRows, trendPageIndex]
  )
  const maxTrendMontant = useMemo(() => Math.max(1, ...trendRows.map((r) => r.montant)), [trendRows])
  const trendTotalCommandes = useMemo(() => trendRows.reduce((sum, r) => sum + r.commandes, 0), [trendRows])
  const trendTotalMontant = useMemo(() => trendRows.reduce((sum, r) => sum + r.montant, 0), [trendRows])

  return (
    <div className="space-y-4 sm:space-y-6">
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
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-refresh 15s
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {stats.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p><p className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{stat.value}</p></div><div className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 ${stat.tone}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div></div><p className="mt-3 text-xs text-muted-foreground sm:mt-4">{stat.detail}</p></div> })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground sm:text-xl">Dernières ventes</h2>
              <p className="mt-1 text-xs text-muted-foreground">Clients, quantités et montants des dernières ventes</p>
            </div>
            <Link href="/admin/commandes" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2 sm:mt-4">
            <label htmlFor="sales-client" className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[220px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom du client</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="sales-client"
                  type="text"
                  value={saleClient}
                  onChange={(e) => { setSaleClient(e.target.value); setSalesPage(1) }}
                  placeholder="Rechercher un client..."
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </label>
            <label htmlFor="sales-date" className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date de la vente</span>
              <input
                id="sales-date"
                type="date"
                value={saleDate}
                onChange={(e) => { setSaleDate(e.target.value); setSalesPage(1) }}
                className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            {isAdmin && (
              <label htmlFor="sales-user" className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[200px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membre d&apos;équipe</span>
                <select
                  id="sales-user"
                  value={saleUserId}
                  onChange={(e) => { setSaleUserId(e.target.value); setSalesPage(1) }}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Tous les membres</option>
                  {memberOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                  {memberOptions.length === 0 && <option disabled>Aucun membre disponible</option>}
                </select>
              </label>
            )}
            {isSalesFiltered && (
              <button
                onClick={() => { setSaleClient(""); setSaleDate(""); setSaleUserId(""); setSalesPage(1) }}
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Réinitialiser
              </button>
            )}
          </div>

          <div className="mt-3 flex-1 divide-y divide-border">
            {pagedSales.map((order) => {
              const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
              const articles = order.items.map((item) => `${item.quantity}× ${item.name}${item.format ? ` (${item.format})` : ""}`).join(" · ")
              return (
                <div key={order.id} className="flex items-center justify-between gap-3 py-2.5 sm:py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {order.customerName || "Client"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{formatSaleTime(order.createdAt)}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{articles || order.orderNumber}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="rounded-full bg-muted px-2 py-0.5  font-semibold text-foreground sm:px-2.5 sm:py-1 ">
                      {quantity} article{quantity > 1 ? "s" : ""}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-foreground sm:text-base">{formatPrice(order.total)}</span>
                  </div>
                </div>
              )
            })}
            {!loading && filteredSales.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{emptySalesMessage}</p>
            )}
          </div>

          {filteredSales.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="min-w-0 text-xs text-muted-foreground">
                {filteredSales.length} vente{filteredSales.length > 1 ? "s" : ""}
                {salesTotalPages > 1 && ` · Page ${salesPageIndex}/${salesTotalPages}`}
              </p>
              {salesTotalPages > 1 && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setSalesPage(1)} disabled={salesPageIndex <= 1} aria-label="Première page" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
                  <button onClick={() => setSalesPage(salesPageIndex - 1)} disabled={salesPageIndex <= 1} aria-label="Page précédente" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
                  {Array.from({ length: salesTotalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === salesTotalPages || Math.abs(p - salesPageIndex) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1 sm:px-1.5 text-xs text-muted-foreground">…</span> : <button key={p} onClick={() => setSalesPage(p)} aria-current={p === salesPageIndex ? "page" : undefined} className={`min-w-[24px] sm:min-w-[28px] rounded-md px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs font-medium transition-colors ${p === salesPageIndex ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{p}</button>)}
                  <button onClick={() => setSalesPage(salesPageIndex + 1)} disabled={salesPageIndex >= salesTotalPages} aria-label="Page suivante" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
                  <button onClick={() => setSalesPage(salesTotalPages)} disabled={salesPageIndex >= salesTotalPages} aria-label="Dernière page" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground">Commandes par semaine / mois</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {trendMode === "jour" ? "Volume et montant des ventes sur les trente derniers jours" : `Volume et montant des ventes sur les douze dernières ${trendMode === "semaine" ? "semaines" : "mois"}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex rounded-lg border border-border bg-muted p-1">
                {(["jour", "semaine", "mois"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setTrendMode(mode); setTrendPage(1) }}
                    aria-pressed={trendMode === mode}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${trendMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <BarChart3 className="hidden h-5 w-5 text-primary sm:block" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2 sm:mt-4">
            <label htmlFor="trend-client" className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[220px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom du client</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="trend-client"
                  type="text"
                  value={trendClient}
                  onChange={(e) => { setTrendClient(e.target.value); setTrendPage(1) }}
                  placeholder="Rechercher un client..."
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </label>
            <label htmlFor="trend-date" className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date de la vente</span>
              <input
                id="trend-date"
                type="date"
                value={trendDate}
                onChange={(e) => { setTrendDate(e.target.value); setTrendPage(1) }}
                className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            {isAdmin && (
              <label htmlFor="trend-user" className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[200px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membre d&apos;équipe</span>
                <select
                  id="trend-user"
                  value={trendUserId}
                  onChange={(e) => { setTrendUserId(e.target.value); setTrendPage(1) }}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Tous les membres</option>
                  {memberOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                  {memberOptions.length === 0 && <option disabled>Aucun membre disponible</option>}
                </select>
              </label>
            )}
            {isTrendFiltered && (
              <button
                onClick={() => { setTrendClient(""); setTrendDate(""); setTrendUserId(""); setTrendPage(1) }}
                className="h-9 rounded-lg border border-border bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Réinitialiser
              </button>
            )}
          </div>

          <div className="mt-3 flex-1 space-y-3 sm:mt-4 sm:space-y-4">
            {pagedTrend.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">{row.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.commandes} commande{row.commandes > 1 ? "s" : ""} · <span className="font-semibold text-foreground">{formatPrice(row.montant)}</span></span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(row.montant > 0 ? 6 : 0, (row.montant / maxTrendMontant) * 100))}%` }} />
                </div>
              </div>
            ))}
            {!loading && trendRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {isTrendFiltered ? "Aucune commande ne correspond à ces critères." : "Pas encore de ventes."}
              </p>
            )}
          </div>

          {trendRows.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="min-w-0 text-xs text-muted-foreground">
                {trendTotalCommandes} commande{trendTotalCommandes > 1 ? "s" : ""} · {formatPrice(trendTotalMontant)}
                {trendTotalPages > 1 && ` · Page ${trendPageIndex}/${trendTotalPages}`}
              </p>
              {trendTotalPages > 1 && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setTrendPage(1)} disabled={trendPageIndex <= 1} aria-label="Première page" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
                  <button onClick={() => setTrendPage(trendPageIndex - 1)} disabled={trendPageIndex <= 1} aria-label="Page précédente" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
                  {Array.from({ length: trendTotalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === trendTotalPages || Math.abs(p - trendPageIndex) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`te${i}`} className="px-1 sm:px-1.5 text-xs text-muted-foreground">…</span> : <button key={p} onClick={() => setTrendPage(p)} aria-current={p === trendPageIndex ? "page" : undefined} className={`min-w-[24px] sm:min-w-[28px] rounded-md px-1.5 sm:px-2 py-1 sm:py-1.5 text-xs font-medium transition-colors ${p === trendPageIndex ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{p}</button>)}
                  <button onClick={() => setTrendPage(trendPageIndex + 1)} disabled={trendPageIndex >= trendTotalPages} aria-label="Page suivante" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
                  <button onClick={() => setTrendPage(trendTotalPages)} disabled={trendPageIndex >= trendTotalPages} aria-label="Dernière page" className="rounded-md px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
                </div>
              )}
            </div>
          )}
        </section>
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
                  <p className="min-w-0 text-xs text-muted-foreground">{alert.format} · {alert.categoryName}</p>
                </div>
                <div className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${alert.stock <= 0 ? "bg-red-100 text-red-700" : alert.stock <= 10 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {alert.stock <= 0 ? "Rupture" : `${alert.stock} unités`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-white p-3 shadow-card-soft sm:p-5 text-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-foreground">Ventes en temps réel</h2>
            <p className="mt-1 text-xs text-muted-foreground">Consultez les ventes par format, les commandes et les quantités par vendeur/opérateur accueil</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={realTimeScope}
              onChange={(e) => { setRealTimeScope(e.target.value as any); setRealTimePage(1) }}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-white/40"
            >
              <option value="formats">Ventes par format de produit</option>
              <option value="commandees">Ventes commandées</option>
              <option value="vendeurs">Quantités par vendeur</option>
              <option value="operateurs">Quantités par opérateur accueil</option>
            </select>
            <button
              onClick={() => { setRealTimePage(1); void loadRealTime() }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-white/20"
            >
              Actualiser
            </button>
          </div>
        </div>
        <div className="mt-3 sm:mt-4">
          {realTimeScope === 'formats' && (
            <div className="space-y-2">
              {(realTimeFormats as any[]).slice((realTimePage-1)*RT_PER_PAGE, realTimePage*RT_PER_PAGE).map((f:any, i:number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{f.format || 'Sans format'}</p>
                    <p className="text-xs text-white/90">{f.count} ligne(s) · {f.qty} unité(s)</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatPrice(f.total||0)}</span>
                </div>
              ))}
              {!realTimeLoading && (realTimeFormats as any[]).length === 0 && (
                <p className="py-6 text-center text-sm text-white/90">Aucune donnée pour le moment.</p>
              )}
            </div>
          )}
          {realTimeScope === 'commandees' && (
            <div className="space-y-2">
              {(realTimeCommandees as any[]).slice((realTimePage-1)*RT_PER_PAGE, realTimePage*RT_PER_PAGE).map((o:any) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{o.orderNumber}</p>
                    <p className="text-xs text-white/90">{o.customerName} · {new Date(o.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatPrice(o.total||0)}</span>
                </div>
              ))}
              {!realTimeLoading && (realTimeCommandees as any[]).length === 0 && (
                <p className="py-6 text-center text-sm text-white/90">Aucune commande trouvée.</p>
              )}
            </div>
          )}
          {realTimeScope === 'vendeurs' && (
            <div className="space-y-2">
              {(realTimeVendeurs as any[]).slice((realTimePage-1)*RT_PER_PAGE, realTimePage*RT_PER_PAGE).map((v:any) => (
                <div key={v.key} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{v.name || 'Vendeur inconnu'}</p>
                    <p className="text-xs text-white/90">{v.count} vente(s) · {v.qty} unité(s)</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatPrice(v.total||0)}</span>
                </div>
              ))}
              {!realTimeLoading && (realTimeVendeurs as any[]).length === 0 && (
                <p className="py-6 text-center text-sm text-white/90">Aucun vendeur avec des ventes.</p>
              )}
            </div>
          )}
          {realTimeScope === 'operateurs' && (
            <div className="space-y-2">
              {(realTimeOperateurs as any[]).slice((realTimePage-1)*RT_PER_PAGE, realTimePage*RT_PER_PAGE).map((op:any) => (
                <div key={op.key} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{op.name || 'Opérateur inconnu'}</p>
                    <p className="text-xs text-white/90">{op.count} vente(s) · {op.qty} unité(s)</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{formatPrice(op.total||0)}</span>
                </div>
              ))}
              {!realTimeLoading && (realTimeOperateurs as any[]).length === 0 && (
                <p className="py-6 text-center text-sm text-white/90">Aucun opérateur avec des ventes.</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Actions rapides</h2><p className="mt-1 text-xs text-muted-foreground">Accéder aux opérations courantes</p></div><CheckCircle2 className="h-5 w-5 text-primary" /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-5"><Link href="/admin/ventes" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><ShoppingCart className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Nouvelle vente</span></Link><Link href="/admin/produits" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><Plus className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Produit</span></Link><Link href="/admin/stock" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><ClipboardList className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Stock</span></Link><Link href="/admin/production" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><Factory className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Production</span></Link><Link href="/admin/rapports" className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-muted sm:gap-3 sm:p-3"><Package className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground sm:text-sm">Rapports</span></Link></div></section>
    </div>
  )
}
