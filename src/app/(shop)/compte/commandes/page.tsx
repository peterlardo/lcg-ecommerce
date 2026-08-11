"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getStatusColor, getStatusLabel, formatPrice } from "@/lib/utils"
import { Package, Truck, ChevronRight, Eye } from "lucide-react"

interface OrderItem {
  name: string
  format: string
  quantity: number
  price: number
  total: number
}

interface Order {
  id: string
  orderNumber: string
  status: string
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  total: number
  createdAt: string
  items: OrderItem[]
  delivery: {
    status: string
    address: string
    city: string
    scheduledDate: string | null
    deliveredAt: string | null
  } | null
}

const statusSteps = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/my-orders")
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
        Mes commandes
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suivez l&apos;état de vos commandes et consultez l&apos;historique.
      </p>

      {orders.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-200" />
          <h2 className="mt-4 font-display text-xl font-bold">Aucune commande</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous n&apos;avez pas encore passé de commande.
          </p>
          <Link
            href="/compte/produits"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1f4fa3] px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.03]"
          >
            Découvrir nos produits
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id
            const currentIdx = statusSteps.indexOf(order.status)
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {" · "}
                      {order.items.length} article
                      {order.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm font-bold text-[#1f4fa3]">
                      {formatPrice(order.total)}
                    </span>
                    <Link
                      href={`/compte/commandes/${order.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#1f4fa3]/10 hover:text-[#1f4fa3]"
                      title="Voir le détail"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <ChevronRight
                      className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 pb-5">
                    {order.status !== "CANCELLED" && (
                      <div className="my-5 flex items-center gap-1">
                        {statusSteps.map((step, i) => (
                          <div key={step} className="flex flex-1 items-center">
                            <div
                              className={`h-2 flex-1 rounded-full ${
                                i <= currentIdx
                                  ? "bg-[#1f4fa3]"
                                  : "bg-gray-200"
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {item.name} ({item.format}) × {item.quantity}
                          </span>
                          <span className="font-semibold">
                            {formatPrice(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <hr className="my-3 border-border" />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span>{formatPrice(order.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Livraison</span>
                      <span>
                        {order.deliveryFee > 0
                          ? formatPrice(order.deliveryFee)
                          : "Gratuite"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>Total</span>
                      <span className="text-[#1f4fa3]">
                        {formatPrice(order.total)}
                      </span>
                    </div>

                    {order.delivery && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="h-4 w-4 text-[#1f4fa3]" />
                          <span className="font-semibold">Livraison</span>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(order.delivery.status)}`}
                          >
                            {getStatusLabel(order.delivery.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.delivery.address}, {order.delivery.city}
                        </p>
                        {order.delivery.deliveredAt && (
                          <p className="mt-1 text-xs text-green-600 font-medium">
                            Livré le{" "}
                            {new Date(order.delivery.deliveredAt).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
