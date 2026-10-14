"use client"

import { useCallback, useEffect, useState } from "react"
import { Settings, Save, Plus, X } from "lucide-react"

interface GeneralSettings {
  companyName: string
  email: string
  phone: string
  address: string
  website: string
  legal: string
}

interface BankSettings {
  bankName: string
  accountHolder: string
  accountNumber: string
  mtnMoney: string
  airtelMoney: string
  instructions: string
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

function SaveBtn({ section, label, saving, saved, onSave }: { section: string; label?: string; saving: string | null; saved: string | null; onSave: (section: string) => void }) {
  const isActive = saving === section
  const isSaved = saved === section
  return (
    <button
      onClick={() => onSave(section)}
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

export default function ParametresPage() {
  const [general, setGeneral] = useState<GeneralSettings>({
    companyName: "LCG — La Congolaise des Glaçons",
    email: "contact@lcg.cg",
    phone: "+242 06 739 49 49 · +242 05 607 91 91",
    address: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo",
    website: "https://lcg.cg",
    legal: "",
  })

  // valeurs réelles chargées depuis le serveur : rien de fictif affiché avant le chargement
  const [delivery, setDelivery] = useState<DeliverySettings>({
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    zones: [],
  })

  const [bank, setBank] = useState<BankSettings>({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    mtnMoney: "",
    airtelMoney: "",
    instructions: "",
  })
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState("")

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
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s) => {
        if (s.general) setGeneral(s.general)
        if (s.delivery) setDelivery(s.delivery)
        if (s.payment) setPayment(s.payment)
        if (s.notifications) setNotifications(s.notifications)
        if (s.bank) setBank(s.bank)
        setLoaded(true)
      })
      .catch(() => setSaveError("Paramètres illisibles : rechargez la page avant d'enregistrer."))
  }, [])

  const persistSettings = async (section: string, data: Record<string, unknown>) => {
    // enregistrer avant le chargement écraserait les vraies valeurs par celles affichées par défaut
    if (!loaded) return
    setSaving(section)
    setSaved(null)
    setSaveError("")
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(res.status === 403 ? "Vous n'avez pas le droit de modifier les paramètres." : body?.error || "Enregistrement impossible.")
      setSaved(section)
      setTimeout(() => setSaved(null), 2500)
    } catch (e) {
      setSaved(null)
      setSaveError(e instanceof Error ? e.message : "Enregistrement impossible.")
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
    else if (section === "reglement") payload.bank = bank
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

  // --- Section Annonces ---
  const ROLES = [
    { value: "ADMIN", label: "Administrateur" },
    { value: "STOCK_MANAGER", label: "Gestionnaire de stock" },
    { value: "DELIVERY_AGENT", label: "Agent de livraison" },
    { value: "COMMERCIAL", label: "Commercial" },
    { value: "CUSTOMER", label: "Client" },
  ]

  interface AnnouncementItem {
    id: string
    message: string
    tone: string
    audience: string
    targetRoles: string[]
    targetUserIds: string[]
    expiresAt: string | null
    isActive: boolean
    createdAt: string
  }

  const [annMessage, setAnnMessage] = useState("")
  const [annTone, setAnnTone] = useState("danger")
  const [annAudience, setAnnAudience] = useState("ALL")
  const [annRoles, setAnnRoles] = useState<string[]>([])
  const [annUserIds, setAnnUserIds] = useState<string[]>([])
  const [annExpiryHours, setAnnExpiryHours] = useState<number | "">(24)
  const [annList, setAnnList] = useState<AnnouncementItem[]>([])
  const [annUsers, setAnnUsers] = useState<{ id: string; name: string | null; email: string; role: string }[]>([])
  const [annSaving, setAnnSaving] = useState(false)
  const [annLoading, setAnnLoading] = useState(true)

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements?scope=admin", { cache: "no-store" })
      if (res.ok) setAnnList((await res.json()) as AnnouncementItem[])
    } catch {
      // ignore
    } finally {
      setAnnLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/announcements?scope=admin", { cache: "no-store", signal: controller.signal })
        const data = await res.json()
        if (controller.signal.aborted) return
        setAnnList(data as AnnouncementItem[])
      } catch {
      } finally {
        if (!controller.signal.aborted) setAnnLoading(false)
      }
    }
    void init()
    fetch("/api/users", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((u) => { if (!controller.signal.aborted) setAnnUsers(u) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const publishAnnouncement = async () => {
    if (!annMessage.trim()) return
    setAnnSaving(true)
    try {
      const payload: Record<string, unknown> = {
        message: annMessage.trim(),
        tone: annTone,
        audience: annAudience,
        targetRoles: annAudience === "ROLES" ? annRoles : [],
        targetUserIds: annAudience === "USERS" ? annUserIds : [],
      }
      if (annExpiryHours === "" || annExpiryHours === 0) {
        payload.expiresAt = null
      } else {
        payload.expiresAt = new Date(Date.now() + Number(annExpiryHours) * 60 * 60 * 1000).toISOString()
      }

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Erreur")
      setAnnMessage("")
      setAnnTone("danger")
      setAnnAudience("ALL")
      setAnnRoles([])
      setAnnUserIds([])
      setAnnExpiryHours(24)
      await loadAnnouncements()
    } catch {
      // ignore
    } finally {
      setAnnSaving(false)
    }
  }

  const deleteAnnouncement = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" })
      if (res.ok) setAnnList((prev) => prev.filter((a) => a.id !== id))
    } catch {
      // ignore
    }
  }

  const toggleRole = (role: string) => {
    setAnnRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  const toggleUser = (id: string) => {
    setAnnUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paramètres</h1>
        <Settings className="h-5 w-5 text-gray-400" />
      </div>

      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Paramètres généraux</h3>
          <SaveBtn section="generaux" saving={saving} saved={saved} onSave={handleSave} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nom de l&apos;entreprise
            </label>
            <input
              type="text"
              value={general.companyName}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, companyName: e.target.value }))
              }
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mentions légales (pied des devis, bons et factures)
            </label>
            <input
              type="text"
              value={general.legal}
              onChange={(e) =>
                setGeneral((prev) => ({ ...prev, legal: e.target.value }))
              }
              placeholder="Forme, capital, RCCM, NIU"
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">Le nom, l&apos;adresse, le téléphone, le site et les mentions légales s&apos;impriment en tête et en pied des documents B2B.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Paramètres de livraison</h3>
          <SaveBtn section="livraison" saving={saving} saved={saved} onSave={handleSave} />
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Les frais s&apos;appliquent aux commandes de la boutique en ligne dès l&apos;enregistrement. 0 = livraison gratuite.
        </p>
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
                    className="ml-0.5 p-2 text-blue-400 hover:text-blue-700"
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

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Moyens de paiement</h3>
          <SaveBtn section="paiement" saving={saving} saved={saved} onSave={handleSave} />
        </div>
        <div className="space-y-2 sm:space-y-3">
          {[
            { key: "card" as const, label: "Carte bancaire", desc: "Visa, Mastercard" },
            { key: "mobileMoney" as const, label: "Mobile Money", desc: "Airtel Money, MTN Mobile Money" },
            { key: "cod" as const, label: "Paiement à la livraison", desc: "Espèces ou Mobile Money" },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 hover:bg-gray-100/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-900">{item.label}</p>
                <p className="  text-gray-500">{item.desc}</p>
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

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Coordonnées de règlement (factures)</h3>
          <SaveBtn section="reglement" saving={saving} saved={saved} onSave={handleSave} />
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Imprimées sur les factures et dans les factures envoyées par e-mail, dès qu&apos;un compte ou un numéro est saisi. Laissez vide ce que LCG n&apos;utilise pas.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "bankName" as const, label: "Banque", placeholder: "Nom de la banque" },
            { key: "accountHolder" as const, label: "Titulaire du compte", placeholder: "Raison sociale du titulaire" },
            { key: "accountNumber" as const, label: "RIB ou IBAN", placeholder: "Code banque, guichet, n° de compte, clé" },
            { key: "mtnMoney" as const, label: "N° MTN Mobile Money", placeholder: "+242 06 …" },
            { key: "airtelMoney" as const, label: "N° Airtel Money", placeholder: "+242 05 …" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                type="text"
                value={bank[field.key]}
                onChange={(e) => setBank((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Consigne de paiement (facultatif)</label>
            <input
              type="text"
              value={bank.instructions}
              onChange={(e) => setBank((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder="Ex. : indiquer le numéro de facture dans le libellé du virement"
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Notifications</h3>
          <SaveBtn section="notifications" saving={saving} saved={saved} onSave={handleSave} />
        </div>
        <div className="space-y-2 sm:space-y-3">
          {[
            { key: "newOrder" as const, label: "Nouvelle commande", desc: "Notification à chaque nouvelle commande" },
            { key: "deliveryUpdate" as const, label: "Mise à jour livraison", desc: "Changement de statut de livraison" },
            { key: "lowStock" as const, label: "Stock faible", desc: "Alerte lorsque le stock est bas" },
            { key: "newRegistration" as const, label: "Nouvelle inscription", desc: "Un nouveau client s'est inscrit" },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 hover:bg-gray-100/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-900">{item.label}</p>
                <p className="  text-gray-500">{item.desc}</p>
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

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Annonces (bannière)</h3>
          <span className="  text-gray-400">Messages diffusés aux utilisateurs connectés</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
              placeholder="Ex : Maintenance prévue ce soir à 22h..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Couleur (ton)</label>
              <select
                value={annTone}
                onChange={(e) => setAnnTone(e.target.value)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
              >
                <option value="danger">Rouge (danger)</option>
                <option value="warning">Ambre (attention)</option>
                <option value="info">Bleu (info)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expiration (heures)</label>
              <input
                type="number"
                min={0}
                value={annExpiryHours}
                onChange={(e) => setAnnExpiryHours(e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                placeholder="24 = 24h, vide = jamais"
              />
              <p className="mt-1 text-xs text-gray-400">Vide ou 0 = n&apos;expire jamais. Défaut : 24h.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Audience</label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "ALL", label: "Tous les utilisateurs" },
                { value: "ROLES", label: "Rôles spécifiques" },
                { value: "USERS", label: "Utilisateurs spécifiques" },
              ].map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="audience"
                    checked={annAudience === opt.value}
                    onChange={() => setAnnAudience(opt.value)}
                    className="accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {annAudience === "ROLES" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rôles ciblés</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      annRoles.includes(r.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-300"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {annAudience === "USERS" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Utilisateurs ciblés</label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1">
                {annUsers.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun utilisateur.</p>
                ) : (
                  annUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 text-xs text-gray-700 p-1 rounded hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={annUserIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="accent-primary"
                      />
                      <span className="font-medium">{u.name || u.email}</span>
                      <span className="text-gray-400">({u.role})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={publishAnnouncement}
              disabled={annSaving || !annMessage.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {annSaving ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Publier l&apos;annonce
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Annonces existantes</h4>
          {annLoading ? (
            <p className="text-xs text-gray-400">Chargement...</p>
          ) : annList.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune annonce pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {annList.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">
                      {a.message}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {a.tone.toUpperCase()} ·{" "}
                      {a.audience === "ALL"
                        ? "Tous"
                        : a.audience === "ROLES"
                        ? `Rôles: ${a.targetRoles.join(", ") || "-"}`
                        : `Users: ${a.targetUserIds.length}`}{" "}
                      · {a.isActive ? "Active" : "Inactive"} ·{" "}
                      {a.expiresAt ? `Expire le ${new Date(a.expiresAt).toLocaleString("fr-FR")}` : "Jamais"}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    className="shrink-0 text-red-600 hover:text-red-800"
                    aria-label="Supprimer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
