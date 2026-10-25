"use client"

import { getStatusColor, getStatusLabel } from "@/lib/utils"

/** Couleurs complémentaires pour les statuts hors commandes/livraisons. */
const EXTRA: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  INVOICED: "bg-violet-100 text-violet-800",
  OPEN: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  EXHAUSTED: "bg-gray-100 text-gray-700",
  EXPIRED: "bg-red-100 text-red-800",
  ARCHIVED: "bg-gray-100 text-gray-700",
  DISABLED: "bg-amber-100 text-amber-800",
  UNPAID: "bg-gray-100 text-gray-700",
}

/** Pastille de statut colorée. */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const color = EXTRA[status] ?? getStatusColor(status)
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}
    >
      {label ?? getStatusLabel(status)}
    </span>
  )
}
