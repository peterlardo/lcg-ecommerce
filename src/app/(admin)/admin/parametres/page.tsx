"use client"

import { useEffect, useState } from "react"
import { Settings, Save, Plus, X } from "lucide-react"

interface GeneralSettings {
  companyName: string
  email: string
  phone: string
  address: string
  website: string
}

interface DeliverySettings {
  deliveryFee: number
  freeDeliveryThreshold: number
  zones: string[]
}

interface PaymentSettings {
  card: boolean
  mobileMoney: boolean
  cod: boolean
}

interface NotificationSettings {
  newOrder: boolean
  deliveryUpdate: boolean
  lowStock: boolean
  newRegistration: boolean
}

export default function ParametresPage() {
  const [general, setGeneral] = useState<GeneralSettings>({
    companyName: "LCG - Les Glaçons du Congo",
    email: "contact@lcg.cg",
    phone: "+242 05 123 45 67",
    address: "15 Avenue de la République, Brazzaville, Congo",
    website: "https://lcg.cg",
  })

  const [delivery, setDelivery] = useState<DeliverySettings>({
    deliveryFee: 1500,
    freeDeliveryThreshold: 15000,
    zones: ["Brazzaville Centre", "Brazzaville Nord", "Brazzaville Sud", "Pointe-Noire"],
  })

  const [payment, setPayment] = useState<PaymentSettings>({
    card: true,
    mobileMoney: true,
    cod: true,
  })

  const [notifications, setNotifications] = useState<NotificationSettings>({
    newOrder: true,
    deliveryUpdate: true,
    lowStock: false,
    newRegistration: true,
  })

  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [newZone, setNewZone] = useState("")
  const [showZoneInput, setShowZoneInput] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.general) setGeneral(s.general)
        if (s.delivery) setDelivery(s.delivery)
        if (s.payment) setPayment(s.payment)
        if (s.notifications) setNotifications(s.notifications)
      })
      .catch(() => {})
  }, [])

  const persistSettings = async (section: string, data: Record<string, unknown>) => {
    setSaving(section)
    setSaved(null)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      })
      if (!res.ok) throw new Error("Erreur")
      setSaved(section)
      setTimeout(() => setSaved(null), 2500)
    } catch {
      setSaved(null)
    } finally {
      setSaving(null)
    }
  }

  const handleSave = (section: string) => {
    const payload: Record<string, unknown> = {}
    if (section === "generaux") payload.general = general
    else if (section === "livraison") payload.delivery = delivery
    else if (section === "paiement") payload.payment = payment
    else if (section === "notifications") payload.notifications = notifications
    persistSettings(section, payload)
  }

  const togglePayment = (key: keyof PaymentSettings) => {
    const updated = { ...payment, [key]: !payment[key] }
    setPayment(updated)
    persistSettings("paiement", { payment: updated })
  }

  const toggleNotification = (key: keyof NotificationSettings) => {
    const updated = { ...notifications, [key]: !notifications[key] }
    setNotifications(updated)
    persistSettings("notifications", { notifications: updated })
  }

  const SaveBtn = ({ section, label }: { section: string; label?: string }) => {
    const isActive = saving === section
    const isSaved = saved === section
    return (
      <button
        onClick={() => handleSave(section)}
        disabled={isActive}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
          isSaved
            ? "bg-green-100 text-green-700 border border-green-200"
            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        }`}
      >
        {isActive ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : isSaved ? (
          <span>&#10003;</span>
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {isSaved ? "Enregistre" : label ?? "Enregistrer"}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <Settings className="h-5 w-5 text-gray-400" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Paramètres généraux</h3>
          <SaveBtn section="generaux" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nom de l'entreprise
            </label>
            <input
              type="text"
              value={general.companyName}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, companyName: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email
            </label>
            <input
              type="email"
              value={general.email}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Téléphone
            </label>
            <input
              type="text"
              value={general.phone}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Adresse
            </label>
            <input
              type="text"
              value={general.address}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, address: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Site web
            </label>
            <input
              type="text"
              value={general.website}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, website: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Paramètres de livraison</h3>
          <SaveBtn section="livraison" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Frais de livraison (F)
            </label>
            <input
              type="number"
              value={delivery.deliveryFee}
              onChange={(e) =>
                setDelivery((prev) => ({
                  ...prev,
                  deliveryFee: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Livraison gratuite à partir de (F)
            </label>
            <input
              type="number"
              value={delivery.freeDeliveryThreshold}
              onChange={(e) =>
                setDelivery((prev) => ({
                  ...prev,
                  freeDeliveryThreshold: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Zones de livraison
            </label>
            <div className="flex flex-wrap gap-2">
              {delivery.zones.map((zone, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg"
                >
                  {zone}
                  <button
                    onClick={() => {
                      const updated = { ...delivery, zones: delivery.zones.filter((_, i) => i !== idx) }
                      setDelivery(updated)
                      persistSettings("livraison", { delivery: updated })
                    }}
                    className="ml-0.5 text-blue-400 hover:text-blue-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {showZoneInput ? (
                <div className="flex items-center gap-1">
                  <input
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newZone.trim()) {
                        const updated = { ...delivery, zones: [...delivery.zones, newZone.trim()] }
                        setDelivery(updated)
                        persistSettings("livraison", { delivery: updated })
                        setNewZone("")
                        setShowZoneInput(false)
                      }
                      if (e.key === "Escape") setShowZoneInput(false)
                    }}
                    className="w-36 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                    placeholder="Nom de la zone"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (newZone.trim()) {
                        const updated = { ...delivery, zones: [...delivery.zones, newZone.trim()] }
                        setDelivery(updated)
                        persistSettings("livraison", { delivery: updated })
                        setNewZone("")
                      }
                      setShowZoneInput(false)
                    }}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowZoneInput(true)}
                  className="px-2.5 py-1 text-xs font-medium text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:text-primary-600 transition-colors"
                >
                  + Ajouter une zone
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Moyens de paiement</h3>
          <SaveBtn section="paiement" />
        </div>
        <div className="space-y-3">
          {[
            { key: "card" as const, label: "Carte bancaire", desc: "Visa, Mastercard" },
            { key: "mobileMoney" as const, label: "Mobile Money", desc: "Airtel Money, MTN Mobile Money" },
            { key: "cod" as const, label: "Paiement à la livraison", desc: "Espèces ou Mobile Money" },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <button
                onClick={() => togglePayment(item.key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  payment[item.key] ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    payment[item.key] ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          <SaveBtn section="notifications" />
        </div>
        <div className="space-y-3">
          {[
            { key: "newOrder" as const, label: "Nouvelle commande", desc: "Notification à chaque nouvelle commande" },
            { key: "deliveryUpdate" as const, label: "Mise à jour livraison", desc: "Changement de statut de livraison" },
            { key: "lowStock" as const, label: "Stock faible", desc: "Alerte lorsque le stock est bas" },
            { key: "newRegistration" as const, label: "Nouvelle inscription", desc: "Un nouveau client s'est inscrit" },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <button
                onClick={() => toggleNotification(item.key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  notifications[item.key] ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    notifications[item.key] ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
