"use client"

import { formatPrice } from "@/lib/utils"
import type { GlobalReport } from "@/lib/report-types"

const PAYMENT: Record<string, string> = {
  CASH_ON_DELIVERY: "Especes",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte",
}

const B2B_DOC_LBL: Record<string, string> = {
  DEVIS: "Devis",
  COMMANDE: "Commande client",
  LIVRAISON: "Bon de livraison",
  FACTURE: "Facture",
  AVOIR: "Avoir",
}

export function GlobalReportView({ data }: { data: GlobalReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 text-xs sm:text-sm text-gray-500">
        Synthèse consolidée de tous les processus — <span className="font-medium text-gray-700">{data.periodLabel}</span> — du {new Date(data.from).toLocaleDateString("fr-FR")} au {new Date(data.to).toLocaleDateString("fr-FR")}
        {" · "}Point de vente : <span className="font-medium text-gray-700">{data.selectedPos?.name ?? "Tous"}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Chiffre d&apos;affaires</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(data.kpi.revenue)}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Commandes actives</p><p className="mt-1 text-lg font-bold text-gray-900">{data.kpi.orders}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Commandes encaissées</p><p className="mt-1 text-lg font-bold text-gray-900">{data.kpi.paidOrders}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Articles vendus</p><p className="mt-1 text-lg font-bold text-gray-900">{data.kpi.items}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">Panier moyen</p><p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(data.kpi.avgOrder)}</p></div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4"><p className="text-xs font-medium text-yellow-700">Annulées</p><p className="mt-1 text-lg font-bold text-yellow-800">{data.kpi.cancelledOrders}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Stocks</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-500">Unités en stock</p><p className="text-base font-bold text-gray-900">{data.stock.units}</p></div>
            <div><p className="text-xs text-gray-500">Variantes</p><p className="text-base font-bold text-gray-900">{data.stock.variants}</p></div>
            <div><p className="text-xs text-gray-500">Stock faible</p><p className="text-base font-bold text-yellow-700">{data.stock.lowStock}</p></div>
            <div><p className="text-xs text-gray-500">Rupture</p><p className="text-base font-bold text-red-700">{data.stock.outOfStock}</p></div>
          </div>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Approvisionnements &amp; production</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-500">Entrées</p><p className="text-base font-bold text-gray-900">{data.supply.inbound}</p></div>
            <div><p className="text-xs text-gray-500">Production</p><p className="text-base font-bold text-gray-900">{data.supply.produced}</p></div>
            <div><p className="text-xs text-gray-500">Pertes</p><p className="text-base font-bold text-gray-900">{data.supply.loss}</p></div>
            <div><p className="text-xs text-gray-500">Ajustements sortants</p><p className="text-base font-bold text-gray-900">{data.supply.adjustOut}</p></div>
            <div><p className="text-xs text-gray-500">Lots</p><p className="text-base font-bold text-gray-900">{data.lots.totalLots} <span className="text-xs font-normal text-gray-400">({data.lots.activeLots} actifs)</span></p></div>
            <div><p className="text-xs text-gray-500">Stock restant (lots)</p><p className="text-base font-bold text-gray-900">{data.lots.totalRemaining}</p></div>
          </div>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Pré-commandes, livraisons &amp; caisse</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-500">Pré-commandes</p><p className="text-base font-bold text-gray-900">{data.reservations.total} <span className="text-xs font-normal text-gray-400">({data.reservations.pending} en attente)</span></p></div>
            <div><p className="text-xs text-gray-500">Livraisons</p><p className="text-base font-bold text-gray-900">{data.deliveries.total} <span className="text-xs font-normal text-gray-400">({data.deliveries.delivered} livrées)</span></p></div>
            <div><p className="text-xs text-gray-500">Sessions de caisse</p><p className="text-base font-bold text-gray-900">{data.cash.sessions} <span className="text-xs font-normal text-gray-400">({data.cash.open} ouvertes)</span></p></div>
            <div><p className="text-xs text-gray-500">Écart de caisse</p><p className={`text-base font-bold ${data.cash.totalGap === 0 ? "text-gray-900" : data.cash.totalGap > 0 ? "text-green-700" : "text-red-700"}`}>{formatPrice(data.cash.totalGap)}</p></div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Encaissements par mode</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Mode</th><th className="py-1 text-right">Transactions</th><th className="py-1 text-right">Montant</th></tr></thead>
            <tbody>
              {data.paymentBreakdown.length === 0 ? <tr><td colSpan={3} className="py-3 text-center text-xs text-gray-400">Aucune vente</td></tr> : data.paymentBreakdown.map((r) => (
                <tr key={r.method} className="border-t border-gray-100"><td className="py-1.5">{PAYMENT[r.method] ?? r.method}</td><td className="py-1.5 text-right">{r.count}</td><td className="py-1.5 text-right font-medium">{formatPrice(r.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Top produits</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Produit</th><th className="py-1 text-right">Qté</th><th className="py-1 text-right">Montant</th></tr></thead>
            <tbody>
              {data.topProducts.length === 0 ? <tr><td colSpan={3} className="py-3 text-center text-xs text-gray-400">Aucune vente</td></tr> : data.topProducts.map((r) => (
                <tr key={r.name} className="border-t border-gray-100"><td className="py-1.5">{r.name}</td><td className="py-1.5 text-right">{r.quantity}</td><td className="py-1.5 text-right font-medium">{formatPrice(r.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
        <h2 className="mb-3 text-xs sm:text-sm font-semibold text-gray-900">Commercial B2B</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Document</th><th className="py-1 text-right">Nombre</th><th className="py-1 text-right">Montant</th></tr></thead>
            <tbody>
              {data.b2b.documents.length === 0 ? <tr><td colSpan={3} className="py-3 text-center text-xs text-gray-400">Aucun document</td></tr> : data.b2b.documents.map((r) => (
                <tr key={r.type} className="border-t border-gray-100"><td className="py-1.5">{B2B_DOC_LBL[r.type] ?? r.type}</td><td className="py-1.5 text-right">{r.count}</td><td className="py-1.5 text-right font-medium">{formatPrice(r.total)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-500">Créances totales</p><p className="text-base font-bold text-gray-900">{formatPrice(data.b2b.creanceTotal)}</p></div>
            <div><p className="text-xs text-gray-500">Créances échues</p><p className="text-base font-bold text-red-700">{formatPrice(data.b2b.creanceOverdue)}</p></div>
            <div><p className="text-xs text-gray-500">Factures ouvertes</p><p className="text-base font-bold text-gray-900">{data.b2b.openInvoices}</p></div>
            <div><p className="text-xs text-gray-500">Clients débiteurs</p><p className="text-base font-bold text-gray-900">{data.b2b.debtorClients}</p></div>
          </div>
        </div>
      </section>
    </div>
  )
}
