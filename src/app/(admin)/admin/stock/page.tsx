"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Minus, Package, Plus, RefreshCw, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react"

interface StockVariant {
  variantId: string
  productName: string
  productImage: string | null
  categoryName: string
  categorySlug: string
  format: string
  price: number
  stock: number
  unit: string | null
  lowThreshold: number
  storageStocks?: {
    pointOfSaleId: string
    pointOfSaleName: string
    pointOfSaleCode: string
    quantity: number
  }[]
}

interface StockMovement {
  id: string
  variantId: string
  type: string
  quantity: number
  reason: string
  reference: string
  createdAt: string
  productName: string
  format: string
  pointOfSaleName?: string
  pointOfSaleCode?: string
}

interface StockLocation {
  id: string
  name: string
  code: string
  type: string
  totalUnits: number
  stockValue: number
  stocks: {
    variantId: string
    productName: string
    format: string
    quantity: number
    price: number
    unit: string | null
  }[]
}

interface StockPayload {
  summary: { totalVariants: number; totalUnits: number; lowStock: number; outOfStock: number }
  locations?: StockLocation[]
  variants: StockVariant[]
  movements: StockMovement[]
}

const movementOptions: Record<string, { label: string; icon: typeof Plus; color: string; sign: "in" | "out" }> = {
  IN: { label: "Entrée", icon: Plus, color: "text-green-700 bg-green-100", sign: "in" },
  OUT: { label: "Sortie", icon: Minus, color: "text-red-700 bg-red-100", sign: "out" },
  PRODUCTION: { label: "Production", icon: Plus, color: "text-blue-700 bg-blue-100", sign: "in" },
  SALE: { label: "Vente", icon: ShoppingCart, color: "text-purple-700 bg-purple-100", sign: "out" },
  LOSS: { label: "Perte / fonte", icon: Minus, color: "text-orange-700 bg-orange-100", sign: "out" },
  ADJUSTMENT_IN: { label: "Ajustement +", icon: Plus, color: "text-emerald-700 bg-emerald-100", sign: "in" },
  ADJUSTMENT_OUT: { label: "Ajustement -", icon: Minus, color: "text-rose-700 bg-rose-100", sign: "out" },
  TRANSFER_IN: { label: "Transfert entrant", icon: TrendingUp, color: "text-cyan-700 bg-cyan-100", sign: "in" },
  TRANSFER_OUT: { label: "Transfert sortant", icon: TrendingDown, color: "text-amber-700 bg-amber-100", sign: "out" },
  RETURN: { label: "Retour", icon: TrendingUp, color: "text-teal-700 bg-teal-100", sign: "in" },
  CANCEL_RESTOCK: { label: "Annulation", icon: TrendingUp, color: "text-indigo-700 bg-indigo-100", sign: "in" },
  RESERVATION: { label: "Réservation", icon: ShoppingCart, color: "text-violet-700 bg-violet-100", sign: "out" },
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export default function StockPage() {
  const [payload, setPayload] = useState<StockPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [lowStockThreshold] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lowStockThreshold")
      return saved ? Number(saved) : 10
    }
    return 10
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stock")
      if (!res.ok) throw new Error("Impossible de charger le stock")
      const body = await res.json()
      setPayload(body)
      setSelectedLocationId((current) => current || body.locations?.[0]?.id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/stock", { signal: controller.signal })
        if (!res.ok) throw new Error("Impossible de charger le stock")
        const body = await res.json()
        if (controller.signal.aborted) return
        setPayload(body)
        setSelectedLocationId((current) => current || body.locations?.[0]?.id || "")
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  const selectedLocation = useMemo(
    () => (payload?.locations ?? []).find((location) => location.id === selectedLocationId) ?? null,
    [payload, selectedLocationId]
  )

  const summary = useMemo(() => {
    const variants = payload?.variants ?? []
    return {
      totalVariants: variants.length,
      totalUnits: variants.reduce((sum, item) => sum + item.stock, 0),
      lowStock: variants.filter((item) => item.stock > 0 && item.stock < lowStockThreshold).length,
      outOfStock: variants.filter((item) => item.stock <= 0).length,
    }
  }, [payload, lowStockThreshold])

  const locationDashboard = useMemo(() => {
    if (!selectedLocationId || !payload) return null
    const movements = (payload.movements ?? []).filter(
      (m) => m.pointOfSaleCode && (payload.locations ?? []).find((l) => l.id === selectedLocationId && l.code === m.pointOfSaleCode)
    )

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const todayMovements = movements.filter((m) => new Date(m.createdAt) >= todayStart)
    const weekMovements = movements.filter((m) => new Date(m.createdAt) >= weekStart)
    const monthMovements = movements.filter((m) => new Date(m.createdAt) >= monthStart)

    const calcStats = (movs: StockMovement[]) => {
      let entries = 0
      let exits = 0
      let salesQty = 0
      let salesRevenue = 0
      for (const m of movs) {
        const opt = movementOptions[m.type]
        if (opt?.sign === "in") entries += m.quantity
        else exits += m.quantity
        if (m.type === "SALE" || m.type === "RESERVATION") {
          salesQty += m.quantity
          const variant = payload.variants.find((v) => v.variantId === m.variantId)
          if (variant) salesRevenue += m.quantity * variant.price
        }
      }
      return { entries, exits, salesQty, salesRevenue }
    }

    const today = calcStats(todayMovements)
    const week = calcStats(weekMovements)
    const month = calcStats(monthMovements)

    const recentByProduct = movements.slice(0, 20).reduce<Record<string, { productName: string; format: string; totalIn: number; totalOut: number }>>((acc, m) => {
      const key = m.variantId
      if (!acc[key]) acc[key] = { productName: m.productName, format: m.format, totalIn: 0, totalOut: 0 }
      const opt = movementOptions[m.type]
      if (opt?.sign === "in") acc[key].totalIn += m.quantity
      else acc[key].totalOut += m.quantity
      return acc
    }, {})

    return { today, week, month, recentByProduct, totalMovements: movements.length }
  }, [selectedLocationId, payload])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion des stocks</h1>
          <p className="mt-1 text-sm text-gray-500">{selectedLocation ? `${selectedLocation.name} — ${selectedLocation.code}` : "Tous les emplacements"}</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Chargement des stocks...</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(payload?.locations ?? []).map((location) => {
          const isSelected = selectedLocationId === location.id
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => setSelectedLocationId(location.id)}
              className={`rounded-xl border p-4 text-left transition-all ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-gray-900"}`}>{location.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{location.code}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${location.type === "VEHICLE" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {location.type === "VEHICLE" ? "Stock Mobile" : "Comptoir"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-gray-500">Unités</span><p className="font-bold text-gray-900">{location.totalUnits}</p></div>
                <div><span className="text-xs text-gray-500">Valeur</span><p className="font-bold text-gray-900">{location.stockValue.toLocaleString("fr-FR")} FCFA</p></div>
              </div>
              {location.stocks.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
                  {location.stocks.map((s) => (
                    <div key={s.variantId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 truncate">{s.productName} ({s.format})</span>
                      <span className={`ml-2 font-semibold shrink-0 ${s.quantity <= 0 ? "text-red-600" : s.quantity < 10 ? "text-yellow-700" : "text-gray-900"}`}>{s.quantity} {s.unit ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {locationDashboard && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Tableau de bord — {selectedLocation?.name}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 uppercase">Aujourd&apos;hui</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-green-600">Entrées</span><p className="font-bold text-gray-900">{locationDashboard.today.entries}</p></div>
                  <div><span className="text-red-600">Sorties</span><p className="font-bold text-gray-900">{locationDashboard.today.exits}</p></div>
                  <div><span className="text-purple-600">Ventes</span><p className="font-bold text-gray-900">{locationDashboard.today.salesQty}</p></div>
                  <div><span className="text-gray-600">CA</span><p className="font-bold text-gray-900">{locationDashboard.today.salesRevenue.toLocaleString("fr-FR")} F</p></div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 uppercase">Cette semaine</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-green-600">Entrées</span><p className="font-bold text-gray-900">{locationDashboard.week.entries}</p></div>
                  <div><span className="text-red-600">Sorties</span><p className="font-bold text-gray-900">{locationDashboard.week.exits}</p></div>
                  <div><span className="text-purple-600">Ventes</span><p className="font-bold text-gray-900">{locationDashboard.week.salesQty}</p></div>
                  <div><span className="text-gray-600">CA</span><p className="font-bold text-gray-900">{locationDashboard.week.salesRevenue.toLocaleString("fr-FR")} F</p></div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[11px] font-medium text-gray-500 uppercase">Ce mois</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-green-600">Entrées</span><p className="font-bold text-gray-900">{locationDashboard.month.entries}</p></div>
                  <div><span className="text-red-600">Sorties</span><p className="font-bold text-gray-900">{locationDashboard.month.exits}</p></div>
                  <div><span className="text-purple-600">Ventes</span><p className="font-bold text-gray-900">{locationDashboard.month.salesQty}</p></div>
                  <div><span className="text-gray-600">CA</span><p className="font-bold text-gray-900">{locationDashboard.month.salesRevenue.toLocaleString("fr-FR")} F</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Écoulement par produit (20 derniers mouvements)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase text-gray-500">
                    <th className="pb-2 pr-4">Produit</th>
                    <th className="pb-2 pr-4">Format</th>
                    <th className="pb-2 pr-4 text-right">Entrées</th>
                    <th className="pb-2 pr-4 text-right">Sorties</th>
                    <th className="pb-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.values(locationDashboard.recentByProduct).map((row) => {
                    const net = row.totalIn - row.totalOut
                    return (
                      <tr key={`${row.productName}-${row.format}`}>
                        <td className="py-1.5 pr-4 font-medium text-gray-900">{row.productName}</td>
                        <td className="py-1.5 pr-4 text-gray-600">{row.format}</td>
                        <td className="py-1.5 pr-4 text-right text-green-600 font-semibold">{row.totalIn > 0 ? `+${row.totalIn}` : "—"}</td>
                        <td className="py-1.5 pr-4 text-right text-red-600 font-semibold">{row.totalOut > 0 ? `-${row.totalOut}` : "—"}</td>
                        <td className={`py-1.5 text-right font-bold ${net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-gray-500"}`}>{net > 0 ? `+${net}` : net}</td>
                      </tr>
                    )
                  })}
                  {Object.keys(locationDashboard.recentByProduct).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-400">Aucun mouvement enregistré pour cet emplacement</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Variantes suivies</p><p className="mt-1 text-lg sm:text-xl font-bold text-gray-900">{summary.totalVariants}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Unités totales</p><p className="mt-1 text-lg sm:text-xl font-bold text-gray-900">{summary.totalUnits}</p></div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-3 sm:p-4"><p className="text-xs font-medium text-yellow-700">Stock faible</p><p className="mt-1 text-lg sm:text-xl font-bold text-yellow-800">{summary.lowStock}</p></div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 sm:p-4"><p className="text-xs font-medium text-red-700">Rupture</p><p className="mt-1 text-lg sm:text-xl font-bold text-red-800">{summary.outOfStock}</p></div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Derniers mouvements{selectedLocation ? ` — ${selectedLocation.name}` : ""}</h3>
        <div className="space-y-2">
          {(payload?.movements ?? [])
            .filter((m) => !selectedLocationId || m.pointOfSaleName || (payload?.locations ?? []).find((l) => l.id === selectedLocationId && l.code === m.pointOfSaleCode))
            .slice(0, 8)
            .map((movement) => {
              const opt = movementOptions[movement.type]
              const Icon = opt?.icon ?? Package
              return (
                <div key={movement.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${opt?.color ?? "bg-gray-100 text-gray-700"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate font-medium text-gray-700">{movement.productName} ({movement.format})</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-gray-500">
                    <span>{opt?.label ?? movement.type}</span>
                    <span className="font-semibold">{movement.quantity}</span>
                    {movement.pointOfSaleName && <span className="hidden md:inline text-gray-400">{movement.pointOfSaleName}</span>}
                    <span className="hidden sm:inline">{movement.reference || movement.reason}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />{formatDate(movement.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          {!loading && (payload?.movements ?? []).length === 0 && <p className="text-sm text-gray-500">Aucun mouvement enregistré.</p>}
        </div>
      </div>
    </div>
  )
}
