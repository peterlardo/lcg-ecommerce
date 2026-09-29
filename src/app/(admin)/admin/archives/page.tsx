"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Archive, ChevronDown, Search, ShoppingCart } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { ARCHIVE_AFTER_DAYS, isArchivedOrder, isTicketOrder } from "@/lib/archives"

const categoryTabs = ["Toutes", "Tickets de caisse", "Commandes"]

interface OrderItem {
  productId: string
  variantId: string
  name: string
  format: string
  quantity: number
  price: number
  total: number
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  paymentMethod: string
  paymentStatus: string
  source: string
  total: number
  createdAt: string
  notes: string | null
  ticketGenerated?: boolean
  items: OrderItem[]
  delivery: { address: string; city: string; district: string | null; notes: string | null } | null
  pointOfSaleId: string | null
  pointOfSale?: { name: string } | null
}

const paymentLabels: Record<string, string> = {
  CARD: "Carte bancaire",
  MOBILE_MONEY: "Mobile Money",
  CASH_ON_DELIVERY: "Paiement à la livraison",
}

const sourceLabels: Record<string, { label: string; className: string }> = {
  WEB: { label: "En ligne", className: "bg-teal-100 text-teal-700" },
  OPERATOR: { label: "Opérateur", className: "bg-violet-100 text-violet-700" },
}

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  PAID: { label: "Réglée", className: "bg-green-100 text-green-700" },
  PENDING: { label: "En attente", className: "bg-amber-100 text-amber-700" },
  REFUNDED: { label: "Remboursée", className: "bg-red-100 text-red-700" },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR")
}

export default function ArchivesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("Toutes")
  const [searchName, setSearchName] = useState("")
  const [searchCode, setSearchCode] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 5

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/orders", { signal: controller.signal })
        if (!controller.signal.aborted && res.ok) setOrders(await res.json())
      } catch (error) {
        if (!controller.signal.aborted) console.error("Erreur chargement archives:", error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  const archived = orders.filter((order) => isArchivedOrder(order))
  const ticketCount = archived.filter((order) => isTicketOrder(order)).length

  const filtered = archived.filter((order) => {
    const matchesTab =
      activeTab === "Toutes" ||
      (activeTab === "Tickets de caisse" && isTicketOrder(order)) ||
      (activeTab === "Commandes" && !isTicketOrder(order))
    const matchesName =
      !searchName || order.customerName.toLowerCase().includes(searchName.toLowerCase())
    const matchesCode =
      !searchCode || order.orderNumber.toLowerCase().includes(searchCode.toLowerCase())
    return matchesTab && matchesName && matchesCode
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const handleSearchName = (v: string) => { setSearchName(v); setPage(1) }
  const handleSearchCode = (v: string) => { setSearchCode(v); setPage(1) }
  const handleTab = (t: string) => { setActiveTab(t); setPage(1) }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
            <Archive className="h-5 w-5 text-gray-400" />
            Archives
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Éléments réglés depuis plus de {ARCHIVE_AFTER_DAYS} jours, classés par source
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Nom du client..."
              value={searchName}
              onChange={(e) => handleSearchName(e.target.value)}
              className="w-full sm:w-56 pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Code commande..."
              value={searchCode}
              onChange={(e) => handleSearchCode(e.target.value)}
              className="w-full sm:w-56 pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {!loading && archived.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Archive className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{archived.length} élément{archived.length > 1 ? "s" : ""} archivé{archived.length > 1 ? "s" : ""}</span>
            {" · dont "}
            <span className="font-semibold">{ticketCount} ticket{ticketCount > 1 ? "s" : ""} de caisse</span>
          </p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {categoryTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab}
            <span className="ml-1.5 text-xs opacity-70">
              (
              {tab === "Toutes"
                ? archived.length
                : tab === "Tickets de caisse"
                  ? ticketCount
                  : archived.length - ticketCount}
              )
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8 text-center">
            <p className="text-sm text-gray-500">Chargement des archives...</p>
          </div>
        )}
        {!loading && paged.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              className="w-full text-left p-3 sm:p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isTicketOrder(order) ? (
                      <Archive className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ShoppingCart className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        sourceLabels[order.source]?.className || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {sourceLabels[order.source]?.label || order.source || "En ligne"}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        paymentStatusConfig[order.paymentStatus]?.className || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {paymentStatusConfig[order.paymentStatus]?.label || order.paymentStatus}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                      {isTicketOrder(order) ? "Ticket de caisse" : "Commande"}
                    </span>
                  </div>
                  <p className="break-words text-xs sm:text-sm font-medium text-gray-700">{order.customerName}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                      {formatPrice(order.total)}
                    </p>
                    <p className="hidden text-xs text-gray-500 sm:block">{formatDate(order.createdAt)}</p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expanded === order.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            </button>

            {expanded === order.id && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-3 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Articles
                    </h4>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm bg-white p-2 rounded-lg border border-gray-100 gap-2"
                        >
                          <span className="min-w-0 break-words text-gray-700">
                            {item.name}
                            {item.format ? ` — ${item.format}` : ""}
                          </span>
                          <span className="text-gray-500">x{item.quantity}</span>
                          <span className="font-medium text-gray-900">
                            {formatPrice(item.total)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                        <span className="text-gray-900">Total</span>
                        <span className="text-gray-900">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Informations
                    </h4>
                    <div className="space-y-2 text-sm bg-white p-2.5 sm:p-3 rounded-lg border border-gray-100">
                      <p className="break-words text-gray-700">
                        <span className="font-medium text-gray-500">Adresse: </span>
                        {order.delivery
                          ? `${order.delivery.address}${order.delivery.district ? ` — ${order.delivery.district}` : ""} (${order.delivery.city})`
                          : "—"}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Paiement: </span>
                        {paymentLabels[order.paymentMethod] || order.paymentMethod || "—"}
                      </p>
                      {order.pointOfSale && (
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-500">Point de vente: </span>
                          {order.pointOfSale.name}
                        </p>
                      )}
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Statut paiement: </span>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          paymentStatusConfig[order.paymentStatus]?.className || "bg-gray-100 text-gray-600"
                        }`}>
                          {paymentStatusConfig[order.paymentStatus]?.label || order.paymentStatus}
                        </span>
                      </p>
                      <p className="break-words text-gray-700">
                        <span className="font-medium text-gray-500">Client: </span>
                        {order.customerEmail || "email non renseigné"} | {order.customerPhone}
                      </p>
                      {order.delivery?.notes && (
                        <p className="text-gray-700">
                          <span className="font-medium text-gray-500">Notes: </span>
                          {order.delivery.notes}
                        </p>
                      )}
                    </div>
                    <div className="mt-4">
                      <Link
                        href={`/admin/commandes/${order.id}/facture`}
                        className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        Voir la facture / le ticket
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8 text-center">
            <Archive className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Aucun élément archivé pour le moment — les commandes réglées apparaissent ici après {ARCHIVE_AFTER_DAYS} jours.
            </p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-3 gap-2 sm:gap-0">
            <p className="text-xs text-gray-500">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""} · Page {currentPage}/{totalPages}
            </p>
            <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto">
              <button onClick={() => setPage(1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
              <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span> : <button key={p} onClick={() => setPage(p)} className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${p === currentPage ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>)}
              <button onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
