"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Crosshair, Loader2 } from "lucide-react"

export interface ZoneMarker {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
}

export interface ZoneCenter {
  lat: number
  lng: number
}

interface MapMouseEventLike {
  latLng?: { lat: () => number; lng: () => number }
}

interface ListenerHandle {
  remove: () => void
}

interface GoogleCircle {
  setMap: (map: GoogleMapLike | null) => void
}

interface GoogleMarkerLike {
  setMap: (map: GoogleMapLike | null) => void
  addListener: (event: string, handler: () => void) => void
}

interface GoogleInfoWindowLike {
  open: (map: GoogleMapLike, anchor: GoogleMarkerLike) => void
  close: () => void
  setContent: (content: HTMLElement) => void
}

interface GoogleMapLike {
  setCenter: (c: ZoneCenter) => void
  addListener: (event: string, handler: (e: MapMouseEventLike) => void) => ListenerHandle
  unbindAll: () => void
}

interface MapsLib {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapLike
  Circle: new (options: Record<string, unknown>) => GoogleCircle
  Marker: new (options: Record<string, unknown>) => GoogleMarkerLike
  InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindowLike
}

const SCRIPT_ID = "lcg-gmaps-script"

const LOAD_ERROR_MESSAGE =
  "Le script Google Maps n'a pas pu être chargé. Vérifiez que l'API « Maps JavaScript API » est activée sur le projet Cloud, que la clé n'est pas restreinte par référent HTTP, et qu'elle n'est pas vide dans NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."

function readMapsLib(): MapsLib | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { google?: { maps?: MapsLib } }).google?.maps ?? null
}

// Chargé une seule fois par page, partagé entre toutes les instances du composant.
let loader: { key: string; promise: Promise<MapsLib> } | null = null

function loadMapsLib(apiKey: string): Promise<MapsLib> {
  const ready = readMapsLib()
  if (ready) return Promise.resolve(ready)
  if (loader?.key === apiKey) return loader.promise

  const promise = new Promise<MapsLib>((resolve, reject) => {
    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.addEventListener("load", () => {
      const lib = readMapsLib()
      if (lib) {
        resolve(lib)
      } else {
        loader = null
        script.remove()
        reject(new Error(LOAD_ERROR_MESSAGE))
      }
    })
    script.addEventListener("error", () => {
      loader = null
      script.remove()
      reject(new Error(LOAD_ERROR_MESSAGE))
    })
    document.head.appendChild(script)
  })

  loader = { key: apiKey, promise }
  return promise
}

function buildInfoContent(title: string, subtitle?: string): HTMLElement {
  const root = document.createElement("div")
  root.style.fontSize = "12px"
  const strong = document.createElement("strong")
  strong.textContent = title
  root.appendChild(strong)
  if (subtitle) {
    root.appendChild(document.createElement("br"))
    root.appendChild(document.createTextNode(subtitle))
  }
  return root
}

// Signature stable : évite de redessiner les marqueurs quand le parent passe
// un nouveau tableau à chaque rendu.
function markersSignature(markers: ZoneMarker[]): string {
  return markers
    .map((m) => `${m.id}|${m.lat}|${m.lng}|${m.title}|${m.subtitle ?? ""}`)
    .join("~")
}

