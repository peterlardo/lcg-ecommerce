"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, ChevronDown, CreditCard, Minus, Plus, Printer, ReceiptText, RefreshCw, Search, Smartphone, Trash2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { buildTicketHtml } from "@/lib/ticket-template"
import { useLowStockThreshold } from "@/hooks/use-low-stock-threshold"

interface ProductVariant {
  id: string
  format: string
  price: number
  stock: number
  unit: string | null
}

interface Product {
  id: string
  name: string
  categoryName: string | null
  variants: ProductVariant[]
}

interface PointOfSale {
  id: string
  name: string
  code: string
  isActive: boolean
}

interface PosStock { variantId: string; quantity: number }

interface SaleReceipt {
  orderNumber: string
  customerName?: string
  paymentMethod?: string
  total: number
  createdAt: string
  items: { name: string; format: string; quantity: number; price: number; total: number }[]
}

interface SaleCartItem {
  variantId: string
  productName: string
  format: string
  price: number
  stock: number
  quantity: number
}

interface SaleHistoryItem {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  paymentMethod: string
  paymentStatus: string
  status: string
  total: number
  notes: string | null
  createdAt: string
  pointOfSale: { id: string; name: string; code: string } | null
  items: { id: string; name: string; format: string; quantity: number; price: number; total: number }[]
}

const paymentMethods = [
  { value: "CASH_ON_DELIVERY", label: "Espèces", icon: Banknote },
  { value: "MOBILE_MONEY_MTN", label: "MTN MoMo", icon: Smartphone },
  { value: "MOBILE_MONEY_AIRTEL", label: "Airtel Money", icon: Smartphone },
  { value: "CARD", label: "Visa / Carte", icon: CreditCard },
]

const paymentLabels: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces",
  MOBILE_MONEY_MTN: "MTN MoMo",
  MOBILE_MONEY_AIRTEL: "Airtel Money",
  CARD: "Visa / Carte",
}

const paymentMethodToApi: Record<string, string> = {
  CASH_ON_DELIVERY: "CASH_ON_DELIVERY",
  MOBILE_MONEY_MTN: "MOBILE_MONEY",
  MOBILE_MONEY_AIRTEL: "MOBILE_MONEY",
  CARD: "CARD",
}

const mobileProviders: Record<string, "MTN_MOMO" | "AIRTEL_MONEY"> = {
  MOBILE_MONEY_MTN: "MTN_MOMO",
  MOBILE_MONEY_AIRTEL: "AIRTEL_MONEY",
}

