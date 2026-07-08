"use client"

import { useState } from "react"
import {
  ShoppingCart,
  ChevronDown,
  Eye,
  Search,
} from "lucide-react"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"

const statusFilters = [
  "Toutes",
  "En attente",
  "Confirmée",
  "En production",
  "Prête",
  "En livraison",
  "Livrée",
  "Annulée",
]

const statusMap: Record<string, string> = {
  "En attente": "PENDING",
  Confirmée: "CONFIRMED",
  "En production": "PROCESSING",
  Prête: "READY",
  "En livraison": "OUT_FOR_DELIVERY",
  Livrée: "DELIVERED",
  Annulée: "CANCELLED",
}

interface OrderItem {
  product: string
  quantity: number
  price: number
}

interface Order {
  id: string
  customer: string
  email: string
  phone: string
  status: string
  total: number
  date: string
  items: OrderItem[]
  deliveryAddress: string
  scheduledDate: string
  deliveryAgent: string
}

const orders: Order[] = [
  {
    id: "LCG-A3F2-1B9C",
    customer: "Jean-Paul M.",
    email: "jeanpaul@example.com",
    phone: "+242 05 123 45 67",
    status: "DELIVERED",
    total: 15000,
    date: "08/07/2026",
    items: [
      { product: "Big bag pro — 25 kg", quantity: 1, price: 15000 },
    ],
    deliveryAddress: "15 Av. de la République, Brazzaville",
    scheduledDate: "08/07/2026",
    deliveryAgent: "Alex N.",
  },
  {
    id: "LCG-B4E1-2C8D",
    customer: "Marie K.",
    email: "marie.k@example.com",
    phone: "+242 06 234 56 78",
    status: "OUT_FOR_DELIVERY",
    total: 4000,
    date: "08/07/2026",
    items: [
      { product: "Glaçons cubes — Sac 5 kg", quantity: 1, price: 4000 },
    ],
    deliveryAddress: "12 Rue des Lilas, Brazzaville",
    scheduledDate: "08/07/2026",
    deliveryAgent: "Sarah B.",
  },
  {
    id: "LCG-C5D0-3D7E",
    customer: "Hôtel Émeraude",
    email: "contact@hotelemeraude.cg",
    phone: "+242 05 345 67 89",
    status: "PROCESSING",
    total: 35000,
    date: "07/07/2026",
    items: [
      { product: "Pack Événementiel VIP", quantity: 1, price: 35000 },
    ],
    deliveryAddress: "Bd du Général de Gaulle, Brazzaville",
    scheduledDate: "09/07/2026",
    deliveryAgent: "",
  },
  {
    id: "LCG-D6C9-4E6F",
    customer: "Restaurant Le Palais",
    email: "contact@lepalais.cg",
    phone: "+242 06 456 78 90",
    status: "CONFIRMED",
    total: 22000,
    date: "07/07/2026",
    items: [
      { product: "Glaçons cylindriques — Sac 5 kg", quantity: 2, price: 5500 },
      { product: "Glace pilée — Sac 5 kg", quantity: 1, price: 4500 },
      { product: "Bloc de glace grand format ±10kg", quantity: 1, price: 5000 },
    ],
    deliveryAddress: "Av. de l'Indépendance, Brazzaville",
    scheduledDate: "09/07/2026",
    deliveryAgent: "",
  },
  {
    id: "LCG-E7B8-5F5G",
    customer: "Café Central",
    email: "cafecentral@example.com",
    phone: "+242 05 567 89 01",
    status: "PENDING",
    total: 8500,
    date: "06/07/2026",
    items: [
      { product: "Glaçons cubes — Sac 2 kg", quantity: 1, price: 1500 },
      { product: "Sphères premium — Boîte de 6", quantity: 2, price: 3500 },
    ],
    deliveryAddress: "3 Place de la Cathédrale, Brazzaville",
    scheduledDate: "10/07/2026",
    deliveryAgent: "",
  },
  {
    id: "LCG-F9A7-6G4H",
    customer: "Traiteur Élégance",
    email: "info@traiteurelegance.cg",
    phone: "+242 06 678 90 12",
    status: "READY",
    total: 48500,
    date: "06/07/2026",
    items: [
      { product: "Pack Événementiel Premium", quantity: 1, price: 20000 },
      { product: "Bloc de glace grand format ±25kg", quantity: 1, price: 10000 },
      { product: "Glaçons cubes — Sac 5 kg", quantity: 3, price: 4000 },
      { product: "Glace pilée — Sac 5 kg", quantity: 1, price: 4500 },
    ],
    deliveryAddress: "25 Rue du Commerce, Brazzaville",
    scheduledDate: "09/07/2026",
    deliveryAgent: "",
  },
  {
    id: "LCG-G0B6-7H3I",
    customer: "Supermarché Mega",
    email: "commandes@megamarket.cg",
    phone: "+242 05 789 01 23",
    status: "PENDING",
    total: 75000,
    date: "05/07/2026",
    items: [
      { product: "Big bag pro — 25 kg", quantity: 3, price: 15000 },
      { product: "Glaçons cubes — Sac 10 kg", quantity: 2, price: 7000 },
      { product: "Glaçons cubes — Sac 25 kg", quantity: 1, price: 15000 },
    ],
    deliveryAddress: "Zone Industrielle, Pointe-Noire",
    scheduledDate: "11/07/2026",
    deliveryAgent: "",
  },
  {
    id: "LCG-H1C4-8G2J",
    customer: "Bar L'Éclipse",
    email: "barleclipse@example.com",
    phone: "+242 06 890 12 34",
    status: "CANCELLED",
    total: 12500,
    date: "04/07/2026",
    items: [
      { product: "Sphères premium — Boîte de 12", quantity: 1, price: 6000 },
      { product: "Glaçons cylindriques — Sac 2 kg", quantity: 1, price: 2500 },
      { product: "Glace pilée — Sac 2 kg", quantity: 2, price: 2000 },
    ],
    deliveryAddress: "5 Quai des Arts, Brazzaville",
    scheduledDate: "06/07/2026",
    deliveryAgent: "",
  },
  {
    id: "LCG-I2D5-9F1K",
    customer: "Mairie de Brazzaville",
    email: "service.event@mairie-bzv.cg",
    phone: "+242 05 901 23 45",
    status: "DELIVERED",
    total: 120000,
    date: "03/07/2026",
    items: [
      { product: "Bloc de glace grand format ±25kg", quantity: 4, price: 10000 },
      { product: "Pack Événementiel VIP", quantity: 2, price: 35000 },
      { product: "Glaçons cubes — Sac 25 kg", quantity: 2, price: 15000 },
    ],
    deliveryAddress: "Hôtel de Ville, Brazzaville",
    scheduledDate: "03/07/2026",
    deliveryAgent: "Alex N.",
  },
  {
    id: "LCG-J3E6-0G2L",
    customer: "Clinique Sainte-Anne",
    email: "logistique@sainteanne.cg",
    phone: "+242 06 012 34 56",
    status: "PROCESSING",
    total: 29000,
    date: "03/07/2026",
    items: [
      { product: "Bloc de glace grand format ±10kg", quantity: 2, price: 5000 },
      { product: "Glaçons cubes — Sac 10 kg", quantity: 2, price: 7000 },
      { product: "Big bag pro — 25 kg", quantity: 1, price: 15000 },
    ],
    deliveryAddress: "Av. de la Santé, Brazzaville",
    scheduledDate: "10/07/2026",
    deliveryAgent: "",
  },
]

