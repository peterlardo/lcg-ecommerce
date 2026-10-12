"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity, ChevronLeft, ChevronRight, Search, Users, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ActivityEvent {
  id: string
  date: string
  userId: string | null
  userName: string | null
  category: string
  action: string
  detail: string
  reference: string | null
  href: string | null
}

interface ActivityUser {
  id: string
  name: string | null
  email: string
  role: string
}

interface Category {
  key: string
  label: string
}

/** Une ligne de la vue d'ensemble : ce qu'un compte actif a fait sur la période. */
interface AccountActivity {
  id: string
  name: string | null
  email: string
  role: string
  online: boolean
  device: string | null
  lastLoginAt: string | null
  orders: number
  sales: number
  salesAmount: number
  stock: number
  cash: number
  deliveries: number
  actions: number
  logins: number
  lastActivityAt: string | null
}

interface AccountTotals {
  accounts: number
  activeAccounts: number
  online: number
  sales: number
  salesAmount: number
  orders: number
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrateur",
  STOCK_MANAGER: "Gestionnaire de stock",
  DELIVERY_AGENT: "Livreur",
  COMMERCIAL: "Commercial",
  COMPTABLE: "Comptable",
  OPERATEUR_ACCUEIL: "Opérateur d'accueil",
  CAISSE: "Caisse",
  CAISSIERE: "Caissière",
  CAISSIER: "Caissier",
  CASHIER: "Caisse",
  CUSTOMER: "Client",
}

