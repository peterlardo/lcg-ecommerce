"use client"

import { formatPrice } from "@/lib/utils"
import type { GlobalDeliveryDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { StatusPill } from "./status-pill"
import { DELIVERY_MODE_LBL } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Livraisons : client, mode, zone, livreur, statut et frais. */
export function DeliveriesDetails({ rows, total }: { rows: GlobalDeliveryDetail[]; total: number }) {
  const columns: DetailColumn<GlobalDeliveryDetail>[] = [
    {
      key: "createdAt",
      label: "Heure",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    { key: "customerName", label: "Client", render: (r) => r.customerName ?? DASH },
    {
      key: "orderNumber",
      label: "N° commande",
      render: (r) => (r.orderNumber ? <span className="whitespace-nowrap">{r.orderNumber}</span> : DASH),
    },
    { key: "mode", label: "Mode", render: (r) => DELIVERY_MODE_LBL[r.mode] ?? r.mode },
    { key: "zone", label: "Zone", render: (r) => r.zone ?? DASH },
    { key: "agent", label: "Livreur", render: (r) => r.agent ?? DASH },
    { key: "status", label: "Statut", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "fee",
      label: "Frais",
      align: "right",
      render: (r) => <span className="whitespace-nowrap">{r.fee ? formatPrice(r.fee) : "—"}</span>,
    },
    {
      key: "deliveredAt",
      label: "Livrée le",
      render: (r) =>
        r.deliveredAt ? <LocalDateTime value={r.deliveredAt} className="whitespace-nowrap" /> : DASH,
    },
    { key: "address", label: "Adresse", render: (r) => r.address ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Livraisons"
      subtitle="Client servi, mode de retrait, zone, livreur, statut et frais de livraison"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucune livraison sur la période"
        searchText={(r) =>
          `${r.customerName ?? ""} ${r.orderNumber ?? ""} ${r.mode} ${r.zone ?? ""} ${r.agent ?? ""} ${r.status} ${r.address ?? ""}`
        }
      />
    </CollapsibleSection>
  )
}
