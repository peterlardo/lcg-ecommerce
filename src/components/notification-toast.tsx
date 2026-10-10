"use client"

import { useEffect, useState } from "react"
import { ShoppingCart, Bell, X, Globe, User, ReceiptText } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Notification {
  id: string
  kind?: "commande" | "precommande" | "vente"
  orderNumber: string
  customerName: string
  status: string
  total: number
  createdAt: string
  source: string
}

const statusLabels: Record<string, string> = {
  PENDING: "Nouvelle commande",
  CONFIRMED: "Commande confirmée",
  PROCESSING: "En production",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  SOLD: "Vente réalisée",
}

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-300",
  CONFIRMED: "bg-green-300",
  PROCESSING: "bg-purple-300",
  OUT_FOR_DELIVERY: "bg-orange-300",
  DELIVERED: "bg-emerald-300",
  CANCELLED: "bg-red-300",
  SOLD: "bg-emerald-300",
}

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const duration = 8000
    const interval = 50
    const step = (interval / duration) * 100
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p <= 0) { clearInterval(timer); return 0 }
        return p - step
      })
    }, interval)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (progress <= 0) onDismiss(notification.id)
  }, [progress, notification.id, onDismiss])

  return (
    <div
      style={{ animation: "toast-in 0.35s cubic-bezier(.22, 1, .36, 1) both" }}
      className="overflow-hidden rounded-xl bg-[#1d4ed8] text-white shadow-lg ring-1 ring-white/20"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 shrink-0">
            {notification.kind === "vente" ? (
              <ReceiptText className="h-5 w-5 text-white" />
            ) : notification.status === "PENDING" ? (
              <Bell className="h-5 w-5 text-white" />
            ) : (
              <ShoppingCart className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold text-white ${notification.kind === "vente" ? "uppercase tracking-wide" : ""}`}>
                {notification.kind === "vente"
                  ? "VENTE RÉALISÉE"
                  : notification.kind === "precommande"
                  ? notification.status === "PENDING"
                    ? "Nouvelle pré-commande"
                    : notification.status === "CONFIRMED"
                      ? "Pré-commande confirmée"
                      : notification.status === "CANCELLED"
                        ? "Pré-commande annulée"
                        : `Pré-commande · ${statusLabels[notification.status] || notification.status}`
                  : statusLabels[notification.status] || notification.status}
              </p>
              <span className={`h-2 w-2 rounded-full ${statusColors[notification.status] || "bg-white/60"}`} />
            </div>
            <p className="mt-0.5 truncate text-xs text-white/80">
              {notification.orderNumber} — {notification.customerName || "Client"}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-sm font-bold text-white">{formatPrice(notification.total)}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90">
                {notification.source === "CAISSE" ? (
                  <>
                    <ReceiptText className="h-2.5 w-2.5" />
                    Caisse
                  </>
                ) : notification.source === "WEB" ? (
                  <>
                    <Globe className="h-2.5 w-2.5" />
                    En ligne
                  </>
                ) : (
                  <>
                    <User className="h-2.5 w-2.5" />
                    Opérateur
                  </>
                )}
              </span>
            </div>
          </div>
          <button onClick={() => onDismiss(notification.id)} className="shrink-0 text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-1 w-full bg-white/20">
        <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

export function NotificationToast({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: (id: string) => void }) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {notifications.slice(0, 3).map((n) => (
        <NotificationItem key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
