"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, ChevronLeft, ChevronRight, Phone, Store, Truck } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { DELIVERY_SLOTS, isSlotAvailable, noSlotLeft, todayInBrazzaville } from "@/lib/delivery-slots"

export type PlanningAgent = { id: string; name: string; isAvailable: boolean; isActive: boolean }

type PlanningRow = {
  id: string
  ref: string
  client: string
  telephone: string
  address: string
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
  orderId: string | null
  deliveryMode: "DELIVERY" | "PICKUP"
  zoneName: string | null
  deliveryFee: number
  slot: string
  heure: string
  items: { name: string; format: string; quantity: number; price: number }[]
  order: {
    orderNumber: string
    status: string
    delivery: { id: string; status: string; agentId: string | null; agent: string | null; failedReason: string | null } | null
  } | null
}

const DELIVERY_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "À assigner", className: "bg-yellow-100 text-yellow-800" },
  ASSIGNED: { label: "Livreur assigné", className: "bg-blue-100 text-blue-800" },
  PICKED_UP: { label: "Récupérée", className: "bg-indigo-100 text-indigo-800" },
  IN_TRANSIT: { label: "En route", className: "bg-purple-100 text-purple-800" },
  DELIVERED: { label: "Livrée", className: "bg-green-100 text-green-800" },
  FAILED: { label: "Échec", className: "bg-red-100 text-red-800" },
}

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+01:00`)
  d.setDate(d.getDate() + days)
  return new Date(d.getTime() + 3600_000).toISOString().slice(0, 10)
}

export function ReservationPlanning({ agents }: { agents: PlanningAgent[] }) {
  const [day, setDay] = useState(todayInBrazzaville())
  const [rows, setRows] = useState<PlanningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState("")
  const [moving, setMoving] = useState<{ id: string; date: string; slot: string } | null>(null)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reservations?planning=${d}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Chargement impossible")
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => { await load(day) }
    void init()
  }, [day, load])

  async function call(key: string, url: string, body: Record<string, unknown>, ok: string) {
    setBusy(key)
    setError("")
    setNotice("")
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Action impossible")
      setNotice(ok)
      await load(day)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible")
      return false
    } finally {
      setBusy("")
    }
  }

  const assignAgent = (row: PlanningRow, agentId: string) =>
    row.order?.delivery &&
    call(row.id, `/api/deliveries/${row.order.delivery.id}`, { agentId: agentId || null }, agentId ? "Livreur assigné." : "Livreur retiré.")

  async function reschedule() {
    if (!moving) return
    const done = await call(moving.id, `/api/reservations/${moving.id}`, { action: "reschedule", date: moving.date, slot: moving.slot }, "Pré-commande replanifiée, client prévenu.")
    if (done) setMoving(null)
  }

  const bySlot = [...DELIVERY_SLOTS.map((s) => ({ id: s.id as string, label: s.label })), { id: "", label: "Sans créneau" }]
    .map((s) => ({ ...s, rows: rows.filter((r) => (DELIVERY_SLOTS.some((d) => d.id === r.slot) ? r.slot : "") === s.id) }))
    .filter((s) => s.rows.length > 0 || s.id !== "")

  const label = new Date(`${day}T12:00:00+01:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setDay(shiftDay(day, -1))} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50" aria-label="Jour précédent"><ChevronLeft className="h-4 w-4" /></button>
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <button onClick={() => setDay(shiftDay(day, 1))} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50" aria-label="Jour suivant"><ChevronRight className="h-4 w-4" /></button>
        <button onClick={() => setDay(todayInBrazzaville())} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Aujourd&apos;hui</button>
        <span className="text-sm font-semibold capitalize text-gray-700">{label} · {rows.length} pré-commande{rows.length > 1 ? "s" : ""}</span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Chargement...</div>
      ) : (
        bySlot.map((slot) => (
          <section key={slot.id || "none"} className="rounded-xl border border-gray-200 bg-white">
            <h3 className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900">
              <CalendarClock className="h-4 w-4 text-gray-400" /> {slot.label}
              <span className="text-xs font-normal text-gray-500">{slot.rows.length} pré-commande{slot.rows.length > 1 ? "s" : ""}</span>
            </h3>
            {slot.rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">Aucune pré-commande sur ce créneau.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {slot.rows.map((r) => {
                  const delivery = r.order?.delivery
                  const total = r.items.reduce((s, i) => s + i.price * i.quantity, 0) + r.deliveryFee
                  const st = r.status === "PENDING" ? { label: "À confirmer", className: "bg-orange-100 text-orange-800" } : DELIVERY_STATUS[delivery?.status ?? "PENDING"]
                  const locked = delivery && ["PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(delivery.status)
                  return (
                    <li key={r.id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-gray-500">{r.ref}</span>
                          <span className="text-sm font-semibold text-gray-900">{r.client}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
                          {r.order && <Link href={`/admin/commandes/${r.orderId}/facture`} className="text-xs text-primary hover:underline">{r.order.orderNumber}</Link>}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.telephone}</span>
                          <span className="inline-flex items-center gap-1">
                            {r.deliveryMode === "PICKUP" ? <><Store className="h-3 w-3" />Retrait sur place</> : <><Truck className="h-3 w-3" />{r.zoneName ?? "Zone ?"} · {r.address}</>}
                          </span>
                          <span>{r.items.map((i) => `${i.name} ${i.format} ×${i.quantity}`).join(", ")}</span>
                          <span className="font-semibold text-gray-700">{formatPrice(total)}</span>
                        </p>
                        {delivery?.failedReason && <p className="mt-0.5 text-xs text-red-600">Échec : {delivery.failedReason}</p>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {r.deliveryMode === "DELIVERY" && delivery && (
                          <select
                            value={delivery.agentId ?? ""}
                            disabled={busy === r.id || !!locked}
                            onChange={(e) => void assignAgent(r, e.target.value)}
                            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50"
                            aria-label="Livreur"
                          >
                            <option value="">Livreur…</option>
                            {agents.filter((a) => a.isActive && (a.isAvailable || a.id === delivery.agentId)).map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        )}
                        {!locked && (
                          moving?.id === r.id ? (
                            <span className="flex flex-wrap items-center gap-1">
                              <input
                                type="date"
                                min={todayInBrazzaville()}
                                value={moving.date}
                                onChange={(e) => {
                                  const date = e.target.value
                                  const slot = isSlotAvailable(date, moving.slot) ? moving.slot : DELIVERY_SLOTS.find((s) => isSlotAvailable(date, s.id))?.id ?? ""
                                  setMoving({ ...moving, date, slot })
                                }}
                                className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                              />
                              <select value={moving.slot} onChange={(e) => setMoving({ ...moving, slot: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                                <option value="" disabled>Créneau…</option>
                                {DELIVERY_SLOTS.map((s) => {
                                  const available = isSlotAvailable(moving.date, s.id)
                                  return <option key={s.id} value={s.id} disabled={!available}>{s.label}{available ? "" : " — indisponible"}</option>
                                })}
                              </select>
                              {noSlotLeft(moving.date) && <span className="text-xs text-red-600">Plus de créneau ce jour-là</span>}
                              <button onClick={() => void reschedule()} disabled={busy === r.id} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">OK</button>
                              <button onClick={() => setMoving(null)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">Annuler</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setMoving({ id: r.id, date: day, slot: DELIVERY_SLOTS.some((s) => s.id === r.slot) ? r.slot : DELIVERY_SLOTS[0].id })}
                              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Replanifier
                            </button>
                          )
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))
      )}
      <p className="text-xs text-gray-500">
        Le départ (« En route »), la livraison et l&apos;échec se marquent depuis la page Livraisons : le client est prévenu automatiquement à chaque étape.
      </p>
    </div>
  )
}
