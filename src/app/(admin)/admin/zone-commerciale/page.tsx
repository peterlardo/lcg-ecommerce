"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  Search,
  Crosshair,
  LocateFixed,
} from "lucide-react"
import { ClientZoneMap, type ZoneCenter, type ZoneMarker } from "@/components/shared/client-zone-map"

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
  address: string | null
  city: string | null
  category: string | null
  latitude: number
  longitude: number
  distanceKm: number
  geoSource?: string | null
  geoConfidence?: string | null
}

interface ZoneResponse {
  zone: { name: string | null; lat: number | null; lng: number | null; radiusKm: number }
  clients: ClientInZone[]
  notice: string | null
}

/** Client actif sans coordonnées : à pointer à la main sur la carte. */
interface MissingClient {
  id: string
  type: "B2B" | "B2C"
  name: string
  category: string | null
  phone: string | null
  address: string | null
  city: string | null
}

// Pointe-Noire / Brazzaville : centre provisoire affiché tant que la zone
// n'a pas de coordonnées, pour pouvoir choisir le centre au clic.
const FALLBACK_CENTER: ZoneCenter = { lat: -4.2634, lng: 15.2429 }

// Étiquettes de confiance issues du script de géocodage : une position
// « faible » ou « moyen » est signalée pour invites à la vérification.
const CONFIDENCE_LABELS: Record<string, { label: string; cls: string }> = {
  confirme: { label: "Confirmé", cls: "bg-green-100 text-green-700" },
  google: { label: "Google", cls: "bg-emerald-100 text-emerald-700" },
  "osm-fort": { label: "OSM · fort", cls: "bg-green-100 text-green-700" },
  "osm-moyen": { label: "OSM · moyen", cls: "bg-amber-100 text-amber-700" },
  "osm-faible": { label: "OSM · à vérifier", cls: "bg-orange-100 text-orange-700" },
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
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
  const [selectedId, setSelectedId] = useState("")
  // L'état porte l'identifiant du commercial chargé : « loading » et
  // « données affichées » en découlent, sans setState dans un effet.
  const [zoneState, setZoneState] = useState<{
    id: string
    data: ZoneResponse | null
    error: string | null
  } | null>(null)
  const [zoneForm, setZoneForm] = useState({
    operationZone: "",
    zoneLat: "",
    zoneLng: "",
    zoneRadiusKm: "10",
  })
  const [editingZone, setEditingZone] = useState(false)
  const [savingZone, setSavingZone] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [actionError, setActionError] = useState("")
  const [toast, setToast] = useState("")
  // Pose manuelle des clients : le géocodage automatique laisse une partie des
  // petits commerces sans coordonnées, on les pointe donc un par un sur la carte.
  const [missing, setMissing] = useState<MissingClient[]>([])
  const [missingNotice, setMissingNotice] = useState<string | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [missingQuery, setMissingQuery] = useState("")
  const [picking, setPicking] = useState<{ id: string; type: "B2B" | "B2C"; name: string } | null>(null)
  const [savingPin, setSavingPin] = useState(false)

  const zoneData = zoneState?.data ?? null
  const loading = !!selectedId && zoneState?.id !== selectedId
  const error = actionError || zoneState?.error || ""

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

  const loadZone = useCallback(async (id: string, signal?: AbortSignal) => {
    if (!id) return
    try {
      const res = await fetch(`/api/clients/zone?commercialId=${id}`, { signal })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as ZoneResponse
      setZoneState({ id, data, error: null })
      setZoneForm({
        operationZone: data.zone.name || "",
        zoneLat: data.zone.lat != null ? String(data.zone.lat) : "",
        zoneLng: data.zone.lng != null ? String(data.zone.lng) : "",
        zoneRadiusKm: String(data.zone.radiusKm ?? 10),
      })
    } catch {
      if (!signal?.aborted) {
        setZoneState({ id, data: null, error: "Impossible de charger la zone." })
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    const init = async () => {
      await loadZone(selectedId, controller.signal)
    }
    void init()
    return () => controller.abort()
  }, [selectedId, loadZone])

  const loadMissing = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/clients/zone?missing=1", { signal })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { missing: MissingClient[]; notice: string | null }
      setMissing(data.missing ?? [])
      setMissingNotice(data.notice ?? null)
    } catch {
      if (!signal?.aborted) setMissing([])
      if (!signal?.aborted) setMissingNotice("Liste des clients à localiser indisponible.")
    }
  }, [])

  const startPicking = useCallback((client: { id: string; type: "B2B" | "B2C"; name: string }) => {
    setPicking(client)
    setActionError("")
    setToast("")
  }, [])

  const placeClient = useCallback(
    async (point: ZoneCenter) => {
      if (!picking) return
      setSavingPin(true)
      setActionError("")
      try {
        const res = await fetch("/api/clients/zone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: picking.id,
            type: picking.type,
            latitude: Number(point.lat.toFixed(6)),
            longitude: Number(point.lng.toFixed(6)),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setActionError(data?.error || "Enregistrement du point impossible.")
          return
        }
        setToast(`« ${picking.name} » pointé sur la carte.`)
        setPicking(null)
        setTimeout(() => setToast(""), 2500)
        if (selectedId) await loadZone(selectedId)
        await loadMissing()
      } catch {
        setActionError("Erreur réseau.")
      } finally {
        setSavingPin(false)
      }
    },
    [picking, selectedId, loadZone, loadMissing]
  )

  const filteredMissing = useMemo(() => {
    const q = missingQuery.trim().toLowerCase()
    if (!q) return missing
    return missing.filter((c) =>
      [c.name, c.category, c.phone, c.city, c.address].filter(Boolean).join(" ").toLowerCase().includes(q)
    )
  }, [missing, missingQuery])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    const init = async () => {
      await loadMissing(controller.signal)
    }
    void init()
    return () => controller.abort()
  }, [selectedId, loadMissing])

  async function saveZone() {
    if (!selectedId) return
    setSavingZone(true)
    setActionError("")
    try {
      const res = await fetch(`/api/commerciaux/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zoneForm),
      })
      if (!res.ok) {
        setActionError((await res.json()).error || "Erreur d'enregistrement.")
        return
      }
      setToast("Zone enregistrée.")
      setEditingZone(false)
      await loadZone(selectedId)
      setTimeout(() => setToast(""), 2500)
    } catch {
      setActionError("Erreur réseau.")
    } finally {
      setSavingZone(false)
    }
  }

  async function geocodeZone() {
    const address = zoneForm.operationZone.trim()
    if (!address) {
      setActionError("Saisissez d'abord le nom de la zone.")
      return
    }
    setGeocoding(true)
    setActionError("")
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data?.error || "Géocodage impossible.")
        return
      }
      setZoneForm((f) => ({
        ...f,
        zoneLat: String(Number(data.lat).toFixed(6)),
        zoneLng: String(Number(data.lng).toFixed(6)),
      }))
    } catch {
      setActionError("Erreur réseau.")
    } finally {
      setGeocoding(false)
    }
  }

  const pickCenter = useCallback((point: ZoneCenter) => {
    setZoneForm((f) => ({
      ...f,
      zoneLat: String(Number(point.lat.toFixed(6))),
      zoneLng: String(Number(point.lng.toFixed(6))),
    }))
  }, [])

  const savedCenter = useMemo<ZoneCenter | null>(
    () =>
      zoneData?.zone.lat != null && zoneData?.zone.lng != null
        ? { lat: zoneData.zone.lat, lng: zoneData.zone.lng }
        : null,
    [zoneData]
  )

  // En édition, le cercle suit les champs du formulaire pour avoir un
  // retour visuel immédiat (clic sur la carte ou saisie manuelle).
  const formLat = zoneForm.zoneLat === "" ? NaN : Number(zoneForm.zoneLat)
  const formLng = zoneForm.zoneLng === "" ? NaN : Number(zoneForm.zoneLng)
  const formCenter =
    Number.isFinite(formLat) && Number.isFinite(formLng)
      ? { lat: formLat, lng: formLng }
      : null
  const center = editingZone && formCenter ? formCenter : savedCenter
  const radiusKm = editingZone
    ? Number(zoneForm.zoneRadiusKm) || 10
    : zoneData?.zone.radiusKm ?? 10

  const markers = useMemo<ZoneMarker[]>(
    () =>
      zoneData?.clients.map((c) => ({
        id: c.id,
        lat: c.latitude,
        lng: c.longitude,
        title: displayName(c),
        subtitle: c.distanceKm != null ? `${c.distanceKm} km` : c.city || "",
      })) ?? [],
    [zoneData]
  )

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

      {zoneData?.notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2.5 rounded-lg">
          {zoneData.notice}
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
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      value={zoneForm.operationZone}
                      onChange={(e) => setZoneForm({ ...zoneForm, operationZone: e.target.value })}
                      placeholder="Ex: Rond point Moungali"
                    />
                    <button
                      type="button"
                      onClick={geocodeZone}
                      disabled={geocoding}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {geocoding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Rechercher
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Le nom est converti en latitude / longitude. Vous pouvez aussi
                    cliquer directement sur la carte.
                  </p>
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

          {/* Bandeau de pose manuelle */}
          {picking && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
              <Crosshair className="h-4 w-4 shrink-0 text-primary" />
              <p className="flex-1 text-sm text-gray-800">
                Cliquez sur la carte pour placer <strong>{picking.name}</strong>
                {savingPin ? " — enregistrement…" : "."}
              </p>
              <button
                type="button"
                onClick={() => setPicking(null)}
                disabled={savingPin}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" /> Annuler
              </button>
            </div>
          )}

          {/* Map */}
          <ClientZoneMap
            apiKey={apiKey}
            center={center}
            fallbackCenter={editingZone || picking ? FALLBACK_CENTER : undefined}
            radiusKm={radiusKm}
            markers={markers}
            onCenterPick={
              editingZone ? pickCenter : picking ? placeClient : undefined
            }
          />

          {/* Clients à pointer à la main */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <LocateFixed className="h-4 w-4 text-primary" />
                Clients sans coordonnées ({missing.length})
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    className={`${inputCls} pl-8 py-1.5 text-xs w-full sm:w-56`}
                    value={missingQuery}
                    onChange={(e) => setMissingQuery(e.target.value)}
                    placeholder="Rechercher un client…"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowMissing((v) => !v)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {showMissing ? <X className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  {showMissing ? "Masquer" : "Localiser"}
                </button>
              </div>
            </div>

            {missingNotice && (
              <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                {missingNotice}
              </p>
            )}

            {!showMissing ? (
              <p className="text-xs text-gray-500">
                Le géocodage automatique ne trouve pas ces commerces. Cliquez sur « Localiser »,
                puis sur la carte, pour pointer leur emplacement.
              </p>
            ) : !filteredMissing.length ? (
              <p className="py-4 text-center text-xs text-gray-500">
                {missing.length
                  ? "Aucun client ne correspond à cette recherche."
                  : "Tous les clients actifs ont des coordonnées."}
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {filteredMissing.map((c) => {
                  const isTarget = picking?.id === c.id
                  return (
                    <div
                      key={`${c.type}-${c.id}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              c.type === "B2B"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {c.type}
                          </span>
                          {c.category && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {c.category}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          )}
                          {(c.address || c.city) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {[c.address, c.city].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          isTarget
                            ? setPicking(null)
                            : startPicking({ id: c.id, type: c.type, name: c.name })
                        }
                        disabled={savingPin}
                        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                          isTarget
                            ? "bg-primary text-primary-foreground"
                            : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                        {isTarget ? "Annuler" : "Placer"}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            c.type === "B2B"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {c.type}
                        </span>
                        {c.category && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {c.category}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-50 text-primary-700">
                          {c.distanceKm} km
                        </span>
                        {c.geoConfidence &&
                          CONFIDENCE_LABELS[c.geoConfidence] &&
                          CONFIDENCE_LABELS[c.geoConfidence].label !==
                            CONFIDENCE_LABELS.confirme.label && (
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${CONFIDENCE_LABELS[c.geoConfidence].cls}`}
                            >
                              {CONFIDENCE_LABELS[c.geoConfidence].label}
                            </span>
                          )}
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
                        {c.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.address}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        startPicking({
                          id: c.id,
                          type: c.type,
                          name: displayName(c),
                        })
                      }
                      disabled={savingPin}
                      title="Re-pointer ce client sur la carte"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <Crosshair className="h-3.5 w-3.5" /> Re-pointer
                    </button>
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
