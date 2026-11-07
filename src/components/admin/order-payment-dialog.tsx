"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { RECEIPT_METHODS, RECEIPT_METHOD_LABEL } from "@/lib/payment-methods"

const METHODS = RECEIPT_METHODS.map((value) => ({ value, label: RECEIPT_METHOD_LABEL[value] }))

export interface PayableOrder { id: string; orderNumber: string; clientName: string; balance: number }

export function OrderPaymentDialog({ order, onClose, onDone }: { order: PayableOrder; onClose: () => void; onDone: (message: string) => void }) {
  const [amount, setAmount] = useState(String(Math.max(0, Math.round(order.balance))))
  const [method, setMethod] = useState("CASH_ON_DELIVERY")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (submitting) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError("Indiquez le montant recu"); return }
    if (value > order.balance + 0.01) { setError("Le montant depasse le solde (" + formatPrice(order.balance) + ")"); return }
    setSubmitting(true); setError("")
    try {
      const res = await fetch("/api/orders/" + order.id + "/encaisser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: value, method, notes }) })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error || "Enregistrement impossible"); return }
      const rest = Number(data?.balance ?? 0)
      onDone(rest > 0.005 ? "Acompte de " + formatPrice(value) + " encaisse sur " + order.orderNumber + ". Reste " + formatPrice(rest) + " (creance)." : "Solde de " + formatPrice(value) + " encaisse sur " + order.orderNumber + " — commande soldee.")
    } catch { setError("Connexion au serveur impossible") } finally { setSubmitting(false) }
  }

  const field = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}>
      <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Encaisser {order.orderNumber}</h2>
            <p className="text-sm text-gray-500">{order.clientName} — solde {formatPrice(order.balance)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Montant encaisse (FCFA)
            <input type="number" min={1} max={Math.ceil(order.balance)} step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className={field + " text-lg font-bold"} />
            {Number(amount) > 0 && Number(amount) < order.balance - 0.005 && (
              <span className="mt-1 block text-xs font-normal text-amber-700">Reglement partiel : il restera {formatPrice(order.balance - Number(amount))} (creance).</span>
            )}
          </label>
          <label className="block text-sm font-medium text-gray-700">Moyen de reglement
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={field + " bg-white"}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Remarque (facultatif)
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Ex. : solde vente comptoir" className={field} />
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{submitting ? "Enregistrement…" : "Encaisser"}</button>
        </div>
      </form>
    </div>
  )
}
