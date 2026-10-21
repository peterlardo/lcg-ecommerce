"use client"

import type { GlobalStockDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"

const DASH = <span className="text-gray-400">—</span>

/** Stock physique par format, réparti par point de vente. */
export function StockDetails({ rows, total }: { rows: GlobalStockDetail[]; total: number }) {
  const columns: DetailColumn<GlobalStockDetail>[] = [
    { key: "productName", label: "Produit", render: (r) => <span className="font-medium text-gray-900">{r.productName}</span> },
    { key: "format", label: "Format", render: (r) => r.format },
    { key: "categoryName", label: "Catégorie", render: (r) => r.categoryName },
    {
      key: "byPointOfSale",
      label: "Stock par point de vente",
      render: (r) =>
        r.byPointOfSale.length === 0 ? (
          DASH
        ) : (
          <ul className="space-y-0.5">
            {r.byPointOfSale.map((p) => (
              <li key={p.pointOfSale} className="whitespace-nowrap">
                <span className="text-gray-500">{p.pointOfSale}</span>{" "}
                <span className={p.quantity < 0 ? "font-medium text-red-700" : "font-medium text-gray-900"}>
                  {p.quantity}
                </span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      render: (r) => (
        <span className={r.total < 0 ? "font-semibold text-red-700" : "font-semibold text-gray-900"}>{r.total}</span>
      ),
    },
    { key: "threshold", label: "Seuil", align: "right", render: (r) => <span className="text-gray-500">{r.threshold}</span> },
    {
      key: "alert",
      label: "Alerte",
      render: (r) =>
        r.alert ? (
          <span className="inline-flex whitespace-nowrap rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
            Stock faible
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ]

  return (
    <CollapsibleSection
      title="Stock par format"
      subtitle="Stock physique de chaque format, point de vente par point de vente"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucune variante en stock"
        searchText={(r) => `${r.productName} ${r.format} ${r.categoryName}`}
      />
    </CollapsibleSection>
  )
}
