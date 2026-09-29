"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  Printer,
  RefreshCw,
  Scale,
  Search,
  ShoppingCart,
  Store,
  Wallet,
  X,
} from "lucide-react"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"
import { exportClotureCaisseExcel, exportClotureCaissePDF, type ClotureReport } from "@/lib/report-export"

interface EtatStockRow {
  variantId: string
  productName: string
  categoryName: string
  format: string
  unit: string | null
  price: number
  stockDepart: number
  ventes: number
  ventesMontant: number
  entrees: number
  autresSorties: number
  autresMouvements: number
  stockCloture: number
  stockReel: number
  stockGlobal: number
  debite: number
  disponible: number
  alerte: boolean
}

interface EtatStockOrder {
  id: string
  orderNumber: string
  customerName: string | null
  status: string
  paymentMethod: string | null
  paymentStatus: string
  total: number
  createdAt: string
  items: { id: string; name: string; format: string; quantity: number; price: number; total: number }[]
}

interface EtatStockMovement {
  id: string
  variantId: string
  type: string
  quantity: number
  reason: string | null
  reference: string | null
  userId: string | null
  own: boolean
  createdAt: string
}

interface CashInfo {
  session: {
    id: string
    openedAt: string
    closedAt: string | null
    openingBalance: number
    closingBalance: number | null
    status: string
    expected: number
    cashSales: number
    gap: number | null
    openedByName: string | null
    reportGeneratedAt: string | null
    reportReference: string | null
  } | null
  dayExpected: number
}

interface EtatStockPayload {
  date: string
  pointOfSaleId: string | null
  pointOfSale: { id: string; name: string; code: string } | null
  userId: string
  seller: { id: string; name: string | null } | null
  sellers: { id: string; name: string | null; role: string }[]
  pointOfSales: { id: string; name: string; code: string; isActive: boolean }[]
  canManage: boolean
  canSeeAllSellers: boolean
  sellerMode: boolean
  rows: EtatStockRow[]
  totals: {
    stockDepart: number
    ventes: number
    entrees: number
    autresSorties: number
    autresMouvements: number
    stockCloture: number
    stockReel: number
    stockGlobal: number
    ventesMontant: number
    commandes: number
    montant: number
    ventesSansDebit: number
    disponible: number
    alertes: number
    cashDay: number
  }
  orders: EtatStockOrder[]
  movements: EtatStockMovement[]
  cash: CashInfo
}

const ORDERS_PER_PAGE = 8
const MOVEMENTS_PER_PAGE = 8

const movementLabels: Record<string, string> = {
  IN: "Entrée",
  OUT: "Sortie",
  PRODUCTION: "Production",
  SALE: "Vente",
  LOSS: "Perte / fonte",
  ADJUSTMENT_IN: "Ajustement +",
  ADJUSTMENT_OUT: "Ajustement -",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  RETURN: "Retour",
  CANCEL_RESTOCK: "Annulation",
  RESERVATION: "Réservation",
}

const paymentLabels: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte",
}

function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function shiftDay(isoDay: string, delta: number): string {
  const date = new Date(`${isoDay}T00:00:00`)
  date.setDate(date.getDate() + delta)
  return toIsoDay(date)
}

