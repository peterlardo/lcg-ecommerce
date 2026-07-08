"use client"

import {
  Package,
  ShoppingCart,
  Truck,
  TrendingUp,
  DollarSign,
  ClipboardList,
  Plus,
  Eye,
  ArrowRight,
  BarChart3,
  Clock,
  BadgeCheck,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"

const statsCards = [
  {
    title: "Total ventes (jour)",
    value: "485 000 F",
    change: "+15%",
    icon: DollarSign,
  },
  {
    title: "Commandes (jour)",
    value: "12",
    change: "+3",
    icon: ShoppingCart,
  },
  {
    title: "Produits actifs",
    value: "8",
    icon: Package,
  },
  {
    title: "Livraisons en cours",
    value: "5",
    icon: Truck,
  },
]

const revenueData = [
  { name: "Lun", revenu: 65000 },
  { name: "Mar", revenu: 85000 },
  { name: "Mer", revenu: 45000 },
  { name: "Jeu", revenu: 95000 },
  { name: "Ven", revenu: 120000 },
  { name: "Sam", revenu: 78000 },
  { name: "Dim", revenu: 55000 },
]

const recentOrders = [
  { id: "LCG-A3F2-1B9C", customer: "Jean-Paul M.", status: "DELIVERED", total: 15000, date: "08/07/2026" },
  { id: "LCG-B4E1-2C8D", customer: "Marie K.", status: "OUT_FOR_DELIVERY", total: 4000, date: "08/07/2026" },
  { id: "LCG-C5D0-3D7E", customer: "Hôtel Émeraude", status: "PROCESSING", total: 35000, date: "07/07/2026" },
  { id: "LCG-D6C9-4E6F", customer: "Restaurant Le Palais", status: "CONFIRMED", total: 22000, date: "07/07/2026" },
  { id: "LCG-E7B8-5F5G", customer: "Café Central", status: "PENDING", total: 8500, date: "06/07/2026" },
]

const quickActions = [
  { href: "/admin/produits", label: "Ajouter un produit", desc: "Nouveau produit", icon: Plus, color: "primary" },
  { href: "/admin/stock", label: "Gérer le stock", desc: "Mouvements", icon: ClipboardList, color: "accent" },
  { href: "/admin/commandes", label: "Voir commandes", desc: "Gestion", icon: Eye, color: "blue" },
  { href: "/admin/rapports", label: "Voir rapports", desc: "Statistiques", icon: TrendingUp, color: "purple" },
]

const colorMap: Record<string, { ring: string; bg: string; text: string }> = {
  primary: { ring: "ring-primary/20", bg: "bg-primary/10", text: "text-primary" },
  accent: { ring: "ring-accent/20", bg: "bg-accent/10", text: "text-accent" },
  blue: { ring: "ring-blue-200", bg: "bg-blue-100", text: "text-blue-600" },
  purple: { ring: "ring-purple-200", bg: "bg-purple-100", text: "text-purple-600" },
}

const iconMap: Record<string, { ring: string; bg: string; text: string }> = {
  DollarSign: { ring: "ring-green-200", bg: "bg-green-100", text: "text-green-600" },
  ShoppingCart: { ring: "ring-blue-200", bg: "bg-blue-100", text: "text-blue-600" },
  Package: { ring: "ring-purple-200", bg: "bg-purple-100", text: "text-purple-600" },
  Truck: { ring: "ring-orange-200", bg: "bg-orange-100", text: "text-orange-600" },
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("fr-FR")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statsCards.map((card) => {
          const Icon = card.icon
          const colors = iconMap[card.icon.name] || { ring: "ring-gray-200", bg: "bg-gray-100", text: "text-gray-600" }
          return (
            <div
              key={card.title}
              className="relative rounded-2xl border-2 border-primary/20 bg-card p-5 shadow-card-soft"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg} ${colors.text} ring-2 ${colors.ring}`}>
                  <Icon className="h-5 w-5" />
                </div>
                {card.change && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                    +{card.change}
                  </span>
                )}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.title}</p>
              <p className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-foreground">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-card-soft">
          <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-frost">
            <BarChart3 className="h-3.5 w-3.5" />
            Revenus (7 jours)
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(92% 0 0)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "oklch(63% 0 0)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "oklch(63% 0 0)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [formatPrice(Number(value)), "Revenu"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid oklch(92% 0 0)",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="revenu" fill="oklch(55% 0.15 262)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-card-soft">
          <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-frost">
            <Clock className="h-3.5 w-3.5" />
            Dernières commandes
          </div>
          <div className="mt-5 space-y-2">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{order.customer}</p>
                  <p className="text-xs text-muted-foreground">{order.id}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-foreground">{formatPrice(order.total)}</p>
                  <p className="text-xs text-muted-foreground">{order.date}</p>
                </div>
                <span className={`ml-3 shrink-0 px-2.5 py-0.5 text-xs font-bold rounded-full ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-right">
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
            >
              Voir toutes les commandes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-card-soft">
        <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-frost">
          <BadgeCheck className="h-3.5 w-3.5" />
          Actions rapides
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            const c = colorMap[action.color]
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`flex items-center gap-3 rounded-xl border-2 border-border/50 p-4 transition-all hover:shadow-sm ${c.ring.replace("ring-", "hover:ring-2 hover:")} hover:${c.bg.replace("bg-", "")} group`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.bg} ${c.text}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
