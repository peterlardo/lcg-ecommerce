"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Boxes, CircleDollarSign, Clock, ShoppingCart, Truck } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { pollEconomically } from "@/lib/polling"

/** Chiffres du jour lus dans /api/reports (même périmètre que l'utilisateur connecté). */
interface DaySummary {
  todayRevenue: number
  todayOrders: number
  todayOrdersDelivered: number
  todayItems?: number
  yesterdayItems?: number
  todayWaiting?: number
  deliveredToday: number
  todayInDelivery: number
  todayProducts?: { name: string; quantity: number }[]
}

/** Jour de Brazzaville (AAAA-MM-JJ), pour le lien « Voir les commandes ». */
const todayKey = () => new Date().toLocaleDateString("fr-CA", { timeZone: "Africa/Brazzaville" })

/**
 * Cartes du tableau de bord classique : ventes, commandes, articles vendus, commandes en attente et
 * livraisons du jour. Relues toutes les minutes, onglet visible.
 */
export function DailyStatsCards() {
  const [summary, setSummary] = useState<DaySummary | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const read = async () => {
      try {
        const res = await fetch("/api/reports", { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (!controller.signal.aborted && res.ok && data?.summary) setSummary(data.summary)
      } catch {}
    }
    void read()
    const stopPolling = pollEconomically(() => void read(), 60000)
    return () => { controller.abort(); stopPolling() }
  }, [])

  const sold = summary?.todayOrdersDelivered ?? 0
  const waiting = summary?.todayWaiting ?? 0
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`
  const cards: { label: string; value: string; detail: string; icon: typeof Clock; tone: string; href?: string; hrefLabel?: string }[] = [
    { label: "Ventes du jour", value: formatPrice(summary?.todayRevenue ?? 0), detail: `Chiffre d'affaires de ${plural(sold, "commande")} payée${sold > 1 ? "s" : ""} ou livrée${sold > 1 ? "s" : ""}`, icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-100" },
    { label: "Commandes du jour", value: String(summary?.todayOrders ?? 0), detail: `${sold} vendue${sold > 1 ? "s" : ""} · ${waiting} en attente`, icon: ShoppingCart, tone: "text-primary bg-primary/10", href: `/admin/commandes?jour=${todayKey()}`, hrefLabel: "Voir les commandes" },
    { label: "Articles vendus", value: String(summary?.todayItems ?? 0), detail: `Payés ou livrés · hier : ${summary?.yesterdayItems ?? 0}`, icon: Boxes, tone: "text-green-600 bg-green-100" },
    { label: "Commandes en attente", value: String(waiting), detail: waiting > 0 ? "Du jour, à traiter" : "Aucune commande en attente aujourd'hui", icon: Clock, tone: "text-yellow-600 bg-yellow-100" },
    { label: "Livraisons du jour", value: String(summary?.deliveredToday ?? 0), detail: `${summary?.todayInDelivery ?? 0} en cours de livraison`, icon: Truck, tone: "text-orange-600 bg-orange-100" },
  ]
  const articles = summary?.todayProducts ?? []

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="rounded-xl border border-border bg-card p-3 shadow-card-soft sm:p-5">
            <div className="flex items-start justify-between">
              <div><p className="text-xs text-muted-foreground sm:text-sm">{card.label}</p><p className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{summary ? card.value : "…"}</p></div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 ${card.tone}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground sm:mt-4">{card.detail}</p>
            {card.href && (
              <Link href={card.href} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-2 py-2 text-center text-sm font-semibold leading-tight text-white shadow-sm hover:opacity-90">
                <span>{card.hrefLabel}</span>
              </Link>
            )}
            {card.label === "Articles vendus" && articles.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-border pt-2">
                {articles.map((article) => (
                  <li key={article.name} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground" title={article.name}>{article.name}</span>
                    <span className="shrink-0 font-semibold text-foreground">{article.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
