"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
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

interface ReportData {
  summary: { todayRevenue: number; todayOrders: number; stockUnits: number; deliveriesInProgress: number; lowStock: number; pendingReservations: number; totalReservations: number; totalDeliveries: number; deliveredToday: number; cashExpected: number; revenue7: number; revenue30: number; orders7: number; orders30: number; avgOrder: number; topProduct: string }
  daily: { name: string; revenu: number; commandes: number }[]
  salesByDay: { name: string; revenu: number; commandes: number }[]
  paymentBreakdown: { method: string; total: number; count: number }[]
  paymentBreakdown30: { method: string; total: number; count: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  reservations: { id: string; client: string; type: string; date: string; heure: string; status: string }[]
  periodLabel: string
}

interface Order { id: string; orderNumber: string; customerName: string; status: string; total: number; createdAt: string; source: string }

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
  const [chartMode, setChartMode] = useState<"revenu" | "commandes">("revenu")

  useEffect(() => {
    Promise.all([fetch("/api/reports"), fetch("/api/orders"), fetch("/api/reservations")])
      .then(async ([reportRes, ordersRes, reservationsRes]) => {
        if (reportRes.ok) setReport(await reportRes.json())
        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (reservationsRes.ok) setReservations(await reservationsRes.json())
      })
      .catch((error) => console.error("Erreur dashboard:", error))
      .finally(() => setLoading(false))
  }, [])

  const role = session?.user?.role
  const isAdmin = role === "ADMIN"
  const userPermissions = session?.user?.permissions ?? []
  const visibleModules = isAdmin ? [] : userPermissions.filter((p) => p.canView).map((p) => p.module)

  const summary = report?.summary
  const stats = [
    { label: "Ventes du jour", value: formatPrice(summary?.todayRevenue ?? 0), detail: `${summary?.todayOrders ?? 0} commande(s)`, icon: CircleDollarSign, tone: "text-green-600 bg-green-100" },
    { label: "Commandes totales", value: String(summary?.orders30 ?? 0), detail: `${summary?.todayOrders ?? 0} aujourd'hui`, icon: ShoppingCart, tone: "text-primary bg-primary/10" },
    { label: "Livraisons", value: String(summary?.totalDeliveries ?? 0), detail: `${summary?.deliveriesInProgress ?? 0} en cours · ${summary?.deliveredToday ?? 0} livrées aujourd'hui`, icon: Truck, tone: "text-orange-600 bg-orange-100" },
    { label: "Pré-commandes", value: String(summary?.totalReservations ?? 0), detail: `${summary?.pendingReservations ?? 0} en attente`, icon: ClipboardList, tone: "text-blue-600 bg-blue-100" },
  ]

