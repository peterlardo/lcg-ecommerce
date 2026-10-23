"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Boxes, CheckCircle2, Factory, FileText, PackagePlus, RefreshCw, Search, Trash2, TrendingUp, XCircle } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface Lot {
  id: string
  lotNumber: string
  variantId: string
  initialQuantity: number
  remainingQuantity: number
  productionDate: string
  expiryDate: string | null
  status: string
  notes: string | null
  createdAt: string
  variant: { product: { name: string }; format: string }
  createdBy?: { name: string } | null
  destination?: { id: string; name: string; code: string } | null
  allocations?: LotAllocation[]
}

interface LotAllocation {
  id: string
  quantity: number
  type: string
  reference: string | null
  createdAt: string
  pointOfSale: { name: string; code: string } | null
}

interface LotSummary {
  _sum: { remainingQuantity: number | null }
  _count: number
}

/** Totaux calculés par le serveur sur l'ensemble des lots (indépendants des filtres de la liste). */
interface LotTotals {
  lots: number
  produced: number
  activeLots: number
  activeRemaining: number
}

interface LotsPayload {
  lots: Lot[]
  summary: LotSummary
  totals?: LotTotals
  truncated?: boolean
}

interface ReportPayload {
  productionByDay: { name: string; quantity: number }[]
  stockAlerts: { variantId: string; productName: string; format: string; stock: number; categoryName: string }[]
}

interface StockVariant {
  variantId: string
  productName: string
  format: string
  stock: number
  unit: string | null
  storageStocks?: { pointOfSaleId: string; quantity: number }[]
}

/** Cohérence d'un format entre le stock des points de vente, l'ancien stock global et le reste des lots. */
interface CoherenceRow {
  variantId: string
  productName: string
  format: string
  globalStock: number
  locationStock: number
  activeLots: number
  expiredLots: number
  uncovered: number
  excess: number
  globalGap: number
  unlocated: number
}

interface CoherencePayload {
  rows: CoherenceRow[]
  summary: { unlocatedFormats: number; unlocatedUnits: number; uncoveredFormats: number; uncoveredUnits: number; globalGapFormats: number; excessFormats: number; excessUnits: number; expiredFormats: number; expiredUnits: number; fixable: number }
}

interface PointOfSaleOption {
  id: string
  name: string
  code: string
  isActive: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: "Actif", color: "text-green-700 bg-green-100", icon: CheckCircle2 },
  EXHAUSTED: { label: "Épuisé", color: "text-gray-600 bg-gray-100", icon: XCircle },
  EXPIRED: { label: "Expiré", color: "text-red-700 bg-red-100", icon: AlertCircle },
}

const ALLOC_TYPE: Record<string, string> = { SALE: "Vente", TRANSFER: "Transfert", LOSS: "Perte", ADJUSTMENT: "Ajustement" }

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("fr-FR")
}

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Saisie d'une quantité : toujours un entier, jamais sous le minimum. */
function wholeQuantity(value: string, min: number) {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? Math.max(min, n) : min
}

/** Stock réel d'un format : somme de ses emplacements (même règle que les rapports), à défaut l'ancien stock global. */
function totalStock(v: StockVariant) {
  return v.storageStocks && v.storageStocks.length > 0 ? v.storageStocks.reduce((s, x) => s + x.quantity, 0) : v.stock
}

function stockAt(v: StockVariant | undefined, pointOfSaleId: string) {
  return v?.storageStocks?.find((s) => s.pointOfSaleId === pointOfSaleId)?.quantity ?? 0
}

/** Lot encore actif alors que sa date d'expiration est passée. */
function isPastExpiry(lot: Lot) {
  return lot.status === "ACTIVE" && !!lot.expiryDate && new Date(lot.expiryDate).getTime() < new Date(todayInput()).getTime()
}

