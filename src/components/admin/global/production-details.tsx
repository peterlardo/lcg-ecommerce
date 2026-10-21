"use client"

import type { GlobalMovementDetail, GlobalProductionFormat } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"

const DASH = <span className="text-gray-400">—</span>

/** Production agrégée par format (produit + variant). */
export function ProductionFormatsDetails({ rows }: { rows: GlobalProductionFormat[] }) {
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)

  const columns: DetailColumn<GlobalProductionFormat>[] = [
    { key: "productName", label: "Produit", render: (r) => <span className="font-medium text-gray-900">{r.productName}</span> },
    { key: "format", label: "Format", render: (r) => r.format },
    { key: "quantity", label: "Quantité produite", align: "right", render: (r) => <span className="font-semibold text-gray-900">{r.quantity}</span> },
    { key: "movements", label: "Mouvements", align: "right", render: (r) => r.movements },
    {
      key: "share",
      label: "% production",
      align: "right",
      render: (r) => <span className="text-gray-600">{r.share.toFixed(1).replace(".", ",")} %</span>,
    },
    { key: "lots", label: "Lots", align: "right", render: (r) => r.lots },
    { key: "remaining", label: "Restant", align: "right", render: (r) => r.remaining },
  ]

  return (
    <CollapsibleSection
      title="Production par format"
      subtitle="Quantités produites par format et par produit, avec la part de chacune"
      count={rows.length}
      badge={totalQty > 0 ? `${totalQty} u.` : undefined}
      defaultOpen
    >
      <DetailTable
        rows={rows}
        columns={columns}
        emptyLabel="Aucune production sur la période"
        searchText={(r) => `${r.productName} ${r.format}`}
      />
    </CollapsibleSection>
  )
}

/** Mouvements de production (unités réellement produites, avec heure et auteur). */
export function ProductionMovementsDetails({ rows, total }: { rows: GlobalMovementDetail[]; total: number }) {
  const columns: DetailColumn<GlobalMovementDetail>[] = [
    {
      key: "createdAt",
      label: "Heure",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    { key: "productName", label: "Produit", render: (r) => <span className="font-medium text-gray-900">{r.productName}</span> },
    { key: "format", label: "Format", render: (r) => r.format },
    { key: "quantity", label: "Quantité", align: "right", render: (r) => <span className="font-semibold text-emerald-700">+{r.quantity}</span> },
    { key: "reason", label: "Motif", render: (r) => r.reason ?? DASH },
    { key: "pointOfSale", label: "PDV", render: (r) => r.pointOfSale ?? DASH },
    { key: "lotNumber", label: "Lot", render: (r) => r.lotNumber ?? DASH },
    { key: "author", label: "Auteur", render: (r) => r.author ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Mouvements de production"
      subtitle="Unités produites : horodatage, format, quantité, motif, point de vente et auteur"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucun mouvement de production sur la période"
        searchText={(r) => `${r.productName} ${r.format} ${r.reason ?? ""} ${r.author ?? ""} ${r.lotNumber ?? ""}`}
      />
    </CollapsibleSection>
  )
}
