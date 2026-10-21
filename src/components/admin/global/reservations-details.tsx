"use client"

import type { GlobalReservationDetail } from "@/lib/report-types"
import { DetailTable, type DetailColumn } from "./detail-table"
import { CollapsibleSection } from "./collapsible-section"
import { LocalDateTime } from "./format"
import { StatusPill } from "./status-pill"
import { RESERVATION_STATUS_LBL } from "./labels"

const DASH = <span className="text-gray-400">—</span>

/** Pré-commandes (réservations) : client, contact, créneau demandé et statut. */
export function ReservationsDetails({ rows, total }: { rows: GlobalReservationDetail[]; total: number }) {
  const columns: DetailColumn<GlobalReservationDetail>[] = [
    {
      key: "createdAt",
      label: "Reçue le",
      render: (r) => <LocalDateTime value={r.createdAt} className="whitespace-nowrap" />,
    },
    { key: "customerName", label: "Client", render: (r) => r.customerName ?? DASH },
    { key: "telephone", label: "Téléphone", render: (r) => r.telephone ?? DASH },
    { key: "type", label: "Type", render: (r) => r.type },
    { key: "date", label: "Date demandée", render: (r) => <span className="whitespace-nowrap">{r.date}</span> },
    { key: "heure", label: "Heure", render: (r) => <span className="whitespace-nowrap">{r.heure}</span> },
    {
      key: "status",
      label: "Statut",
      render: (r) => (
        <StatusPill status={r.status} label={RESERVATION_STATUS_LBL[r.status] ?? r.status} />
      ),
    },
    { key: "pointOfSale", label: "PDV", render: (r) => r.pointOfSale ?? DASH },
  ]

  return (
    <CollapsibleSection
      title="Pré-commandes"
      subtitle="Réservations : client, contact, créneau demandé et statut"
      count={total}
    >
      <DetailTable
        rows={rows}
        columns={columns}
        total={total}
        emptyLabel="Aucune pré-commande sur la période"
        searchText={(r) => `${r.customerName ?? ""} ${r.telephone ?? ""} ${r.type} ${r.date} ${r.heure} ${r.status}`}
      />
    </CollapsibleSection>
  )
}