export default function ProductionPage() {
  const [lotsData, setLotsData] = useState<LotsPayload | null>(null)
  const [reports, setReports] = useState<ReportPayload | null>(null)
  const [stockVariants, setStockVariants] = useState<StockVariant[]>([])
  const [points, setPoints] = useState<PointOfSaleOption[]>([])
  const [coherence, setCoherence] = useState<CoherencePayload | null>(null)
  const [regularising, setRegularising] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [warnings, setWarnings] = useState<string[]>([])

  const [variantId, setVariantId] = useState("")
  const [destinationPointOfSaleId, setDestinationPointOfSaleId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [expiryDate, setExpiryDate] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [filterStatus, setFilterStatus] = useState<string>("")
  const [filterVariantId, setFilterVariantId] = useState<string>("")
  const [filterPointOfSaleId, setFilterPointOfSaleId] = useState<string>("")
  const [searchLot, setSearchLot] = useState("")
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null)
  const [tab, setTab] = useState<"lots" | "alerts" | "coherence">("lots")
  const [formMode, setFormMode] = useState<"single" | "batch">("single")
  const [batchMode, setBatchMode] = useState<"uniform" | "custom">("uniform")
  const [batchQty, setBatchQty] = useState(1)
  const [batchQtys, setBatchQtys] = useState<Record<string, number>>({})
  // Formats exclus de la production groupée à quantité unique (tous inclus par défaut)
  const [batchExcluded, setBatchExcluded] = useState<Record<string, boolean>>({})
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const fail = (message: string) => { setSuccess(""); setError(message) }
  const succeed = (message: string) => { setError(""); setSuccess(message) }

  // Un seul chargement pour l'ouverture, le bouton « Actualiser » et l'après-enregistrement.
  // Les lots sont indispensables ; le graphique, le stock et les points de vente sont chargés à part :
  // si l'un d'eux est refusé au profil connecté, le reste de l'écran s'affiche quand même.
  const loadRef = useRef<(signal?: AbortSignal) => Promise<void>>(async () => {})
  const load = () => loadRef.current()

  useEffect(() => {
    const controller = new AbortController()
    const run = async (signal?: AbortSignal) => {
      const get = async <T,>(url: string): Promise<T | null> => {
        try {
          const res = await fetch(url, { signal })
          return res.ok ? ((await res.json()) as T) : null
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err
          return null
        }
      }
      try {
        const [lotsJson, reportJson, stockJson, pointsJson, coherenceJson] = await Promise.all([
          get<LotsPayload>("/api/lots" + (filterStatus ? `?status=${filterStatus}` : "")),
          get<ReportPayload>("/api/reports"),
          get<{ variants?: StockVariant[] }>("/api/stock"),
          get<PointOfSaleOption[]>("/api/points-de-vente/list"),
          get<CoherencePayload>("/api/lots/coherence"),
        ])
        if (signal?.aborted) return

        const notes: string[] = []
        if (!reportJson) notes.push("Le graphique de production et les alertes de stock n'ont pas pu être chargés.")
        if (!stockJson) notes.push("La liste des produits n'a pas pu être chargée : la création de lots est indisponible.")
        if (!pointsJson) notes.push("La liste des points de vente n'a pas pu être chargée : la création de lots est indisponible.")
        setWarnings(notes)

        if (!lotsJson) {
          setError("Les lots n'ont pas pu être chargés. Vérifiez votre connexion ou vos droits d'accès, puis actualisez.")
        } else {
          setError("")
          setLotsData(lotsJson)
        }
        setReports(reportJson)
        setCoherence(coherenceJson)
        const variants = stockJson?.variants ?? []
        const activePoints = (pointsJson ?? []).filter((p) => p.isActive)
        setStockVariants(variants)
        setPoints(pointsJson ?? [])
        // Valeurs par défaut des listes : le premier format, et le premier point de vente ACTIF
        setVariantId((current) => (variants.some((v) => v.variantId === current) ? current : variants[0]?.variantId ?? ""))
        setDestinationPointOfSaleId((current) => (activePoints.some((p) => p.id === current) ? current : activePoints[0]?.id ?? ""))
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    }
    loadRef.current = run
    void run(controller.signal)
    return () => controller.abort()
  }, [filterStatus])

  const activePoints = useMemo(() => points.filter((p) => p.isActive), [points])

  // Points de vente proposés dans le filtre : les actifs, plus ceux (même désactivés depuis) qui ont reçu un lot
  const filterPoints = useMemo(() => {
    const list = activePoints.map((p) => ({ id: p.id, name: p.name }))
    for (const lot of lotsData?.lots ?? []) {
      if (lot.destination && !list.some((p) => p.id === lot.destination!.id)) list.push({ id: lot.destination.id, name: lot.destination.name })
    }
    return list
  }, [activePoints, lotsData])

  // Un filtre qui ne figure plus dans sa liste ne doit pas rester appliqué sans être visible
  const posFilter = filterPoints.some((p) => p.id === filterPointOfSaleId) ? filterPointOfSaleId : ""

  const filteredLots = useMemo(() => {
    const lots = lotsData?.lots ?? []
    const q = searchLot.trim().toLowerCase()
    return lots.filter((l) =>
      (!filterVariantId || l.variantId === filterVariantId) &&
      (!posFilter || l.destination?.id === posFilter) &&
      (!q ||
        l.lotNumber.toLowerCase().includes(q) ||
        l.variant.product.name.toLowerCase().includes(q) ||
        l.variant.format.toLowerCase().includes(q))
    )
  }, [lotsData, searchLot, filterVariantId, posFilter])

  // Les quatre cartes du haut décrivent toujours l'ensemble des lots, quels que soient les filtres de la liste
  const totals: LotTotals = lotsData?.totals ?? {
    lots: (lotsData?.lots ?? []).length,
    produced: (lotsData?.lots ?? []).reduce((s, l) => s + l.initialQuantity, 0),
    activeLots: lotsData?.summary?._count ?? 0,
    activeRemaining: lotsData?.summary?._sum?.remainingQuantity ?? 0,
  }
  const hasFilter = !!(filterStatus || filterVariantId || posFilter || searchLot.trim())
  const selectedVariant = stockVariants.find((v) => v.variantId === variantId)
  const selectedPoint = activePoints.find((point) => point.id === destinationPointOfSaleId)
  const canProduce = !loading && stockVariants.length > 0 && !!selectedPoint
  const batchEntries = stockVariants
    .map((v) => ({
      variantId: v.variantId,
      quantity: batchMode === "uniform" ? (batchExcluded[v.variantId] ? 0 : batchQty) : (batchQtys[v.variantId] ?? 0),
    }))
    .filter((x) => x.quantity > 0)
  const batchTotal = batchEntries.reduce((s, x) => s + x.quantity, 0)

  const switchFormMode = (mode: "single" | "batch") => {
    if (mode === formMode) return
    // La date d'expiration et la note d'un formulaire ne doivent pas suivre dans l'autre
    setExpiryDate("")
    setNote("")
    setFormMode(mode)
  }

  const submitProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPoint || !variantId) return
    setError("")
    setSuccess("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          pointOfSaleId: selectedPoint.id,
          quantity,
          expiryDate: expiryDate || null,
          notes: note || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        fail(body?.error ?? "Erreur lors de la création du lot")
        return
      }

      const body = await res.json()
      setQuantity(1)
      setExpiryDate("")
      setNote("")
      await load()
      succeed(`Lot ${body.lot.lotNumber} créé avec succès${body.destination?.name ? ` pour ${body.destination.name}` : ""}`)
    } finally {
      setSubmitting(false)
    }
  }

  const submitBatchProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPoint) return
    setError("")
    setSuccess("")

    if (batchEntries.length === 0) {
      fail("Renseignez au moins une quantité à produire")
      return
    }
    if (!confirm(`Créer ${batchEntries.length} lot(s), soit ${batchTotal} unité(s) au total, pour ${selectedPoint.name} ?`)) return

    setBatchSubmitting(true)
    try {
      const res = await fetch("/api/lots/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: batchEntries,
          pointOfSaleId: selectedPoint.id,
          expiryDate: expiryDate || null,
          notes: note || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        fail(body?.error ?? "Erreur lors de la production groupée")
        return
      }

      const body = await res.json()
      setBatchQty(1)
      setBatchQtys({})
      setBatchExcluded({})
      setExpiryDate("")
      setNote("")
      await load()
      succeed(`${body.count} lot(s) créé(s) avec succès pour ${selectedPoint.name}`)
    } finally {
      setBatchSubmitting(false)
    }
  }

  // Seuls les lots épuisés ou expirés se suppriment (même règle côté serveur)
  const deleteLot = async (lot: Lot) => {
    if (lot.status !== "EXHAUSTED" && lot.status !== "EXPIRED") return
    const message = lot.status === "EXPIRED"
      ? `Supprimer le lot expiré ${lot.lotNumber} ?\n\nLe stock des points de vente ne change pas : si des produits de ce lot ont été jetés, sortez-les aussi du stock par une perte. Les ventes et les mouvements de stock sont conservés.`
      : `Supprimer le lot épuisé ${lot.lotNumber} ?\n\nSon historique d'allocations sera effacé. Les ventes et les mouvements de stock sont conservés.`
    if (!confirm(message)) return
    setError("")
    setSuccess("")
    const res = await fetch(`/api/lots/${lot.id}`, { method: "DELETE" })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      fail(body?.error ?? "Suppression impossible")
      return
    }
    setSelectedLot(null)
    await load()
    succeed(`Lot ${lot.lotNumber} supprimé`)
  }

  const regularise = async () => {
    const sum = coherence?.summary
    if (!sum || sum.fixable === 0) return
    const lines = [
      sum.uncoveredFormats > 0 ? `- créer ${sum.uncoveredFormats} lot(s) pour couvrir ${sum.uncoveredUnits} unité(s) présentes sans lot` : "",
      sum.globalGapFormats > 0 ? `- réaligner l'ancien stock global de ${sum.globalGapFormats} format(s) sur le stock des points de vente` : "",
    ].filter(Boolean)
    if (!confirm(`Régulariser le stock ?\n${lines.join("\n")}\n\nAucune quantité ne change dans les points de vente.`)) return
    setError("")
    setSuccess("")
    setRegularising(true)
    try {
      const res = await fetch("/api/lots/coherence", { method: "POST" })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        fail(res.status === 403 ? "La régularisation est réservée à l'administrateur" : body?.error ?? "Régularisation impossible")
        return
      }
      await load()
      succeed(`Régularisation faite : ${body.createdLots.length} lot(s) créé(s), stock global réaligné sur ${body.syncedFormats} format(s)`)
    } finally {
      setRegularising(false)
    }
  }

  // Stock hors point de vente d'un format : le placer au Comptoir LCG, ou le retirer s'il n'existe pas.
  const handleUnlocated = async (row: CoherenceRow, action: "placer" | "retirer") => {
    const question = action === "placer"
      ? `Placer ${row.unlocated} unité(s) de « ${row.productName} · ${row.format} » au Comptoir LCG ?\nElles deviennent vendables en caisse.`
      : `Retirer ${row.unlocated} unité(s) de « ${row.productName} · ${row.format} » du stock ?\nÀ faire seulement si ce stock n'existe pas réellement.`
    if (!confirm(question)) return
    setError("")
    setSuccess("")
    setRegularising(true)
    try {
      const res = await fetch("/api/stock/hors-point-de-vente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: row.variantId, action }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        fail(res.status === 403 ? "Action réservée à l'administrateur" : body?.error ?? "Action impossible")
        return
      }
      await load()
      succeed(action === "placer" ? `${body.placed} unité(s) placée(s) au ${body.pointOfSale}` : `${body.dropped} unité(s) retirée(s) du stock`)
    } finally {
      setRegularising(false)
    }
  }

  const viewLot = async (lot: Lot) => {
    try {
      const res = await fetch(`/api/lots/${lot.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      // la destination vient de la liste : le détail du lot ne la renvoie pas
      setSelectedLot({ ...data.lot, destination: data.lot.destination ?? lot.destination ?? null })
    } catch {
      fail(`Le détail du lot ${lot.lotNumber} n'a pas pu être chargé`)
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 sm:py-2 sm:text-sm"
  const destinationSelect = (
    <label className="block text-xs font-medium text-gray-700 sm:text-sm">
      Point de vente de destination
      <select value={destinationPointOfSaleId} onChange={(e) => setDestinationPointOfSaleId(e.target.value)} className={`${inputClass} bg-white`}>
        {activePoints.length === 0 && <option value="">Aucun point de vente actif</option>}
        {activePoints.map((point) => <option key={point.id} value={point.id}>{point.name} ({point.code})</option>)}
      </select>
    </label>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Production & Lots</h1>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">Gestion des lots de production, traçabilité et suivi FIFO.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => { const { generateLotDocumentationPDF } = await import("@/lib/lot-doc-pdf"); generateLotDocumentationPDF().save("Documentation-Lot-Production-Traceabilite.pdf") }} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:py-2 sm:text-sm">
            <FileText className="h-4 w-4" /> Documentation
          </button>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:py-2 sm:text-sm">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:px-4 sm:py-3 sm:text-sm">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 sm:px-4 sm:py-3 sm:text-sm">{success}</div>}
      {warnings.map((w) => (
        <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:px-4 sm:py-3 sm:text-sm">{w}</div>
      ))}
      {coherence && (coherence.summary.uncoveredFormats > 0 || coherence.summary.expiredFormats > 0) && tab !== "coherence" && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 sm:text-sm">
          <span>
            {coherence.summary.uncoveredFormats > 0 && <>{coherence.summary.uncoveredFormats} format(s) ont du stock sans lot ({coherence.summary.uncoveredUnits} unités) : leur vente est refusée tant que ce stock n&apos;est pas couvert. </>}
            {coherence.summary.expiredFormats > 0 && <>{coherence.summary.expiredUnits} unité(s) restent dans des lots expirés : elles ne sont plus vendables.</>}
          </span>
          <button onClick={() => setTab("coherence")} className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100">Voir le détail</button>
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
            <p className=" font-medium text-gray-500 ">Lots actifs</p>
            <p className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{totals.activeLots} <span className="text-xs font-medium text-gray-400 sm:text-sm">/ {totals.lots}</span></p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:p-4">
            <p className=" font-medium text-blue-700 ">Total produit (tous les lots)</p>
            <p className="mt-1 text-lg font-bold text-blue-800 sm:text-xl">{totals.produced}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/40 p-3 sm:p-4">
            <p className=" font-medium text-green-700 ">Reste dans les lots actifs</p>
            <p className="mt-1 text-lg font-bold text-green-800 sm:text-xl">{totals.activeRemaining}</p>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-3 sm:p-4">
            <p className=" font-medium text-yellow-700 ">Formats en alerte de stock</p>
            <p className="mt-1 text-lg font-bold text-yellow-800 sm:text-xl">{reports ? reports.stockAlerts.length : "—"}</p>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">Ces chiffres portent sur l&apos;ensemble des lots ; ils ne changent pas avec les filtres de la liste.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-900 sm:text-sm">{formMode === "single" ? <Factory className="h-4 w-4" /> : <Boxes className="h-4 w-4" />} {formMode === "single" ? "Nouveau lot" : "Production groupée"}</h2>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button type="button" onClick={() => switchFormMode("single")} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${formMode === "single" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Lot simple</button>
              <button type="button" onClick={() => switchFormMode("batch")} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${formMode === "batch" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Production groupée</button>
            </div>
          </div>

          {formMode === "single" && (
          <form onSubmit={submitProduction} className="space-y-3 sm:space-y-4">
            <label className="block text-xs font-medium text-gray-700 sm:text-sm">
              Produit / format
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={`${inputClass} bg-white`}>
                {stockVariants.length === 0 && <option value="">Aucun produit disponible</option>}
                {stockVariants.map((v) => <option key={v.variantId} value={v.variantId}>{v.productName} - {v.format}</option>)}
              </select>
            </label>
            {destinationSelect}
            <label className="block text-xs font-medium text-gray-700 sm:text-sm">
              Quantité à produire
              <input type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(wholeQuantity(e.target.value, 1))} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-gray-700 sm:text-sm">
              Date d&apos;expiration (optionnel)
              <input type="date" min={todayInput()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-gray-700 sm:text-sm">
              Note
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Production glaçon..." />
            </label>
            {selectedVariant && (
              <div className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 sm:p-3 sm:text-sm">
                Stock total : <span className="font-semibold text-gray-900">{totalStock(selectedVariant)} {selectedVariant.unit ?? ""}</span>
                <span className="mx-1.5 text-gray-300">|</span>
                {selectedPoint?.name ?? "Destination"} : <span className="font-semibold text-gray-900">{stockAt(selectedVariant, destinationPointOfSaleId)} {selectedVariant.unit ?? ""}</span>
              </div>
            )}
            <button disabled={!canProduce || !variantId || submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:py-2.5 sm:text-sm">
              <PackagePlus className="h-4 w-4" /> {submitting ? "Création en cours..." : "Créer le lot"}
            </button>
          </form>
          )}

          {formMode === "batch" && (
            <form onSubmit={submitBatchProduction} className="space-y-3 sm:space-y-4">
              {destinationSelect}

              <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
                <button type="button" onClick={() => setBatchMode("uniform")} className={`flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${batchMode === "uniform" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Quantité unique</button>
                <button type="button" onClick={() => setBatchMode("custom")} className={`flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${batchMode === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Personnalisé</button>
              </div>

              {batchMode === "uniform" && (
                <label className="block text-xs font-medium text-gray-700 sm:text-sm">
                  Quantité pour chaque format coché
                  <input type="number" min={1} step={1} inputMode="numeric" value={batchQty} onChange={(e) => setBatchQty(wholeQuantity(e.target.value, 1))} className={inputClass} />
                </label>
              )}

              <label className="block text-xs font-medium text-gray-700 sm:text-sm">
                Date d&apos;expiration (optionnel)
                <input type="date" min={todayInput()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-gray-700 sm:text-sm">
                Note
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Production groupée..." />
              </label>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[480px] text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-gray-50/80">
                    <tr>
                      <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-3 sm:py-2 ">Produit</th>
                      <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-3 sm:py-2 ">Format</th>
                      <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-3 sm:py-2 " title="Stock total, tous points de vente">Total</th>
                      <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-3 sm:py-2 " title="Stock du point de vente de destination">Destination</th>
                      <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-3 sm:py-2 ">Quantité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stockVariants.map((v) => (
                      <tr key={v.variantId} className="hover:bg-gray-50/50">
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">{v.productName}</td>
                        <td className="px-2 py-1.5 text-gray-600 sm:px-3 sm:py-2">{v.format}</td>
                        <td className="px-2 py-1.5 text-right sm:px-3 sm:py-2">{totalStock(v)}</td>
                        <td className="px-2 py-1.5 text-right sm:px-3 sm:py-2">{stockAt(v, destinationPointOfSaleId)}</td>
                        <td className="px-2 py-1.5 text-right sm:px-3 sm:py-2">
                          {batchMode === "uniform" ? (
                            <label className="inline-flex cursor-pointer items-center justify-end gap-2">
                              <span className={`font-semibold ${batchExcluded[v.variantId] ? "text-gray-300 line-through" : "text-primary-700"}`}>×{batchQty}</span>
                              <input
                                type="checkbox"
                                checked={!batchExcluded[v.variantId]}
                                onChange={(e) => setBatchExcluded((prev) => ({ ...prev, [v.variantId]: !e.target.checked }))}
                                aria-label={`Produire ${v.productName} ${v.format}`}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </label>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              value={batchQtys[v.variantId] ?? ""}
                              onChange={(e) => setBatchQtys((prev) => ({ ...prev, [v.variantId]: wholeQuantity(e.target.value, 0) }))}
                              placeholder="0"
                              aria-label={`Quantité pour ${v.productName} ${v.format}`}
                              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 sm:text-sm"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500">
                {batchEntries.length === 0
                  ? "Aucun format retenu pour l'instant."
                  : `${batchEntries.length} lot(s) seront créés, soit ${batchTotal} unité(s) au total${selectedPoint ? ` pour ${selectedPoint.name}` : ""}.`}
              </p>

              <button disabled={batchSubmitting || !canProduce || batchEntries.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:py-2.5 sm:text-sm">
                <Boxes className="h-4 w-4" /> {batchSubmitting ? "Production en cours..." : "Produire en groupe"}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-900 sm:mb-4 sm:text-sm"><TrendingUp className="h-4 w-4" /> Production / jour (30 j)</h2>
          <div className="h-48 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports?.productionByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }} />
                <Bar dataKey="quantity" fill="#1f4fa3" radius={[4, 4, 0, 0]} name="Quantité" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-full sm:w-fit">
        <button onClick={() => setTab("lots")} className={`flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${tab === "lots" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Factory className="inline h-4 w-4 mr-1" /> Lots
        </button>
        <button onClick={() => setTab("alerts")} className={`flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${tab === "alerts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <AlertCircle className="inline h-4 w-4 mr-1" /> Alertes
        </button>
        <button onClick={() => setTab("coherence")} className={`flex-1 sm:flex-none rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${tab === "coherence" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <CheckCircle2 className="inline h-4 w-4 mr-1" /> Cohérence{coherence && coherence.summary.fixable > 0 ? ` (${coherence.summary.fixable})` : ""}
        </button>
      </div>

      {tab === "lots" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="text-xs font-semibold text-gray-900 sm:text-sm">{hasFilter ? "Lots filtrés" : "Tous les lots"} ({filteredLots.length})</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={searchLot} onChange={(e) => setSearchLot(e.target.value)} aria-label="Rechercher un lot" className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-1.5 text-xs focus:border-primary-500 focus:outline-none sm:w-56 sm:py-2 sm:text-sm" placeholder="Rechercher un lot..." />
              </div>
              <select value={filterVariantId} onChange={(e) => setFilterVariantId(e.target.value)} aria-label="Filtrer par produit" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs bg-white sm:py-2 sm:text-sm">
                <option value="">Tous les produits</option>
                {stockVariants.map((v) => <option key={v.variantId} value={v.variantId}>{v.productName} - {v.format}</option>)}
              </select>
              <select value={posFilter} onChange={(e) => setFilterPointOfSaleId(e.target.value)} aria-label="Filtrer par point de vente" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs bg-white sm:py-2 sm:text-sm">
                <option value="">Tous les PDV</option>
                {filterPoints.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filtrer par statut" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs bg-white sm:py-2 sm:text-sm">
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_CONFIG).map(([key, st]) => <option key={key} value={key}>{st.label}</option>)}
              </select>
            </div>
          </div>

          {lotsData?.truncated && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Seuls les {lotsData.lots.length} lots les plus récents sont listés ; utilisez le filtre par statut pour retrouver les plus anciens.</p>
          )}

          <div className="overflow-x-auto max-h-[400px] sm:max-h-[500px]">
            <table className="w-full min-w-[760px] text-xs sm:text-sm">
              <thead className="sticky top-0 bg-gray-50/80">
                <tr>
                  <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Numéro</th>
                  <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Produit</th>
                  <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Format</th>
                  <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Qté</th>
                  <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Restant</th>
                  <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Point de vente</th>
                  <th className="px-2 py-1.5 text-center  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Statut</th>
                  <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Production</th>
                  <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Expiration</th>
                  <th className="px-2 py-1.5 text-center  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLots.map((lot) => {
                  const st = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.ACTIVE
                  const Icon = st.icon
                  const late = isPastExpiry(lot)
                  return (
                    <tr key={lot.id} className="hover:bg-gray-50/50">
                      <td className="px-2 py-2 font-mono  font-semibold text-primary-700 sm:px-4 sm:py-2.5 ">{lot.lotNumber}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2.5">{lot.variant.product.name}</td>
                      <td className="px-2 py-2 text-gray-600 sm:px-4 sm:py-2.5">{lot.variant.format}</td>
                      <td className="px-2 py-2 text-right font-semibold sm:px-4 sm:py-2.5">{lot.initialQuantity}</td>
                      <td className={`px-2 py-2 text-right font-bold sm:px-4 sm:py-2.5 ${lot.remainingQuantity === 0 ? "text-gray-400" : "text-gray-900"}`}>{lot.remainingQuantity}</td>
                      <td className="px-2 py-2 text-left sm:px-4 sm:py-2.5">
                        {lot.destination ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 sm:px-2">{lot.destination.name} ({lot.destination.code})</span>
                        ) : (
                          <span className="text-gray-400  ">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center sm:px-4 sm:py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5  font-semibold sm:px-2  ${st.color}`}>
                          <Icon className="h-3 w-3" /> {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-gray-600 sm:px-4 sm:py-2.5">{fmtDate(lot.productionDate)}</td>
                      <td className={`px-2 py-2 sm:px-4 sm:py-2.5 ${late ? "font-semibold text-red-700" : "text-gray-600"}`} title={late ? "Date d'expiration dépassée : ce lot est encore actif" : undefined}>
                        {lot.expiryDate ? fmtDate(lot.expiryDate) : "-"}{late ? " (dépassée)" : ""}
                      </td>
                      <td className="px-2 py-2 text-center sm:px-4 sm:py-2.5">
                        <button onClick={() => viewLot(lot)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Détails" aria-label={`Détails du lot ${lot.lotNumber}`}>
                          <FileText className="h-4 w-4" />
                        </button>
                        {lot.status === "EXHAUSTED" && (
                          <button onClick={() => deleteLot(lot)} className="ml-1 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600" title="Supprimer ce lot épuisé" aria-label={`Supprimer le lot épuisé ${lot.lotNumber}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {lot.status === "EXPIRED" && (
                          <button onClick={() => deleteLot(lot)} className="ml-1 inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50" aria-label={`Supprimer le lot expiré ${lot.lotNumber}`}>
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredLots.length === 0 && (
                  <tr><td colSpan={10} className="px-2 py-6 text-center text-xs text-gray-500 sm:px-4 sm:py-8 sm:text-sm">{loading ? "Chargement..." : "Aucun lot trouvé."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "alerts" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-1 text-xs font-semibold text-gray-900 sm:text-sm">Alertes à produire</h2>
          <p className="mb-3 text-xs text-gray-500 sm:mb-4">Formats dont le stock total, tous points de vente confondus, est de 20 unités ou moins.</p>
          <div className="space-y-2">
            {(reports?.stockAlerts ?? []).map((alert) => (
              <div key={alert.variantId} className="flex items-center justify-between rounded-lg bg-yellow-50 p-2.5 text-xs sm:p-3 sm:text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium text-gray-800">{alert.productName}</p>
                    <p className=" text-gray-500 ">{alert.format} - {alert.categoryName}</p>
                  </div>
                </div>
                <span className="font-semibold text-yellow-800">{alert.stock}</span>
              </div>
            ))}
            {!reports && <p className="text-xs text-gray-500 sm:text-sm">Les alertes de stock n&apos;ont pas pu être chargées.</p>}
            {reports && reports.stockAlerts.length === 0 && <p className="text-xs text-gray-500 sm:text-sm">Aucune alerte stock.</p>}
          </div>
        </section>
      )}

      {tab === "coherence" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xs font-semibold text-gray-900 sm:text-sm">Cohérence du stock</h2>
              <p className="mt-1 max-w-2xl text-xs text-gray-500">Le stock des points de vente fait foi. Chaque unité doit être couverte par un lot : sans lot, la vente est refusée. Un lot expiré n&apos;est plus vendable ; son reste se sort du stock par une perte.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  if (!coherence) return
                  const rows = coherence.rows.filter((r) => r.activeLots === 0 && r.expiredLots > 0 && r.uncovered > 0)
                  if (rows.length === 0) {
                    fail("Aucun lot périmé à supprimer pour les lignes avec 'Sans lot' et 'Lots actifs' nul")
                    return
                  }
                  if (!confirm(`Supprimer tous les lots périmés pour ${rows.length} format(s) ayant du stock sans lot et aucun lot actif ?\n\nLes ventes et mouvements de stock seront conservés.`)) return
                  setError("")
                  setSuccess("")
                  setRegularising(true)
                  try {
                    const res = await fetch("/api/lots/expired-cleanup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ variantIds: rows.map((r) => r.variantId) }),
                    })
                    const body = await res.json().catch(() => null)
                    if (!res.ok) {
                      fail(body?.error ?? "Suppression impossible")
                      return
                    }
                    await load()
                    succeed(`${body.deleted || 0} lot(s) périmé(s) supprimé(s)`)
                  } catch (e) {
                    fail(e instanceof Error ? e.message : "Erreur")
                  } finally {
                    setRegularising(false)
                  }
                }}
                disabled={regularising || !coherence || coherence.rows.filter((r) => r.activeLots === 0 && r.expiredLots > 0 && r.uncovered > 0).length === 0}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 sm:text-sm"
              >
                <Trash2 className="h-4 w-4" /> Supprimer lots périmés (SANS LOT)
              </button>
              <button onClick={regularise} disabled={regularising || !coherence || coherence.summary.fixable === 0} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:text-sm">
                <CheckCircle2 className="h-4 w-4" /> {regularising ? "Régularisation..." : "Régulariser"}
              </button>
            </div>
          </div>

          {!coherence && <p className="text-xs text-gray-500 sm:text-sm">L&apos;état de cohérence n&apos;a pas pu être chargé.</p>}
          {coherence && coherence.summary.fixable === 0 && coherence.summary.excessFormats === 0 && coherence.summary.expiredFormats === 0 && (
            <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 sm:text-sm">Tout est cohérent : chaque unité en stock est couverte par un lot.</p>
          )}
          {coherence && coherence.summary.unlocatedFormats > 0 && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">{coherence.summary.unlocatedFormats} format(s) ont du stock hors point de vente ({coherence.summary.unlocatedUnits} unités) : invisible en caisse. Placez-le au Comptoir LCG, ou retirez-le s&apos;il n&apos;existe pas (colonne « Hors point de vente »).</p>
          )}
          {coherence && coherence.summary.excessFormats > 0 && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">{coherence.summary.excessFormats} format(s) ont plus de reste dans leurs lots que de stock présent ({coherence.summary.excessUnits} unités) : à vérifier par un inventaire, la régularisation n&apos;y touche pas.</p>
          )}

          {coherence && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs sm:text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Produit</th>
                    <th className="px-2 py-1.5 text-left  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Format</th>
                    <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Stock points de vente</th>
                    <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Lots actifs</th>
                    <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Lots expirés</th>
                    <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Sans lot</th>
                    <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Ancien stock global</th>
                    <th className="px-2 py-1.5 text-right  font-semibold uppercase text-gray-500 sm:px-4 sm:py-2 ">Hors point de vente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coherence.rows.map((r) => (
                    <tr key={r.variantId} className="hover:bg-gray-50/50">
                      <td className="px-2 py-2 sm:px-4 sm:py-2.5">{r.productName}</td>
                      <td className="px-2 py-2 text-gray-600 sm:px-4 sm:py-2.5">{r.format}</td>
                      <td className="px-2 py-2 text-right font-semibold sm:px-4 sm:py-2.5">{r.locationStock}</td>
                      <td className="px-2 py-2 text-right sm:px-4 sm:py-2.5">{r.activeLots}{r.excess > 0 ? <span className="ml-1 text-amber-700" title="Reste des lots supérieur au stock présent">(+{r.excess})</span> : null}</td>
                      <td className={`px-2 py-2 text-right sm:px-4 sm:py-2.5 ${r.expiredLots > 0 ? "font-semibold text-red-700" : "text-gray-400"}`}>{r.expiredLots}</td>
                      <td className={`px-2 py-2 text-right sm:px-4 sm:py-2.5 ${r.uncovered > 0 ? "font-bold text-red-700" : "text-gray-400"}`}>{r.uncovered}</td>
                      <td className={`px-2 py-2 text-right sm:px-4 sm:py-2.5 ${r.globalGap !== 0 ? "font-semibold text-amber-700" : "text-gray-600"}`}>{r.globalStock}{r.globalGap !== 0 ? ` (${r.globalGap > 0 ? "+" : ""}${r.globalGap})` : ""}</td>
                      <td className="px-2 py-2 text-right sm:px-4 sm:py-2.5">
                        {r.unlocated > 0 ? (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <span className="font-bold text-amber-700">{r.unlocated}</span>
                            <button onClick={() => handleUnlocated(r, "placer")} disabled={regularising} className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">Placer au Comptoir</button>
                            <button onClick={() => handleUnlocated(r, "retirer")} disabled={regularising} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Retirer</button>
                          </div>
                        ) : <span className="text-gray-400">0</span>}
                      </td>
                    </tr>
                  ))}
                  {coherence.rows.length === 0 && (
                    <tr><td colSpan={8} className="px-2 py-6 text-center text-xs text-gray-500 sm:px-4 sm:py-8 sm:text-sm">Aucun produit.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={() => setSelectedLot(null)}>
          <div className="max-h-[90vh] w-full max-w-full overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:max-w-2xl sm:p-6 sm:max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between sm:mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 sm:text-lg">Lot {selectedLot.lotNumber}</h3>
                <p className="text-xs text-gray-500 sm:text-sm">{selectedLot.variant?.product?.name} - {selectedLot.variant?.format}</p>
              </div>
              <button onClick={() => setSelectedLot(null)} aria-label="Fermer" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-lg bg-gray-50 p-2 text-center sm:p-3"><p className=" text-gray-500 ">Produit</p><p className="text-sm font-bold sm:text-base">{selectedLot.initialQuantity}</p></div>
              <div className="rounded-lg bg-gray-50 p-2 text-center sm:p-3"><p className=" text-gray-500 ">Restant</p><p className="text-sm font-bold sm:text-base">{selectedLot.remainingQuantity}</p></div>
              <div className="rounded-lg bg-gray-50 p-2 text-center sm:p-3"><p className=" text-gray-500 ">Consommé</p><p className="text-sm font-bold sm:text-base">{selectedLot.initialQuantity - selectedLot.remainingQuantity}</p></div>
              <div className="rounded-lg bg-gray-50 p-2 text-center sm:p-3"><p className=" text-gray-500 ">Statut</p><p className={`text-sm font-bold sm:text-base ${selectedLot.status === "ACTIVE" ? "text-green-700" : selectedLot.status === "EXPIRED" ? "text-red-700" : "text-gray-600"}`}>{STATUS_CONFIG[selectedLot.status]?.label ?? selectedLot.status}</p></div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 sm:gap-3 sm:text-sm">
              <div><span className="text-gray-500">Production :</span> <span className="font-medium">{fmtDate(selectedLot.productionDate)}</span></div>
              {selectedLot.destination && <div><span className="text-gray-500">Point de vente :</span> <span className="font-medium">{selectedLot.destination.name} ({selectedLot.destination.code})</span></div>}
              {selectedLot.expiryDate && <div><span className="text-gray-500">Expiration :</span> <span className={`font-medium ${isPastExpiry(selectedLot) ? "text-red-700" : ""}`}>{fmtDate(selectedLot.expiryDate)}{isPastExpiry(selectedLot) ? " (dépassée)" : ""}</span></div>}
              {selectedLot.createdBy && <div><span className="text-gray-500">Créé par :</span> <span className="font-medium">{selectedLot.createdBy.name}</span></div>}
              {selectedLot.notes && <div><span className="text-gray-500">Note :</span> <span className="font-medium">{selectedLot.notes}</span></div>}
            </div>

            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-gray-900 sm:text-sm">Historique des allocations ({(selectedLot.allocations ?? []).length})</h4>
              {selectedLot.status === "EXHAUSTED" || selectedLot.status === "EXPIRED" ? (
                <button onClick={() => deleteLot(selectedLot)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1  font-medium text-red-600 hover:bg-red-50 sm:px-3 sm:py-1.5 ">
                  <Trash2 className="h-3 w-3" /> Supprimer
                </button>
              ) : (
                <span className="text-xs text-gray-400">Seul un lot épuisé ou expiré peut être supprimé</span>
              )}
            </div>

            {(() => {
              const transfers = (selectedLot.allocations ?? []).filter((a: LotAllocation) => a.type === "TRANSFER" && a.pointOfSale)
              if (transfers.length === 0) return null
              const byPos = new Map<string, { name: string; code: string; qty: number }>()
              for (const t of transfers) {
                const key = t.pointOfSale!.code
                const existing = byPos.get(key)
                if (existing) existing.qty += t.quantity
                else byPos.set(key, { name: t.pointOfSale!.name, code: t.pointOfSale!.code, qty: t.quantity })
              }
              return (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 sm:p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">PDV ayant reçu ce lot</p>
                  <div className="space-y-1 sm:space-y-1.5">
                    {Array.from(byPos.values()).map((p) => (
                      <div key={p.code} className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-gray-700">{p.name} <span className=" text-gray-400 ">({p.code})</span></span>
                        <span className="font-semibold text-amber-700">{p.qty} unités</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="max-h-48 overflow-y-auto sm:max-h-60">
              {(selectedLot.allocations ?? []).length === 0 ? (
                <p className="text-xs text-gray-500 sm:text-sm">Aucune allocation (lot non encore utilisé).</p>
              ) : (
                <table className="w-full min-w-[420px] text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-gray-50/80">
                    <tr>
                      <th className="px-2 py-1 text-left  font-semibold uppercase text-gray-500 sm:px-3 sm:py-1.5 ">Type</th>
                      <th className="px-2 py-1 text-right  font-semibold uppercase text-gray-500 sm:px-3 sm:py-1.5 ">Qté</th>
                      <th className="px-2 py-1 text-left  font-semibold uppercase text-gray-500 sm:px-3 sm:py-1.5 ">Référence</th>
                      <th className="px-2 py-1 text-left  font-semibold uppercase text-gray-500 sm:px-3 sm:py-1.5 ">PDV</th>
                      <th className="px-2 py-1 text-left  font-semibold uppercase text-gray-500 sm:px-3 sm:py-1.5 ">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(selectedLot.allocations ?? []).map((a: LotAllocation) => (
                      <tr key={a.id}>
                        <td className="px-2 py-1 sm:px-3 sm:py-1.5">{ALLOC_TYPE[a.type] ?? a.type}</td>
                        <td className="px-2 py-1 text-right font-semibold sm:px-3 sm:py-1.5">{a.quantity}</td>
                        <td className="px-2 py-1 font-mono  sm:px-3 sm:py-1.5 ">{a.reference || "-"}</td>
                        <td className="px-2 py-1 sm:px-3 sm:py-1.5">
                          {a.pointOfSale ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 sm:px-2">{a.pointOfSale.name}</span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-gray-500 sm:px-3 sm:py-1.5">{fmtDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
