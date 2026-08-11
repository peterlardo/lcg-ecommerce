"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, CreditCard, Minus, Plus, Printer, ReceiptText, RefreshCw, Search, Smartphone, Trash2 } from "lucide-react"
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

const paymentMethods = [
  { value: "CASH_ON_DELIVERY", label: "Espèces", icon: Banknote },
  { value: "MOBILE_MONEY", label: "Mobile Money", icon: Smartphone },
  { value: "CARD", label: "Carte", icon: CreditCard },
]

export default function VentesPage() {
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

  const variants = useMemo(() => {
    return products.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product.id,
        productName: product.name,
        categoryName: product.categoryName ?? "Sans catégorie",
        ...variant,
      }))
    )
  }, [products])

  const filteredVariants = variants.filter((variant) => {
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

    setSubmitting(true)
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentMethod,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la vente")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vente comptoir</h1>
          <p className="mt-1 text-sm text-gray-500">Enregistrer une vente immédiate et encaisser rapidement.</p>
        </div>
        <button onClick={loadProducts} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}
      {receipt && <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"><div><p className="text-sm font-semibold text-primary">Ticket {receipt.orderNumber}</p><p className="text-xs text-gray-600">Vente enregistrée le {new Date(receipt.createdAt).toLocaleString("fr-FR")} · Total {formatPrice(receipt.total)}</p></div><button type="button" onClick={() => printReceipt(receipt)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Printer className="h-4 w-4" /> Imprimer le ticket</button></div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit, format ou catégorie..." className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {loading && <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 md:col-span-2">Chargement...</div>}
            {!loading && filteredVariants.map((variant) => {
              const outOfStock = variant.stock <= 0
              const lowStock = variant.stock > 0 && variant.stock <= lowStockThreshold
              const disabled = outOfStock
              return (
                <button key={variant.id} disabled={disabled} onClick={() => addToCart(variant)} className={`rounded-xl border p-4 text-left transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${outOfStock ? "border-red-300 bg-red-50 hover:border-red-400" : lowStock ? "border-red-200 bg-red-50 hover:border-red-300" : "border-gray-200 bg-white hover:border-primary-300"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{variant.productName}</p>
                      <p className="mt-1 text-xs text-gray-500">{variant.format} - {variant.categoryName}</p>
                    </div>
                    <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">{formatPrice(variant.price)}</span>
                  </div>
                  <p className={`mt-3 text-xs font-medium ${variant.stock <= lowStockThreshold ? "text-red-600" : "text-gray-500"}`}>Stock : {variant.stock} {variant.unit ?? ""}</p>
                </button>
              )
            })}
            {!loading && filteredVariants.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 md:col-span-2">Aucun produit trouvé.</div>}
          </div>
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white p-5 xl:sticky xl:top-6 xl:self-start">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ReceiptText className="h-4 w-4" /> Ticket de vente</h2>
            <span className="text-xs text-gray-500">{cart.length} ligne(s)</span>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-600">Client
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Client comptoir" />
            </label>
            <label className="block text-xs font-medium text-gray-600">Téléphone
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Optionnel" />
            </label>
            <label className="block text-xs font-medium text-gray-600">Point de vente
              <select value={pointOfSaleId} onChange={(e) => setPointOfSaleId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">Sélectionner un point de vente</option>
                {pointsOfSale.map((point) => <option key={point.id} value={point.id}>{point.name} ({point.code})</option>)}
              </select>
            </label>
          </div>

          <div className="my-5 space-y-2 border-y border-gray-100 py-4">
            {cart.map((item) => (
              <div key={item.variantId} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.format}</p>
                  </div>
                  <button onClick={() => removeItem(item.variantId)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                    <button onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="p-1.5 text-gray-500"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="p-1.5 text-gray-500"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Aucun article dans le ticket.</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-base"><span className="font-semibold text-gray-900">Total</span><span className="text-xl font-bold text-gray-900">{formatPrice(total)}</span></div>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon
                return <button key={method.value} onClick={() => setPaymentMethod(method.value)} className={`rounded-lg border px-2 py-2 text-xs font-medium ${paymentMethod === method.value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{method.label}</button>
              })}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Note optionnelle" />
            <div className="border-t border-gray-200 pt-4">
              <button type="button" onClick={submitSale} disabled={submitting || cart.length === 0} aria-label="Valider la vente" className="flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Validation..." : "Valider la vente"}
              </button>
              {cart.length === 0 && <p className="mt-2 text-center text-xs text-gray-500">Ajoutez un produit pour activer la validation.</p>}
              {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">{error}</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}











