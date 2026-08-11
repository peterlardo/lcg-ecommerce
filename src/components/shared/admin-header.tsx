"use client"

import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell, LogOut, Search, Settings, Store, Users } from "lucide-react"

interface OrderSearchItem {
  id: string
  orderNumber: string
  customerName: string | null
  customerPhone: string | null
  status: string
  total: number
}

interface ReservationSearchItem {
  id: string
  client: string
  telephone: string
  type: string
  date: string
  heure: string
  status: string
}

interface SearchResult {
  type: "Commande" | "Pré-commande"
  title: string
  detail: string
  href: string
}

export function AdminHeader() {
  const { data: session } = useSession()
  const canSee = (module: string) => session?.user?.role === "ADMIN" || (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") || session?.user?.permissions?.some((permission) => permission.module === module && permission.canView)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const value = query.trim().toLowerCase()
    if (value.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const [ordersResponse, reservationsResponse] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/reservations"),
        ])
        const orders = ordersResponse.ok ? (await ordersResponse.json() as OrderSearchItem[]) : []
        const reservations = reservationsResponse.ok ? (await reservationsResponse.json() as ReservationSearchItem[]) : []
        const orderResults = orders
          .filter((order) => `${order.orderNumber} ${order.customerName ?? ""} ${order.customerPhone ?? ""}`.toLowerCase().includes(value))
          .slice(0, 5)
          .map((order) => ({
            type: "Commande" as const,
            title: order.orderNumber,
            detail: `${order.customerName || "Client"} · ${order.status} · ${order.total.toLocaleString("fr-FR")} FCFA`,
            href: `/admin/commandes?search=${encodeURIComponent(order.orderNumber)}`,
          }))
        const reservationResults = reservations
          .filter((reservation) => `${reservation.client} ${reservation.telephone} ${reservation.type} ${reservation.date}`.toLowerCase().includes(value))
          .slice(0, 5)
          .map((reservation) => ({
            type: "Pré-commande" as const,
            title: reservation.client,
            detail: `${reservation.type} · ${reservation.date} à ${reservation.heure}`,
            href: `/admin/reservations?search=${encodeURIComponent(reservation.client)}`,
          }))
        setResults([...orderResults, ...reservationResults].slice(0, 8))
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="mx-4 hidden min-w-0 max-w-xl flex-1 md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Rechercher une commande ou une pré-commande..."
            aria-label="Rechercher une commande ou une pré-commande"
            className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-16 text-sm text-gray-700 outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-400 lg:inline-block">⌘ K</kbd>
          {searchOpen && query.trim().length >= 2 && <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {searching && <p className="px-4 py-3 text-sm text-gray-500">Recherche en cours...</p>}
            {!searching && results.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">Aucun résultat trouvé.</p>}
            {!searching && results.map((result) => <Link key={`${result.type}-${result.href}`} href={result.href} onMouseDown={() => setSearchOpen(false)} className="block border-b border-gray-100 px-4 py-3 hover:bg-gray-50"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-gray-800">{result.title}</span><span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">{result.type}</span></div><p className="mt-1 text-xs text-gray-500">{result.detail}</p></Link>)}
          </div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {canSee("utilisateurs") && <Link href="/admin/utilisateurs" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700" title="Utilisateurs"><Users className="h-4 w-4" /><span className="hidden md:inline">Utilisateurs</span></Link>}
        {canSee("points-de-vente") && <Link href="/admin/points-de-vente" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700" title="Points de vente"><Store className="h-4 w-4" /><span className="hidden md:inline">Points de vente</span></Link>}
        <Link href="/admin/parametres" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700" title="Paramètres"><Settings className="h-4 w-4" /><span className="hidden md:inline">Paramètres</span></Link>
        <button type="button" aria-label="Notifications" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"><Bell className="h-4 w-4" /></button>
        <div className="flex items-center gap-2 text-sm"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">{session?.user?.name?.charAt(0) || "U"}</div><span className="hidden text-gray-700 sm:inline">{session?.user?.name}</span></div>
        <button type="button" onClick={() => signOut({ callbackUrl: "/auth/personnel" })} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Déconnexion"><LogOut className="h-4 w-4" /></button>
      </div>
    </header>
  )
}









