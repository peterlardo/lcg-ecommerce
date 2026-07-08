"use client"

import { useState } from "react"
import {
  Truck,
  MapPin,
  Phone,
  Calendar,
  Clock,
  Check,
  X,
  AlertCircle,
} from "lucide-react"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"

interface Delivery {
  id: string
  orderId: string
  customer: string
  address: string
  phone: string
  scheduledDate: string
  estimatedTime: string
  agent: string
  status: string
  items: string
  total: number
}

const initialDeliveries: Delivery[] = [
  {
    id: "del-1",
    orderId: "LCG-B4E1-2C8D",
    customer: "Marie K.",
    address: "12 Rue des Lilas, Brazzaville",
    phone: "+242 06 234 56 78",
    scheduledDate: "08/07/2026",
    estimatedTime: "14h00 - 16h00",
    agent: "Sarah B.",
    status: "IN_TRANSIT",
    items: "Glaçons cubes — Sac 5 kg",
    total: 4000,
  },
  {
    id: "del-2",
    orderId: "LCG-F9A7-6G4H",
    customer: "Traiteur Élégance",
    address: "25 Rue du Commerce, Brazzaville",
    phone: "+242 06 678 90 12",
    scheduledDate: "09/07/2026",
    estimatedTime: "09h00 - 12h00",
    agent: "",
    status: "ASSIGNED",
    items: "Pack Événementiel Premium, Bloc ±25kg, etc.",
    total: 48500,
  },
  {
    id: "del-3",
    orderId: "LCG-C5D0-3D7E",
    customer: "Hôtel Émeraude",
    address: "Bd du Général de Gaulle, Brazzaville",
    phone: "+242 05 345 67 89",
    scheduledDate: "09/07/2026",
    estimatedTime: "10h00 - 12h00",
    agent: "",
    status: "ASSIGNED",
    items: "Pack Événementiel VIP",
    total: 35000,
  },
  {
    id: "del-4",
    orderId: "LCG-D6C9-4E6F",
    customer: "Restaurant Le Palais",
    address: "Av. de l'Indépendance, Brazzaville",
    phone: "+242 06 456 78 90",
    scheduledDate: "09/07/2026",
    estimatedTime: "11h00 - 13h00",
    agent: "",
    status: "ASSIGNED",
    items: "Glaçons cylindriques 5kg, Glace pilée 5kg, Bloc ±10kg",
    total: 22000,
  },
  {
    id: "del-5",
    orderId: "LCG-A3F2-1B9C",
    customer: "Jean-Paul M.",
    address: "15 Av. de la République, Brazzaville",
    phone: "+242 05 123 45 67",
    scheduledDate: "08/07/2026",
    estimatedTime: "08h00 - 10h00",
    agent: "Alex N.",
    status: "DELIVERED",
    items: "Big bag pro — 25 kg",
    total: 15000,
  },
  {
    id: "del-6",
    orderId: "LCG-I2D5-9F1K",
    customer: "Mairie de Brazzaville",
    address: "Hôtel de Ville, Brazzaville",
    phone: "+242 05 901 23 45",
    scheduledDate: "03/07/2026",
    estimatedTime: "08h00 - 10h00",
    agent: "Alex N.",
    status: "DELIVERED",
    items: "Bloc ±25kg x4, Pack VIP x2, Sac 25kg x2",
    total: 120000,
  },
  {
    id: "del-7",
    orderId: "LCG-E7B8-5F5G",
    customer: "Café Central",
    address: "3 Place de la Cathédrale, Brazzaville",
    phone: "+242 05 567 89 01",
    scheduledDate: "10/07/2026",
    estimatedTime: "09h00 - 11h00",
    agent: "",
    status: "ASSIGNED",
    items: "Glaçons cubes 2kg, Sphères premium x2",
    total: 8500,
  },
]

const deliveryAgents = ["Alex N.", "Sarah B.", "David K.", "Fatima M.", "Christophe L."]

const statusSections = [
  { key: "ASSIGNED", label: "À assigner / Assignées", icon: Calendar },
  { key: "IN_TRANSIT", label: "En cours", icon: Truck },
  { key: "DELIVERED", label: "Livrées", icon: Check },
]

