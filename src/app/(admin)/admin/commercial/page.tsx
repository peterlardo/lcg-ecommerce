"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, BriefcaseBusiness, RefreshCw } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface RecentDocument {
  id: string
  reference: string
  status: string
  clientName: string
  total: number
  createdAt: string
  /** factures : état du paiement (avoirs déduits) */
  paymentState?: "PAID" | "PARTIAL" | "UNPAID" | "CANCELLED"
  balance?: number
}

const PAYMENT_STATE: Record<string, { label: string; className: string }> = {
  PAID: { label: "Payée", className: "bg-green-100 text-green-700" },
  PARTIAL: { label: "Partiellement payée", className: "bg-amber-100 text-amber-800" },
  UNPAID: { label: "Non payée", className: "bg-rose-100 text-rose-700" },
  CANCELLED: { label: "Annulée par avoir", className: "bg-gray-100 text-gray-500" },
}

interface CommercialDashboard {
  month: string
  allPortfolio: boolean
  ca: number
  target: number
  rate: number | null
  facturesMois: number
  newClients: number
  contractsActive: number
  contractsCreated: number
  encaissements: number
  devisOuverts: number
  paiementsPending: number
  promesses: number
  receivables: number
  toRemind: number
  bonsLivraison: number
  facturesCount: number
  facturesMontant: number
  recentDevis: RecentDocument[]
  recentLivraisons: RecentDocument[]
  recentFactures?: RecentDocument[]
}

const STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-gray-100 text-gray-600" },
  SENT: { label: "Envoyé", className: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmé", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Refusé", className: "bg-rose-100 text-rose-700" },
  DELIVERED: { label: "Livré", className: "bg-indigo-100 text-indigo-700" },
  INVOICED: { label: "Facturé", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Annulé", className: "bg-gray-100 text-gray-500" },
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`
}

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "alert" }) {
  return (
    <div className={`rounded-xl border bg-white p-3 sm:p-4 ${tone === "alert" ? "border-red-200" : "border-gray-200"}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "alert" ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function RecentTable({ title, empty, rows, seeAll }: { title: string; empty: string; rows: RecentDocument[]; seeAll?: string }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {seeAll && <Link href={seeAll} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">Voir tout</Link>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="py-1.5 pr-3 font-medium">Référence</th>
              <th className="py-1.5 pr-3 font-medium">Client</th>
              <th className="py-1.5 pr-3 text-right font-medium">Montant</th>
              <th className="py-1.5 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((doc) => (
              <tr key={doc.id} className="border-t border-gray-100">
                <td className="py-2.5 pr-3">
                  <Link href={`/admin/bons-b2b/${doc.id}/document`} className="font-mono text-xs text-primary underline-offset-2 hover:underline">{doc.reference}</Link>
                </td>
                <td className="py-2.5 pr-3 text-gray-700">{doc.clientName}</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right font-medium text-gray-900">{formatPrice(doc.total)}</td>
                <td className="py-2.5">
                  {doc.paymentState ? (
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATE[doc.paymentState].className}`}>
                      {doc.paymentState === "PARTIAL" && doc.balance ? `Reste ${formatPrice(doc.balance)}` : PAYMENT_STATE[doc.paymentState].label}
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[doc.status]?.className ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS[doc.status]?.label ?? doc.status}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-500">{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function CommercialDashboardPage() {
  const [dash, setDash] = useState<CommercialDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/commercial/dashboard", { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok || !data?.dashboard) {
          setError(res.status === 403 ? "Cet écran est réservé à l'administrateur, aux commerciaux et au comptable." : data?.error || "Chargement impossible")
          return
        }
        setError("")
        setDash(data.dashboard)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [reload])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <BriefcaseBusiness className="h-6 w-6 text-primary" />
            Tableau de bord commercial
          </h1>
          {dash && (
            <p className="mt-1 text-sm text-gray-500">
              {monthLabel(dash.month)} · {dash.allPortfolio ? "tout le portefeuille B2B" : "vos clients B2B"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); setReload((n) => n + 1) }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {loading && !dash && <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Chargement...</p>}

      {dash && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            <Kpi label="Chiffre d'affaires du mois" value={formatPrice(dash.ca)} hint={`${dash.facturesMois} facture${dash.facturesMois > 1 ? "s" : ""} émise${dash.facturesMois > 1 ? "s" : ""} ce mois-ci`} />
            {dash.target > 0 && (
              <Kpi label="Objectif du mois" value={formatPrice(dash.target)} hint={`Réalisé à ${dash.rate ?? 0} %`} />
            )}
            <Kpi label="Encaissements" value={formatPrice(dash.encaissements)} hint="validés ce mois-ci" />
            <Kpi
              label="Créances"
              value={formatPrice(dash.receivables)}
              hint={dash.toRemind > 0 ? `${dash.toRemind} facture${dash.toRemind > 1 ? "s" : ""} à relancer` : "aucune échéance dépassée"}
              tone={dash.toRemind > 0 ? "alert" : undefined}
            />
            <Kpi label="En attente de validation" value={formatPrice(dash.paiementsPending)} hint="règlements saisis à valider" />
            <Kpi label="Promesses de paiement" value={formatPrice(dash.promesses)} hint="en cours" />
            <Kpi label="Contrats actifs" value={dash.contractsActive} hint={`${dash.contractsCreated} créé${dash.contractsCreated > 1 ? "s" : ""} ce mois-ci`} />
            <Kpi label="Nouveaux clients B2B" value={dash.newClients} hint="ce mois-ci" />
            <Kpi label="Devis ouverts" value={dash.devisOuverts} hint="en attente de la validation du client" />
            <Kpi label="Bons de livraison" value={dash.bonsLivraison} hint="émis, hors annulés" />
            <Kpi label="Factures émises" value={dash.facturesCount} hint={formatPrice(dash.facturesMontant)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/creances" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              Voir les créances
            </Link>
            <Link href="/admin/clients-b2b" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Clients B2B
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {/* dans l'ordre de la chaîne : devis → facture → bon de livraison */}
            <RecentTable title="Devis récents" empty="Aucun devis" rows={dash.recentDevis} seeAll="/admin/devis-b2b" />
            <RecentTable title="Factures récentes" empty="Aucune facture" rows={dash.recentFactures ?? []} seeAll="/admin/bons-b2b?type=FACTURE" />
            <RecentTable title="Bons de livraison récents" empty="Aucun bon de livraison" rows={dash.recentLivraisons} seeAll="/admin/bons-b2b?type=LIVRAISON" />
          </div>
        </>
      )}
    </div>
  )
}
