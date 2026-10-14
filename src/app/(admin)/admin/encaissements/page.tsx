"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Banknote, Check, Download, Search, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { RECEIPT_METHODS, RECEIPT_METHOD_LABEL, VALIDATION_LABEL } from "@/lib/payment-methods"

// Journal des règlements reçus sur les factures B2B (étape 4 du module commercial).

interface Payment {
  id: string
  createdAt: string
  amount: number
  method: string
  reference: string | null
  notes: string | null
  validationStatus: "PENDING" | "VALIDATED" | "REJECTED"
  validatedAt: string | null
  rejectReason: string | null
  receivedBy: string | null
  validatedBy: string | null
  invoice: { id: string; reference: string } | null
  clientName: string
}

interface Totals {
  validated: number
  validatedCount: number
  pending: number
  pendingCount: number
  rejected: number
  rejectedCount: number
  byMethod: { method: string; amount: number; count: number }[]
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  VALIDATED: "bg-green-100 text-green-700",
  REJECTED: "bg-gray-100 text-gray-500 line-through",
}

/** Jour de Brazzaville (UTC+1), au format AAAA-MM-JJ. */
function localDay(date: Date): string {
  return new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const inputClass = "min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"

export default function EncaissementsPage() {
  const today = localDay(new Date())
  const monthStart = `${today.slice(0, 8)}01`
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [method, setMethod] = useState("")
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [reload, setReload] = useState(0)

  const [payments, setPayments] = useState<Payment[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [count, setCount] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [canValidate, setCanValidate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Payment | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ from, to })
        if (method) params.set("method", method)
        if (status) params.set("status", status)
        if (query) params.set("q", query)
        const res = await fetch(`/api/encaissements?${params}`, { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(res.status === 403 ? "Cet écran demande le droit « Encaissements »." : data?.error || "Chargement impossible")
          return
        }
        setError("")
        setPayments(data.payments ?? [])
        setTotals(data.totals ?? null)
        setCount(data.count ?? 0)
        setTruncated(Boolean(data.truncated))
        setCanValidate(Boolean(data.canValidate))
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [from, to, method, status, query, reload])

  const shownTotal = useMemo(() => payments.filter((p) => p.validationStatus === "VALIDATED").reduce((s, p) => s + p.amount, 0), [payments])

  const decide = async (p: Payment, action: "validate" | "reject", reason = "") => {
    if (busy) return
    setBusy(`${action}-${p.id}`)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/encaissements/reglements/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Action impossible")
        return
      }
      setMessage(action === "validate" ? `Règlement de ${formatPrice(p.amount)} (${p.clientName}) validé.` : `Règlement de ${formatPrice(p.amount)} (${p.clientName}) refusé.`)
      setRejecting(null)
      setReload((n) => n + 1)
    } catch {
      setError("Connexion au serveur impossible")
    } finally {
      setBusy(null)
    }
  }

  const exportCsv = () => {
    const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const lines = [
      ["Date", "Client", "Facture", "Moyen", "Référence", "Montant (FCFA)", "Statut", "Saisi par", "Validé ou refusé par", "Remarque"].map(cell).join(";"),
      ...payments.map((p) =>
        [
          formatDateTime(p.createdAt), p.clientName, p.invoice?.reference ?? "", RECEIPT_METHOD_LABEL[p.method] ?? p.method, p.reference, p.amount,
          VALIDATION_LABEL[p.validationStatus] ?? p.validationStatus, p.receivedBy, p.validatedBy, p.rejectReason || p.notes,
        ].map(cell).join(";"),
      ),
    ]
    // BOM : accents lisibles à l'ouverture dans Excel
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `encaissements-${from}-au-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const setPeriod = (start: string, end: string) => { setFrom(start); setTo(end) }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <Banknote className="h-6 w-6 text-primary" />
            Encaissements
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Règlements reçus sur les factures B2B. Les ventes au comptoir, payées au ticket, sont dans Caisse et Tickets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/creances" className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Voir les créances
          </Link>
          <button type="button" onClick={exportCsv} disabled={payments.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Exporter (CSV)
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Du
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Au
            <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={inputClass} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPeriod(today, today)} className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Aujourd&apos;hui</button>
            <button type="button" onClick={() => setPeriod(monthStart, today)} className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Ce mois</button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setQuery(search.trim()) }}
              onBlur={() => setQuery(search.trim())}
              placeholder="Client ou n° de facture, puis Entrée"
              className={`${inputClass} w-full pl-9`}
            />
          </div>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass} aria-label="Moyen de règlement">
            <option value="">Tous les moyens</option>
            {RECEIPT_METHODS.map((m) => <option key={m} value={m}>{RECEIPT_METHOD_LABEL[m]}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option value="PENDING">À valider</option>
            <option value="VALIDATED">Validés</option>
            <option value="REJECTED">Refusés</option>
          </select>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-500">Encaissé (validé)</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{formatPrice(totals.validated)}</p>
            <p className="text-sm text-gray-500">{totals.validatedCount} règlement{totals.validatedCount > 1 ? "s" : ""}</p>
          </div>
          <button
            type="button"
            onClick={() => setStatus(status === "PENDING" ? "" : "PENDING")}
            aria-pressed={status === "PENDING"}
            className={`rounded-xl border p-4 text-left ${status === "PENDING" ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:bg-amber-50/50"}`}
          >
            <p className="text-sm font-medium text-gray-500">À valider</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{formatPrice(totals.pending)}</p>
            <p className="text-sm text-gray-500">{totals.pendingCount} règlement{totals.pendingCount > 1 ? "s" : ""}{totals.pendingCount > 0 ? " · toucher pour les voir" : ""}</p>
          </button>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-500">Par moyen (validé)</p>
            {totals.byMethod.length === 0 ? (
              <p className="mt-1 text-sm text-gray-400">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm">
                {totals.byMethod.map((m) => (
                  <li key={m.method} className="flex justify-between gap-2">
                    <span className="text-gray-700">{RECEIPT_METHOD_LABEL[m.method] ?? m.method}</span>
                    <span className="font-semibold text-gray-900">{formatPrice(m.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {totals.rejectedCount > 0 && <p className="mt-1 text-sm text-gray-500">Refusés : {totals.rejectedCount} ({formatPrice(totals.rejected)})</p>}
          </div>
        </div>
      )}

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
        {loading && <p className="p-4 text-sm text-gray-500">Chargement des encaissements...</p>}
        {!loading && payments.length === 0 && !error && <p className="p-8 text-center text-sm text-gray-500">Aucun règlement sur cette période.</p>}
        {!loading && payments.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2.5 sm:px-4">Date</th>
                    <th className="px-3 py-2.5">Client</th>
                    <th className="px-3 py-2.5">Facture</th>
                    <th className="px-3 py-2.5">Moyen</th>
                    <th className="px-3 py-2.5 text-right">Montant</th>
                    <th className="px-3 py-2.5">Statut</th>
                    <th className="px-3 py-2.5">Saisi par</th>
                    {canValidate && <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id} className={p.validationStatus === "PENDING" ? "bg-amber-50/40" : ""}>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 sm:px-4">{formatDateTime(p.createdAt)}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{p.clientName}</td>
                      <td className="px-3 py-2.5">
                        {p.invoice ? (
                          <Link href={`/admin/bons-b2b/${p.invoice.id}/document`} className="whitespace-nowrap font-mono text-sm text-primary underline-offset-2 hover:underline">{p.invoice.reference}</Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">
                        {RECEIPT_METHOD_LABEL[p.method] ?? p.method}
                        {p.reference && <span className="block font-mono text-xs text-gray-500">réf. {p.reference}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-bold text-gray-900">{formatPrice(p.amount)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.validationStatus] ?? "bg-gray-100 text-gray-700"}`}>{VALIDATION_LABEL[p.validationStatus] ?? p.validationStatus}</span>
                        {p.validationStatus !== "PENDING" && p.validatedBy && (
                          <span className="block text-xs text-gray-500">par {p.validatedBy}</span>
                        )}
                        {p.rejectReason && <span className="block text-xs text-gray-500">{p.rejectReason}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {p.receivedBy ?? <span className="text-gray-400">—</span>}
                        {p.notes && <span className="block text-xs text-gray-500">{p.notes}</span>}
                      </td>
                      {canValidate && (
                        <td className="px-3 py-2.5 sm:px-4">
                          {p.validationStatus === "PENDING" && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => decide(p, "validate")}
                                disabled={busy !== null}
                                className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-green-300 bg-white px-3 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" /> {busy === `validate-${p.id}` ? "Validation…" : "Valider"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRejecting(p); setRejectReason("") }}
                                disabled={busy !== null}
                                className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" /> Refuser
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
              {count} règlement{count > 1 ? "s" : ""} · validés affichés : <span className="font-semibold text-gray-900">{formatPrice(shownTotal)}</span>
              {truncated ? ` · seuls les ${payments.length} plus récents sont affichés : réduisez la période pour voir les autres` : ""}
            </p>
          </>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) setRejecting(null) }}>
          <form
            onSubmit={(e) => { e.preventDefault(); if (rejectReason.trim()) void decide(rejecting, "reject", rejectReason.trim()) }}
            className="w-full rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Refuser ce règlement</h2>
                <p className="text-sm text-gray-500">{rejecting.clientName} · {formatPrice(rejecting.amount)} · {RECEIPT_METHOD_LABEL[rejecting.method] ?? rejecting.method}</p>
              </div>
              <button type="button" onClick={() => setRejecting(null)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Motif (obligatoire)
              <input
                type="text"
                required
                maxLength={300}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex. : somme non reçue, saisie en double…"
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <p className="mt-2 text-sm text-gray-500">Le règlement ne comptera plus : la somme redevient due sur la facture.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} disabled={busy !== null} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" disabled={busy !== null || !rejectReason.trim()} className="min-h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {busy ? "Enregistrement…" : "Refuser le règlement"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