export default function LivraisonsPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries)

  const updateDeliveryStatus = (deliveryId: string, newStatus: string) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === deliveryId ? { ...d, status: newStatus } : d))
    )
    console.log(`Livraison ${deliveryId}: statut mis à jour → ${newStatus}`)
  }

  const assignAgent = (deliveryId: string, agent: string) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === deliveryId ? { ...d, agent } : d))
    )
    console.log(`Livraison ${deliveryId}: livreur assigné → ${agent}`)
  }

  const getGrouped = (status: string) =>
    deliveries.filter((d) => d.status === status)

  const statusActions: Record<string, { label: string; nextStatus: string; color: string }[]> = {
    ASSIGNED: [
      { label: "Prise en charge", nextStatus: "PICKED_UP", color: "bg-indigo-600 hover:bg-indigo-700" },
    ],
    PICKED_UP: [
      { label: "En transit", nextStatus: "IN_TRANSIT", color: "bg-orange-600 hover:bg-orange-700" },
    ],
    IN_TRANSIT: [
      { label: "Livrée", nextStatus: "DELIVERED", color: "bg-green-600 hover:bg-green-700" },
      { label: "Échec", nextStatus: "FAILED", color: "bg-red-600 hover:bg-red-700" },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Livraisons</h1>
        <Truck className="h-5 w-5 text-gray-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {statusSections.map((section) => {
            const Icon = section.icon
            const items = getGrouped(section.key)
            return (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-700">{section.label}</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-gray-900">
                              {delivery.orderId}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(delivery.status)}`}
                            >
                              {getStatusLabel(delivery.status)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-700">{delivery.customer}</p>
                          <div className="flex items-start gap-1.5 text-xs text-gray-500">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>{delivery.address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{delivery.phone}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {delivery.scheduledDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {delivery.estimatedTime}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {delivery.items} — {formatPrice(delivery.total)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:items-end flex-shrink-0">
                          {delivery.status === "ASSIGNED" && (
                            <div className="flex items-center gap-2">
                              <select
                                value={delivery.agent}
                                onChange={(e) => assignAgent(delivery.id, e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-white"
                              >
                                <option value="">Assigner un livreur</option>
                                {deliveryAgents.map((agent) => (
                                  <option key={agent} value={agent}>
                                    {agent}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {delivery.agent && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                              <Truck className="h-3.5 w-3.5" />
                              <span>{delivery.agent}</span>
                            </div>
                          )}

                          {delivery.status === "ASSIGNED" && delivery.agent && (
                            <button
                              onClick={() => updateDeliveryStatus(delivery.id, "PICKED_UP")}
                              className="w-full sm:w-auto px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                              Prise en charge
                            </button>
                          )}

                          {delivery.status === "IN_TRANSIT" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  updateDeliveryStatus(delivery.id, "DELIVERED")
                                }
                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Check className="h-3.5 w-3.5 inline mr-1" />
                                Livrée
                              </button>
                              <button
                                onClick={() =>
                                  updateDeliveryStatus(delivery.id, "FAILED")
                                }
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                              >
                                <X className="h-3.5 w-3.5 inline mr-1" />
                                Échec
                              </button>
                            </div>
                          )}

                          {delivery.status === "DELIVERED" && (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <Check className="h-3.5 w-3.5" />
                              Livrée le {delivery.scheduledDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
                      <p className="text-sm text-gray-400">
                        Aucune livraison {section.label.toLowerCase()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Carte</h3>
            <div className="bg-gray-100 rounded-lg h-80 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Carte interactive</p>
                <p className="text-xs text-gray-400">(Intégration à venir)</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Livreurs disponibles
              </h4>
              {deliveryAgents.map((agent) => {
                const activeCount = deliveries.filter(
                  (d) => d.agent === agent && d.status !== "DELIVERED" && d.status !== "FAILED"
                ).length
                return (
                  <div
                    key={agent}
                    className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold text-xs">
                        {agent.charAt(0)}
                      </div>
                      <span className="text-gray-700">{agent}</span>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        activeCount > 0
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {activeCount > 0 ? `${activeCount} active(s)` : "Disponible"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
