"use client"

import { useEffect, useState } from "react"
import { ShoppingCart, Bell, X, Globe, User } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Notification {
  id: string
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
}

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-500",
  CONFIRMED: "bg-green-500",
  PROCESSING: "bg-purple-500",
  OUT_FOR_DELIVERY: "bg-orange-500",
  DELIVERED: "bg-emerald-600",
  CANCELLED: "bg-red-500",
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
      className="bg-white border border-border rounded-xl shadow-lg overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
            {notification.status === "PENDING" ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <ShoppingCart className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {statusLabels[notification.status] || notification.status}
              </p>
              <span className={`h-2 w-2 rounded-full ${statusColors[notification.status] || "bg-gray-400"}`} />
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {notification.orderNumber} — {notification.customerName || "Client"}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-sm font-bold text-primary">{formatPrice(notification.total)}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {notification.source === "WEB" ? <Globe className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                {notification.source === "WEB" ? "En ligne" : "Opérateur"}
              </span>
            </div>
          </div>
          <button onClick={() => onDismiss(notification.id)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-1 w-full bg-muted">
        <div className="h-full bg-primary transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

export function NotificationToast({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: (id: string) => void }) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {notifications.slice(0, 3).map((n) => (
        <NotificationItem key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
