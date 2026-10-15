"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, BellRing, Check, HandCoins, Search, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { RECEIPT_METHODS, RECEIPT_METHOD_LABEL, REFERENCE_EXPECTED } from "@/lib/payment-methods"

interface Creance {
  id: string
  reference: string
  clientId: string | null
  clientName: string
  total: number
  credited: number
  paid: number
  pendingAmount: number
  promisePending: number
  balance: number
  creditLimit: number | null
  paymentTermsDays: number
  dueDate: string
  overdue: boolean
  createdAt: string
  reminderCount: number
  lastReminderAt: string | null
}

const METHODS = RECEIPT_METHODS.map((value) => ({ value, label: RECEIPT_METHOD_LABEL[value] }))

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function CreancesPage() {
  const [creances, setCreances] = useState<Creance[]>([])
  const [canValidate, setCanValidate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [paying, setPaying] = useState<Creance | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("CASH_ON_DELIVERY")
  const [payNotes, setPayNotes] = useState("")
  const [payReference, setPayReference] = useState("")
  const [payError, setPayError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // arrivée depuis une facture (« Encaisser ») : ?q=<référence> pré-remplit la recherche
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état initial tiré de l'adresse
    if (q) setSearch(q)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/commercial/creances", { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(res.status === 403 ? "Cet écran est réservé à l'administrateur, aux commerciaux et au comptable." : data?.error || "Chargement impossible")
          return
        }
        setCreances(data.creances ?? [])
        setCanValidate(Boolean(data.canValidate))
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [reload])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return creances.filter(
      (c) => (!term || c.clientName.toLowerCase().includes(term) || c.reference.toLowerCase().includes(term)) && (!onlyOverdue || c.overdue),
    )
  }, [creances, search, onlyOverdue])

  // encours par client : sert à signaler le dépassement du plafond de crédit
  const exposure = useMemo(() => {
    const byClient = new Map<string, number>()
    for (const c of creances) if (c.clientId) byClient.set(c.clientId, (byClient.get(c.clientId) ?? 0) + Math.max(0, c.balance))
    return byClient
  }, [creances])
  const overLimit = (c: Creance) => c.creditLimit !== null && c.clientId !== null && (exposure.get(c.clientId) ?? 0) > c.creditLimit + 0.01

  const totalBalance = filtered.reduce((sum, c) => sum + Math.max(0, c.balance), 0)

  const openPayment = (c: Creance) => {
    setPaying(c)
    setPayAmount(String(Math.max(0, c.balance)))
    setPayMethod("CASH_ON_DELIVERY")
    setPayNotes("")
    setPayReference("")
    setPayError("")
  }

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paying || submitting) return
    setSubmitting(true)
    setPayError("")
    try {
      const res = await fetch(`/api/encaissements/${paying.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod, reference: payReference, notes: payNotes }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPayError(data?.error || "Enregistrement impossible")
        return
      }
      setMessage(
        data?.validationStatus === "PENDING"
          ? `Règlement de ${formatPrice(Number(payAmount))} enregistré sur ${paying.reference} : en attente de validation par la caisse.`
          : `Règlement de ${formatPrice(Number(payAmount))} encaissé sur ${paying.reference}.`,
      )
      setPaying(null)
      setReload((n) => n + 1)
    } catch {
      setPayError("Connexion au serveur impossible : rien n'a été enregistré")
    } finally {
      setSubmitting(false)
    }
  }

  const act = async (c: Creance, action: "reminder" | "validate") => {
    if (busy) return
    setBusy(`${action}-${c.id}`)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/encaissements/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, channel: "WHATSAPP" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Action impossible")
        return
      }
      setMessage(action === "reminder" ? `Relance de ${c.clientName} enregistrée pour ${c.reference}.` : `Règlements de ${c.reference} validés.`)
      setReload((n) => n + 1)
    } catch {
      setError("Connexion au serveur impossible")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <HandCoins className="h-6 w-6 text-primary" />
            Créances
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Factures B2B émises et pas encore soldées · {filtered.length} facture{filtered.length > 1 ? "s" : ""} · reste à recouvrer {formatPrice(totalBalance)}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Client ou référence..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 sm:w-64"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
            À relancer (échéance dépassée)
          </label>
        </div>
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" /> {message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Fermer" className="p-2 text-green-600 hover:text-green-800"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement des créances...</p>}
        {!loading && filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">{creances.length === 0 ? "Aucune créance : toutes les factures émises sont soldées." : "Aucune créance pour ces critères."}</p>
        )}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2.5 sm:px-4">Client</th>
                  <th className="px-3 py-2.5">Facture</th>
                  <th className="px-3 py-2.5 text-right">Montant</th>
                  <th className="px-3 py-2.5 text-right">Réglé</th>
                  <th className="px-3 py-2.5 text-right">En attente</th>
                  <th className="px-3 py-2.5 text-right">Solde</th>
                  <th className="px-3 py-2.5">Échéance</th>
                  <th className="px-3 py-2.5">Relances</th>
                  <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className={overLimit(c) ? "bg-red-50/60" : ""}>
                    <td className="px-3 py-2.5 sm:px-4">
                      <p className="font-semibold text-gray-900">{c.clientName}</p>
                      {c.creditLimit !== null && (
                        <p className={`text-xs ${overLimit(c) ? "font-semibold text-red-700" : "text-gray-500"}`}>
                          Plafond {formatPrice(c.creditLimit)}{overLimit(c) ? " · dépassé" : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-xs text-gray-700">{c.reference}</p>
                      <p className="text-xs text-gray-500">du {formatDate(c.createdAt)}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-700">
                      {formatPrice(c.total)}
                      {c.credited > 0 && <span className="block text-xs text-gray-500">avoir − {formatPrice(c.credited)}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-700">{formatPrice(c.paid)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {c.pendingAmount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{formatPrice(c.pendingAmount)}</span>}
                      {c.promisePending > 0 && <span className="block text-xs text-blue-700">Promesse : {formatPrice(c.promisePending)}</span>}
                      {c.pendingAmount <= 0 && c.promisePending <= 0 && <span className="text-gray-400">—</span>}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right text-base font-bold ${c.overdue ? "text-red-700" : "text-gray-900"}`}>{formatPrice(c.balance)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <p className={c.overdue ? "font-semibold text-red-700" : "text-gray-700"}>{formatDate(c.dueDate)}</p>
                      <p className="text-xs text-gray-500">{c.overdue ? "dépassée" : `${c.paymentTermsDays} jours`}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">
                      {c.reminderCount > 0 ? (
                        <>
                          {c.reminderCount}
                          {c.lastReminderAt && <span className="block text-xs text-gray-500">dernière le {formatDate(c.lastReminderAt)}</span>}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <div className="flex items-center justify-end gap-2">
                        {canValidate && c.pendingAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => act(c, "validate")}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" /> Valider
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => act(c, "reminder")}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <BellRing className="h-4 w-4" /> {busy === `reminder-${c.id}` ? "Relance…" : "Relancer"}
                        </button>
                        {c.balance > 0 && (
                          <button
                            type="button"
                            onClick={() => openPayment(c)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                          >
                            <HandCoins className="h-4 w-4" /> Encaisser
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paying && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !submitting) setPaying(null) }}>
          <form onSubmit={submitPayment} className="w-full rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Encaisser {paying.reference}</h2>
                <p className="text-sm text-gray-500">{paying.clientName} · solde restant {formatPrice(paying.balance)}</p>
              </div>
              <button type="button" onClick={() => setPaying(null)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Montant reçu (FCFA)
                <input
                  type="number"
                  min={1}
                  max={paying.balance}
                  step="1"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg font-bold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Moyen de règlement
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:border-primary-500 focus:outline-none">
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
              {REFERENCE_EXPECTED.includes(payMethod) && (
                <label className="block text-sm font-medium text-gray-700">
                  {payMethod === "BANK_TRANSFER" ? "Référence du virement" : payMethod === "MOBILE_MONEY" ? "N° de transaction Mobile Money" : "Référence de la transaction"}
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    maxLength={120}
                    placeholder="Facultatif, mais utile pour retrouver le paiement"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  />
                </label>
              )}
              <label className="block text-sm font-medium text-gray-700">
                Remarque (facultatif)
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Ex. : remis par le gérant, chèque n°…"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </label>
              {!canValidate && <p className="text-sm text-gray-500">Ce règlement sera compté après validation par la caisse ou l&apos;administrateur.</p>}
              {payError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{payError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPaying(null)} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit" disabled={submitting} aria-busy={submitting} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Enregistrement…" : "Enregistrer le règlement"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
