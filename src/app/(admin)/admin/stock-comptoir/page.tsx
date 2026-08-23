"use client"

import { useCallback, useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BarChart3, Boxes, Package, RefreshCw, TrendingUp, Warehouse, CircleDollarSign } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ComptoirStock {
  id: string; variantId: string; quantity: number; updatedAt: string
  productName: string; format: string; price: number; centralStock: number
}

interface VariantOption { id: string; label: string; price: number; centralStock: number }

interface Movement {
  id: string; type: string; quantity: number; reason: string | null; reference: string | null
  productName: string | null; format: string | null; createdAt: string
}

interface Data {
  pos: { id: string; name: string; code: string; isActive: boolean }
  stocks: ComptoirStock[]
  variants: VariantOption[]
  stats: { today: { revenue: number; count: number }; week: { revenue: number; count: number }; month: { revenue: number; count: number }; stockUnits: number; stockValue: number }
  chartData: { key: string; label: string; ventes: number; revenu: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  movements: Movement[]
}

type Period = "jour" | "semaine" | "mois"

const movementLabels: Record<string, string> = {
  IN: "Entrée", TRANSFER_IN: "Transfert entrant", TRANSFER_OUT: "Transfert sortant",
  SALE: "Vente", ADJUSTMENT_IN: "Ajustement +", ADJUSTMENT_OUT: "Ajustement -",
  OUT: "Sortie", LOSS: "Perte", RETURN: "Retour", PRODUCTION: "Production",
}

export default function StockComptoirPage() {
  const [period, setPeriod] = useState<Period>("jour")
  const [chartMode, setChartMode] = useState<"revenu" | "ventes">("revenu")
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [variantId, setVariantId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [mode, setMode] = useState<"ADD" | "SET">("ADD")

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock-comptoir?period=${period}`)
      if (!res.ok) throw new Error("Erreur de chargement")
      const json: Data = await res.json()
      setData(json)
      if (!variantId && json.variants.length > 0) setVariantId(json.variants[0].id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { setLoading(true); void load() }, [load])

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [success])

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/stock-comptoir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: Number(quantity), mode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erreur")
      setSuccess(mode === "ADD" ? `Approvisionnement effectué (+${quantity})` : `Stock comptoir défini à ${json.comptoirQuantity}`)
      setQuantity("")
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 overflow-x-hidden sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Stock Comptoir</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Gestion du stock dédié à l&apos;opérateur comptoir — séparé des points de vente</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-start justify-between"><p className="text-xs text-muted-foreground sm:text-sm">Ventes du jour</p><TrendingUp className="h-4 w-4 text-orange-600" /></div>
          <p className="mt-2 text-lg font-bold text-foreground sm:text-2xl">{formatPrice(data?.stats.today.revenue ?? 0)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{data?.stats.today.count ?? 0} vente(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-start justify-between"><p className="text-xs text-muted-foreground sm:text-sm">Cette semaine</p><CircleDollarSign className="h-4 w-4 text-emerald-600" /></div>
          <p className="mt-2 text-lg font-bold text-foreground sm:text-2xl">{formatPrice(data?.stats.week.revenue ?? 0)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{data?.stats.week.count ?? 0} vente(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-start justify-between"><p className="text-xs text-muted-foreground sm:text-sm">Ce mois-ci</p><BarChart3 className="h-4 w-4 text-blue-600" /></div>
          <p className="mt-2 text-lg font-bold text-foreground sm:text-2xl">{formatPrice(data?.stats.month.revenue ?? 0)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{data?.stats.month.count ?? 0} vente(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
          <div className="flex items-start justify-between"><p className="text-xs text-muted-foreground sm:text-sm">Unités en stock</p><Package className="h-4 w-4 text-blue-600" /></div>
          <p className="mt-2 text-lg font-bold text-foreground sm:text-2xl">{data?.stats.stockUnits ?? 0}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{data?.stocks.length ?? 0} variante(s)</p>
        </div>
        <div className="col-span-2 rounded-xl border border-border bg-card p-3 shadow-card-soft sm:col-span-1 sm:p-5">
          <div className="flex items-start justify-between"><p className="text-xs text-muted-foreground sm:text-sm">Valeur du stock</p><Warehouse className="h-4 w-4 text-violet-600" /></div>
          <p className="mt-2 text-lg font-bold text-foreground sm:text-2xl">{formatPrice(data?.stats.stockValue ?? 0)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{data?.pos.name ?? "Comptoir"} · {data?.pos.code}</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-foreground">Évolution des ventes</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-muted p-1">
              {( ["jour", "semaine", "mois"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"} capitalize cursor-pointer`}>{p === "jour" ? "Jour" : p === "semaine" ? "Semaine" : "Mois"}</button>
              ))}
            </div>
            <div className="flex rounded-lg border border-border bg-muted p-1">
              <button onClick={() => setChartMode("revenu")} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${chartMode === "revenu" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"} cursor-pointer`}>Revenus</button>
              <button onClick={() => setChartMode("ventes")} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${chartMode === "ventes" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"} cursor-pointer`}>Ventes</button>
            </div>
          </div>
        </div>
        <div className="mt-4 h-56 sm:h-72">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chartData ?? []} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => chartMode === "revenu" ? `${Math.round(Number(v) / 1000)}k` : String(v)} />
                <Tooltip formatter={(value) => [chartMode === "revenu" ? formatPrice(Number(value)) : String(value), chartMode === "revenu" ? "Revenu" : "Ventes"]} />
                <Bar dataKey={chartMode} fill="var(--primary)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card shadow-card-soft">
          <div className="border-b border-border p-3 sm:p-5">
            <h2 className="font-semibold text-foreground">Stock du comptoir</h2>
            <p className="mt-1 text-xs text-muted-foreground">Approvisionner depuis le stock central ou définir directement une quantité</p>
          </div>

          <div className="border-b border-border bg-muted/30 p-3 sm:p-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,auto)_auto]">
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
                {(data?.variants ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.label} — central: {v.centralStock}</option>
                ))}
              </select>
              <input type="number" min="0" placeholder="Qté" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <div className="flex rounded-lg border border-border bg-muted p-1">
                <button onClick={() => setMode("ADD")} disabled={submitting} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "ADD" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"} disabled:opacity-40 cursor-pointer`}>Approvisionner</button>
                <button onClick={() => setMode("SET")} disabled={submitting} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "SET" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"} disabled:opacity-40 cursor-pointer`}>Définir</button>
              </div>
              <button onClick={() => void submit()} disabled={!variantId || quantity === "" || submitting} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 transition-opacity cursor-pointer">
                <Boxes className="h-3.5 w-3.5" />{submitting ? "..." : mode === "ADD" ? "Approvisionner" : "Définir"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{mode === "ADD" ? "Décrémente le stock central et crédite le stock comptoir." : "Fixe directement la quantité du comptoir sans toucher au stock central."}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Produit</th>
                  <th className="px-3 py-2 font-medium sm:px-5 sm:py-3">Format</th>
                  <th className="px-3 py-2 text-right font-medium sm:px-5 sm:py-3">PU</th>
                  <th className="px-3 py-2 text-right font-medium sm:px-5 sm:py-3">Qté</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell sm:px-5 sm:py-3">Central</th>
                  <th className="px-3 py-2 text-right font-medium sm:px-5 sm:py-3">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.stocks ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-medium text-foreground sm:px-5 sm:py-3">{s.productName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground sm:px-5 sm:py-3">{s.format}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground sm:px-5 sm:py-3">{formatPrice(s.price)}</td>
                    <td className="px-3 py-2.5 text-right sm:px-5 sm:py-3"><span className={`inline-block min-w-[32px] rounded-full px-2 py-0.5 text-center text-xs font-bold ${s.quantity <= 0 ? "bg-red-100 text-red-700" : s.quantity <= 10 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>{s.quantity}</span></td>
                    <td className="hidden px-3 py-2.5 text-right text-muted-foreground sm:table-cell sm:px-5 sm:py-3">{s.centralStock}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-foreground sm:px-5 sm:py-3">{formatPrice(s.quantity * s.price)}</td>
                  </tr>
                ))}
                {!loading && (data?.stocks.length ?? 0) === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-5">Stock comptoir vide. Approvisionnez-le ci-dessus.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4 sm:space-y-6">
          <section className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
            <h2 className="font-semibold text-foreground">Top produits</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sur la période sélectionnée</p>
            <div className="mt-3 space-y-3">
              {(data?.topProducts ?? []).map((p) => (
                <div key={p.name}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-foreground truncate mr-2">{p.name}</span><span className="text-muted-foreground shrink-0">{p.quantity} u.</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(8, p.quantity * 12))}%` }} /></div>
                </div>
              ))}
              {!loading && (data?.topProducts.length ?? 0) === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-card-soft">
            <div className="border-b border-border p-3 sm:p-5">
              <h2 className="font-semibold text-foreground">Mouvements récents</h2>
              <p className="mt-1 text-xs text-muted-foreground">Dernières opérations sur le stock comptoir</p>
            </div>
            <div className="divide-y divide-border">
              {(data?.movements ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.productName ? `${m.productName} ${m.format ?? ""}` : "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{movementLabels[m.type] || m.type}{m.reason ? ` · ${m.reason}` : ""} · {new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${m.quantity >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{m.quantity >= 0 ? "+" : ""}{m.quantity}</span>
                </div>
              ))}
              {!loading && (data?.movements.length ?? 0) === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-5">Aucun mouvement.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
