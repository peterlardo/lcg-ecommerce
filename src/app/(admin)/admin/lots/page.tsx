"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, Download, FileText, FileSpreadsheet, PackagePlus, RefreshCw, Search, Trash2, XCircle } from "lucide-react"
import { exportLotsPDF, exportLotsExcel } from "@/lib/report-export"

interface StockVariant {
  variantId: string
  productName: string
  format: string
  stock: number
  unit: string | null
}

interface LotAllocation {
  id: string
  quantity: number
  type: string
  reference: string | null
  createdAt: string
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

interface LotSummary {
  _sum: { remainingQuantity: number | null }
  _count: number
}

interface LotsPayload {
  lots: Lot[]
  summary: LotSummary
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: "Actif", color: "text-green-700 bg-green-100", icon: CheckCircle2 },
  EXHAUSTED: { label: "Epuise", color: "text-gray-600 bg-gray-100", icon: XCircle },
  EXPIRED: { label: "Expire", color: "text-red-700 bg-red-100", icon: AlertCircle },
}

const ALLOC_LABEL: Record<string, string> = { SALE: "Vente", TRANSFER: "Transfert", LOSS: "Perte", ADJUSTMENT: "Ajustement", PRODUCTION: "Production" }

function fmtDate(v: string) { return new Date(v).toLocaleDateString("fr-FR") }
function fmtDateTime(v: string) { return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) }

