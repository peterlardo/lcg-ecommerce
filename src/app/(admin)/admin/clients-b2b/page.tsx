"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Building2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  X,
  Loader2,
  Navigation,
  Users,
  Briefcase,
  ChevronDown,
  Eye,
  Calendar,
} from "lucide-react"
import { ClientZoneMap } from "@/components/shared/client-zone-map"

interface Commercial {
  id: string
  name: string | null
  email: string
  role: string
  operationZone: string | null
  zoneLat: number | null
  zoneLng: number | null
  zoneRadiusKm: number | null
}

interface B2BClient {
  id: string
  type: "B2B"
  companyName: string | null
  tradeName: string | null
  contactName: string | null
  taxId: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  isActive: boolean
  createdAt: string
  distanceKm?: number
  commercial: { id: string; name: string | null; email: string } | null
}

interface ZoneData {
  zone: { name: string | null; lat: number | null; lng: number | null; radiusKm: number }
  clients: B2BClient[]
}

function displayName(c: B2BClient): string {
  return c.companyName || c.tradeName || c.contactName || "(sans nom)"
}

export default function ClientsB2BPage() {
  const { data: session } = useSession()
  const role = session?.user?.role as string | undefined
  const meId = session?.user?.id as string | undefined
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined

  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [zoneData, setZoneData] = useState<ZoneData | null>(null)
  const [allClients, setAllClients] = useState<B2BClient[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<B2BClient | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    companyName: "",
    tradeName: "",
    contactName: "",
    taxId: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    notes: "",
    isActive: true,
  })

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailClient, setDetailClient] = useState<B2BClient | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/commerciaux", { signal: controller.signal })
        if (res.ok) {
          const list = await res.json()
          setCommerciaux(list)
          setSelectedId((current) => current || (role === "COMMERCIAL" && meId ? meId : list[0]?.id || ""))
        }
      } catch { /* ignore */ }
    }
    void init()
    return () => controller.abort()
  }, [role, meId])

  const loadZone = useCallback(async (id: string) => {
    if (!id) return
    try {
      const res = await fetch(`/api/clients/zone?commercialId=${id}&type=B2B`)
      if (!res.ok) throw new Error()
      const data: ZoneData = await res.json()
      setZoneData(data)
      setAllClients(data.clients)
    } catch {
      setError("Impossible de charger les clients B2B.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    const init = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/clients/zone?commercialId=${selectedId}&type=B2B`, { signal: controller.signal })
        if (!res.ok) throw new Error()
        const data: ZoneData = await res.json()
        setZoneData(data)
        setAllClients(data.clients)
      } catch {
        if (!controller.signal.aborted) setError("Impossible de charger les clients B2B.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [selectedId])

  const filtered = allClients.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (c.companyName || "").toLowerCase().includes(q) ||
      (c.tradeName || "").toLowerCase().includes(q) ||
      (c.contactName || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.city || "").toLowerCase().includes(q) ||
      (c.taxId || "").toLowerCase().includes(q)
    )
  })

  function openCreate() {
    setEditing(null)
    setForm({
      companyName: "",
      tradeName: "",
      contactName: "",
      taxId: "",
      email: "",
      phone: "",
      city: "",
      address: "",
      notes: "",
      isActive: true,
    })
    setError("")
    setModalOpen(true)
  }

  function openEdit(c: B2BClient) {
    setEditing(c)
    setForm({
      companyName: c.companyName || "",
      tradeName: c.tradeName || "",
      contactName: c.contactName || "",
      taxId: c.taxId || "",
      email: c.email || "",
      phone: c.phone || "",
      city: c.city || "",
      address: c.address || "",
      notes: c.notes || "",
      isActive: c.isActive,
    })
    setError("")
    setModalOpen(true)
  }

  async function save() {
    if (!form.companyName.trim()) {
      setError("La raison sociale est obligatoire pour un client B2B.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload = {
        type: "B2B",
        companyName: form.companyName.trim(),
        tradeName: form.tradeName.trim() || null,
        contactName: form.contactName.trim() || null,
        taxId: form.taxId.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
        commercialId: selectedId || null,
      }
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
      setToast(editing ? "Client B2B mis à jour." : "Client B2B créé.")
      setModalOpen(false)
      await loadZone(selectedId)
      setTimeout(() => setToast(""), 2500)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(c: B2BClient) {
    if (!confirm(`Supprimer le client B2B « ${displayName(c)} » ?`)) return
    try {
      const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setToast("Client B2B supprimé.")
      await loadZone(selectedId)
      setTimeout(() => setToast(""), 2500)
    } catch {
      setError("Échec de la suppression.")
    }
  }

  function openDetail(c: B2BClient) {
    setDetailClient(c)
    setDetailOpen(true)
  }

  const center =
    zoneData?.zone.lat != null && zoneData?.zone.lng != null
      ? { lat: zoneData.zone.lat, lng: zoneData.zone.lng }
      : null

  const markers =
    filtered
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({
        id: c.id,
        lat: c.latitude!,
        lng: c.longitude!,
        title: displayName(c),
        subtitle: c.distanceKm != null ? `${c.distanceKm} km` : c.city || "",
      })) || []

  const inputCls =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  const totalB2B = allClients.length
  const activeB2B = allClients.filter((c) => c.isActive).length
  const withGeo = allClients.filter((c) => c.latitude != null).length

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
            <Building2 className="h-5 w-5 text-primary" />
            Clients B2B
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {role === "COMMERCIAL" ? "Mes clients professionnels et leur zone" : "Clients B2B par commercial"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {role === "ADMIN" && (
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={`${inputCls} pl-9 pr-8 appearance-none bg-white min-w-[200px]`}
              >
                <option value="">Sélectionner un commercial…</option>
                {commerciaux.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          )}
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter un client B2B</span>
            <span className="sm:hidden">Ajouter</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase">Total B2B</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalB2B}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase">Actifs</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{activeB2B}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase">Géolocalisés</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{withGeo}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase">Rayon zone</p>
          <p className="text-xl sm:text-2xl font-bold text-primary mt-1">{zoneData?.zone.radiusKm ?? "—"}<span className="text-sm font-normal"> km</span></p>
        </div>
      </div>

      {/* Zone info */}
      {zoneData && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            {zoneData.zone.name || "Zone d'opération"}
            <span className="text-xs font-normal text-gray-400">
              — {zoneData.clients.length} client(s) B2B dans un rayon de {zoneData.zone.radiusKm} km
            </span>
          </h2>
          {center && (
            <p className="text-xs text-gray-500 mt-1">
              Centre : {zoneData.zone.lat}, {zoneData.zone.lng}
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher (raison sociale, contact, email, téléphone, ville, NIF)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} pl-9`}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !selectedId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          {role === "COMMERCIAL" ? "Chargement de vos données..." : "Sélectionnez un commercial."}
        </div>
      ) : (
        <>
          {/* Map */}
          {center && (
            <ClientZoneMap
              apiKey={apiKey}
              center={center}
              radiusKm={zoneData?.zone.radiusKm ?? 10}
              markers={markers}
            />
          )}

          {/* Client List */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              Clients B2B ({filtered.length})
            </h2>
            {!filtered.length ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                {search ? "Aucun client B2B ne correspond à votre recherche." : "Aucun client B2B dans cette zone."}
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {displayName(c)}
                        </p>
                        {!c.isActive && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">
                            Inactif
                          </span>
                        )}
                        {c.distanceKm != null && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary-50 text-primary-700">
                            {c.distanceKm} km
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1 ml-10">
                        {c.contactName && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" /> {c.contactName}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </span>
                        )}
                        {c.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.city}
                          </span>
                        )}
                        {c.taxId && (
                          <span className="text-gray-400">NIF: {c.taxId}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 ml-10 sm:ml-0">
                      <button
                        onClick={() => openDetail(c)}
                        className="p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {detailOpen && detailClient && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl my-4">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Fiche client B2B
              </h2>
              <button onClick={() => setDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 sm:px-6 py-4 space-y-3">
              <div>
                <p className="text-lg font-semibold text-gray-900">{displayName(detailClient)}</p>
                {detailClient.tradeName && <p className="text-sm text-gray-500">Enseigne : {detailClient.tradeName}</p>}
              </div>
              {detailClient.contactName && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Briefcase className="h-4 w-4 text-gray-400" /> {detailClient.contactName}
                </div>
              )}
              {detailClient.taxId && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">NIF :</span> {detailClient.taxId}
                </div>
              )}
              {detailClient.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" /> {detailClient.email}
                </div>
              )}
              {detailClient.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="h-4 w-4 text-gray-400" /> {detailClient.phone}
                </div>
              )}
              {detailClient.city && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <MapPin className="h-4 w-4 text-gray-400" /> {detailClient.city}
                </div>
              )}
              {detailClient.address && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Adresse :</span> {detailClient.address}
                </div>
              )}
              {detailClient.notes && (
                <div className="text-sm text-gray-500 italic">
                  Notes : {detailClient.notes}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Créé le {new Date(detailClient.createdAt).toLocaleDateString("fr-FR")}
                </span>
                <span className={detailClient.isActive ? "text-green-600" : "text-gray-400"}>
                  {detailClient.isActive ? "Actif" : "Inactif"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 sm:px-6 py-4">
              <button
                onClick={() => { setDetailOpen(false); openEdit(detailClient) }}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                <Pencil className="h-4 w-4" /> Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-4">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {editing ? "Modifier le client B2B" : "Nouveau client B2B"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Raison sociale *</label>
                  <input
                    className={inputCls}
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="Ex: Hôtel Émeraude"
                  />
                </div>
                <div>
                  <label className={labelCls}>Enseigne</label>
                  <input
                    className={inputCls}
                    value={form.tradeName}
                    onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                    placeholder="Nom commercial"
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact principal</label>
                  <input
                    className={inputCls}
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
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
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@entreprise.cg"
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
                <div className="sm:col-span-2">
                  <label className={labelCls}>Adresse</label>
                  <input
                    className={inputCls}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
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
