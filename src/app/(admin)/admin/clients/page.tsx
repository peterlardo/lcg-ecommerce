"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Users,
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Building2,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  X,
  ChevronDown,
  Loader2,
  Briefcase,
} from "lucide-react"

interface Commercial {
  id: string
  name: string | null
  email: string
  role: string
}

interface Client {
  id: string
  type: "B2B" | "B2C"
  companyName: string | null
  tradeName: string | null
  contactName: string | null
  taxId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  commercial: { id: string; name: string | null; email: string } | null
}

function displayName(c: Client): string {
  if (c.type === "B2B") {
    return c.companyName || c.tradeName || c.contactName || "(sans nom)"
  }
  const full = [c.firstName, c.lastName].filter(Boolean).join(" ")
  return full || c.email || "(sans nom)"
}

const emptyForm = {
  type: "B2C" as "B2B" | "B2C",
  companyName: "",
  tradeName: "",
  contactName: "",
  taxId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  address: "",
  notes: "",
  isActive: true,
  commercialId: "",
}

export default function ClientsPage() {
  const { data: session } = useSession()
  const currentRole = session?.user?.role as string | undefined
  const currentUserId = session?.user?.id as string | undefined

  const [clients, setClients] = useState<Client[]>([])
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("tous")
  const [commercialFilter, setCommercialFilter] = useState("tous")
  const [activeFilter, setActiveFilter] = useState("tous")

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set("q", search.trim())
      if (typeFilter !== "tous") params.set("type", typeFilter)
      if (commercialFilter !== "tous") params.set("commercialId", commercialFilter)
      if (activeFilter !== "tous") params.set("active", activeFilter)
      const res = await fetch(`/api/clients?${params.toString()}`)
      if (!res.ok) throw new Error("load")
      setClients(await res.json())
    } catch {
      setError("Impossible de charger les clients.")
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, commercialFilter, activeFilter])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/commerciaux", { signal: controller.signal })
        if (res.ok) setCommerciaux(await res.json())
      } catch {
        /* ignore */
      }
    }
    void init()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const t = setTimeout(loadClients, 300)
    return () => clearTimeout(t)
  }, [loadClients])

  function openCreate() {
    setEditing(null)
    const base = {
      ...emptyForm,
      commercialId:
        currentRole === "COMMERCIAL" && currentUserId ? currentUserId : "",
    }
    setForm(base)
    setError("")
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      type: c.type,
      companyName: c.companyName || "",
      tradeName: c.tradeName || "",
      contactName: c.contactName || "",
      taxId: c.taxId || "",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      email: c.email || "",
      phone: c.phone || "",
      city: c.city || "",
      address: c.address || "",
      notes: c.notes || "",
      isActive: c.isActive,
      commercialId: c.commercial?.id || "",
    })
    setError("")
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      const payload = { ...form }
      const res = editing
        ? await fetch(`/api/clients/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.")
        return
      }
      setToast(editing ? "Client mis à jour." : "Client créé.")
      setModalOpen(false)
      loadClients()
      setTimeout(() => setToast(""), 2500)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(c: Client) {
    if (!confirm(`Supprimer le client « ${displayName(c)} » ?`)) return
    try {
      const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setToast("Client supprimé.")
      loadClients()
      setTimeout(() => setToast(""), 2500)
    } catch {
      setError("Échec de la suppression.")
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {clients.length} client{clients.length > 1 ? "s" : ""} · B2B & B2C
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Ajouter un client
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher (nom, email, téléphone, ville)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`${inputCls} pl-9 pr-8 appearance-none bg-white`}
          >
            <option value="tous">Tous les types</option>
            <option value="B2B">B2B (entreprise)</option>
            <option value="B2C">B2C (particulier)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={commercialFilter}
            onChange={(e) => setCommercialFilter(e.target.value)}
            className={`${inputCls} pl-9 pr-8 appearance-none bg-white`}
          >
            <option value="tous">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className={`${inputCls} pr-8 appearance-none bg-white`}
          >
            <option value="tous">Tous les statuts</option>
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-xs sm:text-sm text-gray-500">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm flex-shrink-0 ${
                      c.type === "B2B"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {c.type === "B2B" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <UserIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {displayName(c)}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          c.type === "B2B"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {c.type}
                      </span>
                      {!c.isActive && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 hidden sm:inline" />
                          {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 hidden sm:inline" />
                          {c.phone}
                        </span>
                      )}
                      {c.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 hidden sm:inline" />
                          {c.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {c.commercial && (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                      <Briefcase className="h-3 w-3" />
                      {c.commercial.name || c.commercial.email}
                    </span>
                  )}
                  <button
                    onClick={() => openEdit(c)}
                    className="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-primary-50 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-4">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {editing ? "Modifier le client" : "Nouveau client"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className={labelCls}>Type de client</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "B2C" })}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.type === "B2C"
                        ? "border-primary bg-primary-50 text-primary-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <UserIcon className="h-4 w-4" /> B2C (particulier)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "B2B" })}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.type === "B2B"
                        ? "border-primary bg-primary-50 text-primary-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Building2 className="h-4 w-4" /> B2B (entreprise)
                  </button>
                </div>
              </div>

              {form.type === "B2B" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Raison sociale *</label>
                    <input
                      className={inputCls}
                      value={form.companyName}
                      onChange={(e) =>
                        setForm({ ...form, companyName: e.target.value })
                      }
                      placeholder="Ex: Hôtel Émeraude"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Enseigne</label>
                    <input
                      className={inputCls}
                      value={form.tradeName}
                      onChange={(e) =>
                        setForm({ ...form, tradeName: e.target.value })
                      }
                      placeholder="Nom commercial"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Contact principal</label>
                    <input
                      className={inputCls}
                      value={form.contactName}
                      onChange={(e) =>
                        setForm({ ...form, contactName: e.target.value })
                      }
                      placeholder="Nom du contact"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>NIF / Identifiant fiscal</label>
                    <input
                      className={inputCls}
                      value={form.taxId}
                      onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                      placeholder="Ex: CG-ABC-12-3456"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Prénom *</label>
                    <input
                      className={inputCls}
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nom *</label>
                    <input
                      className={inputCls}
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      placeholder="Nom"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemple.cg"
                  />
                </div>
                <div>
                  <label className={labelCls}>Téléphone</label>
                  <input
                    className={inputCls}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+242 05 00 00 00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Ville</label>
                  <input
                    className={inputCls}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Brazzaville"
                  />
                </div>
                <div>
                  <label className={labelCls}>Commercial</label>
                  <select
                    className={inputCls}
                    value={form.commercialId}
                    onChange={(e) =>
                      setForm({ ...form, commercialId: e.target.value })
                    }
                  >
                    <option value="">Non assigné</option>
                    {commerciaux.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.email}
                        {c.role === "COMMERCIAL" ? " (Commercial)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Adresse</label>
                  <input
                    className={inputCls}
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    placeholder="Adresse complète"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Informations complémentaires..."
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-500"
                />
                Client actif
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 sm:px-6 py-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
