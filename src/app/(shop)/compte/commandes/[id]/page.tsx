"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getStatusColor, getStatusLabel, formatPrice } from "@/lib/utils"
import { ArrowLeft, Truck, Package, Clock, CheckCircle } from "lucide-react"

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  subtotal: number
  deliveryFee: number
  total: number
  notes: string | null
  createdAt: string
  items: {
    name: string
    format: string
    quantity: number
    price: number
    total: number
  }[]
  delivery: {
    status: string
    address: string
    city: string
    scheduledDate: string | null
    deliveredAt: string | null
    notes: string | null
  } | null
}

const statusSteps = [
  { key: "PENDING", label: "Reçue", icon: Clock },
  { key: "CONFIRMED", label: "Confirmée", icon: CheckCircle },
  { key: "PROCESSING", label: "En production", icon: Package },
  { key: "READY", label: "Prête", icon: Package },
  { key: "OUT_FOR_DELIVERY", label: "En livraison", icon: Truck },
  { key: "DELIVERED", label: "Livrée", icon: CheckCircle },
]

export default function OrderTrackingPage() {
  const params = useParams()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!params.id) return
    fetch("/api/my-orders")
      .then((r) => r.json())
      .then((data) => {
        const found = Array.isArray(data)
          ? data.find((o: OrderDetail) => o.id === params.id || o.orderNumber === params.id)
          : null
        if (found) {
          setOrder(found)
        } else {
          setError("Commande introuvable")
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Erreur lors du chargement")
        setLoading(false)
      })
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="p-6 lg:p-10 text-center">
        <h1 className="font-display text-2xl font-extrabold">Commande introuvable</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Link
          href="/compte/commandes"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1f4fa3] px-6 py-3 text-sm font-bold text-white"
        >
          Mes commandes
        </Link>
      </div>
    )
  }

  const currentIdx = statusSteps.findIndex((s) => s.key === order.status)

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Commande {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Passée le{" "}
            {new Date(order.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${getStatusColor(order.status)}`}
        >
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Progress */}
      {order.status !== "CANCELLED" && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-card-soft">
          <h2 className="mb-6 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Suivi de la commande
          </h2>
          <div className="relative">
            {statusSteps.map((step, i) => {
              const Icon = step.icon
              const isActive = i <= currentIdx
              const isCurrent = i === currentIdx
              return (
                <div key={step.key} className="flex items-start gap-4 pb-8 last:pb-0">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground"
                      } ${isCurrent ? "ring-2 ring-primary/20" : ""}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {i < statusSteps.length - 1 && (
                      <div
                        className={`mt-1 h-8 w-0.5 ${
                          i < currentIdx ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <p
                      className={`text-sm font-semibold ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="mt-0.5 text-xs text-primary font-medium">
                        Statut actuel
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {order.status === "CANCELLED" && (
        <div className="mt-8 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="font-semibold text-destructive">Commande annulée</p>
        </div>
      )}

      {/* Items */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card-soft">
        <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Articles
        </h2>
        <div className="space-y-3">
          {order.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-border p-4"
            >
              <div>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.format} × {item.quantity}
                </p>
              </div>
              <span className="text-sm font-bold">{formatPrice(item.total)}</span>
            </div>
          ))}
        </div>

        <hr className="my-4 border-border" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Livraison</span>
            <span>
              {order.deliveryFee > 0 ? formatPrice(order.deliveryFee) : "Gratuite"}
            </span>
          </div>
          <div className="flex justify-between pt-2 text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Delivery info */}
      {order.delivery && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card-soft">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Livraison
          </h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Adresse :</span>{" "}
              {order.delivery.address}, {order.delivery.city}
            </p>
            <p>
              <span className="font-medium">Statut :</span>{" "}
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(order.delivery.status)}`}
              >
                {getStatusLabel(order.delivery.status)}
              </span>
            </p>
            {order.delivery.deliveredAt && (
              <p className="text-green-600 font-medium">
                Livré le{" "}
                {new Date(order.delivery.deliveredAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
