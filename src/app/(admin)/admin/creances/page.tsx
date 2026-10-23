"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, BellRing, Check, HandCoins, Search, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { InvoicePaymentDialog } from "@/components/admin/invoice-payment-dialog"
import type { AgingBucket, ClientCreance, CreanceSummary } from "@/lib/commercial"

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
  const [tab, setTab] = useState<"factures" | "aging" | "clients">("factures")
  const [summary, setSummary] = useState<CreanceSummary | null>(null)
  const [aging, setAging] = useState<AgingBucket[]>([])
  const [byClient, setByClient] = useState<ClientCreance[]>([])
  const [clientFilter, setClientFilter] = useState<string | null>(null)

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
        setSummary(data.summary ?? null)
        setAging(Array.isArray(data.aging) ? data.aging : [])
        setByClient(Array.isArray(data.byClient) ? data.byClient : [])
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
      (c) =>
        (!clientFilter || c.clientId === clientFilter) &&
        (!term || c.clientName.toLowerCase().includes(term) || c.reference.toLowerCase().includes(term)) &&
        (!onlyOverdue || c.overdue),
    )
  }, [creances, search, onlyOverdue, clientFilter])

  // encours par client : sert à signaler le dépassement du plafond de crédit
  const exposure = useMemo(() => {
    const byClient = new Map<string, number>()
    for (const c of creances) if (c.clientId) byClient.set(c.clientId, (byClient.get(c.clientId) ?? 0) + Math.max(0, c.balance))
    return byClient
  }, [creances])
  const overLimit = (c: Creance) => c.creditLimit !== null && c.clientId !== null && (exposure.get(c.clientId) ?? 0) > c.creditLimit + 0.01

  const totalBalance = filtered.reduce((sum, c) => sum + Math.max(0, c.balance), 0)

  const openPayment = (c: Creance) => setPaying(c)

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
            {tab === "factures"
              ? `Factures B2B émises et pas encore soldées · ${filtered.length} facture${filtered.length > 1 ? "s" : ""} · reste à recouvrer ${formatPrice(totalBalance)}`
              : tab === "aging"
                ? `Balance âgée par échéance · ${aging.reduce((n, b) => n + b.count, 0)} facture(s) ouverte(s)`
                : `Encours par client · ${byClient.length} client(s) débiteur(s)`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {tab === "factures" && (
            <>
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
            </>
          )}
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

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              { label: "À recevoir", value: formatPrice(summary.totalBalance), detail: "", tone: "text-gray-900" },
              { label: "En retard", value: formatPrice(summary.overdueBalance), detail: "", tone: "text-red-700" },
              {
                label: "Promesses en cours",
                value: formatPrice(summary.promisePendingAmount),
                detail: `${summary.promisePendingCount} promesse${summary.promisePendingCount > 1 ? "s" : ""}`,
                tone: "text-blue-700",
              },
              { label: "Clients débiteurs", value: String(summary.debtorClients), detail: "", tone: "text-gray-900" },
              { label: "Au-dessus du plafond", value: String(summary.clientsOverLimit), detail: "", tone: summary.clientsOverLimit > 0 ? "text-red-700" : "text-gray-900" },
              { label: "Plafonds accordés", value: formatPrice(summary.creditLimitTotal), detail: "", tone: "text-gray-900" },
            ] as { label: string; value: string; detail: string; tone: string }[]
          ).map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{kpi.label}</p>
              <p className={`mt-1 text-lg font-bold sm:text-xl ${kpi.tone}`}>{kpi.value}</p>
              {kpi.detail && <p className="text-xs text-gray-500">{kpi.detail}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "factures", label: "Factures ouvertes" },
            { key: "aging", label: "Balance âgée" },
            { key: "clients", label: "Par client" },
          ] as { key: "factures" | "aging" | "clients"; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${tab === t.key ? "bg-primary text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
        {tab === "factures" && clientFilter && (
          <button
            type="button"
            onClick={() => setClientFilter(null)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Client : {byClient.find((c) => c.clientId === clientFilter)?.clientName ?? "sélectionné"}
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {tab === "factures" && (
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
      )}

      {tab === "aging" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="grid min-w-[900px] grid-cols-5 divide-x divide-gray-100">
            {aging.map((bucket) => (
              <div key={bucket.key} className="p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{bucket.label}</p>
                <p className={`mt-1 text-lg font-bold ${bucket.key === "not_due" ? "text-gray-900" : "text-red-700"}`}>{formatPrice(bucket.balance)}</p>
                <p className="text-xs text-gray-500">
                  {bucket.count} facture{bucket.count > 1 ? "s" : ""} · {bucket.clients} client{bucket.clients > 1 ? "s" : ""}
                </p>
                <ul className="mt-2 space-y-2">
                  {bucket.lines.map((line) => (
                    <li key={line.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                      <p className="font-mono text-gray-700">{line.reference}</p>
                      <p className="truncate font-semibold text-gray-900">{line.clientName}</p>
                      <p className="font-bold text-gray-900">{formatPrice(line.balance)}</p>
                      <p className="text-gray-500">
                        {formatDate(line.dueDate)} · {line.daysLate > 0 ? `${line.daysLate} j de retard` : "à échoir"}
                      </p>
                    </li>
                  ))}
                  {bucket.lines.length === 0 && <li className="text-gray-400">Aucune facture</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "clients" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {byClient.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">Aucun client débiteur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2.5 sm:px-4">Client</th>
                    <th className="px-3 py-2.5 text-right">Encours</th>
                    <th className="px-3 py-2.5 text-right">Dont en retard</th>
                    <th className="px-3 py-2.5 text-right">Plus ancien retard</th>
                    <th className="px-3 py-2.5 text-right">Factures</th>
                    <th className="px-3 py-2.5">Prochaine échéance</th>
                    <th className="px-3 py-2.5">Plafond</th>
                    <th className="px-3 py-2.5 text-right sm:px-4">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byClient.map((client) => (
                    <tr key={client.clientId} className={client.overLimit ? "bg-red-50/60" : ""}>
                      <td className="px-3 py-2.5 sm:px-4">
                        <p className="font-semibold text-gray-900">{client.clientName}</p>
                        {client.commercialName && <p className="text-xs text-gray-500">Commercial : {client.commercialName}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-bold text-gray-900">{formatPrice(client.balance)}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${client.overdueBalance > 0 ? "text-red-700" : "text-gray-500"}`}>{formatPrice(client.overdueBalance)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-700">{client.oldestOverdueDays > 0 ? `${client.oldestOverdueDays} j` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-700">{client.openInvoices}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{client.nextDueDate ? formatDate(client.nextDueDate) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {client.creditLimit !== null ? (
                          <span className={client.overLimit ? "font-semibold text-red-700" : "text-gray-700"}>
                            {formatPrice(client.creditLimit)}{client.overLimit ? " · dépassé" : ""}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setClientFilter(client.clientId)
                            setTab("factures")
                          }}
                          className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Voir les factures
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {paying && (
        <InvoicePaymentDialog
          // reste à encaisser : le solde affiché déduit les promesses de paiement, que ce règlement vient justement honorer
          invoice={{ id: paying.id, reference: paying.reference, clientName: paying.clientName, balance: Math.max(0, paying.balance + paying.promisePending) }}
          onClose={() => setPaying(null)}
          onDone={(text) => { setMessage(text); setPaying(null); setReload((n) => n + 1) }}
        />
      )}
    </div>
  )
}