function formatLongDate(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function Delta({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-muted-foreground">0</span>
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${value > 0 ? "text-green-600" : "text-red-600"}`}>
      {value > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  )
}

export default function EtatStockPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<"stock" | "ventes" | "caisse">("stock")
  const [date, setDate] = useState(() => toIsoDay(new Date()))
  const [userId, setUserId] = useState("")
  const [pointOfSaleId, setPointOfSaleId] = useState("")
  const [data, setData] = useState<EtatStockPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const [search, setSearch] = useState("")
  const [onlyGap, setOnlyGap] = useState(false)
  const [physical, setPhysical] = useState<Record<string, string>>({})
  const [busyRow, setBusyRow] = useState("")
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  const [ordersPage, setOrdersPage] = useState(1)
  const [movementsPage, setMovementsPage] = useState(1)
  const [cashInput, setCashInput] = useState("")
  const [cashSaving, setCashSaving] = useState(false)
  const [report, setReport] = useState<ClotureReport | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams()
    if (date) query.set("date", date)
    if (userId) query.set("userId", userId)
    if (pointOfSaleId) query.set("pointOfSaleId", pointOfSaleId)
    const init = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/etat-stock?${query.toString()}`, { signal: controller.signal })
        const body = await res.json()
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(body.error || "Impossible de charger les données")
        } else {
          setError("")
          setData(body as EtatStockPayload)
          setRefreshedAt(new Date())
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Erreur de chargement")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [date, userId, pointOfSaleId])

  const reload = useCallback(async () => {
    const query = new URLSearchParams()
    if (date) query.set("date", date)
    if (userId) query.set("userId", userId)
    if (pointOfSaleId) query.set("pointOfSaleId", pointOfSaleId)
    const res = await fetch(`/api/etat-stock?${query.toString()}`)
    if (res.ok) {
      setData(await res.json())
      setRefreshedAt(new Date())
    }
  }, [date, userId, pointOfSaleId])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const totals = data?.totals
  const canManage = data?.canManage ?? false
  const cashSession = data?.cash.session ?? null
  const sellerLabel = data?.seller?.name || (userId ? session?.user?.name ?? "—" : "Tous les vendeurs")

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (query && !`${row.productName} ${row.format} ${row.categoryName}`.toLowerCase().includes(query)) return false
      if (onlyGap) {
        const value = physical[row.variantId]
        if (value === undefined || value === "") return false
        if (Number(value) - row.stockCloture === 0) return false
      }
      return true
    })
  }, [rows, search, onlyGap, physical])

  const totalPhysicalGap = useMemo(
    () =>
      filteredRows.reduce((sum, row) => {
        const value = physical[row.variantId]
        if (value === undefined || value === "") return sum
        return sum + (Number(value) - row.stockCloture)
      }, 0),
    [filteredRows, physical],
  )

  const orders = useMemo(() => data?.orders ?? [], [data])
  const ordersTotalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE))
  const ordersPageIndex = Math.min(ordersPage, ordersTotalPages)
  const pagedOrders = orders.slice((ordersPageIndex - 1) * ORDERS_PER_PAGE, ordersPageIndex * ORDERS_PER_PAGE)

  const salesTotals = useMemo(() => {
    const byMethod = new Map<string, { count: number; total: number }>()
    let total = 0
    for (const order of orders) {
      total += order.total
      const key = order.paymentMethod ?? "UNKNOWN"
      const bucket = byMethod.get(key) ?? { count: 0, total: 0 }
      bucket.count += 1
      bucket.total += order.total
      byMethod.set(key, bucket)
    }
    return {
      count: orders.length,
      total,
      average: orders.length > 0 ? total / orders.length : 0,
      units: totals?.ventes ?? 0,
      methods: [...byMethod.entries()].sort((a, b) => b[1].total - a[1].total),
    }
  }, [orders, totals?.ventes])

  const movements = useMemo(() => data?.movements ?? [], [data])
  const movementsTotalPages = Math.max(1, Math.ceil(movements.length / MOVEMENTS_PER_PAGE))
  const movementsPageIndex = Math.min(movementsPage, movementsTotalPages)
  const pagedMovements = movements.slice(
    (movementsPageIndex - 1) * MOVEMENTS_PER_PAGE,
    movementsPageIndex * MOVEMENTS_PER_PAGE,
  )
  const variantById = useMemo(() => new Map(rows.map((row) => [row.variantId, row])), [rows])

  const applyAdjustment = async (row: EtatStockRow) => {
    const value = physical[row.variantId]
    if (value === undefined || value === "") return
    setBusyRow(row.variantId)
    setFeedback(null)
    try {
      const res = await fetch("/api/etat-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointOfSaleId: data?.pointOfSaleId,
          variantId: row.variantId,
          targetQuantity: Number(value),
          reason: `Inventaire du ${date} — ${row.productName} ${row.format}`,
          ...(data?.userId ? { userId: data.userId } : {}),
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.error || "Ajustement impossible" })
      } else {
        setPhysical((current) => {
          const next = { ...current }
          delete next[row.variantId]
          return next
        })
        setFeedback({
          tone: "success",
          message: `${row.productName} ${row.format} ajusté (${body.delta > 0 ? "+" : ""}${body.delta}) · ${body.reference}`,
        })
        await reload()
      }
    } catch {
      setFeedback({ tone: "error", message: "Erreur réseau lors de l'ajustement" })
    } finally {
      setBusyRow("")
    }
  }

  const submitCash = async (action: "open" | "close") => {
    if (!data?.pointOfSaleId) {
      setFeedback({ tone: "error", message: "Sélectionnez un point de vente" })
      return
    }
    // Le rapport de clôture est obligatoire : il retrace les transactions et
    // les quantités vendues avant que la caisse puisse être fermée.
    if (action === "close" && cashSession && !cashSession.reportGeneratedAt) {
      setFeedback({
        tone: "error",
        message: "Générez d'abord le rapport de clôture de la journée.",
      })
      return
    }
    setCashSaving(true)
    setFeedback(null)
    try {
      const isClose = action === "close" && cashSession !== null
      const res = await fetch("/api/points-de-vente/caisse", {
        method: isClose ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isClose
            ? { id: cashSession?.id, closingBalance: Number(cashInput) || 0 }
            : {
                pointOfSaleId: data.pointOfSaleId,
                openingBalance: Number(cashInput) || 0,
                openedById: userId || session?.user?.id || null,
              },
        ),
      })
      const body = await res.json()
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.error || "Opération impossible" })
      } else {
        setCashInput("")
        setReport(null)
        setReportOpen(false)
        setFeedback({
          tone: "success",
          message: isClose
            ? `Caisse fermée · ${body.returnedTotal ?? 0} unité(s) non vendue(s) rendue(s) au point de vente`
            : "Caisse ouverte",
        })
        await reload()
      }
    } catch {
      setFeedback({ tone: "error", message: "Erreur réseau" })
    } finally {
      setCashSaving(false)
    }
  }

  // Le POST horodate la session : c'est lui qui autorise ensuite la fermeture.
  const openReport = async (stamp: boolean) => {
    if (!cashSession) return
    setReportLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${cashSession.id}/rapport`, {
        method: stamp ? "POST" : "GET",
      })
      const body = await res.json()
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.error || "Rapport indisponible" })
        return
      }
      setReport(body as ClotureReport)
      setReportOpen(true)
      if (stamp) {
        setFeedback({
          tone: "success",
          message: `Rapport de clôture généré (${body.session.reportReference}). Vous pouvez fermer la caisse.`,
        })
        await reload()
      }
    } catch {
      setFeedback({ tone: "error", message: "Erreur réseau" })
    } finally {
      setReportLoading(false)
    }
  }

  const pagination = (
    total: number,
    totalPages: number,
    pageIndex: number,
    unit: string,
    setPage: (page: number) => void,
  ) => (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        {total} {unit}
        {totalPages > 1 && ` · Page ${pageIndex}/${totalPages}`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(1)} disabled={pageIndex <= 1} aria-label="Première page" className="rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
            &laquo;
          </button>
          <button onClick={() => setPage(pageIndex - 1)} disabled={pageIndex <= 1} aria-label="Page précédente" className="rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
            &lsaquo;
          </button>
          <span className="px-2 text-xs font-semibold text-foreground">
            {pageIndex}/{totalPages}
          </span>
          <button onClick={() => setPage(pageIndex + 1)} disabled={pageIndex >= totalPages} aria-label="Page suivante" className="rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
            &rsaquo;
          </button>
          <button onClick={() => setPage(totalPages)} disabled={pageIndex >= totalPages} aria-label="Dernière page" className="rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
            &raquo;
          </button>
        </div>
      )}
    </div>
  )

  const kpis = [
    { label: "Stock de départ", value: `${totals?.stockDepart ?? 0}`, detail: "à l'ouverture de la journée", icon: Boxes, tone: "text-blue-600 bg-blue-100" },
    { label: "Ventes du vendeur", value: `${totals?.ventes ?? 0}`, detail: `${formatPrice(totals?.ventesMontant ?? 0)} sur ${totals?.commandes ?? 0} commande(s)`, icon: ShoppingCart, tone: "text-primary bg-primary/10" },
    { label: "Autres mouvements", value: `${totals?.autresMouvements ?? 0}`, detail: `+${totals?.entrees ?? 0} entrée(s) · ${totals?.autresSorties ?? 0} sortie(s)`, icon: Scale, tone: "text-orange-600 bg-orange-100" },
    { label: "Stock de clôture", value: `${totals?.stockCloture ?? 0}`, detail: `stock système : ${totals?.stockReel ?? 0}`, icon: Package, tone: "text-emerald-600 bg-emerald-100" },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground sm:text-sm">Opérations</p>
        <div className="mt-6 flex flex-col gap-2 sm:mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">État de stock &amp; caisse</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stock de départ, ventes réalisées et clôture de caisse par vendeur
            </p>
          </div>
          <div className="flex items-center gap-3">
            {refreshedAt && (
              <span className="text-xs text-muted-foreground">
                Mis à jour à {refreshedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => void reload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 grow basis-[47%] flex-col gap-1 sm:max-w-[220px] sm:basis-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendeur</span>
            {data?.canSeeAllSellers === false ? (
              <p className="flex h-9 items-center rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground">
                {session?.user?.name || "Mon stock"}
              </p>
            ) : (
              <select
                value={userId}
                onChange={(event) => { setUserId(event.target.value); setOrdersPage(1) }}
                className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Tous les vendeurs</option>
                {(data?.sellers ?? []).map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name || seller.id}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="flex min-w-0 grow basis-[47%] flex-col gap-1 sm:max-w-[200px] sm:basis-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Point de vente</span>
            <select
              value={pointOfSaleId || data?.pointOfSaleId || ""}
              onChange={(event) => setPointOfSaleId(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {(data?.pointOfSales ?? []).filter((point) => point.isActive).map((point) => (
                <option key={point.id} value={point.id}>
                  {point.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-full shrink-0 flex-col gap-1 sm:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Journée</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDate(shiftDay(date, -1))}
                aria-label="Journée précédente"
                className="h-9 w-9 rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="mx-auto h-4 w-4" />
              </button>
              <input
                type="date"
                value={date}
                onChange={(event) => event.target.value && setDate(event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => setDate(shiftDay(date, 1))}
                aria-label="Journée suivante"
                className="h-9 w-9 rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight className="mx-auto h-4 w-4" />
              </button>
            </div>
          </label>

          {date !== toIsoDay(new Date()) && (
            <button
                onClick={() => setDate(toIsoDay(new Date()))}
                className="h-9 shrink-0 rounded-lg border border-border bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {formatLongDate(date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5" /> {data?.pointOfSale?.name ?? "Aucun point de vente"}
          </span>
          <span className="font-medium text-foreground">{sellerLabel}</span>
        </div>
      </section>

      {feedback && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
            feedback.tone === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.tone === "success" ? <ArrowRight className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs underline">
            Fermer
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {data?.sellerMode && totals && totals.alertes > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {totals.alertes} produit(s) vendus au-delà du stock attribué à {data.seller?.name ?? "ce vendeur"}{" "}
            aujourd&apos;hui. Les ventes restent autorisées tant que le stock du comptoir le permet.
          </span>
        </div>
      )}

      {totals && totals.ventesSansDebit > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {totals.ventesSansDebit} article(s) vendus sans mouvement de stock correspondant sur ce point de vente.
            Vérifiez les commandes en attente de confirmation.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">{kpi.label}</p>
                  <p className="mt-2 break-words text-xl font-bold text-foreground tabular-nums sm:text-2xl">{kpi.value}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kpi.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground sm:mt-4">{kpi.detail}</p>
            </div>
          )
        })}
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card-soft">
        <div className="flex gap-2 overflow-x-auto border-b border-border px-3 pt-2.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-5 sm:pt-3">
          {([[
            "stock",
            "Stock",
          ], [
            "ventes",
            "Ventes",
          ], [
            "caisse",
            "Caisse",
          ]] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                tab === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {value === "ventes" && orders.length > 0 && ` (${orders.length})`}
            </button>
          ))}
        </div>

        {tab === "stock" && (
          <div className="p-3 sm:p-5">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[260px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produit</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher un produit..."
                    className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </label>
              <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={onlyGap}
                  onChange={(event) => setOnlyGap(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Écarts seulement
              </label>
              {Object.keys(physical).length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">
                    Écart total : <Delta value={totalPhysicalGap} />
                  </span>
                  <button
                    onClick={() => { setPhysical({}); setFeedback(null) }}
                    className="h-9 rounded-lg border border-border bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Vider la saisie
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">Produit</th>
                    <th className="pb-2 pr-3 text-right">Départ</th>
                    <th className="pb-2 pr-3 text-right">Vendu</th>
                    <th className="pb-2 pr-3 text-right">Autres mvts</th>
                    <th className="pb-2 pr-3 text-right">Clôture</th>
                    <th className="pb-2 pr-3 text-right">Physique</th>
                    <th className="pb-2 pr-3 text-right">Écart</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row) => {
                    const value = physical[row.variantId]
                    const typed = value !== undefined && value !== "" && Number.isFinite(Number(value))
                    const gap = typed ? Number(value) - row.stockCloture : 0
                    return (
                      <tr key={row.variantId} className="align-middle">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-foreground">{row.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.format} · {row.categoryName}
                          </p>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                          {row.stockDepart}
                          {row.alerte && (
                            <span className="mt-1 block text-xs font-semibold uppercase text-amber-600">
                              hors stock
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                          {row.ventes > 0 ? (
                            <span className="font-semibold text-primary">{row.ventes}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          <Delta value={row.autresMouvements} />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold text-foreground">
                          {row.stockCloture}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={value ?? ""}
                            onChange={(event) =>
                              setPhysical((current) => ({ ...current, [row.variantId]: event.target.value }))
                            }
                            placeholder={String(row.stockReel)}
                            aria-label={`Stock physique de ${row.productName} ${row.format}`}
                            className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {typed ? <Delta value={gap} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 text-right">
                          {canManage && (
                            <button
                              onClick={() => void applyAdjustment(row)}
                              disabled={!typed || gap === 0 || busyRow === row.variantId}
                              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {busyRow === row.variantId ? "..." : "Ajuster"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filteredRows.length === 0 && (
                  <tbody>
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        {loading ? "Chargement..." : "Aucune ligne de stock pour cette journée."}
                      </td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {data?.sellerMode ? (
                <>
                  <span>Le vendeur puise dans le stock du point de vente : il n&apos;détient aucun stock réservé</span>
                  <span>Clôture = disponible après les ventes et les mouvements du vendeur</span>
                </>
              ) : (
                <>
                  <span>
                    Stock de départ = stock de clôture + sorties de la journée − entrées de la journée
                  </span>
                  <span>Clôture = stock réel du point de vente · CA vendu {formatPrice(totals?.ventesMontant ?? 0)}</span>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "ventes" && (
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Total des ventes</p>
                <p className="mt-1 text-2xl font-bold text-primary sm:text-3xl">{formatPrice(salesTotals.total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatLongDate(date)} · {sellerLabel}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Ventes</p>
                <p className="mt-2 text-xl font-bold text-foreground">{salesTotals.count}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Panier moyen</p>
                <p className="mt-2 text-lg font-bold tabular-nums text-foreground break-words sm:text-xl">{formatPrice(salesTotals.average)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{salesTotals.units} article(s) vendu(s)</p>
              </div>
            </div>

            {salesTotals.methods.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {salesTotals.methods.map(([method, bucket]) => (
                  <span
                    key={method}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                  >
                    <span className="font-semibold text-foreground">
                      {paymentLabels[method] ?? method ?? "—"}
                    </span>
                    {bucket.count} · {formatPrice(bucket.total)}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex-1 divide-y divide-border">
              {pagedOrders.map((order) => (
                <div key={order.id} className="flex flex-col items-stretch gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3">
                  <div className="min-w-0 sm:flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {order.customerName || "Client"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {order.orderNumber} · {formatTime(order.createdAt)}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.items.map((item) => `${item.quantity}× ${item.name} (${item.format})`).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap sm:gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(order.paymentStatus)}`}>
                      {paymentLabels[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "—"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-foreground sm:text-base">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              ))}
              {!loading && orders.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune vente pour ce vendeur à cette date.</p>
              )}
            </div>

            {pagination(orders.length, ordersTotalPages, ordersPageIndex, "vente(s)", setOrdersPage)}

            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mouvements de stock du jour
              </p>
              <div className="divide-y divide-border">
                {pagedMovements.map((movement) => {
                  const variant = variantById.get(movement.variantId)
                  const isEntry = ["IN", "PRODUCTION", "TRANSFER_IN", "RETURN", "ADJUSTMENT_IN", "CANCEL_RESTOCK"].includes(
                    movement.type,
                  )
                  return (
                    <div key={movement.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {movementLabels[movement.type] ?? movement.type}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {variant ? `${variant.productName} (${variant.format})` : "Produit"}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatTime(movement.createdAt)}
                          {movement.reason ? ` · ${movement.reason}` : ""}
                        </p>
                      </div>
                      <span className={`whitespace-nowrap text-sm font-semibold ${isEntry ? "text-green-600" : "text-red-600"}`}>
                        {isEntry ? "+" : "−"}
                        {movement.quantity}
                      </span>
                    </div>
                  )
                })}
                {!loading && movements.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aucun mouvement de stock ce jour.</p>
                )}
              </div>
              {pagination(movements.length, movementsTotalPages, movementsPageIndex, "mouvement(s)", setMovementsPage)}
            </div>
          </div>
        )}

        {tab === "caisse" && (
          <div className="space-y-4 p-3 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Espèces du jour</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatPrice(totals?.cashDay ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">
                  {cashSession?.status === "OPEN" ? "Attendu (caisse ouverte)" : "Attendu (dernière caisse)"}
                </p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatPrice(cashSession?.expected ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Écart de caisse</p>
                <p
                  className={`mt-2 text-xl font-bold ${
                    cashSession?.gap === null || cashSession?.gap === undefined
                      ? "text-foreground"
                      : cashSession.gap === 0
                        ? "text-green-600"
                        : "text-red-600"
                  }`}
                >
                  {cashSession?.gap === null || cashSession?.gap === undefined
                    ? "—"
                    : formatPrice(cashSession.gap)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border p-3 sm:p-4">
              <Banknote className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold text-foreground">
                  {cashSession?.status === "OPEN" ? "Caisse ouverte" : "Aucune caisse ouverte"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {cashSession
                    ? `Ouverte le ${new Date(cashSession.openedAt).toLocaleString("fr-FR")} · fond ${formatPrice(cashSession.openingBalance)}`
                    : "Ouvrez une session pour saisir le fond de caisse."}
                </p>
              </div>
            </div>

            {canManage && (
              <div className="flex max-w-md flex-col gap-3 sm:flex-row">
                <input
                  type="number"
                  min={0}
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  placeholder={cashSession?.status === "OPEN" ? "Espèces comptées" : "Fond de caisse"}
                  aria-label={cashSession?.status === "OPEN" ? "Espèces comptées" : "Fond de caisse"}
                  className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                />
                {cashSession?.status === "OPEN" ? (
                  <button
                    onClick={() => void submitCash("close")}
                    disabled={cashSaving || !cashSession.reportGeneratedAt}
                    title={
                      cashSession.reportGeneratedAt
                        ? "Clôturer la caisse et rendre le stock invendu au point de vente"
                        : "Générez d'abord le rapport de clôture"
                    }
                    className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Fermer la caisse
                  </button>
                ) : (
                  <button
                    onClick={() => void submitCash("open")}
                    disabled={cashSaving}
                    className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Ouvrir la caisse
                  </button>
                )}
              </div>
            )}

            {cashSession && canManage && cashSession.status === "OPEN" && (
              <div
                className={`rounded-lg border p-3 sm:p-4 ${
                  cashSession.reportGeneratedAt
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <FileText
                      className={`mt-0.5 h-5 w-5 ${
                        cashSession.reportGeneratedAt ? "text-green-700" : "text-amber-700"
                      }`}
                    />
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          cashSession.reportGeneratedAt ? "text-green-900" : "text-amber-900"
                        }`}
                      >
                        Rapport de clôture
                      </p>
                      <p
                        className={`text-xs ${
                          cashSession.reportGeneratedAt ? "text-green-800" : "text-amber-800"
                        }`}
                      >
                        {cashSession.reportGeneratedAt
                          ? `Rapport ${cashSession.reportReference} généré le ${new Date(
                              cashSession.reportGeneratedAt,
                            ).toLocaleString("fr-FR")} — la caisse peut être fermée.`
                          : "La caisse ne peut pas être fermée avant la génération du rapport : il retrace les transactions et les quantités vendues de la journée."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void openReport(false)}
                      disabled={reportLoading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground disabled:opacity-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Aperçu
                    </button>
                    <button
                      onClick={() => void openReport(true)}
                      disabled={reportLoading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {reportLoading
                        ? "Génération…"
                        : cashSession.reportGeneratedAt
                          ? "Régénérer le rapport"
                          : "Générer le rapport"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {cashSession && (
              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Détail de la session
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Fond de caisse</p>
                    <p className="mt-1 font-semibold text-foreground">{formatPrice(cashSession.openingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ventes espèces</p>
                    <p className="mt-1 font-semibold text-foreground">{formatPrice(cashSession.cashSales)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Attendu</p>
                    <p className="mt-1 font-semibold text-foreground">{formatPrice(cashSession.expected)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Compté</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {cashSession.closingBalance === null ? "—" : formatPrice(cashSession.closingBalance)}
                    </p>
                  </div>
                </div>
                {cashSession.closedAt && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    Clôturée le {new Date(cashSession.closedAt).toLocaleString("fr-FR")} par {sellerLabel}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {reportOpen && report && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-4xl rounded-xl border border-border bg-background shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">Rapport de clôture de caisse</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {report.pointOfSale?.name} · {report.seller?.name ?? report.seller?.email} ·{" "}
                    {report.session.reportReference ?? "non référencé"}
                  </p>
                </div>
                <button
                  onClick={() => setReportOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Fermer l'aperçu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[65vh] space-y-5 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ["Fond de caisse", formatPrice(report.reconciliation.openingBalance)],
                    ["Chiffre d'affaires", formatPrice(report.reconciliation.revenue)],
                    ["Attendu", formatPrice(report.reconciliation.expected)],
                    [
                      "Compté",
                      report.reconciliation.closingBalance === null
                        ? "—"
                        : formatPrice(report.reconciliation.closingBalance),
                    ],
                    [
                      "Écart",
                      report.reconciliation.gap === null
                        ? "—"
                        : formatPrice(report.reconciliation.gap),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p
                        className={`mt-1 text-sm font-bold ${
                          label === "Écart" && report.reconciliation.gap !== null && report.reconciliation.gap !== 0
                            ? "text-red-600"
                            : "text-foreground"
                        }`}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{report.totals.orders}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Articles vendus</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{report.totals.items}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Références produits</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{report.totals.products}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Mouvements de stock</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{report.totals.movements}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quantités vendues par produit
                  </p>
                  {report.soldByProduct.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Aucune vente sur cette session.</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      {report.soldByProduct.map((row) => (
                        <div
                          key={row.variantId}
                          className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0"
                        >
                          <span className="min-w-0 truncate text-sm text-foreground">
                            {row.productName} <span className="text-muted-foreground">{row.format}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="text-sm font-semibold text-foreground">× {row.quantity}</span>
                            <span className="w-24 text-right text-sm text-muted-foreground">
                              {formatPrice(row.amount)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Transactions
                  </p>
                  {report.orders.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Aucune transaction.</p>
                  ) : (
                    <div className="max-h-64 overflow-auto rounded-lg border border-border">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Heure</th>
                            <th className="px-3 py-2 font-medium">Pièce</th>
                            <th className="px-3 py-2 font-medium">Client</th>
                            <th className="px-3 py-2 font-medium">Paiement</th>
                            <th className="px-3 py-2 text-right font-medium">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.orders.map((order) => (
                            <tr key={order.id} className="border-t border-border">
                              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-foreground">{order.orderNumber}</td>
                              <td className="px-3 py-2 text-muted-foreground">{order.customerName ?? "—"}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                {order.paymentMethodLabel}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-foreground">
                                {formatPrice(order.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mouvements de stock
                  </p>
                  {report.movements.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Aucun mouvement de stock.</p>
                  ) : (
                    <div className="max-h-64 overflow-auto rounded-lg border border-border">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Heure</th>
                            <th className="px-3 py-2 font-medium">Type</th>
                            <th className="px-3 py-2 font-medium">Produit</th>
                            <th className="px-3 py-2 text-right font-medium">Qté</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.movements.map((movement) => (
                            <tr key={movement.id} className="border-t border-border">
                              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                {new Date(movement.createdAt).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-foreground">
                                {movement.typeLabel}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {movement.productName} {movement.format}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-foreground">
                                {movement.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
                <p className="text-xs text-muted-foreground">
                  Le PDF et l&apos;Excel contiennent le visa de clôture.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => exportClotureCaissePDF(report)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger le PDF
                  </button>
                  <button
                    onClick={() => exportClotureCaisseExcel(report)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Télécharger Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
