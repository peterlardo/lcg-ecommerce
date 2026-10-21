"use client"

import { formatPrice } from "@/lib/utils"
import type { GlobalSaleDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { StatusPill } from "./status-pill"
import { PAYMENT_METHOD_LBL, PAYMENT_STATUS_LBL, SOURCE_LBL } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Détail des ventes : chaque commande avec caissière, client, heure et montant. */
export function SalesDetails({ rows, total }: { rows: GlobalSaleDetail[]; total: number }) {
  const columns: DetailColumn<GlobalSaleDetail>[] = [
    {
      key: "createdAt",
      label: "Heure",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    {
      key: "orderNumber",
      label: "N° commande",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900">{r.orderNumber}</span>,
    },
    { key: "customerName", label: "Client", render: (r) => r.customerName ?? DASH },
    { key: "cashier", label: "Caissière", render: (r) => r.cashier ?? DASH },
    { key: "operator", label: "Opérateur", render: (r) => r.operator ?? DASH },
    { key: "source", label: "Source", render: (r) => SOURCE_LBL[r.source] ?? r.source },
    { key: "status", label: "Statut", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "paymentStatus",
      label: "Paiement",
      render: (r) => (
        <StatusPill status={r.paymentStatus} label={PAYMENT_STATUS_LBL[r.paymentStatus] ?? r.paymentStatus} />
      ),
    },
    {
      key: "paymentMethod",
      label: "Mode",
      render: (r) => (r.paymentMethod ? PAYMENT_METHOD_LBL[r.paymentMethod] ?? r.paymentMethod : DASH),
    },
    { key: "items", label: "Articles", align: "right", render: (r) => r.items },
    {
      key: "total",
      label: "Total",
      align: "right",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900">{formatPrice(r.total)}</span>,
    },
    { key: "pointOfSale", label: "PDV", render: (r) => r.pointOfSale ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Ventes"
      subtitle="Toutes les commandes de la période : caissière, client servi, heure et montant"
      count={total}
      defaultOpen
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucune vente sur la période"
        searchText={(r) =>
          [r.orderNumber, r.customerName, r.cashier, r.operator, r.pointOfSale, r.status].join(" ")
        }
      />
    </CollapsibleSection>
  )
}