export default function LotsPage() {
  const [data, setData] = useState<LotsPayload | null>(null)
  const [stockVariants, setStockVariants] = useState<StockVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [search, setSearch] = useState("")

  const [variantId, setVariantId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [expiryDate, setExpiryDate] = useState("")
  const [note, setNote] = useState("")

  const [selectedLot, setSelectedLot] = useState<any>(null)
  const [editExpiry, setEditExpiry] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [detailLoading, setDetailLoading] = useState(false)

  const load = async () => {
    setError("")
    try {
      const [lotsRes, stockRes] = await Promise.all([
        fetch("/api/lots" + (filterStatus ? `?status=${filterStatus}` : "")),
        fetch("/api/stock"),
      ])
      if (!lotsRes.ok || !stockRes.ok) throw new Error("Erreur de chargement")
      setData(await lotsRes.json())
      const sv = await stockRes.json()
      setStockVariants(sv.variants ?? [])
      if (!variantId && sv.variants?.[0]) setVariantId(sv.variants[0].variantId)
    } catch {
      setError("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [filterStatus])

  const filtered = useMemo(() => {
    const lots = data?.lots ?? []
    if (!search) return lots
    const q = search.toLowerCase()
    return lots.filter((l) =>
      l.lotNumber.toLowerCase().includes(q) ||
      l.variant.product.name.toLowerCase().includes(q) ||
      l.variant.format.toLowerCase().includes(q)
    )
  }, [data, search])

  const totalProduced = (data?.lots ?? []).reduce((s, l) => s + l.initialQuantity, 0)
  const totalRemaining = data?.summary?._sum?.remainingQuantity ?? 0
  const activeLots = data?.summary?._count ?? 0
  const selectedVariant = stockVariants.find((v) => v.variantId === variantId)

  const submitLot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    const res = await fetch("/api/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, quantity, expiryDate: expiryDate || null, notes: note || null }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "Erreur lors de la creation du lot")
      return
    }
    const body = await res.json()
    setSuccess("Lot " + body.lot.lotNumber + " cree avec succes")
    setQuantity(1)
    setExpiryDate("")
    setNote("")
    await load()
  }

  const openDetail = async (lot: Lot) => {
    setDetailLoading(true)
    setSelectedLot(lot)
    setEditExpiry(lot.expiryDate ? lot.expiryDate.slice(0, 10) : "")
    setEditNotes(lot.notes ?? "")
    try {
      const res = await fetch(`/api/lots/${lot.id}`)
      if (res.ok) {
        const d = await res.json()
        setSelectedLot(d.lot)
        setEditExpiry(d.lot.expiryDate ? d.lot.expiryDate.slice(0, 10) : "")
        setEditNotes(d.lot.notes ?? "")
      }
    } catch { /* keep basic lot data */ }
    setDetailLoading(false)
  }

  const updateLot = async () => {
    if (!selectedLot) return
    setError("")
    const res = await fetch(`/api/lots/${selectedLot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryDate: editExpiry || null, notes: editNotes }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "Erreur de modification")
      return
    }
    setSuccess("Lot modifie")
    setSelectedLot(null)
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

  const exportPDF = () => {
    if (!data) return
    exportLotsPDF({ lots: data.lots, lotSummary: { totalLots: data.lots.length, activeLots, totalProduced, totalRemaining } })
  }
  const exportExcel = () => {
    if (!data) return
    exportLotsExcel({ lots: data.lots, lotSummary: { totalLots: data.lots.length, activeLots, totalProduced, totalRemaining } })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lots</h1>
          <p className="mt-1 text-sm text-gray-500">Creer, suivre et gerer les lots de production.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Total lots</p><p className="mt-1 text-xl font-bold text-gray-900">{data?.lots.length ?? 0}</p></div>
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-4"><p className="text-xs font-medium text-green-700">Lots actifs</p><p className="mt-1 text-xl font-bold text-green-800">{activeLots}</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"><p className="text-xs font-medium text-blue-700">Total produit</p><p className="mt-1 text-xl font-bold text-blue-800">{totalProduced}</p></div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4"><p className="text-xs font-medium text-orange-700">Stock restant</p><p className="mt-1 text-xl font-bold text-orange-800">{totalRemaining}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><PackagePlus className="h-4 w-4" /> Nouveau lot</h2>
          <form onSubmit={submitLot} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Produit / format
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                {stockVariants.map((v) => <option key={v.variantId} value={v.variantId}>{v.productName} - {v.format}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Quantite a produire
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Tous les lots ({filtered.length})</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="Rechercher..." />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                <option value="">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="EXHAUSTED">Epuise</option>
                <option value="EXPIRED">Expire</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50/80">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Numero</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Produit</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Qte</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Restant</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">Statut</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Production</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Expiration</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((lot) => {
                    const st = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.ACTIVE
                    const Icon = st.icon
                    return (
                      <tr key={lot.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => openDetail(lot)}>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary-700">{lot.lotNumber}</td>
                        <td className="px-3 py-2.5">{lot.variant.product.name} <span className="text-gray-400">- {lot.variant.format}</span></td>
                        <td className="px-3 py-2.5 text-right font-semibold">{lot.initialQuantity}</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${lot.remainingQuantity === 0 ? "text-gray-400" : "text-gray-900"}`}>{lot.remainingQuantity}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${st.color}`}>
                            <Icon className="h-3 w-3" /> {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{fmtDate(lot.productionDate)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{lot.expiryDate ? fmtDate(lot.expiryDate) : "-"}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={(e) => { e.stopPropagation(); openDetail(lot) }} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Details">
                            <FileText className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Aucun lot trouve.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

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

            {detailLoading ? (
              <p className="text-sm text-gray-500">Chargement...</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Produit</p><p className="font-bold">{selectedLot.initialQuantity}</p></div>
                  <div className="rounded-lg bg-green-50 p-3 text-center"><p className="text-xs text-green-600">Restant</p><p className="font-bold text-green-700">{selectedLot.remainingQuantity}</p></div>
                  <div className="rounded-lg bg-red-50 p-3 text-center"><p className="text-xs text-red-600">Consomme</p><p className="font-bold text-red-700">{selectedLot.initialQuantity - selectedLot.remainingQuantity}</p></div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Statut</p><p className={`font-bold ${selectedLot.status === "ACTIVE" ? "text-green-700" : selectedLot.status === "EXPIRED" ? "text-red-700" : "text-gray-600"}`}>{selectedLot.status}</p></div>
                </div>

                <div className="mb-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Date d&apos;expiration
                    <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    Note
                    <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                  </label>
                  {selectedLot.createdBy && <p className="text-xs text-gray-500">Cree par : {selectedLot.createdBy.name}</p>}
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Allocations ({(selectedLot.allocations ?? []).length})</h4>
                  <div className="flex gap-2">
                    <button onClick={updateLot} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                      Enregistrer
                    </button>
                    <button onClick={() => deleteLot(selectedLot.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  </div>
                </div>

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
                          <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedLot.allocations.map((a: LotAllocation) => (
                          <tr key={a.id}>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${a.type === "SALE" ? "bg-blue-100 text-blue-700" : a.type === "LOSS" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                                {ALLOC_LABEL[a.type] ?? a.type}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right font-semibold">{a.quantity}</td>
                            <td className="px-3 py-1.5 font-mono text-xs">{a.reference || "-"}</td>
                            <td className="px-3 py-1.5 text-gray-500">{fmtDateTime(a.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
