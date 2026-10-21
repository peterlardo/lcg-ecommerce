"use client"

import { formatPrice } from "@/lib/utils"
import type { GlobalB2bDocumentDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { StatusPill } from "./status-pill"
import { B2B_DOC_LBL, B2B_STATUS_LBL } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Documents commerciaux B2B : devis, commandes, livraisons, factures, avoirs. */
export function B2bDetails({ rows, total }: { rows: GlobalB2bDocumentDetail[]; total: number }) {
  const columns: DetailColumn<GlobalB2bDocumentDetail>[] = [
    {
      key: "createdAt",
      label: "Heure",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    {
      key: "reference",
      label: "N° document",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900">{r.reference}</span>,
    },
    { key: "type", label: "Type", render: (r) => B2B_DOC_LBL[r.type] ?? r.type },
    { key: "client", label: "Client", render: (r) => r.client ?? DASH },
    {
      key: "total",
      label: "Montant",
      align: "right",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900">{formatPrice(r.total)}</span>,
    },
    { key: "status", label: "Statut", render: (r) => <StatusPill status={r.status} label={B2B_STATUS_LBL[r.status] ?? r.status} /> },
  ]

  return (
    <CollapsibleSection
      title="Commercial B2B — documents"
      subtitle="Chaque document émis sur la période : référence, client, montant et statut"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucun document B2B sur la période"
        searchText={(r) => `${r.reference} ${r.type} ${r.client ?? ""} ${r.status}`}
      />
    </CollapsibleSection>
  )
}
