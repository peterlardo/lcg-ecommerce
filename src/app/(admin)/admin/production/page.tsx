"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Factory, FileText, PackagePlus, RefreshCw, Search, Trash2, TrendingUp, XCircle } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatPrice } from "@/lib/utils"

interface LotVariant {
  id: string
  productId: string
  format: string
  price: number
  stock: number
  unit: string | null
  product: { name: string; category?: { name: string } | null }
}

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

interface LotsPayload {
  lots: Lot[]
  summary: LotSummary
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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: "Actif", color: "text-green-700 bg-green-100", icon: CheckCircle2 },
  EXHAUSTED: { label: "Epuise", color: "text-gray-600 bg-gray-100", icon: XCircle },
  EXPIRED: { label: "Expire", color: "text-red-700 bg-red-100", icon: AlertCircle },
}

const ALLOC_TYPE: Record<string, string> = { SALE: "Vente", TRANSFER: "Transfert", LOSS: "Perte", ADJUSTMENT: "Ajustement" }

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("fr-FR")
}

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export default function ProductionPage() {
  const [lotsData, setLotsData] = useState<LotsPayload | null>(null)
  const [reports, setReports] = useState<ReportPayload | null>(null)
  const [stockVariants, setStockVariants] = useState<StockVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [variantId, setVariantId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [expiryDate, setExpiryDate] = useState("")
  const [note, setNote] = useState("")

  const [filterStatus, setFilterStatus] = useState<string>("")
  const [searchLot, setSearchLot] = useState("")
  const [selectedLot, setSelectedLot] = useState<any>(null)
  const [tab, setTab] = useState<"lots" | "alerts">("lots")

  const load = async () => {
    setError("")
    try {
      const [lotsRes, reportRes, stockRes] = await Promise.all([
        fetch("/api/lots" + (filterStatus ? `?status=${filterStatus}` : "")),
        fetch("/api/reports"),
        fetch("/api/stock"),
      ])
      if (!lotsRes.ok || !reportRes.ok || !stockRes.ok) throw new Error("Erreur de chargement")
      const lotsJson = await lotsRes.json()
      const reportJson = await reportRes.json()
      const stockJson = await stockRes.json()
      setLotsData(lotsJson)
      setReports(reportJson)
      setStockVariants(stockJson.variants ?? [])
      if (!variantId && stockJson.variants?.[0]) setVariantId(stockJson.variants[0].variantId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [filterStatus])

  const filteredLots = useMemo(() => {
    const lots = lotsData?.lots ?? []
    if (!searchLot) return lots
    const q = searchLot.toLowerCase()
    return lots.filter((l) =>
      l.lotNumber.toLowerCase().includes(q) ||
      l.variant.product.name.toLowerCase().includes(q) ||
      l.variant.format.toLowerCase().includes(q)
    )
  }, [lotsData, searchLot])

  const totalProduced = (lotsData?.lots ?? []).reduce((s, l) => s + l.initialQuantity, 0)
  const totalRemaining = lotsData?.summary?._sum?.remainingQuantity ?? 0
  const activeLots = lotsData?.summary?._count ?? 0
  const selectedVariant = stockVariants.find((v) => v.variantId === variantId)

  const submitProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    const res = await fetch("/api/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        quantity,
        expiryDate: expiryDate || null,
        notes: note || null,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "Erreur lors de la creation du lot")
      return
    }

    const body = await res.json()
    setSuccess(`Lot ${body.lot.lotNumber} cree avec succes`)
    setQuantity(1)
    setExpiryDate("")
    setNote("")
    await load()
  }

  const deleteLot = async (lotId: string) => {
    if (!confirm("Supprimer ce lot ? Le stock restant sera retire.")) return
    setError("")
    const res = await fetch(`/api/lots/${lotId}`, { method: "DELETE" })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "Suppression impossible")
      return
    }
    setSuccess("Lot supprime")
    setSelectedLot(null)
    await load()
  }

  const viewLot = async (lot: Lot) => {
    const res = await fetch(`/api/lots/${lot.id}`)
    if (res.ok) {
      const data = await res.json()
      setSelectedLot(data.lot)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production & Lots</h1>
          <p className="mt-1 text-sm text-gray-500">Gestion des lots de production, traçabilité et suivi FIFO.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => { const { generateLotDocumentationPDF } = await import("@/lib/lot-doc-pdf"); generateLotDocumentationPDF().save("Documentation-Lot-Production-Traceabilite.pdf") }} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileText className="h-4 w-4" /> Documentation
          </button>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Lots actifs</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{activeLots}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <p className="text-xs font-medium text-blue-700">Total produit</p>
          <p className="mt-1 text-xl font-bold text-blue-800">{totalProduced}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-4">
          <p className="text-xs font-medium text-green-700">Stock restant (lots)</p>
          <p className="mt-1 text-xl font-bold text-green-800">{totalRemaining}</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-4">
          <p className="text-xs font-medium text-yellow-700">Alertes stock</p>
          <p className="mt-1 text-xl font-bold text-yellow-800">{(reports?.stockAlerts ?? []).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><Factory className="h-4 w-4" /> Nouveau lot</h2>
          <form onSubmit={submitProduction} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Produit / format
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                {stockVariants.map((v) => <option key={v.variantId} value={v.variantId}>{v.productName} - {v.format}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Quantité à produire
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Date d&apos;expiration (optionnel)
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Note
              <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Production glacon..." />
            </label>
            {selectedVariant && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                Stock actuel : <span className="font-semibold text-gray-900">{selectedVariant.stock} {selectedVariant.unit ?? ""}</span>
              </div>
            )}
            <button disabled={loading || !variantId} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <PackagePlus className="h-4 w-4" /> Creer le lot
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><TrendingUp className="h-4 w-4" /> Production / jour (30j)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports?.productionByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }} />
                <Bar dataKey="quantity" fill="#1f4fa3" radius={[4, 4, 0, 0]} name="Quantite" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit">
        <button onClick={() => setTab("lots")} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === "lots" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Factory className="inline h-4 w-4 mr-1" /> Lots
        </button>
        <button onClick={() => setTab("alerts")} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === "alerts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <AlertCircle className="inline h-4 w-4 mr-1" /> Alertes
        </button>
      </div>

      {tab === "lots" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Tous les lots ({filteredLots.length})</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={searchLot} onChange={(e) => setSearchLot(e.target.value)} className="w-56 rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="Rechercher un lot..." />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                <option value="">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="EXHAUSTED">Epuise</option>
                <option value="EXPIRED">Expire</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/80">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Numero</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Produit</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Format</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Produit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Restant</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500">Statut</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Production</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Expiration</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLots.map((lot) => {
                  const st = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.ACTIVE
                  const Icon = st.icon
                  return (
                    <tr key={lot.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary-700">{lot.lotNumber}</td>
                      <td className="px-4 py-2.5">{lot.variant.product.name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{lot.variant.format}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{lot.initialQuantity}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${lot.remainingQuantity === 0 ? "text-gray-400" : "text-gray-900"}`}>{lot.remainingQuantity}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${st.color}`}>
                          <Icon className="h-3 w-3" /> {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtDate(lot.productionDate)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{lot.expiryDate ? fmtDate(lot.expiryDate) : "-"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => viewLot(lot)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Details">
                          <FileText className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredLots.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">Aucun lot trouve.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "alerts" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Alertes a produire</h2>
          <div className="space-y-2">
            {(reports?.stockAlerts ?? []).map((alert) => (
              <div key={alert.variantId} className="flex items-center justify-between rounded-lg bg-yellow-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium text-gray-800">{alert.productName}</p>
                    <p className="text-xs text-gray-500">{alert.format} - {alert.categoryName}</p>
                  </div>
                </div>
                <span className="font-semibold text-yellow-800">{alert.stock}</span>
              </div>
            ))}
            {(reports?.stockAlerts ?? []).length === 0 && <p className="text-sm text-gray-500">Aucune alerte stock.</p>}
          </div>
        </section>
      )}

      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedLot(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Lot {selectedLot.lotNumber}</h3>
                <p className="text-sm text-gray-500">{selectedLot.variant?.product?.name} - {selectedLot.variant?.format}</p>
              </div>
              <button onClick={() => setSelectedLot(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Produit</p><p className="font-bold">{selectedLot.initialQuantity}</p></div>
              <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Restant</p><p className="font-bold">{selectedLot.remainingQuantity}</p></div>
              <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Consomme</p><p className="font-bold">{selectedLot.initialQuantity - selectedLot.remainingQuantity}</p></div>
              <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Statut</p><p className={`font-bold ${selectedLot.status === "ACTIVE" ? "text-green-700" : selectedLot.status === "EXPIRED" ? "text-red-700" : "text-gray-600"}`}>{selectedLot.status}</p></div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Production :</span> <span className="font-medium">{fmtDate(selectedLot.productionDate)}</span></div>
              {selectedLot.expiryDate && <div><span className="text-gray-500">Expiration :</span> <span className="font-medium">{fmtDate(selectedLot.expiryDate)}</span></div>}
              {selectedLot.createdBy && <div><span className="text-gray-500">Cree par :</span> <span className="font-medium">{selectedLot.createdBy.name}</span></div>}
              {selectedLot.notes && <div><span className="text-gray-500">Note :</span> <span className="font-medium">{selectedLot.notes}</span></div>}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Historique des allocations ({(selectedLot.allocations ?? []).length})</h4>
              <button onClick={() => deleteLot(selectedLot.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-3 w-3" /> Supprimer
              </button>
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
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-2">PDV ayant reçu ce lot</p>
                  <div className="space-y-1.5">
                    {Array.from(byPos.values()).map((p) => (
                      <div key={p.code} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.name} <span className="text-xs text-gray-400">({p.code})</span></span>
                        <span className="font-semibold text-amber-700">{p.qty} unités</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="max-h-60 overflow-y-auto">
              {(selectedLot.allocations ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">Aucune allocation (lot non encore utilise).</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50/80">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                      <th className="px-3 py-1.5 text-right text-xs font-semibold uppercase text-gray-500">Qte</th>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-gray-500">Reference</th>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-gray-500">PDV</th>
                      <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedLot.allocations.map((a: any) => (
                      <tr key={a.id}>
                        <td className="px-3 py-1.5">{ALLOC_TYPE[a.type] ?? a.type}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{a.quantity}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{a.reference || "-"}</td>
                        <td className="px-3 py-1.5">
                          {a.pointOfSale ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{a.pointOfSale.name}</span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">{fmtDateTime(a.createdAt)}</td>
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
