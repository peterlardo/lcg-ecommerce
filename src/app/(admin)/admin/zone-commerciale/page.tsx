"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Map as MapIcon,
  Briefcase,
  Loader2,
  Pencil,
  Save,
  X,
  Navigation,
  Users,
  Phone,
  Mail,
  MapPin,
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

interface ClientInZone {
  id: string
  type: "B2B" | "B2C"
  companyName: string | null
  tradeName: string | null
  contactName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  city: string | null
  latitude: number
  longitude: number
  distanceKm: number
}

interface ZoneResponse {
  zone: { name: string | null; lat: number | null; lng: number | null; radiusKm: number }
  clients: ClientInZone[]
}

function displayName(c: ClientInZone): string {
  if (c.type === "B2B") return c.companyName || c.tradeName || c.contactName || "(sans nom)"
  const full = [c.firstName, c.lastName].filter(Boolean).join(" ")
  return full || c.email || "(sans nom)"
}

export default function ZoneCommercialePage() {
  const { data: session } = useSession()
  const role = session?.user?.role as string | undefined
  const meId = session?.user?.id as string | undefined
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined

  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [zoneData, setZoneData] = useState<ZoneResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [zoneForm, setZoneForm] = useState({
    operationZone: "",
    zoneLat: "",
    zoneLng: "",
    zoneRadiusKm: "10",
  })
  const [editingZone, setEditingZone] = useState(false)
  const [savingZone, setSavingZone] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")

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
      } catch {
        /* ignore */
      }
    }
    void init()
    return () => controller.abort()
  }, [role, meId])

  const loadZone = useCallback(async (id: string) => {
    if (!id) return
    try {
      const res = await fetch(`/api/clients/zone?commercialId=${id}`)
      if (!res.ok) throw new Error()
      const data: ZoneResponse = await res.json()
      setZoneData(data)
      setZoneForm({
        operationZone: data.zone.name || "",
        zoneLat: data.zone.lat != null ? String(data.zone.lat) : "",
        zoneLng: data.zone.lng != null ? String(data.zone.lng) : "",
        zoneRadiusKm: String(data.zone.radiusKm ?? 10),
      })
    } catch {
      setError("Impossible de charger la zone.")
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
        const res = await fetch(`/api/clients/zone?commercialId=${selectedId}`, { signal: controller.signal })
        if (!res.ok) throw new Error()
        const data: ZoneResponse = await res.json()
        setZoneData(data)
        setZoneForm({
          operationZone: data.zone.name || "",
          zoneLat: data.zone.lat != null ? String(data.zone.lat) : "",
          zoneLng: data.zone.lng != null ? String(data.zone.lng) : "",
          zoneRadiusKm: String(data.zone.radiusKm ?? 10),
        })
      } catch {
        if (!controller.signal.aborted) setError("Impossible de charger la zone.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [selectedId])

  async function saveZone() {
    if (!selectedId) return
    setSavingZone(true)
    setError("")
    try {
      const res = await fetch(`/api/commerciaux/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zoneForm),
      })
      if (!res.ok) {
        setError((await res.json()).error || "Erreur d'enregistrement.")
        return
      }
      setToast("Zone enregistrée.")
      setEditingZone(false)
      await loadZone(selectedId)
      setTimeout(() => setToast(""), 2500)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setSavingZone(false)
    }
  }

  const center =
    zoneData?.zone.lat != null && zoneData?.zone.lng != null
      ? { lat: zoneData.zone.lat, lng: zoneData.zone.lng }
      : null

  const markers =
    zoneData?.clients.map((c) => ({
      id: c.id,
      lat: c.latitude,
      lng: c.longitude,
      title: displayName(c),
      subtitle: c.distanceKm != null ? `${c.distanceKm} km` : c.city || "",
    })) || []

  const inputCls =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
            <MapIcon className="h-5 w-5 text-primary" />
            Zone commerciale
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Clients dans la zone d&apos;opération du commercial
          </p>
        </div>
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
                  {c.role === "COMMERCIAL" ? " (Commercial)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !selectedId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Aucun commercial sélectionné.
        </div>
      ) : (
        <>
          {/* Zone info + edit */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" />
                {zoneData?.zone.name || "Zone d'opération"}
                <span className="text-xs font-normal text-gray-400">
                  (rayon {zoneData?.zone.radiusKm ?? 10} km)
                </span>
              </h2>
              <button
                onClick={() => setEditingZone((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                {editingZone ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {editingZone ? "Fermer" : "Définir la zone"}
              </button>
            </div>

            {editingZone ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Nom de la zone
                  </label>
                  <input
                    className={inputCls}
                    value={zoneForm.operationZone}
                    onChange={(e) => setZoneForm({ ...zoneForm, operationZone: e.target.value })}
                    placeholder="Ex: Brazzaville Centre"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Latitude centre
                  </label>
                  <input
                    className={inputCls}
                    value={zoneForm.zoneLat}
                    onChange={(e) => setZoneForm({ ...zoneForm, zoneLat: e.target.value })}
                    placeholder="-4.263"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Longitude centre
                  </label>
                  <input
                    className={inputCls}
                    value={zoneForm.zoneLng}
                    onChange={(e) => setZoneForm({ ...zoneForm, zoneLng: e.target.value })}
                    placeholder="15.242"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rayon (km)
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    value={zoneForm.zoneRadiusKm}
                    onChange={(e) => setZoneForm({ ...zoneForm, zoneRadiusKm: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={saveZone}
                    disabled={savingZone}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 w-full"
                  >
                    {savingZone && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {center
                  ? `Centre : ${zoneData?.zone.lat}, ${zoneData?.zone.lng} · ${zoneData?.clients.length} client(s) dans un rayon de ${zoneData?.zone.radiusKm} km.`
                  : "Zone non définie. Cliquez sur « Définir la zone » pour saisir le centre et le rayon."}
              </p>
            )}
          </div>

          {/* Map */}
          <ClientZoneMap apiKey={apiKey} center={center} radiusKm={zoneData?.zone.radiusKm ?? 10} markers={markers} />

          {/* List */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              Clients dans la zone ({zoneData?.clients.length ?? 0})
            </h2>
            {!zoneData?.clients.length ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                Aucun client géolocalisé dans cette zone.
              </p>
            ) : (
              <div className="space-y-2">
                {zoneData.clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border border-gray-100 rounded-lg p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
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
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary-50 text-primary-700">
                          {c.distanceKm} km
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