export function ClientZoneMap({
  apiKey,
  center,
  fallbackCenter,
  radiusKm,
  markers,
  zoom = 12,
  onCenterPick,
}: {
  apiKey?: string
  center: ZoneCenter | null
  fallbackCenter?: ZoneCenter
  radiusKm: number
  markers: ZoneMarker[]
  zoom?: number
  onCenterPick?: (center: ZoneCenter) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleMapLike | null>(null)
  const mapKeyRef = useRef<string | null>(null)
  const circleRef = useRef<GoogleCircle | null>(null)
  const markerRefs = useRef<GoogleMarkerLike[]>([])
  const infoWindowRef = useRef<GoogleInfoWindowLike | null>(null)
  const pickListenerRef = useRef<ListenerHandle | null>(null)
  const onCenterPickRef = useRef(onCenterPick)
  const [mapVersion, setMapVersion] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Le callback est stocké dans une ref pour ne pas réattacher l'écouteur
  // « click » à chaque rendu.
  useEffect(() => {
    onCenterPickRef.current = onCenterPick
  })

  const lat = center?.lat ?? null
  const lng = center?.lng ?? null
  const viewLat = lat ?? fallbackCenter?.lat ?? null
  const viewLng = lng ?? fallbackCenter?.lng ?? null
  const hasView = viewLat !== null && viewLng !== null
  const signature = markersSignature(markers)
  const radiusMeters = radiusKm * 1000

  // Détruit la carte et toutes ses surcouches. Sans cela, le cercle, les
  // marqueurs et l'infobulle survivent au démontage et les cartes se
  // superposent dans le conteneur.
  const teardown = () => {
    pickListenerRef.current?.remove()
    pickListenerRef.current = null
    infoWindowRef.current?.close()
    infoWindowRef.current = null
    markerRefs.current.forEach((m) => m.setMap(null))
    markerRefs.current = []
    circleRef.current?.setMap(null)
    circleRef.current = null
    mapRef.current?.unbindAll()
    mapRef.current = null
    mapKeyRef.current = null
    if (containerRef.current) containerRef.current.innerHTML = ""
  }

  // 1. Charger l'API, puis créer la carte une seule fois par clé.
  useEffect(() => {
    if (!apiKey || !containerRef.current) return
    let disposed = false

    if (mapRef.current) {
      if (mapKeyRef.current === apiKey) return
      teardown() // la clé a changé : on repart d'une carte propre
    }

    setLoading(true)
    setLoadError(null)

    loadMapsLib(apiKey)
      .then((lib) => {
        if (disposed || !containerRef.current || mapRef.current) return
        const map = new lib.Map(containerRef.current, {
          center: { lat: viewLat, lng: viewLng },
          zoom,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        })
        mapRef.current = map
        mapKeyRef.current = apiKey
        infoWindowRef.current = new lib.InfoWindow({})
        setLoading(false)
        setMapVersion((v) => v + 1)
      })
      .catch((error: Error) => {
        if (disposed) return
        setLoadError(error.message || LOAD_ERROR_MESSAGE)
        setLoading(false)
      })

    return () => {
      disposed = true
    }
    // La carte n'est créée qu'une fois par clé : lat/lng/zoom sont appliqués
    // par les effets suivants, pas ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  // 2. Recentrer sans recréer la carte.
  useEffect(() => {
    const map = mapRef.current
    if (!map || viewLat === null || viewLng === null) return
    map.setCenter({ lat: viewLat, lng: viewLng })
  }, [mapVersion, viewLat, viewLng])

  // 3. Cercle de la zone (uniquement si la zone a un centre défini).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    circleRef.current?.setMap(null)
    circleRef.current = null
    if (lat === null || lng === null) return

    const lib = readMapsLib()
    if (!lib) return

    circleRef.current = new lib.Circle({
      map,
      center: { lat, lng },
      radius: radiusMeters,
      strokeColor: "#1D53C4",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#1D53C4",
      fillOpacity: 0.12,
    })
  }, [mapVersion, lat, lng, radiusMeters])

  // 4. Marqueurs clients (redessinés uniquement quand la liste change).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    infoWindowRef.current?.close()
    markerRefs.current.forEach((m) => m.setMap(null))
    markerRefs.current = []

    const lib = readMapsLib()
    const info = infoWindowRef.current
    if (!lib || !info) return

    markers.forEach((m) => {
      const marker = new lib.Marker({
        map,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
      })
      info.setContent(buildInfoContent(m.title, m.subtitle))
      marker.addListener("click", () => info.open(map, marker))
      markerRefs.current.push(marker)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapVersion, signature])

  // 5. Sélection du centre au clic sur la carte.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    pickListenerRef.current?.remove()
    pickListenerRef.current = null
    if (!onCenterPickRef.current) return

    pickListenerRef.current = map.addListener("click", (event) => {
      const latLng = event?.latLng
      if (!latLng) return
      onCenterPickRef.current?.({ lat: latLng.lat(), lng: latLng.lng() })
    })
  }, [mapVersion])

  // 6. Nettoyage au démontage.
  useEffect(() => teardown, [])

  if (!apiKey) {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <p className="text-sm font-medium text-gray-700">Carte Google Maps indisponible</p>
        <p className="max-w-md text-xs text-gray-500">
          Définissez <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> dans <code>.env</code> (clé de
          l&apos;API JavaScript Maps, restriction HTTP-referrer{" "}
          <code>http://localhost:3000/*</code>). La liste des clients reste disponible sans la carte.
        </p>
      </div>
    )
  }

  if (!hasView) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          Renseignez le centre (latitude / longitude) de la zone pour afficher la carte.
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-gray-200">
      <div ref={containerRef} className="h-full w-full" />
      {onCenterPick && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1 text-xs font-medium text-white">
          <Crosshair className="mr-1 inline h-3 w-3" />
          Cliquez sur la carte pour déplacer le centre de la zone
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      {loadError && (
        <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
    </div>
  )
}
