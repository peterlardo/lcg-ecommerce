"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { formatPrice } from "@/lib/utils"

export interface AppNotification {
  id: string
  kind?: "commande" | "precommande" | "vente"
  orderNumber: string
  customerName: string
  status: string
  total: number
  createdAt: string
  source: string
  href?: string
}

const desktopStatusLabels: Record<string, string> = {
  PENDING: "Nouvelle commande",
  CONFIRMED: "Commande confirmée",
  PROCESSING: "En production",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  SOLD: "Vente réalisée",
}

function desktopTitle(n: AppNotification): string {
  if (n.kind === "vente") return "VENTE RÉALISÉE"
  if (n.kind === "precommande") {
    if (n.status === "PENDING") return "Nouvelle pré-commande"
    if (n.status === "CONFIRMED") return "Pré-commande confirmée"
    if (n.status === "CANCELLED") return "Pré-commande annulée"
    return `Pré-commande · ${desktopStatusLabels[n.status] || n.status}`
  }
  return desktopStatusLabels[n.status] || n.status
}

function showDesktopNotification(n: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  try {
    const notif = new Notification(desktopTitle(n), {
      body: `${n.orderNumber} — ${n.customerName || "Client"} · ${formatPrice(n.total)}`,
      tag: `lcg-${n.id}`,
      icon: "/favicon-64.png",
    })
    notif.onclick = () => {
      window.focus()
      if (n.href) window.location.href = n.href
    }
  } catch {}
}

export function useNotifications(pollInterval = 8000) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [recent, setRecent] = useState<AppNotification[]>([])
  const seenIds = useRef(new Set<string>())
  // Premier chargement : l'existant est mémorisé sans être affiché. Ne pas se fier à
  // seenIds.size : si la liste initiale est vide, la première commande arrivée ne
  // s'afficherait jamais.
  const primed = useRef(false)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const res = await fetch("/api/notifications")
        if (!res.ok) return
        const data: AppNotification[] = await res.json()
        if (!active) return

        setRecent(data)
        const fresh = data.filter((n) => !seenIds.current.has(n.id))
        if (fresh.length > 0 && primed.current) {
          setNotifications((prev) => [...fresh, ...prev].slice(0, 10))
          setNewCount((c) => c + fresh.length)
          fresh.forEach(showDesktopNotification)
        }
        data.forEach((n) => seenIds.current.add(n.id))
        primed.current = true
      } catch {}
    }

    check()
    const timer = setInterval(check, pollInterval)
    return () => { active = false; clearInterval(timer) }
  }, [pollInterval])

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "default") return
    const request = () => {
      Notification.requestPermission().finally(() => {
        window.removeEventListener("pointerdown", request)
        window.removeEventListener("keydown", request)
      })
    }
    window.addEventListener("pointerdown", request, { once: true })
    window.addEventListener("keydown", request, { once: true })
    return () => {
      window.removeEventListener("pointerdown", request)
      window.removeEventListener("keydown", request)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => { setNotifications([]); setNewCount(0) }, [])

  return { notifications, recent, newCount, dismiss, dismissAll }
}
