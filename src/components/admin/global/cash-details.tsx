"use client"

import { formatPrice } from "@/lib/utils"
import type { GlobalCashSessionDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { StatusPill } from "./status-pill"
import { CASH_STATUS_LBL } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Sessions de caisse : ouverture, fermeture, soldes et écart. */
export function CashDetails({ rows, total }: { rows: GlobalCashSessionDetail[]; total: number }) {
  const columns: DetailColumn<GlobalCashSessionDetail>[] = [
    {
      key: "openedAt",
      label: "Ouverture",
      render: (r) => <LocalDateTime value={r.openedAt} className="whitespace-nowrap" />,
    },
    {
      key: "closedAt",
      label: "Fermeture",
      render: (r) => (r.closedAt ? <LocalDateTime value={r.closedAt} className="whitespace-nowrap" /> : DASH),
    },
    { key: "cashier", label: "Caissière", render: (r) => r.cashier ?? DASH },
    { key: "pointOfSale", label: "PDV", render: (r) => r.pointOfSale ?? DASH },
    {
      key: "openingBalance",
      label: "Fonds initial",
      align: "right",
      render: (r) => <span className="whitespace-nowrap">{formatPrice(r.openingBalance)}</span>,
    },
    {
      key: "closingBalance",
      label: "Clôture",
      align: "right",
      render: (r) =>
        r.closingBalance === null ? (
          DASH
        ) : (
          <span className="whitespace-nowrap">{formatPrice(r.closingBalance)}</span>
        ),
    },
    {
      key: "gap",
      label: "Écart",
      align: "right",
      render: (r) =>
        r.gap === null ? (
          DASH
        ) : (
          <span
            className={`whitespace-nowrap font-semibold ${
              r.gap === 0 ? "text-gray-900" : r.gap > 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {formatPrice(r.gap)}
          </span>
        ),
    },
    { key: "status", label: "Statut", render: (r) => <StatusPill status={r.status} label={CASH_STATUS_LBL[r.status] ?? r.status} /> },
    { key: "reportReference", label: "Rapport", render: (r) => r.reportReference ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Caisses"
      subtitle="Sessions de caisse : ouverture, fermeture, fonds, clôture et écart"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucune session de caisse sur la période"
        searchText={(r) => `${r.cashier ?? ""} ${r.pointOfSale ?? ""} ${r.status} ${r.reportReference ?? ""}`}
      />
    </CollapsibleSection>
  )
}