const statusToLabel: Record<string, string> = {}
for (const [label, status] of Object.entries(statusMap)) {
  statusToLabel[status] = label
}

export default function CommandesPage() {
  const [activeTab, setActiveTab] = useState("Toutes")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = orders.filter((order) => {
    const matchesTab =
      activeTab === "Toutes" || getStatusLabel(order.status) === activeTab
    const matchesSearch =
      order.customer.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const handleStatusChange = (orderId: string, newStatus: string) => {
    console.log(`Commande ${orderId}: passage en ${newStatus}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab}
            {tab !== "Toutes" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({orders.filter((o) => getStatusLabel(o.status) === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {order.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{order.customer}</p>
                </div>
                <div className="flex items-center gap-4 sm:text-right">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatPrice(order.total)}
                    </p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expanded === order.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            </button>

            {expanded === order.id && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Articles
                    </h4>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm bg-white p-2 rounded-lg border border-gray-100"
                        >
                          <span className="text-gray-700">{item.product}</span>
                          <span className="text-gray-500">
                            x{item.quantity}
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                        <span className="text-gray-900">Total</span>
                        <span className="text-gray-900">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Informations de livraison
                    </h4>
                    <div className="space-y-2 text-sm bg-white p-3 rounded-lg border border-gray-100">
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Adresse: </span>
                        {order.deliveryAddress}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Livraison prévue: </span>
                        {order.scheduledDate}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Livreur: </span>
                        {order.deliveryAgent || "Non assigné"}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium text-gray-500">Client: </span>
                        {order.email} | {order.phone}
                      </p>
                    </div>

                    {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Mettre à jour le statut
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const statuses = [
                              "CONFIRMED",
                              "PROCESSING",
                              "READY",
                              "OUT_FOR_DELIVERY",
                              "DELIVERED",
                              "CANCELLED",
                            ]
                            const currentIdx = statuses.indexOf(order.status)
                            const nextStatuses = statuses.slice(currentIdx + 1)
                            if (currentIdx > 0) nextStatuses.unshift("PENDING")
                            return nextStatuses.slice(0, 4).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(order.id, s)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                  s === "CANCELLED"
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : s === "DELIVERED"
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                {getStatusLabel(s)}
                              </button>
                            ))
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucune commande trouvée</p>
          </div>
        )}
      </div>
    </div>
  )
}
