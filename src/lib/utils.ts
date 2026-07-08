import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
  }).format(price)
}

export function generateOrderNumber(): string {
  const prefix = "LCG"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-indigo-100 text-indigo-800",
    READY: "bg-purple-100 text-purple-800",
    OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    PAID: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    REFUNDED: "bg-gray-100 text-gray-800",
    ASSIGNED: "bg-blue-100 text-blue-800",
    PICKED_UP: "bg-indigo-100 text-indigo-800",
    IN_TRANSIT: "bg-orange-100 text-orange-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "En attente",
    CONFIRMED: "Confirmée",
    PROCESSING: "En production",
    READY: "Prête",
    OUT_FOR_DELIVERY: "En livraison",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
    PAID: "Payée",
    FAILED: "Échoué",
    REFUNDED: "Remboursée",
    ASSIGNED: "Assignée",
    PICKED_UP: "Récupérée",
    IN_TRANSIT: "En transit",
  }
  return labels[status] || status
}
