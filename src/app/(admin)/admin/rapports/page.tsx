"use client"

import { useState } from "react"
import {
  BarChart3,
  TrendingUp,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { formatPrice } from "@/lib/utils"

const timeRanges = [
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "quarter", label: "Ce trimestre" },
  { key: "year", label: "Cette année" },
]

const revenueByRange: Record<string, { name: string; revenu: number }[]> = {
  week: [
    { name: "Lun", revenu: 65000 },
    { name: "Mar", revenu: 85000 },
    { name: "Mer", revenu: 45000 },
    { name: "Jeu", revenu: 95000 },
    { name: "Ven", revenu: 120000 },
    { name: "Sam", revenu: 78000 },
    { name: "Dim", revenu: 55000 },
  ],
  month: [
    { name: "Sem 1", revenu: 320000 },
    { name: "Sem 2", revenu: 410000 },
    { name: "Sem 3", revenu: 285000 },
    { name: "Sem 4", revenu: 543000 },
  ],
  quarter: [
    { name: "Jan", revenu: 850000 },
    { name: "Fév", revenu: 920000 },
    { name: "Mar", revenu: 1100000 },
    { name: "Avr", revenu: 980000 },
    { name: "Mai", revenu: 1050000 },
    { name: "Juin", revenu: 1240000 },
    { name: "Juil", revenu: 543000 },
  ],
  year: [
    { name: "Jan", revenu: 850000 },
    { name: "Fév", revenu: 920000 },
    { name: "Mar", revenu: 1100000 },
    { name: "Avr", revenu: 980000 },
    { name: "Mai", revenu: 1050000 },
    { name: "Juin", revenu: 1240000 },
  ],
}

const ordersByRange: Record<string, { name: string; commandes: number }[]> = {
  week: [
    { name: "Lun", commandes: 3 },
    { name: "Mar", commandes: 5 },
    { name: "Mer", commandes: 2 },
    { name: "Jeu", commandes: 6 },
    { name: "Ven", commandes: 8 },
    { name: "Sam", commandes: 4 },
    { name: "Dim", commandes: 2 },
  ],
  month: [
    { name: "Sem 1", commandes: 18 },
    { name: "Sem 2", commandes: 22 },
    { name: "Sem 3", commandes: 15 },
    { name: "Sem 4", commandes: 28 },
  ],
  quarter: [
    { name: "Jan", commandes: 65 },
    { name: "Fév", commandes: 72 },
    { name: "Mar", commandes: 88 },
    { name: "Avr", commandes: 76 },
    { name: "Mai", commandes: 82 },
    { name: "Juin", commandes: 95 },
    { name: "Juil", commandes: 40 },
  ],
  year: [
    { name: "Jan", commandes: 65 },
    { name: "Fév", commandes: 72 },
    { name: "Mar", commandes: 88 },
    { name: "Avr", commandes: 76 },
    { name: "Mai", commandes: 82 },
    { name: "Juin", commandes: 95 },
  ],
}

const topProducts = [
  { name: "Glaçons cubes", value: 35, color: "#1f4fa3" },
  { name: "Pack Événementiel", value: 22, color: "#3b82f6" },
  { name: "Bloc de glace", value: 18, color: "#60a5fa" },
  { name: "Glaçons cylindriques", value: 15, color: "#93c5fd" },
  { name: "Glace pilée", value: 10, color: "#bfdbfe" },
]

const summaryMaps: Record<
  string,
  { revenue: number; orders: number; avgOrder: number; topProduct: string }
> = {
  week: {
    revenue: 543000,
    orders: 30,
    avgOrder: 18100,
    topProduct: "Glaçons cubes",
  },
  month: {
    revenue: 1558000,
    orders: 83,
    avgOrder: 18771,
    topProduct: "Pack Événementiel",
  },
  quarter: {
    revenue: 6683000,
    orders: 518,
    avgOrder: 12902,
    topProduct: "Glaçons cubes",
  },
  year: {
    revenue: 6143000,
    orders: 478,
    avgOrder: 12852,
    topProduct: "Glaçons cubes",
  },
}

export default function RapportsPage() {
  const [selectedRange, setSelectedRange] = useState("week")

  const revenueData = revenueByRange[selectedRange]
  const ordersData = ordersByRange[selectedRange]
  const summary = summaryMaps[selectedRange]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => setSelectedRange(range.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedRange === range.key
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Revenu total</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatPrice(summary.revenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Commandes totales</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{summary.orders}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Panier moyen</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatPrice(summary.avgOrder)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Meilleur produit</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{summary.topProduct}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Revenus
          </h3>
          <div className="h-72">
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
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Évolution des commandes
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="commandes"
                  stroke="#1f4fa3"
                  strokeWidth={2}
                  dot={{ fill: "#1f4fa3", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Top 5 produits
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topProducts}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  label={(entry: any) =>
                    `${entry.name} ${(entry.percent * 100).toFixed(0)}%`
                  }
                  labelLine
                >
                  {topProducts.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Part"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Répartition des produits
          </h3>
          <div className="space-y-3">
            {topProducts.map((product) => (
              <div key={product.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{product.name}</span>
                  <span className="font-medium text-gray-900">{product.value}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${product.value}%`,
                      backgroundColor: product.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