/** Jour au format AAAA-MM-JJ, à l'heure de l'appareil. */
function dayString(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const PERIODS = [
  { key: "today", label: "Aujourd'hui", from: () => dayString(0) },
  { key: "week", label: "7 jours", from: () => dayString(-6) },
  { key: "month", label: "30 jours", from: () => dayString(-29) },
  { key: "all", label: "Tout", from: () => "" },
] as const

const CATEGORY_STYLE: Record<string, string> = {
  vente: "bg-emerald-100 text-emerald-700",
  commande: "bg-blue-100 text-blue-700",
  stock: "bg-amber-100 text-amber-700",
  caisse: "bg-violet-100 text-violet-700",
  livraison: "bg-sky-100 text-sky-700",
  connexion: "bg-slate-100 text-slate-600",
  journal: "bg-gray-100 text-gray-600",
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ActivitePage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [users, setUsers] = useState<ActivityUser[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [userId, setUserId] = useState("")
  const [category, setCategory] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [accounts, setAccounts] = useState<AccountActivity[]>([])
  const [accountTotals, setAccountTotals] = useState<AccountTotals | null>(null)
  const [accountsLoading, setAccountsLoading] = useState(true)

  // Vue d'ensemble par compte : même période que le journal
  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      try {
        const res = await fetch(`/api/activite/comptes?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (controller.signal.aborted) return
        setAccounts(data.accounts ?? [])
        setAccountTotals(data.totals ?? null)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Erreur chargement activité par compte:", error)
        }
      } finally {
        if (!controller.signal.aborted) setAccountsLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [from, to])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      const params = new URLSearchParams()
      if (userId) params.set("userId", userId)
      if (category) params.set("category", category)
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (query) params.set("q", query)
      params.set("page", String(page))
      params.set("perPage", String(perPage))
      try {
        const res = await fetch(`/api/activite?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (controller.signal.aborted) return
        setEvents(data.events ?? [])
        setCategories(data.categories ?? [])
        setUsers(data.users ?? [])
        setTotal(data.total ?? 0)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Erreur chargement activité:", error)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [userId, category, from, to, query, page, perPage])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const resetTo = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }
  const hasFilters = !!(userId || category || from || to || query)
  const activePeriod = PERIODS.find((p) => (p.key === "all" ? !from && !to : from === p.from() && (!to || to === dayString(0))))?.key ?? null
  const choosePeriod = (key: (typeof PERIODS)[number]["key"]) => {
    const period = PERIODS.find((p) => p.key === key)!
    setFrom(period.from())
    setTo(key === "all" ? "" : dayString(0))
    setPage(1)
  }
  const showAccount = (id: string) => {
    setUserId(id)
    setPage(1)
    document.getElementById("journal")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
          <Activity className="h-6 w-6 text-primary" />
          Journal d&apos;activité
        </h1>
        <p className="text-sm text-gray-500">
          Toutes les opérations des utilisateurs, du plus récent au plus ancien.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Users className="h-5 w-5 text-primary" />
              Activité par compte
            </h2>
            <p className="text-sm text-gray-500">
              {accountTotals
                ? `${accountTotals.accounts} comptes actifs · ${accountTotals.activeAccounts} avec de l'activité · ${accountTotals.online} connecté${accountTotals.online > 1 ? "s" : ""} en ce moment · ${accountTotals.sales} vente${accountTotals.sales > 1 ? "s" : ""} (${formatPrice(accountTotals.salesAmount)})`
                : "Ce que chaque compte actif a fait sur la période"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((period) => (
              <button
                key={period.key}
                type="button"
                onClick={() => choosePeriod(period.key)}
                aria-pressed={activePeriod === period.key}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activePeriod === period.key ? "bg-primary text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        {accountsLoading && <p className="p-4 text-sm text-gray-500">Chargement des comptes...</p>}
        {!accountsLoading && accounts.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun compte actif</p>}
        {!accountsLoading && accounts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2.5 sm:px-4">Compte</th>
                  <th className="px-3 py-2.5">Dernière connexion</th>
                  <th className="px-3 py-2.5 text-right">Ventes</th>
                  <th className="px-3 py-2.5 text-right">Commandes</th>
                  <th className="px-3 py-2.5 text-right">Stock</th>
                  <th className="px-3 py-2.5 text-right">Caisse</th>
                  <th className="px-3 py-2.5 text-right">Livraisons</th>
                  <th className="px-3 py-2.5 text-right">Autres</th>
                  <th className="px-3 py-2.5">Dernière activité</th>
                  <th className="px-3 py-2.5 sm:px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((account) => (
                  <tr key={account.id} className={`${userId === account.id ? "bg-primary/5" : ""} ${account.lastActivityAt ? "" : "text-gray-400"}`}>
                    <td className="px-3 py-2.5 sm:px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${account.online ? "bg-green-500" : "bg-gray-300"}`}
                          title={account.online ? `Connecté${account.device ? ` · ${account.device}` : ""}` : "Hors ligne"}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{account.name || account.email}</p>
                          <p className="truncate text-xs text-gray-500">{ROLE_LABEL[account.role] ?? account.role}{account.online ? " · connecté" : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Jamais"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="font-semibold text-gray-900">{account.sales}</span>
                      {account.sales > 0 && <span className="block text-xs text-gray-500">{formatPrice(account.salesAmount)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{account.orders}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{account.stock}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{account.cash}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{account.deliveries}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{account.actions}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{account.lastActivityAt ? formatDateTime(account.lastActivityAt) : "Rien sur la période"}</td>
                    <td className="px-3 py-2.5 text-right sm:px-4">
                      <button
                        type="button"
                        onClick={() => showAccount(account.id)}
                        className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-gray-50"
                      >
                        Voir le détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div id="journal" className="flex scroll-mt-24 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") resetTo(setQuery)(search)
              }}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <select
            value={userId}
            onChange={(e) => resetTo(setUserId)(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} ({u.role})
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => resetTo(setCategory)(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">Toutes les actions</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="date"
              value={from}
              onChange={(e) => resetTo(setFrom)(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            <span className="text-xs text-gray-400">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => resetTo(setTo)(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => resetTo(setQuery)(search)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setUserId("")
                setCategory("")
                setFrom("")
                setTo("")
                setSearch("")
                setQuery("")
                setPage(1)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading && <p className="p-4 text-sm text-gray-500 sm:p-6">Chargement du journal...</p>}
        {!loading && events.length === 0 && (
          <div className="p-6 text-center sm:p-10">
            <Activity className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">Aucune activité pour ces critères</p>
          </div>
        )}
        {!loading && events.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-1.5 p-3 hover:bg-gray-50/60 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                <div className="w-full shrink-0 text-xs text-gray-500 sm:w-40">
                  {formatDateTime(event.date)}
                </div>
                <div className="w-full shrink-0 sm:w-48">
                  <span className="inline-flex max-w-full items-center truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {event.userName || "Système"}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        CATEGORY_STYLE[event.category] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {event.action}
                    </span>
                    {event.reference && (
                      <span className="font-mono text-[11px] text-gray-400">{event.reference}</span>
                    )}
                  </div>
                  <p className="break-words text-sm text-gray-700">{event.detail}</p>
                </div>
                {event.href && (
                  <Link
                    href={event.href}
                    className="shrink-0 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    Voir
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:flex-row sm:px-4 sm:py-3">
          <p className="text-xs text-gray-500">
            {total} opération{total > 1 ? "s" : ""} · Page {page}/{totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
