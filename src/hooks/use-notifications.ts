"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { formatPrice } from "@/lib/utils"
import { playNotificationSound, unlockNotificationAudio } from "@/lib/notification-sound"

export interface AppNotification {
  id: string
  kind?: "commande" | "precommande" | "vente" | "rappel"
  orderNumber: string
  customerName: string
  status: string
  total: number
  createdAt: string
  source: string
  href?: string
  /** Rappels : jour de livraison (ou de retrait) prévu, demain. */
  scheduledDate?: string | null
  pickup?: boolean
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
  if (n.kind === "rappel") return n.pickup ? "RAPPEL : retrait prévu demain" : "RAPPEL : livraison prévue demain"
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

// Rappels déjà affichés pendant cette session du navigateur (sans stockage disponible : affichés à chaque ouverture)
const REMINDERS_KEY = "lcg-rappels-vus"
function reminderShown(id: string): boolean {
  try {
    return (JSON.parse(sessionStorage.getItem(REMINDERS_KEY) || "[]") as string[]).includes(id)
  } catch {
    return false
  }
}
function markReminderShown(id: string) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(REMINDERS_KEY) || "[]") as string[]
    if (!seen.includes(id)) sessionStorage.setItem(REMINDERS_KEY, JSON.stringify([...seen, id].slice(-50)))
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
  // nombre de commandes prévues un autre jour qu'aujourd'hui (en-tête de la réponse)
  const [plannedCount, setPlannedCount] = useState(0)

  useEffect(() => {
    let active = true
    let inFlight = false

    const check = async () => {
      // Une seule vérification à la fois : sinon la même commande serait notifiée deux fois.
      if (inFlight) return
      inFlight = true
      try {
        const res = await fetch("/api/notifications")
        if (!res.ok) return
        const data: AppNotification[] = await res.json()
        if (!active) return

        setRecent(data)
        setPlannedCount(Number(res.headers.get("X-Commandes-Prevues")) || 0)
        const fresh = data.filter((n) => !seenIds.current.has(n.id))
        if (fresh.length > 0 && primed.current) {
          setNotifications((prev) => [...fresh, ...prev].slice(0, 10))
          setNewCount((c) => c + fresh.length)
          fresh.forEach(showDesktopNotification)
          playNotificationSound()
        } else if (!primed.current) {
          // À l'ouverture, les rappels de la veille déjà présents s'affichent quand même (une fois par session)
          const reminders = fresh.filter((n) => n.kind === "rappel" && !reminderShown(n.id))
          if (reminders.length > 0) {
            setNotifications((prev) => [...reminders, ...prev].slice(0, 10))
            setNewCount((c) => c + reminders.length)
            reminders.forEach((n) => markReminderShown(n.id))
          }
        }
        if (primed.current) fresh.filter((n) => n.kind === "rappel").forEach((n) => markReminderShown(n.id))
        data.forEach((n) => seenIds.current.add(n.id))
        primed.current = true
      } catch {
      } finally {
        inFlight = false
      }
    }

    check()
    const timer = setInterval(check, pollInterval)
    // Edge/Chrome ralentissent ou suspendent les onglets en arrière-plan : au retour
    // sur l'onglet, on vérifie tout de suite pour afficher les commandes arrivées entre-temps.
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
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

  useEffect(() => {
    const unlock = () => unlockNotificationAudio()
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => { setNotifications([]); setNewCount(0) }, [])

  return { notifications, recent, newCount, plannedCount, dismiss, dismissAll }
}
