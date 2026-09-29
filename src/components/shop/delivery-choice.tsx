"use client"

import { useEffect, useMemo, useState } from "react"
import { Bike, MapPin, Store, Truck } from "lucide-react"
import { formatPrice } from "@/lib/utils"

export type DeliveryOptionZone = { id: string; name: string; baseFee: number }
export type DeliveryOptionAgent = {
  id: string
  name: string
  kind: string
  companyName: string | null
  phone: string | null
  vehicle: string | null
  zonesLabel: string | null
  fees: Record<string, number>
}

export type DeliveryChoice = {
  mode: "DELIVERY" | "PICKUP"
  zoneId: string | null
  agentId: string | null
  fee: number
}

export const PICKUP_PLACE = "97 Rue EWO — site LCG, Brazzaville"

const inputClass =
  "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"

function agentFee(agent: DeliveryOptionAgent, zoneId: string | null, zoneBaseFee: number | null) {
  if (!zoneId) return 0
  const override = agent.fees[zoneId]
  return typeof override === "number" ? override : zoneBaseFee ?? 0
}

export default function DeliveryChoiceBlock({
  value,
  onChange,
  requireAgent = false,
}: {
  value: DeliveryChoice
  onChange: (next: DeliveryChoice) => void
  requireAgent?: boolean
}) {
  const [zones, setZones] = useState<DeliveryOptionZone[]>([])
  const [agents, setAgents] = useState<DeliveryOptionAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/delivery-options")
        const data = await res.json().catch(() => null)
        if (res.ok && data) {
          setZones(Array.isArray(data.zones) ? data.zones : [])
          setAgents(Array.isArray(data.agents) ? data.agents : [])
        }
      } catch {
        // réseau indisponible
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [])

  const zone = useMemo(() => zones.find((z) => z.id === value.zoneId) ?? null, [zones, value.zoneId])
  const maison = agents.filter((a) => a.kind === "MAISON")
  const partenaires = agents.filter((a) => a.kind === "PARTNER")

  const currentFee = value.mode === "PICKUP"
    ? 0
    : value.agentId
      ? agentFee(agents.find((a) => a.id === value.agentId)!, zone?.id ?? null, zone?.baseFee ?? null)
      : zone?.baseFee ?? 0

  function setMode(mode: "DELIVERY" | "PICKUP") {
    if (mode === "PICKUP") {
      onChange({ mode, zoneId: null, agentId: null, fee: 0 })
      return
    }
    const firstZone = zones[0]?.id ?? null
    onChange({ mode, zoneId: value.zoneId ?? firstZone, agentId: null, fee: 0 })
  }

  function setZone(zoneId: string) {
    const z = zones.find((item) => item.id === zoneId)
    onChange({
      mode: "DELIVERY",
      zoneId,
      agentId: value.agentId,
      fee: value.agentId && z ? agentFee(agents.find((a) => a.id === value.agentId)!, zoneId, z.baseFee) : z?.baseFee ?? 0,
    })
  }

  function setAgent(agentId: string | null) {
    onChange({
      mode: "DELIVERY",
      zoneId: value.zoneId,
      agentId,
      fee: agentId ? agentFee(agents.find((a) => a.id === agentId)!, value.zoneId, zone?.baseFee ?? null) : zone?.baseFee ?? 0,
    })
  }

  const zoneSelect = (
    <label className="block text-sm font-semibold">
      Zone de livraison *
      <select
        value={value.zoneId ?? ""}
        onChange={(e) => setZone(e.target.value)}
        disabled={value.mode === "PICKUP"}
        className={inputClass}
      >
        <option value="">Choisir une zone…</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name} — {formatPrice(z.baseFee)}
          </option>
        ))}
      </select>
    </label>
  )

  function agentCard(agent: DeliveryOptionAgent) {
    const selected = value.agentId === agent.id
    const fee = agentFee(agent, value.zoneId, zone?.baseFee ?? null)
    return (
      <button
        key={agent.id}
        type="button"
        onClick={() => setAgent(selected ? null : agent.id)}
        className={
          selected
            ? "flex w-full items-start gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-3.5 text-left"
            : "flex w-full items-start gap-3 rounded-2xl border border-border p-3.5 text-left transition-colors hover:border-primary/50"
        }
      >
        <span className="mt-0.5 rounded-lg bg-muted p-2">
          {agent.kind === "PARTNER" ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            {agent.kind === "PARTNER" ? agent.companyName || agent.name : agent.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {agent.vehicle || (agent.kind === "PARTNER" ? "Partenaire" : "Livreur LCG")}
            {agent.zonesLabel ? ` — ${agent.zonesLabel}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-sm font-extrabold text-primary">{formatPrice(fee)}</span>
      </button>
    )
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
            <span className="block text-xs text-muted-foreground">Livreur maison ou partenaire, frais selon la zone</span>
          </span>
          <span className="text-sm font-extrabold text-primary">
            {value.mode === "DELIVERY" ? formatPrice(currentFee) : ""}
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
        <div className="space-y-4">
          {zoneSelect}

          {loading ? (
            <p className="text-xs text-muted-foreground">Chargement des livreurs…</p>
          ) : agents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Aucun livreur disponible pour le moment. Votre commande reste enregistrée : notre équipe organise
              la livraison manuellement et vous appelle pour confirmer.
            </div>
          ) : (
            <div className="space-y-3">
              {maison.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> Livreurs LCG
                  </p>
                  {maison.map(agentCard)}
                </div>
              )}
              {partenaires.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Bike className="h-3.5 w-3.5" /> Partenaires
                  </p>
                  {partenaires.map(agentCard)}
                </div>
              )}
            </div>
          )}

          {requireAgent && !value.agentId && (
            <p className="text-xs font-semibold text-destructive">Choisissez un livreur pour finaliser la commande.</p>
          )}
        </div>
      )}
    </div>
  )
}
