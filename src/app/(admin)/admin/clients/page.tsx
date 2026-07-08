"use client"

import { useState } from "react"
import {
  Users,
  Search,
  Filter,
  ChevronDown,
  Mail,
  Phone,
  ShoppingCart,
  DollarSign,
  Eye,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface ClientOrder {
  id: string
  date: string
  total: number
  status: string
}

interface Client {
  id: string
  name: string
  email: string
  phone: string
  city: string
  ordersCount: number
  totalSpent: number
  status: "actif" | "inactif" | "nouveau"
  registeredDate: string
  recentOrders: ClientOrder[]
}

const clients: Client[] = [
  {
    id: "cli-1",
    name: "Jean-Paul M.",
    email: "jeanpaul@example.com",
    phone: "+242 05 123 45 67",
    city: "Brazzaville",
    ordersCount: 12,
    totalSpent: 285000,
    status: "actif",
    registeredDate: "15/01/2026",
    recentOrders: [
      { id: "LCG-A3F2-1B9C", date: "08/07/2026", total: 15000, status: "DELIVERED" },
      { id: "LCG-K4L5-2M3N", date: "22/06/2026", total: 25000, status: "DELIVERED" },
    ],
  },
  {
    id: "cli-2",
    name: "Hôtel Émeraude",
    email: "contact@hotelemeraude.cg",
    phone: "+242 05 345 67 89",
    city: "Brazzaville",
    ordersCount: 24,
    totalSpent: 890000,
    status: "actif",
    registeredDate: "02/12/2025",
    recentOrders: [
      { id: "LCG-C5D0-3D7E", date: "07/07/2026", total: 35000, status: "PROCESSING" },
      { id: "LCG-M5N6-3L2O", date: "15/06/2026", total: 45000, status: "DELIVERED" },
    ],
  },
  {
    id: "cli-3",
    name: "Marie K.",
    email: "marie.k@example.com",
    phone: "+242 06 234 56 78",
    city: "Brazzaville",
    ordersCount: 5,
    totalSpent: 32000,
    status: "actif",
    registeredDate: "10/03/2026",
    recentOrders: [
      { id: "LCG-B4E1-2C8D", date: "08/07/2026", total: 4000, status: "OUT_FOR_DELIVERY" },
    ],
  },
  {
    id: "cli-4",
    name: "Restaurant Le Palais",
    email: "contact@lepalais.cg",
    phone: "+242 06 456 78 90",
    city: "Brazzaville",
    ordersCount: 18,
    totalSpent: 445000,
    status: "actif",
    registeredDate: "20/01/2026",
    recentOrders: [
      { id: "LCG-D6C9-4E6F", date: "07/07/2026", total: 22000, status: "CONFIRMED" },
      { id: "LCG-N7O8-4K3P", date: "10/06/2026", total: 38000, status: "DELIVERED" },
    ],
  },
  {
    id: "cli-5",
    name: "Café Central",
    email: "cafecentral@example.com",
    phone: "+242 05 567 89 01",
    city: "Pointe-Noire",
    ordersCount: 3,
    totalSpent: 18500,
    status: "nouveau",
    registeredDate: "20/06/2026",
    recentOrders: [
      { id: "LCG-E7B8-5F5G", date: "06/07/2026", total: 8500, status: "PENDING" },
    ],
  },
  {
    id: "cli-6",
    name: "Supermarché Mega",
    email: "commandes@megamarket.cg",
    phone: "+242 05 789 01 23",
    city: "Pointe-Noire",
    ordersCount: 7,
    totalSpent: 312000,
    status: "inactif",
    registeredDate: "05/02/2026",
    recentOrders: [
      { id: "LCG-G0B6-7H3I", date: "05/07/2026", total: 75000, status: "PENDING" },
    ],
  },
]

export default function ClientsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("tous")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    const matchesStatus =
      statusFilter === "tous" || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500">{clients.length} clients</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 appearance-none bg-white"
          >
            <option value="tous">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="nouveau">Nouveau</option>
            <option value="inactif">Inactif</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedId(expandedId === client.id ? null : client.id)
              }
              className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {client.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:text-right">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {client.ordersCount} commande{client.ordersCount > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatPrice(client.totalSpent)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      client.status === "actif"
                        ? "bg-green-100 text-green-700"
                        : client.status === "nouveau"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {client.status === "actif"
                      ? "Actif"
                      : client.status === "nouveau"
                        ? "Nouveau"
                        : "Inactif"}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expandedId === client.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            </button>

            {expandedId === client.id && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Informations
                    </h4>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 space-y-2 text-sm">
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Ville: </span>
                        {client.city}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Inscrit le: </span>
                        {client.registeredDate}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Total dépensé: </span>
                        <span className="font-semibold">{formatPrice(client.totalSpent)}</span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Commandes: </span>
                        {client.ordersCount}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Dernières commandes
                    </h4>
                    <div className="space-y-2">
                      {client.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100 text-sm"
                        >
                          <div>
                            <p className="text-xs font-mono font-medium text-gray-900">
                              {order.id}
                            </p>
                            <p className="text-xs text-gray-500">{order.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatPrice(order.total)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun client trouvé</p>
          </div>
        )}
      </div>
    </div>
  )
}
