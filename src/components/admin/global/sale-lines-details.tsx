"use client"

import { formatPrice } from "@/lib/utils"
import type { GlobalSaleLine } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"

const DASH = <span className="text-gray-400">—</span>

/** Détail des ventes PAR ARTICLE : chaque ligne = un produit+format vendu, avec quantité, montant, caissière et date. */
export function SaleLinesDetails({ rows, total }: { rows: GlobalSaleLine[]; total: number }) {
  const columns: DetailColumn<GlobalSaleLine>[] = [
    {
      key: "createdAt",
      label: "Date",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    {
      key: "orderNumber",
      label: "N° commande",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900">{r.orderNumber}</span>,
    },
    { key: "productName", label: "Produit", render: (r) => <span className="font-medium text-gray-900">{r.productName}</span> },
    { key: "format", label: "Format", render: (r) => r.format },
    { key: "quantity", label: "Qté", align: "right", render: (r) => <span className="tabular-nums">{r.quantity}</span> },
    {
      key: "amount",
      label: "Montant",
      align: "right",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900 tabular-nums">{formatPrice(r.amount)}</span>,
    },
    { key: "customerName", label: "Client", render: (r) => r.customerName ?? DASH },
    { key: "cashier", label: "Caissière", render: (r) => r.cashier ?? DASH },
    { key: "pointOfSale", label: "PDV", render: (r) => r.pointOfSale ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Ventes par produit"
      subtitle="Chaque article vendu : produit, format, quantité, montant, caissière et date"
      count={total}
      defaultOpen
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucun article vendu sur la période"
        searchText={(r) =>
          [r.orderNumber, r.productName, r.format, r.customerName, r.cashier, r.pointOfSale].join(" ")
        }
      />
    </CollapsibleSection>
  )
}
