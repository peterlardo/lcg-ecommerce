"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertCircle, Banknote, BarChart3, CalendarRange, LockKeyhole, Package, RefreshCw, ShieldCheck, Truck, Wifi } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ReportPayload {
  summary: {
    todayRevenue: number
    todayOrders: number
    stockUnits: number
    lowStock: number
    outOfStock: number
    pendingReservations: number
    deliveriesInProgress: number
    cashExpected: number
  }
  stockAlerts: { variantId: string; productName: string; format: string; stock: number }[]
  reservations: { id: string; client: string; type: string; date: string; heure: string; status: string }[]
  deliveries: { id: string; orderNumber: string; customer: string; status: string; address: string }[]
}

const quickLinks = [
  { href: "/admin/ventes", label: "Ventes", icon: Banknote },
  { href: "/admin/stock", label: "Stock", icon: Package },
  { href: "/admin/distribution", label: "Distribution", icon: Truck },
  { href: "/admin/rapports", label: "Rapports", icon: BarChart3 },
]

export default function ControleDistantPage() {
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState("")

  const load = async () => {
    setError("")
    try {
      const res = await fetch("/api/reports")
      if (!res.ok) throw new Error("Impossible de charger le contrôle distant")
      setData(await res.json())
      setLastRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const summary = data?.summary
  const criticalAlerts = [
    ...(summary?.outOfStock ? [`${summary.outOfStock} rupture(s) de stock`] : []),
    ...(summary?.lowStock ? [`${summary.lowStock} stock(s) faible(s)`] : []),
    ...(summary?.pendingReservations ? [`${summary.pendingReservations} pré-commande(s) en attente`] : []),
    ...(summary?.deliveriesInProgress ? [`${summary.deliveriesInProgress} livraison(s) en cours`] : []),
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Contrôle distant</h1>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">Supervision direction des ventes, stocks, caisse et distribution.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:text-sm">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error &&       <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:px-4 sm:py-3 sm:text-sm">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-green-700"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-wider">Accès sécurisé</p></div>
          <p className="mt-2 text-xs text-green-800 sm:text-sm">Session protégée par authentification et rôles admin.</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-blue-700"><Wifi className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-wider">État supervision</p></div>
          <p className="mt-2 text-xs text-blue-800 sm:text-sm">{loading ? "Synchronisation..." : `Dernière actualisation ${lastRefresh || "-"}`}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <div className="flex items-center gap-2 text-gray-700"><LockKeyhole className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-wider">Périmètre</p></div>
          <p className="mt-2 text-xs text-gray-600 sm:text-sm">Lecture direction sur les opérations critiques.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">CA aujourd'hui</p><p className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{formatPrice(summary?.todayRevenue ?? 0)}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Commandes aujourd'hui</p><p className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{summary?.todayOrders ?? 0}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Stock total</p><p className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{summary?.stockUnits ?? 0}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Espèces attendues</p><p className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{formatPrice(summary?.cashExpected ?? 0)}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold text-gray-900 sm:text-sm"><AlertCircle className="h-4 w-4" /> Alertes direction</h2>
          <div className="space-y-2">
            {criticalAlerts.map((alert) => <div key={alert} className="rounded-lg bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-800 sm:text-sm">{alert}</div>)}
            {criticalAlerts.length === 0 && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-800 sm:text-sm">Aucune alerte critique.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold text-gray-900 sm:text-sm"><Package className="h-4 w-4" /> Stocks à surveiller</h2>
          <div className="space-y-2">
            {(data?.stockAlerts ?? []).slice(0, 5).map((alert) => <div key={alert.variantId} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-xs sm:p-3 sm:text-sm"><div><p className="font-medium text-gray-800">{alert.productName}</p><p className="text-xs text-gray-500">{alert.format}</p></div><span className="font-semibold text-red-700">{alert.stock}</span></div>)}
            {(data?.stockAlerts ?? []).length === 0 && <p className="text-xs text-gray-500 sm:text-sm">Stocks sous contrôle.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold text-gray-900 sm:text-sm"><CalendarRange className="h-4 w-4" /> Pré-commandes à suivre</h2>
          <div className="space-y-2">
            {(data?.reservations ?? []).filter((item) => item.status === "PENDING").slice(0, 5).map((reservation) => <div key={reservation.id} className="rounded-lg bg-gray-50 p-2 text-xs sm:p-3 sm:text-sm"><p className="font-medium text-gray-800">{reservation.client}</p><p className="text-xs text-gray-500">{reservation.type} - {reservation.date} {reservation.heure}</p></div>)}
            {(data?.reservations ?? []).filter((item) => item.status === "PENDING").length === 0 && <p className="text-xs text-gray-500 sm:text-sm">Aucune pré-commande en attente.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
        <h2 className="mb-4 text-xs font-semibold text-gray-900 sm:text-sm">Accès rapides</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return <Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-xs font-semibold text-gray-800 hover:border-primary-300 hover:bg-primary-50 sm:p-4 sm:text-sm"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><Icon className="h-4 w-4" /></span>{link.label}</Link>
          })}
        </div>
      </section>
    </div>
  )
}
