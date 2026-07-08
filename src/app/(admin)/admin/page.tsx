"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  TrendingUp,
  DollarSign,
  ClipboardList,
  Plus,
  Eye,
  ArrowRight,
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
    color: "text-green-600",
    bg: "bg-green-100",
  },
  {
    title: "Commandes (jour)",
    value: "12",
    change: "+3",
    icon: ShoppingCart,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    title: "Produits actifs",
    value: "8",
    change: "",
    icon: Package,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
  {
    title: "Livraisons en cours",
    value: "5",
    change: "",
    icon: Truck,
    color: "text-orange-600",
    bg: "bg-orange-100",
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
  {
    id: "LCG-A3F2-1B9C",
    customer: "Jean-Paul M.",
    status: "DELIVERED",
    total: 15000,
    date: "08/07/2026",
  },
  {
    id: "LCG-B4E1-2C8D",
    customer: "Marie K.",
    status: "OUT_FOR_DELIVERY",
    total: 4000,
    date: "08/07/2026",
  },
  {
    id: "LCG-C5D0-3D7E",
    customer: "Hôtel Émeraude",
    status: "PROCESSING",
    total: 35000,
    date: "07/07/2026",
  },
  {
    id: "LCG-D6C9-4E6F",
    customer: "Restaurant Le Palais",
    status: "CONFIRMED",
    total: 22000,
    date: "07/07/2026",
  },
  {
    id: "LCG-E7B8-5F5G",
    customer: "Café Central",
    status: "PENDING",
    total: 8500,
    date: "06/07/2026",
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString("fr-FR")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                {card.change && (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    +{card.change}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">{card.title}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenus (7 derniers jours)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: any) => [formatPrice(Number(value)), "Revenu"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="revenu" fill="#1f4fa3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Dernières commandes</h3>
            <Link
              href="/admin/commandes"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{order.customer}</p>
                  <p className="text-xs text-gray-500">{order.id}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatPrice(order.total)}
                  </p>
                  <p className="text-xs text-gray-500">{order.date}</p>
                </div>
                <span
                  className={`ml-3 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}
                >
                  {getStatusLabel(order.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/admin/produits"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all group"
          >
            <div className="p-2 rounded-lg bg-primary-100">
              <Plus className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                Ajouter un produit
              </p>
              <p className="text-xs text-gray-500">Nouveau produit</p>
            </div>
          </Link>
          <Link
            href="/admin/stock"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-accent-300 hover:bg-accent-50/50 transition-all group"
          >
            <div className="p-2 rounded-lg bg-accent-100">
              <ClipboardList className="h-4 w-4 text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-accent-700">
                Gérer le stock
              </p>
              <p className="text-xs text-gray-500">Mouvements</p>
            </div>
          </Link>
          <Link
            href="/admin/commandes"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
          >
            <div className="p-2 rounded-lg bg-blue-100">
              <Eye className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                Voir commandes
              </p>
              <p className="text-xs text-gray-500">Gestion</p>
            </div>
          </Link>
          <Link
            href="/admin/rapports"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
          >
            <div className="p-2 rounded-lg bg-purple-100">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700">
                Voir rapports
              </p>
              <p className="text-xs text-gray-500">Statistiques</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
