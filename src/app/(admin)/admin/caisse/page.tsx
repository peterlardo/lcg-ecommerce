"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, Calculator, CreditCard, RefreshCw, Smartphone, WalletCards } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface PaymentBreakdown {
  method: string
  total: number
  count: number
}

interface ReportPayload {
  summary: {
    todayRevenue: number
    todayOrders: number
    cashExpected: number
    cashGap: number
  }
  paymentBreakdown: PaymentBreakdown[]
  daily: { name: string; revenu: number; commandes: number }[]
}

const paymentLabels: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces / à la livraison",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte bancaire",
}

const paymentIcons: Record<string, typeof Banknote> = {
  CASH_ON_DELIVERY: Banknote,
  MOBILE_MONEY: Smartphone,
  CARD: CreditCard,
}

export default function CaissePage() {
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [cashCounted, setCashCounted] = useState("")
  const [closingNote, setClosingNote] = useState("")

  const load = async () => {
    try {
      const res = await fetch("/api/reports")
      if (!res.ok) throw new Error("Impossible de charger la caisse")
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/reports", { signal: controller.signal })
        if (!res.ok) throw new Error("Impossible de charger la caisse")
        setData(await res.json())
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Erreur de chargement")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  const cashActual = Number(cashCounted) || 0
  const expected = data?.summary.cashExpected ?? 0
  const countedGap = useMemo(() => cashActual - expected, [cashActual, expected])
  const mobileMoney = data?.paymentBreakdown.find((item) => item.method === "MOBILE_MONEY")?.total ?? 0
  const card = data?.paymentBreakdown.find((item) => item.method === "CARD")?.total ?? 0

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Caisse</h1>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">Encaissements du jour, contrôle espèces et rapprochement.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:px-4 sm:py-3 sm:text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className="text-xs font-medium text-gray-500">Ventes du jour</p><p className="mt-1 text-base font-bold text-gray-900 sm:text-xl">{loading ? "..." : formatPrice(data?.summary.todayRevenue ?? 0)}</p></div>
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-3 sm:p-4"><p className="text-xs font-medium text-green-700">Espèces attendues</p><p className="mt-1 text-base font-bold text-green-800 sm:text-xl">{formatPrice(expected)}</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:p-4"><p className="text-xs font-medium text-blue-700">Mobile Money</p><p className="mt-1 text-base font-bold text-blue-800 sm:text-xl">{formatPrice(mobileMoney)}</p></div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 sm:p-4"><p className="text-xs font-medium text-purple-700">Carte</p><p className="mt-1 text-base font-bold text-purple-800 sm:text-xl">{formatPrice(card)}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 lg:col-span-2">
          <h2 className="mb-3 text-xs font-semibold text-gray-900 sm:mb-4 sm:text-sm">Rapprochement des paiements</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px]">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4 sm:py-3">Mode</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4 sm:py-3">Transactions</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4 sm:py-3">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.paymentBreakdown ?? []).map((item) => {
                  const Icon = paymentIcons[item.method] ?? WalletCards
                  return (
                    <tr key={item.method}>
                      <td className="px-2 py-2 sm:px-4 sm:py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 sm:h-8 sm:w-8"><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span><span className="text-xs font-medium text-gray-800 sm:text-sm">{paymentLabels[item.method] ?? item.method}</span></div></td>
                      <td className="px-2 py-2 text-right text-xs text-gray-600 sm:px-4 sm:py-3 sm:text-sm">{item.count}</td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-gray-900 sm:px-4 sm:py-3 sm:text-sm">{formatPrice(item.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs font-semibold text-gray-900 sm:mb-4 sm:text-sm">Clôture de caisse</h2>
          <div className="space-y-3 sm:space-y-4">
            <label className="block text-xs font-medium text-gray-700 sm:text-sm">
              Espèces comptées
              <input type="number" min={0} value={cashCounted} onChange={(e) => setCashCounted(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="0" />
            </label>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between text-xs sm:text-sm"><span className="text-gray-500">Attendu</span><span className="font-semibold text-gray-900">{formatPrice(expected)}</span></div>
              <div className="mt-2 flex items-center justify-between text-xs sm:text-sm"><span className="text-gray-500">Écart</span><span className={`font-semibold ${countedGap === 0 ? "text-gray-900" : countedGap > 0 ? "text-green-700" : "text-red-700"}`}>{formatPrice(countedGap)}</span></div>
            </div>
            <label className="block text-xs font-medium text-gray-700 sm:text-sm">
              Note de clôture
              <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40" placeholder="Justification d'écart, remise banque..." />
            </label>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              <Calculator className="h-4 w-4" /> Préparer le rapport journalier
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
