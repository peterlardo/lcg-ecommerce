"use client"

import type { GlobalLotDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { StatusPill } from "./status-pill"
import { LOT_STATUS_LBL } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Lots de production : quantités initiale/restante, dates, statut et auteur. */
export function LotsDetails({ rows, total }: { rows: GlobalLotDetail[]; total: number }) {
  const columns: DetailColumn<GlobalLotDetail>[] = [
    {
      key: "lotNumber",
      label: "N° lot",
      render: (r) => <span className="whitespace-nowrap font-medium text-gray-900">{r.lotNumber}</span>,
    },
    { key: "productName", label: "Produit", render: (r) => r.productName },
    { key: "format", label: "Format", render: (r) => r.format },
    { key: "initialQuantity", label: "Qté initiale", align: "right", render: (r) => r.initialQuantity },
    {
      key: "remainingQuantity",
      label: "Qté restante",
      align: "right",
      render: (r) => <span className="font-semibold text-gray-900">{r.remainingQuantity}</span>,
    },
    {
      key: "productionDate",
      label: "Production",
      render: (r) => <LocalDateTime value={r.productionDate} className="whitespace-nowrap" />,
    },
    {
      key: "expiryDate",
      label: "Péremption",
      render: (r) => (r.expiryDate ? <LocalDateTime value={r.expiryDate} className="whitespace-nowrap" /> : DASH),
    },
    { key: "status", label: "Statut", render: (r) => <StatusPill status={r.status} label={LOT_STATUS_LBL[r.status] ?? r.status} /> },
    { key: "createdBy", label: "Créé par", render: (r) => r.createdBy ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Lots de production"
      subtitle="Chaque lot : quantité initiale, quantité restante, dates de production et péremption"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucun lot sur la période"
        searchText={(r) => `${r.lotNumber} ${r.productName} ${r.format} ${r.status} ${r.createdBy ?? ""}`}
      />
    </CollapsibleSection>
  )
}