export default function VentesPage() {
  const [tab, setTab] = useState<"nouvelle" | "historique">("nouvelle")
  const [products, setProducts] = useState<Product[]>([])
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null)
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<SaleCartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState("CASH_ON_DELIVERY")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [pointOfSaleId, setPointOfSaleId] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [lowStockThreshold] = useLowStockThreshold()
  const [posStocks, setPosStocks] = useState<PosStock[]>([])

  const [salesHistory, setSalesHistory] = useState<SaleHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState("")
  const [weekOffset, setWeekOffset] = useState(0)
  const [expandedSale, setExpandedSale] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const HISTORY_PER_PAGE = 15
  const [pendingPayment, setPendingPayment] = useState<{ transactionId: string; reference: string; provider: string } | null>(null)
  const [pollingStatus, setPollingStatus] = useState<string | null>(null)

  const printReceipt = (ticket: SaleReceipt) => {
    const pointOfSale = pointsOfSale.find((point) => point.id === pointOfSaleId)
    const popup = window.open("", "ticket", "width=360,height=700")
    if (!popup) return
    popup.document.write(
      buildTicketHtml({
        orderNumber: ticket.orderNumber,
        customerName: ticket.customerName || "Client comptoir",
        paymentMethod: ticket.paymentMethod || "CASH_ON_DELIVERY",
        paymentStatus: "PAID",
        total: ticket.total,
        createdAt: ticket.createdAt,
        pointOfSale: pointOfSale ? { name: pointOfSale.name, code: pointOfSale.code } : null,
        items: ticket.items,
      })
    )
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const printHistoryTicket = (sale: SaleHistoryItem) => {
    const popup = window.open("", "ticket", "width=360,height=700")
    if (!popup) return
    popup.document.write(
      buildTicketHtml({
        orderNumber: sale.orderNumber,
        customerName: sale.customerName || "Client comptoir",
        paymentMethod: sale.paymentMethod || "CASH_ON_DELIVERY",
        paymentStatus: sale.paymentStatus || "PAID",
        total: sale.total,
        createdAt: sale.createdAt,
        pointOfSale: sale.pointOfSale ? { name: sale.pointOfSale.name, code: sale.pointOfSale.code } : null,
        items: sale.items,
      })
    )
    popup.document.close()
    popup.focus()
    popup.print()
  }

  const loadProducts = async () => {
    setError("")
    try {
      const res = await fetch("/api/produits")
      if (!res.ok) throw new Error("Impossible de charger les produits")
      setProducts(await res.json())
      const pointsRes = await fetch("/api/points-de-vente")
      if (pointsRes.ok) {
        const payload = await pointsRes.json()
        const points = (Array.isArray(payload) ? payload : payload.points) as PointOfSale[]
        setPointsOfSale(points.filter((point) => point.isActive))
        setPointOfSaleId((current) => current || points.find((point) => point.isActive)?.id || "")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  const loadPosStock = async (posId: string) => {
    if (!posId) { setPosStocks([]); return }
    try {
      const res = await fetch(`/api/points-de-vente/${posId}`)
      if (res.ok) {
        const data = await res.json()
        setPosStocks((data.stocks ?? []).map((s: any) => ({ variantId: s.variantId ?? s.variant?.id, quantity: s.quantity })))
      }
    } catch { setPosStocks([]) }
  }

  useEffect(() => { void loadPosStock(pointOfSaleId) }, [pointOfSaleId])

  const loadSalesHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/sales")
      if (res.ok) setSalesHistory(await res.json())
    } catch {
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "historique") loadSalesHistory()
  }, [tab])

  useEffect(() => {
    if (!pendingPayment) return
    let cancelled = false
    let attempts = 0
    const maxAttempts = 30

    const poll = async () => {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled) {
          setPendingPayment(null)
          setPollingStatus(null)
          setError("Délai d'attente dépassé. Vérifiez le statut du paiement dans l'historique.")
        }
        return
      }
      attempts++
      setPollingStatus(`Vérification... (${attempts}/${maxAttempts})`)
      try {
        const res = await fetch(`/api/payments/status?provider=${pendingPayment.provider}&transactionId=${pendingPayment.transactionId}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.status === "SUCCESSFUL") {
          setPendingPayment(null)
          setPollingStatus(null)
          setSuccess(`Paiement confirmé pour ${pendingPayment.reference}`)
          loadSalesHistory()
          return
        }
        if (data.status === "FAILED") {
          setPendingPayment(null)
          setPollingStatus(null)
          setError(`Paiement échoué pour ${pendingPayment.reference}`)
          return
        }
      } catch {}
      setTimeout(poll, 3000)
    }
    poll()
    return () => { cancelled = true }
  }, [pendingPayment])

  const variants = useMemo(() => {
    const posMap = new Map(posStocks.map((s) => [s.variantId, s.quantity]))
    return products.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product.id,
        productName: product.name,
        categoryName: product.categoryName ?? "Sans catégorie",
        ...variant,
        stock: posMap.has(variant.id) ? posMap.get(variant.id)! : variant.stock,
        _isPosStock: posMap.has(variant.id),
      }))
    )
  }, [products, posStocks])

  const filteredVariants = variants.filter((variant) => {
    if (pointOfSaleId && (!variant._isPosStock || variant.stock <= 0)) return false
    const term = search.toLowerCase()
    return `${variant.productName} ${variant.format} ${variant.categoryName}`.toLowerCase().includes(term)
  })

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const addToCart = (variant: (typeof variants)[number]) => {
    setSuccess("")
    setError("")
    setCart((current) => {
      const existing = current.find((item) => item.variantId === variant.id)
      if (existing) {
        return current.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: Math.min(item.stock, item.quantity + 1) }
            : item
        )
      }
      return [
        ...current,
        {
          variantId: variant.id,
          productName: variant.productName,
          format: variant.format,
          price: variant.price,
          stock: variant.stock,
          quantity: 1,
        },
      ]
    })
  }

  const updateQuantity = (variantId: string, quantity: number) => {
    setCart((current) =>
      current.map((item) =>
        item.variantId === variantId
          ? { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) }
          : item
      )
    )
  }

  const removeItem = (variantId: string) => {
    setCart((current) => current.filter((item) => item.variantId !== variantId))
  }

  const submitSale = async () => {
    setError("")
    setSuccess("")

    if (!pointOfSaleId) {
      setError("Sélectionnez un point de vente")
      return
    }

    if (cart.length === 0) {
      setError("Ajoutez au moins un produit à la vente")
      return
    }

    if (paymentMethod !== "CASH_ON_DELIVERY" && !customerPhone.trim()) {
      setError("Numéro de téléphone requis pour ce mode de paiement")
      return
    }

    setSubmitting(true)
    try {
      const isMobile = paymentMethod in mobileProviders
      const isCard = paymentMethod === "CARD"

      if (isMobile || isCard) {
        const provider = isMobile ? mobileProviders[paymentMethod] : "VISA_CARD"
        const orderNumber = `LCG-${Date.now()}`
        const origin = window.location.origin

        const payRes = await fetch("/api/payments/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            amount: total,
            phone: customerPhone,
            reference: orderNumber,
            description: `Vente LCG - ${cart.map((c) => c.productName).join(", ")}`,
            origin,
          }),
        })

        const payData = await payRes.json()
        if (!payRes.ok || !payData.success) {
          throw new Error(payData.error || "Échec de l'initiation du paiement")
        }

        if (isCard && payData.redirectUrl) {
          window.open(payData.redirectUrl, "_blank")
        }

        setPendingPayment({
          transactionId: payData.transactionId,
          reference: orderNumber,
          provider: isMobile ? mobileProviders[paymentMethod] : "VISA_CARD",
        })
        setSuccess(`Paiement initié ${isMobile ? `- En attente de confirmation (${provider === "MTN_MOMO" ? "MTN MoMo" : "Airtel Money"})` : "- Veuillez compléter le paiement par carte"}`)
        setCart([])
        setCustomerName("")
        setCustomerPhone("")
        setNotes("")
        return
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentMethod: paymentMethodToApi[paymentMethod] || "CASH_ON_DELIVERY",
          pointOfSaleId,
          notes,
          items: cart.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        }),
      })

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Vente refusée")

      setSuccess(`Vente ${body.orderNumber} enregistrée - ${formatPrice(body.total)}`)
      setReceipt(body as SaleReceipt)
      setCart([])
      setCustomerName("")
      setCustomerPhone("")
      setNotes("")
      await loadProducts()
      await loadPosStock(pointOfSaleId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la vente")
    } finally {
      setSubmitting(false)
    }
  }

  const getWeekRange = (offset: number) => {
    const now = new Date()
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday + offset * 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { monday, sunday }
  }

  const { monday: weekStart, sunday: weekEnd } = getWeekRange(weekOffset)

  const weekLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} — ${weekEnd.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`

  const filteredHistory = useMemo(() => {
    return salesHistory.filter((sale) => {
      const saleDate = new Date(sale.createdAt)
      const inWeek = saleDate >= weekStart && saleDate <= weekEnd
      const term = historySearch.toLowerCase()
      const matchesSearch = `${sale.orderNumber} ${sale.customerName} ${sale.pointOfSale?.name || ""}`.toLowerCase().includes(term)
      return inWeek && matchesSearch
    })
  }, [salesHistory, historySearch, weekStart, weekEnd])

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PER_PAGE))
  const historyCurrentPage = Math.min(historyPage, historyTotalPages)
  const pagedHistory = filteredHistory.slice((historyCurrentPage - 1) * HISTORY_PER_PAGE, historyCurrentPage * HISTORY_PER_PAGE)

  const todayTotal = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return salesHistory
      .filter((s) => s.createdAt.slice(0, 10) === today)
      .reduce((sum, s) => sum + s.total, 0)
  }, [salesHistory])

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return salesHistory.filter((s) => s.createdAt.slice(0, 10) === today).length
  }, [salesHistory])

  const variantSummary = useMemo(() => {
    const map = new Map<string, { name: string; format: string; quantity: number; total: number; posNames: Set<string> }>()
    for (const sale of filteredHistory) {
      for (const item of sale.items) {
        const key = `${item.name}||${item.format}`
        const existing = map.get(key)
        if (existing) {
          existing.quantity += item.quantity
          existing.total += item.total
          if (sale.pointOfSale?.name) existing.posNames.add(sale.pointOfSale.name)
        } else {
          map.set(key, {
            name: item.name,
            format: item.format,
            quantity: item.quantity,
            total: item.total,
            posNames: sale.pointOfSale?.name ? new Set([sale.pointOfSale.name]) : new Set(),
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity)
  }, [filteredHistory])

  const posSummary = useMemo(() => {
    const map = new Map<string, { name: string; code: string; salesCount: number; totalRevenue: number; itemsSold: number }>()
    for (const sale of filteredHistory) {
      if (!sale.pointOfSale) continue
      const existing = map.get(sale.pointOfSale.id)
      if (existing) {
        existing.salesCount++
        existing.totalRevenue += sale.total
        existing.itemsSold += sale.items.reduce((s, i) => s + i.quantity, 0)
      } else {
        map.set(sale.pointOfSale.id, {
          name: sale.pointOfSale.name,
          code: sale.pointOfSale.code,
          salesCount: 1,
          totalRevenue: sale.total,
          itemsSold: sale.items.reduce((s, i) => s + i.quantity, 0),
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [filteredHistory])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mes ventes</h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">Ventes effectuées depuis le comptoir et points de vente.</p>
        </div>
        <button onClick={() => { loadProducts(); if (tab === "historique") loadSalesHistory() }} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setTab("nouvelle")}
          className={`shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            tab === "nouvelle"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ReceiptText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Nouvelle vente
        </button>
        <button
          onClick={() => setTab("historique")}
          className={`shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            tab === "historique"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Search className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Historique des ventes
          {salesHistory.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">{salesHistory.length}</span>
          )}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      {tab === "nouvelle" && (
        <>
          {receipt && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-5 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-bold text-primary">Vente enregistrée</p>
                  <p className="text-sm text-gray-600">{receipt.orderNumber} · {new Date(receipt.createdAt).toLocaleString("fr-FR")} · {formatPrice(receipt.total)}</p>
                </div>
                <button type="button" onClick={() => printReceipt(receipt)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <Printer className="h-4 w-4" /> Imprimer le ticket
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[340px_1fr]">
                <div className="space-y-2 rounded-lg bg-white p-3 sm:p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Détails</p>
                      <div className="space-y-1 text-xs sm:text-sm">
                    <p><span className="text-gray-500">Client :</span> {receipt.customerName || "Client comptoir"}</p>
                    <p><span className="text-gray-500">Paiement :</span> {receipt.paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : receipt.paymentMethod === "CARD" ? "Carte" : "Espèces"}</p>
                    <p><span className="text-gray-500">Statut :</span> <span className="text-green-600 font-medium">Payé</span></p>
                  </div>
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
                    {receipt.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.name} {item.format} × {item.quantity}</span>
                        <span className="font-medium">{formatPrice(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-gray-100 pt-2 flex items-center justify-between text-sm sm:text-base font-bold">
                    <span>Total</span><span>{formatPrice(receipt.total)}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu du ticket</p>
                  <iframe
                    ref={(el) => { if (el) { try { el.contentDocument?.open(); el.contentDocument?.write(buildTicketHtml({ orderNumber: receipt.orderNumber, customerName: receipt.customerName || "Client comptoir", paymentMethod: receipt.paymentMethod || "CASH_ON_DELIVERY", paymentStatus: "PAID", total: receipt.total, createdAt: receipt.createdAt, pointOfSale: null, items: receipt.items })); el.contentDocument?.close(); } catch {} } }}
                    title="Aperçu ticket"
                    className="w-full rounded border-0"
                    style={{ height: "420px" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1fr_420px]">
            <section className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit, format ou catégorie..." className="w-full rounded-lg border border-gray-300 py-2 sm:py-2.5 pl-9 pr-4 text-xs sm:text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {loading && <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 text-center text-xs sm:text-sm text-gray-500 md:col-span-2">Chargement...</div>}
                {!loading && !pointOfSaleId && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6 text-center text-xs sm:text-sm text-amber-700 md:col-span-2">
                    Sélectionnez un point de vente pour afficher les produits disponibles.
                  </div>
                )}
                {!loading && pointOfSaleId && filteredVariants.length === 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 text-center text-xs sm:text-sm text-gray-500 md:col-span-2">
                    Aucun produit disponible dans ce point de vente.
                  </div>
                )}
                {!loading && pointOfSaleId && filteredVariants.map((variant) => {
                  const outOfStock = variant.stock <= 0
                  const lowStock = variant.stock > 0 && variant.stock <= lowStockThreshold
                  const disabled = outOfStock
                  const inCart = cart.some((item) => item.variantId === variant.id)
                  return (
                    <button key={variant.id} disabled={disabled} onClick={() => addToCart(variant)} className={`rounded-xl border p-3 sm:p-4 text-left transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${inCart ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600/30" : outOfStock ? "border-red-300 bg-red-50 hover:border-red-400" : lowStock ? "border-red-200 bg-red-50 hover:border-red-300" : "border-gray-200 bg-white hover:border-primary-300"}`}>
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{variant.productName}</p>
                          <p className="mt-1 text-[11px] sm:text-xs text-gray-500 truncate">{variant.format} - {variant.categoryName}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary-50 px-2 py-1 text-[11px] sm:text-xs font-semibold text-primary-700">{formatPrice(variant.price)}</span>
                      </div>
                      <p className={`mt-2 sm:mt-3 text-[11px] sm:text-xs font-medium ${variant.stock <= lowStockThreshold ? "text-red-600" : "text-gray-500"}`}>Stock : {variant.stock} {variant.unit ?? ""}</p>
                    </button>
                  )
                })}
              </div>
            </section>

            <aside className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 xl:sticky xl:top-6 xl:self-start">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-900"><ReceiptText className="h-4 w-4" /> Ticket de vente</h2>
                <span className="text-[11px] sm:text-xs text-gray-500">{cart.length} ligne(s)</span>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] sm:text-xs font-medium text-gray-600">Client
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs sm:text-sm" placeholder="Client comptoir" />
                </label>
                <label className="block text-[11px] sm:text-xs font-medium text-gray-600">Téléphone
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs sm:text-sm" placeholder="Optionnel" />
                </label>
                <label className="block text-[11px] sm:text-xs font-medium text-gray-600">Point de vente
                  <select value={pointOfSaleId} onChange={(e) => setPointOfSaleId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm">
                    <option value="">Sélectionner un point de vente</option>
                    {pointsOfSale.map((point) => <option key={point.id} value={point.id}>{point.name} ({point.code})</option>)}
                  </select>
                </label>
              </div>

              {pointOfSaleId && posStocks.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-2">Stock du point de vente</p>
                  <div className="space-y-1.5">
                    {(() => {
                      const posMap = new Map(posStocks.map((s) => [s.variantId, s.quantity]))
                      const allVariants = products.flatMap((p) =>
                        p.variants.map((v) => ({
                          name: p.name,
                          format: v.format,
                          stock: posMap.get(v.id) ?? 0,
                          unit: v.unit,
                        }))
                      )
                      return allVariants.map((v, i) => {
                        const isOut = v.stock <= 0
                        const isLow = v.stock > 0 && v.stock <= lowStockThreshold
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 truncate">{v.name} {v.format}</span>
                            <span className={`ml-2 shrink-0 font-semibold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"}`}>
                              {v.stock} {v.unit ?? ""}
                            </span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              <div className="my-3 sm:my-5 space-y-2 border-y border-gray-100 py-3 sm:py-4">
                {cart.map((item) => (
                    <div key={item.variantId} className="rounded-lg bg-gray-50 p-2.5 sm:p-3">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        <p className="text-[11px] sm:text-xs text-gray-500">{item.format}</p>
                      </div>
                      <button onClick={() => removeItem(item.variantId)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                        <button onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="p-1.5 text-gray-500"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="min-w-8 text-center text-xs sm:text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="p-1.5 text-gray-500"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Aucun article dans le ticket.</p>}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm sm:text-base"><span className="font-semibold text-gray-900">Total</span><span className="text-lg sm:text-xl font-bold text-gray-900">{formatPrice(total)}</span></div>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon
                    return <button key={method.value} onClick={() => setPaymentMethod(method.value)} className={`rounded-lg border px-2 py-2 text-[10px] sm:text-xs font-medium ${paymentMethod === method.value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{method.label}</button>
                  })}
                </div>
                {paymentMethod !== "CASH_ON_DELIVERY" && (
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={paymentMethod === "CARD" ? "Email (optionnel)" : "Numéro de téléphone (ex: 06 XXX XXX)"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs sm:text-sm"
                  />
                )}
                {pendingPayment && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <p className="font-semibold">Paiement en attente: {pendingPayment.reference}</p>
                    {pollingStatus && <p className="mt-1">{pollingStatus}</p>}
                  </div>
                )}
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs sm:text-sm" placeholder="Note optionnelle" />
                <div className="border-t border-gray-200 pt-4">
                  <button type="button" onClick={submitSale} disabled={submitting || cart.length === 0 || !!pendingPayment} aria-label="Valider la vente" className="flex min-h-10 sm:min-h-12 w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting ? "Validation..." : paymentMethod !== "CASH_ON_DELIVERY" ? "Initier le paiement" : "Valider la vente"}
                  </button>
                  {cart.length === 0 && <p className="mt-2 text-center text-xs text-gray-500">Ajoutez un produit pour activer la validation.</p>}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {tab === "historique" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">Ventes aujourd&apos;hui</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{todayCount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">Total aujourd&apos;hui</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-primary">{formatPrice(todayTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">Total général</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{formatPrice(salesHistory.reduce((sum, s) => sum + s.total, 0))}</p>
            </div>
          </div>

          {variantSummary.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <h3 className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ventes par variante (sacs)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500">Produit</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-500">Format</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500">Qté vendue</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500">CA total</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-500">Point de vente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantSummary.map((v, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 font-medium text-gray-900">{v.name}</td>
                        <td className="py-2 text-gray-600">{v.format}</td>
                        <td className="py-2 text-right font-semibold text-primary">{v.quantity}</td>
                        <td className="py-2 text-right font-medium text-gray-900">{formatPrice(v.total)}</td>
                        <td className="py-2">
                          {v.posNames.size > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Array.from(v.posNames).map((name) => (
                                <span key={name} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{name}</span>
                              ))}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-bold">
                      <td className="py-2 text-gray-900" colSpan={2}>Total</td>
                      <td className="py-2 text-right text-primary">{variantSummary.reduce((s, v) => s + v.quantity, 0)}</td>
                      <td className="py-2 text-right text-gray-900">{formatPrice(variantSummary.reduce((s, v) => s + v.total, 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {posSummary.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <h3 className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Stock décrémenté par point de vente</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {posSummary.map((pos, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 sm:p-3">
                    <p className="text-xs sm:text-sm font-semibold text-gray-900">{pos.name} <span className="text-[11px] sm:text-xs font-normal text-gray-400">({pos.code})</span></p>
                    <div className="mt-2 space-y-1 text-[11px] sm:text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Ventes</span><span className="font-medium text-gray-900">{pos.salesCount}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Articles vendus</span><span className="font-semibold text-primary">{pos.itemsSold} sacs</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">CA total</span><span className="font-medium text-gray-900">{formatPrice(pos.totalRevenue)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
                <button onClick={() => setWeekOffset((v) => v - 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50">&lsaquo;</button>
                <div className="flex flex-col items-center min-w-[140px] sm:min-w-[180px]">
                  <span className="text-xs sm:text-sm font-semibold text-gray-900">{weekLabel}</span>
                {weekOffset === 0 && <span className="text-[11px] text-primary font-medium">Cette semaine</span>}
                {weekOffset === -1 && <span className="text-[11px] text-gray-400">Semaine passée</span>}
              </div>
                <button onClick={() => setWeekOffset((v) => v + 1)} disabled={weekOffset >= 0} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="ml-1 text-xs text-primary hover:underline font-medium">Aujourd&apos;hui</button>
              )}
            </div>
            <div className="relative flex-1 sm:ml-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par numéro, client ou point de vente..."
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1) }}
                className="w-full rounded-lg border border-gray-300 py-2 sm:py-2.5 pl-9 pr-4 text-xs sm:text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          {historyLoading && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center text-sm text-gray-500">Chargement de l&apos;historique...</div>
          )}

          {!historyLoading && pagedHistory.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center text-sm text-gray-500">
              Aucune vente comptoir trouvée.
            </div>
          )}

          {!historyLoading && pagedHistory.map((sale) => (
            <div key={sale.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                className="w-full text-left p-3 sm:p-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono font-semibold text-gray-900">{sale.orderNumber}</span>
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Vente comptoir
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {sale.customerName}
                      {sale.pointOfSale && <span className="ml-2 text-gray-400">· {sale.pointOfSale.name}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatPrice(sale.total)}</p>
                      <p className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleDateString("fr-FR")} {new Date(sale.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); printHistoryTicket(sale) }}
                      className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-100"
                      title="Imprimer le ticket"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSale === sale.id ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </button>

              {expandedSale === sale.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-[1fr_280px]">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Articles</h4>
                      <div className="space-y-2">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-white p-2 sm:p-2.5 rounded-lg border border-gray-100">
                            <div className="min-w-0">
                              <span className="font-medium text-gray-900">{item.name}</span>
                              {item.format && <span className="text-gray-500 ml-1.5">{item.format}</span>}
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-gray-500">×{item.quantity}</span>
                              <span className="font-semibold text-gray-900 w-20 sm:w-24 text-right">{formatPrice(item.total)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs sm:text-sm font-bold pt-2 border-t border-gray-200">
                          <span className="text-gray-900">Total</span>
                          <span className="text-gray-900">{formatPrice(sale.total)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm bg-white p-2.5 sm:p-3 rounded-lg border border-gray-100 h-fit">
                      <p><span className="text-gray-500">Client :</span> <span className="font-medium">{sale.customerName}</span></p>
                      {sale.customerPhone && <p><span className="text-gray-500">Téléphone :</span> <span className="font-medium">{sale.customerPhone}</span></p>}
                      <p><span className="text-gray-500">Paiement :</span> <span className="font-medium">{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</span></p>
                      <p><span className="text-gray-500">Statut :</span> <span className="font-medium text-green-600">Payé</span></p>
                      {sale.pointOfSale && <p><span className="text-gray-500">Point de vente :</span> <span className="font-medium">{sale.pointOfSale.name} ({sale.pointOfSale.code})</span></p>}
                      {sale.notes && <p><span className="text-gray-500">Notes :</span> <span className="font-medium">{sale.notes}</span></p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!historyLoading && filteredHistory.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 gap-2 sm:gap-0">
                      <p className="text-[11px] sm:text-xs text-gray-500">
                {filteredHistory.length} vente{filteredHistory.length > 1 ? "s" : ""} · Page {historyCurrentPage}/{historyTotalPages}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setHistoryPage(1)} disabled={historyCurrentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
                <button onClick={() => setHistoryPage(historyCurrentPage - 1)} disabled={historyCurrentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
                {Array.from({ length: historyTotalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === historyTotalPages || Math.abs(p - historyCurrentPage) <= 1)
                  .reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, [])
                  .map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span> : <button key={p} onClick={() => setHistoryPage(p)} className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${p === historyCurrentPage ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>)}
                <button onClick={() => setHistoryPage(historyCurrentPage + 1)} disabled={historyCurrentPage >= historyTotalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
                <button onClick={() => setHistoryPage(historyTotalPages)} disabled={historyCurrentPage >= historyTotalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
