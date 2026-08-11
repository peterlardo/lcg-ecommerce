"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, ChevronDown, Clock, Filter, Minus, Plus, RefreshCw, Search, Warehouse } from "lucide-react"
import { formatPrice } from "@/lib/utils"

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
}

interface StockPayload {
  summary: { totalVariants: number; totalUnits: number; lowStock: number; outOfStock: number }
  variants: StockVariant[]
  movements: StockMovement[]
}

const movementOptions = [
  { value: "IN", label: "Entrée", icon: Plus, color: "text-green-700 bg-green-100" },
  { value: "OUT", label: "Sortie", icon: Minus, color: "text-red-700 bg-red-100" },
  { value: "PRODUCTION", label: "Production", icon: Plus, color: "text-blue-700 bg-blue-100" },
  { value: "LOSS", label: "Perte / fonte", icon: Minus, color: "text-orange-700 bg-orange-100" },
  { value: "ADJUSTMENT_IN", label: "Ajustement +", icon: Plus, color: "text-emerald-700 bg-emerald-100" },
  { value: "ADJUSTMENT_OUT", label: "Ajustement -", icon: Minus, color: "text-rose-700 bg-rose-100" },
]

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export default function StockPage() {
  const [payload, setPayload] = useState<StockPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [editingVariant, setEditingVariant] = useState<string | null>(null)
  const [movementType, setMovementType] = useState("IN")
  const [movementQty, setMovementQty] = useState(1)
  const [movementReason, setMovementReason] = useState("")
  const [movementReference, setMovementReference] = useState("")
  const [stockTarget, setStockTarget] = useState<number | null>(null)
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lowStockThreshold")
      return saved ? Number(saved) : 10
    }
    return 10
  })

  const updateThreshold = (value: number) => {
    const clamped = Math.max(1, value)
    setLowStockThreshold(clamped)
    localStorage.setItem("lowStockThreshold", String(clamped))
  }

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/stock")
      if (!res.ok) throw new Error("Impossible de charger le stock")
      setPayload(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const variant of payload?.variants ?? []) {
      if (variant.categorySlug) map.set(variant.categorySlug, variant.categoryName)
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }))
  }, [payload])

  const filteredVariants = (payload?.variants ?? []).map((variant) => ({
    ...variant,
    lowThreshold: lowStockThreshold,
  })).filter((variant) => {
    const term = search.toLowerCase()
    const matchesSearch = `${variant.productName} ${variant.format}`.toLowerCase().includes(term)
    const matchesCategory = selectedCategory === "all" || variant.categorySlug === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleMovement = async (variantId: string) => {
    setError("")
    const variant = payload?.variants.find((item) => item.variantId === variantId)
    const directDelta = variant && stockTarget !== null ? stockTarget - variant.stock : null
    if (directDelta === 0) {
      setEditingVariant(null)
      setStockTarget(null)
      return
    }
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        type: directDelta !== null ? (directDelta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT") : movementType,
        quantity: directDelta !== null ? Math.abs(directDelta) : movementQty,
        reason: movementReason,
        reference: movementReference,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error || "Mouvement refusé")
      return
    }

    setEditingVariant(null)
    setStockTarget(null)
    setMovementQty(1)
    setMovementReason("")
    setMovementReference("")
    await load()
  }

  const summary = useMemo(() => {
    const variants = payload?.variants ?? []
    const withThreshold = variants.map((v) => ({ ...v, lowThreshold: lowStockThreshold }))
    return {
      totalVariants: withThreshold.length,
      totalUnits: withThreshold.reduce((sum, item) => sum + item.stock, 0),
      lowStock: withThreshold.filter((item) => item.stock > 0 && item.stock < item.lowThreshold).length,
      outOfStock: withThreshold.filter((item) => item.stock <= 0).length,
    }
  }, [payload, lowStockThreshold])
  const editingStock = payload?.variants.find((variant) => variant.variantId === editingVariant)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des stocks</h1>
          <p className="mt-1 text-sm text-gray-500">Entrées, sorties, production, pertes et seuils critiques.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Variantes suivies</p><p className="mt-1 text-xl font-bold text-gray-900">{summary.totalVariants}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Unités disponibles</p><p className="mt-1 text-xl font-bold text-gray-900">{summary.totalUnits}</p></div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4"><p className="text-xs font-medium text-yellow-700">Stock faible</p><p className="mt-1 text-xl font-bold text-yellow-800">{summary.lowStock}</p></div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4"><p className="text-xs font-medium text-red-700">Rupture</p><p className="mt-1 text-xl font-bold text-red-800">{summary.outOfStock}</p></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-gray-700">Seuil d'alerte stock bas :</span>
          <input type="number" min={1} value={lowStockThreshold} onChange={(e) => updateThreshold(Number(e.target.value) || 1)} className="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-sm font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
          <span className="text-xs text-gray-500">unités</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit ou format..." className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
            <option value="all">Toutes catégories</option>
            {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Produit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Format</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Prix</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Mouvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Chargement...</td></tr>}
              {!loading && filteredVariants.map((variant) => {
                const isLow = variant.stock > 0 && variant.stock < variant.lowThreshold
                const isOut = variant.stock <= 0
                const isEditing = editingVariant === variant.variantId
                return (
                  <tr key={variant.variantId} className={isOut ? "bg-red-50/40" : isLow ? "bg-yellow-50/40" : "hover:bg-gray-50/50"}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2">{(isLow || isOut) && <AlertCircle className={`h-4 w-4 ${isOut ? "text-red-500" : "text-yellow-500"}`} />}<span className="text-sm font-medium text-gray-900">{variant.productName}</span></div><p className="text-xs text-gray-500">{variant.categoryName}</p></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{variant.format}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(variant.price)}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${isOut ? "text-red-600" : isLow ? "text-yellow-700" : "text-gray-900"}`}>{variant.stock} {variant.unit ?? ""} <button type="button" onClick={() => { setEditingVariant(variant.variantId); setStockTarget(variant.stock) }} className="ml-2 rounded-md border border-primary-300 px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50">Modifier</button></td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <input type="number" min={0} value={stockTarget ?? variant.stock} onChange={(e) => setStockTarget(Math.max(0, Number(e.target.value) || 0))} aria-label="Nouveau stock" className="w-20 rounded-lg border border-primary-300 px-2 py-1.5 text-center text-xs" /><select value={movementType} onChange={(e) => setMovementType(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"><option value="IN">Entrée</option><option value="OUT">Sortie</option><option value="PRODUCTION">Production</option><option value="LOSS">Perte / fonte</option><option value="ADJUSTMENT_IN">Ajustement +</option><option value="ADJUSTMENT_OUT">Ajustement -</option></select>
                          <input type="number" min={1} value={movementQty} onChange={(e) => setMovementQty(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-xs" />
                          <input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder="Motif" className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                          <input value={movementReference} onChange={(e) => setMovementReference(e.target.value)} placeholder="Réf." className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                          <button onClick={() => handleMovement(variant.variantId)} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90">OK</button>
                          <button onClick={() => setEditingVariant(null)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">Annuler</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
              {!loading && filteredVariants.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500"><Warehouse className="mx-auto mb-2 h-9 w-9 text-gray-300" />Aucune variante trouvée</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Derniers mouvements</h3>
        <div className="space-y-2">
          {(payload?.movements ?? []).slice(0, 8).map((movement) => {
            const option = movementOptions.find((item) => item.value === movement.type) ?? movementOptions[0]
            const Icon = option.icon
            return <div key={movement.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-2.5 text-sm"><div className="flex min-w-0 items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${option.color}`}><Icon className="h-3.5 w-3.5" /></span><span className="truncate font-medium text-gray-700">{movement.productName} ({movement.format})</span></div><div className="flex shrink-0 items-center gap-3 text-xs text-gray-500"><span>{movement.type}</span><span className="font-semibold">{movement.quantity}</span><span className="hidden sm:inline">{movement.reference || movement.reason}</span><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDate(movement.createdAt)}</span></div></div>
          })}
          {!loading && (payload?.movements ?? []).length === 0 && <p className="text-sm text-gray-500">Aucun mouvement enregistré.</p>}
        </div>
      </div>

      {editingStock && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="modifier-stock-title">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4"><div><h2 id="modifier-stock-title" className="text-lg font-semibold text-gray-900">Modifier le stock</h2><p className="mt-1 text-sm text-gray-500">{editingStock.productName} · {editingStock.format}</p></div><button type="button" onClick={() => { setEditingVariant(null); setStockTarget(null) }} className="text-sm text-gray-500 hover:text-gray-900">Fermer</button></div>
          <label className="mt-5 block text-sm font-medium text-gray-700">Nouvelle quantité</label>
          <input autoFocus type="number" min={0} value={stockTarget ?? editingStock.stock} onChange={(event) => setStockTarget(Math.max(0, Number(event.target.value) || 0))} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30" />
          <label className="mt-4 block text-sm font-medium text-gray-700">Motif (facultatif)</label>
          <input value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="Ex. Réception de marchandises" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30" />
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => { setEditingVariant(null); setStockTarget(null); setMovementReason("") }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button><button type="button" onClick={() => handleMovement(editingStock.variantId)} className="min-w-[190px] rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700">Valider la modification</button></div>
        </div>
      </div>}
    </div>
  )
}












