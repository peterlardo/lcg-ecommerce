"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Clock, FileText, Package, Search, XCircle } from "lucide-react"

interface LotOption {
  id: string
  lotNumber: string
  productName: string
  format: string
  status: string
  remainingQuantity: number
}

interface LotDetail {
  id: string
  lotNumber: string
  initialQuantity: number
  remainingQuantity: number
  productionDate: string
  expiryDate: string | null
  status: string
  notes: string | null
  createdAt: string
  variant: { product: { name: string; category?: { name: string } | null }; format: string }
  createdBy?: { name: string } | null
}

interface Allocation {
  id: string
  quantity: number
  type: string
  reference: string | null
  createdAt: string
}

interface TraceData {
  lot: LotDetail
  allocations: Allocation[]
  movements: any[]
  summary: {
    initialQuantity: number
    remainingQuantity: number
    consumedQuantity: number
    totalAllocations: number
    saleAllocations: number
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: "Actif", color: "text-green-700 bg-green-100", icon: CheckCircle2 },
  EXHAUSTED: { label: "Epuise", color: "text-gray-600 bg-gray-100", icon: XCircle },
  EXPIRED: { label: "Expire", color: "text-red-700 bg-red-100", icon: AlertCircle },
}

const ALLOC_LABEL: Record<string, string> = { SALE: "Vente", TRANSFER: "Transfert", LOSS: "Perte", ADJUSTMENT: "Ajustement" }

function fmtDate(v: string) { return new Date(v).toLocaleDateString("fr-FR") }
function fmtDateTime(v: string) { return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) }

export default function TracabilitePage() {
  const [query, setQuery] = useState("")
  const [data, setData] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [lots, setLots] = useState<LotOption[]>([])
  const [lotsLoading, setLotsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/lots")
      .then((r) => (r.ok ? r.json() : { lots: [] }))
      .then((data: { lots: any[] }) => {
        const rows = Array.isArray(data.lots) ? data.lots : []
        setLots(rows.map((l) => ({
          id: l.id,
          lotNumber: l.lotNumber,
          productName: l.variant?.product?.name ?? "Produit",
          format: l.variant?.format ?? "",
          status: l.status,
          remainingQuantity: l.remainingQuantity,
        })))
      })
      .catch(() => {})
      .finally(() => setLotsLoading(false))
  }, [])

  const search = async (lotNumberOrId: string) => {
    if (!lotNumberOrId.trim()) return
    setLoading(true)
    setError("")
    setData(null)

    try {
      const isId = lotNumberOrId.startsWith("LOT-") ? `lotNumber=${encodeURIComponent(lotNumberOrId)}` : `lotId=${encodeURIComponent(lotNumberOrId)}`
      const res = await fetch(`/api/lots/trace?${isId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? "Lot introuvable")
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLot = (value: string) => {
    setQuery(value)
    if (value) search(value)
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    search(query)
  }

  const s = data?.summary

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traçabilité</h1>
        <p className="mt-1 text-sm text-gray-500">Rechercher un lot pour voir son historique complet (productions, ventes, transferts).</p>
      </div>

      <form onSubmit={handleManualSearch} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              placeholder="Numero de lot (LOT-...) ou ID..."
            />
          </div>
          <button disabled={loading || !query.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Search className="h-4 w-4" /> Rechercher
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">Ou choisir un lot existant</label>
          <select
            value=""
            onChange={(e) => { if (e.target.value) handleSelectLot(e.target.value) }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            disabled={lotsLoading}
          >
            <option value="">{lotsLoading ? "Chargement des lots..." : "-- Sélectionner un lot --"}</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.lotNumber}>
                {lot.lotNumber} — {lot.productName} ({lot.format}) · Reste: {lot.remainingQuantity} · {lot.status === "ACTIVE" ? "Actif" : lot.status === "EXHAUSTED" ? "Épuisé" : "Expiré"}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {data && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{data.lot.lotNumber}</h2>
                <p className="text-sm text-gray-500">{data.lot.variant?.product?.name} - {data.lot.variant?.format}</p>
              </div>
              {(() => {
                const st = STATUS_CONFIG[data.lot.status] ?? STATUS_CONFIG.ACTIVE
                const Icon = st.icon
                return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${st.color}`}><Icon className="h-3.5 w-3.5" /> {st.label}</span>
              })()}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">Produit</p><p className="text-lg font-bold">{s?.initialQuantity}</p></div>
              <div className="rounded-lg bg-green-50 p-3 text-center"><p className="text-xs text-green-600">Restant</p><p className="text-lg font-bold text-green-700">{s?.remainingQuantity}</p></div>
              <div className="rounded-lg bg-red-50 p-3 text-center"><p className="text-xs text-red-600">Consomme</p><p className="text-lg font-bold text-red-700">{s?.consumedQuantity}</p></div>
              <div className="rounded-lg bg-blue-50 p-3 text-center"><p className="text-xs text-blue-600">Allocations</p><p className="text-lg font-bold text-blue-700">{s?.totalAllocations}</p></div>
              <div className="rounded-lg bg-purple-50 p-3 text-center"><p className="text-xs text-purple-600">Ventes</p><p className="text-lg font-bold text-purple-700">{s?.saleAllocations}</p></div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Production :</span> <span className="font-medium">{fmtDate(data.lot.productionDate)}</span></div>
              {data.lot.expiryDate && <div><span className="text-gray-500">Expiration :</span> <span className="font-medium">{fmtDate(data.lot.expiryDate)}</span></div>}
              {data.lot.createdBy && <div><span className="text-gray-500">Cree par :</span> <span className="font-medium">{data.lot.createdBy.name}</span></div>}
              {data.lot.notes && <div><span className="text-gray-500">Note :</span> <span className="font-medium">{data.lot.notes}</span></div>}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><FileText className="h-4 w-4" /> Historique des allocations</h3>
            {data.allocations.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune allocation - ce lot n'a pas encore ete utilise.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Quantite</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Reference</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.allocations.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${a.type === "SALE" ? "bg-blue-100 text-blue-700" : a.type === "LOSS" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                            {ALLOC_LABEL[a.type] ?? a.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">{a.quantity}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{a.reference || "-"}</td>
                        <td className="px-4 py-2.5 text-gray-500">{fmtDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><Package className="h-4 w-4" /> Mouvements de stock lies</h3>
            {data.movements.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun mouvement de stock lie.</p>
            ) : (
              <div className="space-y-2">
                {data.movements.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{m.type}</p>
                      <p className="text-xs text-gray-500">{m.reason || m.reference || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${m.type.includes("SALE") || m.type.includes("LOSS") ? "text-red-600" : "text-green-600"}`}>
                        {m.type.includes("SALE") || m.type.includes("LOSS") ? "-" : "+"}{m.quantity}
                      </p>
                      <p className="text-xs text-gray-500">{fmtDateTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
