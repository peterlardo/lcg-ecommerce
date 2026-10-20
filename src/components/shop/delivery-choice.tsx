"use client"

import { Store, Truck } from "lucide-react"
import { formatPrice } from "@/lib/utils"

export type DeliveryChoice = {
  mode: "DELIVERY" | "PICKUP"
  zoneId: string | null
  agentId: string | null
  fee: number
}

export const PICKUP_PLACE = "97 Rue EWO — site LCG, Brazzaville"

/**
 * Choix du mode de réception : livraison à domicile ou retrait sur place.
 * La zone et le livreur ne sont plus demandés au client : l'équipe LCG les
 * attribue à la confirmation, et règle les frais en conséquence.
 */
export default function DeliveryChoiceBlock({
  value,
  onChange,
}: {
  value: DeliveryChoice
  onChange: (next: DeliveryChoice) => void
}) {
  function setMode(mode: "DELIVERY" | "PICKUP") {
    onChange({ mode, zoneId: null, agentId: null, fee: 0 })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setMode("DELIVERY")}
          className={
            value.mode === "DELIVERY"
              ? "flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4 text-left"
              : "flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/50"
          }
        >
          <Truck className="h-5 w-5 text-primary" />
          <span className="flex-1">
            <span className="block text-sm font-bold">Livraison à domicile</span>
            <span className="block text-xs text-muted-foreground">
              Notre équipe vous appelle pour confirmer la livraison et les frais
            </span>
          </span>
          <span className="text-sm font-extrabold text-primary">
            {value.mode === "DELIVERY" ? formatPrice(value.fee) : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("PICKUP")}
          className={
            value.mode === "PICKUP"
              ? "flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4 text-left"
              : "flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/50"
          }
        >
          <Store className="h-5 w-5 text-primary" />
          <span className="flex-1">
            <span className="block text-sm font-bold">Retrait sur place</span>
            <span className="block text-xs text-muted-foreground">{PICKUP_PLACE} — sans frais</span>
          </span>
          <span className="text-sm font-extrabold text-green-600">Gratuit</span>
        </button>
      </div>

      {value.mode === "DELIVERY" && (
        <p className="text-xs text-muted-foreground">
          Les frais de livraison sont confirmés par notre équipe selon votre quartier, lors de l&apos;appel de confirmation.
        </p>
      )}
    </div>
  )
}
