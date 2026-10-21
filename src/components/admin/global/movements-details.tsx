"use client"

import type { GlobalMovementDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { MOVEMENT_LBL, MOVEMENT_NEGATIVE_TYPES } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Quantité signée : les quantités sont stockées en positif, le type porte le sens. */
function signedQuantity(type: string, quantity: number) {
  const out = MOVEMENT_NEGATIVE_TYPES.has(type.toUpperCase())
  const value = out ? -Math.abs(quantity) : Math.abs(quantity)
  return {
    value,
    node: (
      <span className={out ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
        {value > 0 ? "+" : ""}
        {value}
      </span>
    ),
  }
}

/** Tous les mouvements de stock de la période (entrées, sorties, transferts, ventes). */
export function StockMovementsDetails({ rows, total }: { rows: GlobalMovementDetail[]; total: number }) {
  const columns: DetailColumn<GlobalMovementDetail>[] = [
    {
      key: "createdAt",
      label: "Heure",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    { key: "type", label: "Type", render: (r) => MOVEMENT_LBL[r.type] ?? r.type },
    { key: "productName", label: "Produit", render: (r) => <span className="font-medium text-gray-900">{r.productName}</span> },
    { key: "format", label: "Format", render: (r) => r.format },
    { key: "quantity", label: "Quantité", align: "right", render: (r) => signedQuantity(r.type, r.quantity).node },
    { key: "reason", label: "Motif", render: (r) => r.reason ?? DASH },
    { key: "pointOfSale", label: "PDV", render: (r) => r.pointOfSale ?? DASH },
    { key: "lotNumber", label: "Lot", render: (r) => r.lotNumber ?? DASH },
    { key: "reference", label: "Référence", render: (r) => r.reference ?? DASH },
    { key: "author", label: "Auteur", render: (r) => r.author ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Mouvements de stock"
      subtitle="Entrées, sorties, transferts et ventes : horodatage, quantité signée, motif et auteur"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucun mouvement de stock sur la période"
        searchText={(r) =>
          `${r.type} ${r.productName} ${r.format} ${r.reason ?? ""} ${r.reference ?? ""} ${r.author ?? ""} ${r.pointOfSale ?? ""}`
        }
      />
    </CollapsibleSection>
  )
}