  const paymentData = useMemo(() => (report?.paymentBreakdown ?? []).map((item) => ({ ...item, name: paymentLabels[item.method] ?? item.method })), [report])
  const recentOrders = orders.slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="-mt-[3px] text-3xl font-bold tracking-tight text-foreground">Bonjour, <span className="text-primary">{session?.user?.name || "Administrateur"}</span></h3>
        {!isAdmin && role && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <MapPin className="h-3.5 w-3.5" />
            {roleLabels[role] || role}
            {visibleModules.length > 0 && <span className="text-muted-foreground">· {visibleModules.length} module(s)</span>}
          </div>
        )}
        <div className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm text-muted-foreground">Vue d&apos;ensemble</p><h1 className="mt-1 text-2xl font-bold text-foreground">Tableau de bord{!isAdmin ? " personnel" : ""}</h1></div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-xl border border-border bg-card p-5 shadow-card-soft"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-full ${stat.tone}`}><Icon className="h-5 w-5" /></div></div><p className="mt-4 text-xs text-muted-foreground">{stat.detail}</p></div> })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <section className="rounded-xl border border-border bg-card p-5 shadow-card-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-foreground">Statistiques des ventes</h2><p className="mt-1 text-xs text-muted-foreground">Vue d&apos;ensemble des ventes et commandes</p></div><div className="flex rounded-lg border border-border bg-muted p-1"><button onClick={() => setChartMode("revenu")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${chartMode === "revenu" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Revenus</button><button onClick={() => setChartMode("commandes")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${chartMode === "commandes" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Commandes</button></div></div>
          <div className="mt-6 h-72">{loading ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement...</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={report?.daily ?? []} barCategoryGap="28%"><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(value) => chartMode === "revenu" ? `${Math.round(Number(value) / 1000)}k` : String(value)} /><Tooltip formatter={(value) => [chartMode === "revenu" ? formatPrice(Number(value)) : value, chartMode === "revenu" ? "Revenu" : "Commandes"]} /><Bar dataKey={chartMode} fill="var(--primary)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}</div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">CA 7 jours</p><p className="mt-1 text-lg font-bold text-foreground">{formatPrice(summary?.revenue7 ?? 0)}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">CA {report?.periodLabel ?? "Mois"}</p><p className="mt-1 text-lg font-bold text-foreground">{formatPrice(summary?.revenue30 ?? 0)}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Commandes {report?.periodLabel ?? "Mois"}</p><p className="mt-1 text-lg font-bold text-foreground">{summary?.orders30 ?? 0}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Panier moyen</p><p className="mt-1 text-lg font-bold text-foreground">{formatPrice(summary?.avgOrder ?? 0)}</p></div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paiements du jour</h3>
              <div className="space-y-2">{(report?.paymentBreakdown ?? []).filter((p) => p.total > 0).map((item, index) => <div key={item.method} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{paymentLabels[item.method] ?? item.method} <span className="text-xs text-muted-foreground">({item.count})</span></span><span className="font-semibold text-foreground">{formatPrice(item.total)}</span></div>)}{(report?.paymentBreakdown ?? []).filter((p) => p.total > 0).length === 0 && <p className="text-xs text-muted-foreground">Aucun encaissement aujourd&apos;hui.</p>}</div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paiements {report?.periodLabel ?? "Mois"}</h3>
              <div className="space-y-2">{(report?.paymentBreakdown30 ?? []).filter((p) => p.total > 0).map((item, index) => <div key={item.method} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{paymentLabels[item.method] ?? item.method} <span className="text-xs text-muted-foreground">({item.count})</span></span><span className="font-semibold text-foreground">{formatPrice(item.total)}</span></div>)}{(report?.paymentBreakdown30 ?? []).filter((p) => p.total > 0).length === 0 && <p className="text-xs text-muted-foreground">Aucun encaissement.</p>}</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-card-soft"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Encaissements du jour</h2><p className="mt-1 text-xs text-muted-foreground">Répartition par moyen de paiement</p></div><CircleDollarSign className="h-5 w-5 text-primary" /></div><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentData} dataKey="total" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3}>{paymentData.map((entry, index) => <Cell key={entry.method} fill={paymentColors[index % paymentColors.length]} />)}</Pie><Tooltip formatter={(value) => [formatPrice(Number(value)), "Total"]} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{paymentData.map((item, index) => <div key={item.method} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{item.name}</span><span className="font-semibold text-foreground">{formatPrice(item.total)}</span></div>)}{paymentData.length === 0 && <p className="text-center text-sm text-muted-foreground">Aucun encaissement aujourd&apos;hui.</p>}</div></section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <section className="rounded-xl border border-border bg-card shadow-card-soft"><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-semibold text-foreground">Commandes récentes</h2><p className="mt-1 text-xs text-muted-foreground">Suivi des dernières ventes enregistrées</p></div><Link href="/admin/commandes" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Commande</th><th className="px-5 py-3 font-medium">Client</th><th className="px-5 py-3 font-medium">Provenance</th><th className="px-5 py-3 font-medium">Montant</th><th className="px-5 py-3 font-medium">Statut</th></tr></thead><tbody className="divide-y divide-border">{recentOrders.map((order) => <tr key={order.id} className="hover:bg-muted/40"><td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">{order.orderNumber}</td><td className="px-5 py-3 text-muted-foreground">{order.customerName || "Client"}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceLabels[order.source]?.className || "bg-gray-100 text-gray-600"}`}>{sourceLabels[order.source]?.label || order.source || "En ligne"}</span></td><td className="whitespace-nowrap px-5 py-3 font-semibold text-foreground">{formatPrice(order.total)}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span></td></tr>)}{!loading && recentOrders.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune commande récente.</td></tr>}</tbody></table></div></section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-card-soft"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Produits les plus vendus</h2><p className="mt-1 text-xs text-muted-foreground">Sur les sept derniers jours</p></div><BarChart3 className="h-5 w-5 text-primary" /></div><div className="mt-5 space-y-4">{(report?.topProducts ?? []).map((product, index) => <div key={product.name}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-foreground">{product.name}</span><span className="text-muted-foreground">{product.quantity} unités</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(8, product.quantity * 12))}%` }} /></div></div>)}{!loading && !report?.topProducts.length && <p className="text-sm text-muted-foreground">Pas encore de ventes.</p>}</div></section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card-soft"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Dernières pré-commandes</h2><p className="mt-1 text-xs text-muted-foreground">Pré-commandes les plus récentes</p></div><Link href="/admin/reservations" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="mt-4 divide-y divide-border">{reservations.slice(0, 5).map((res) => <div key={res.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-foreground">{res.client}</p><p className="text-xs text-muted-foreground">{res.type} · {res.date} à {res.heure || "-"}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceLabels[res.source]?.className || "bg-gray-100 text-gray-600"}`}>{sourceLabels[res.source]?.label || res.source || "En ligne"}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{res.status}</span></div></div>)}{!loading && reservations.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune pré-commande pour le moment.</p>}</div></section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card-soft"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Actions rapides</h2><p className="mt-1 text-xs text-muted-foreground">Accéder aux opérations courantes</p></div><CheckCircle2 className="h-5 w-5 text-primary" /></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><Link href="/admin/ventes" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"><ShoppingCart className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">Nouvelle vente</span></Link><Link href="/admin/produits" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"><Plus className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">Produit</span></Link><Link href="/admin/stock" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"><ClipboardList className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">Stock</span></Link><Link href="/admin/production" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"><Factory className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">Production</span></Link><Link href="/admin/rapports" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"><Package className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">Rapports</span></Link></div></section>
    </div>
  )
}
