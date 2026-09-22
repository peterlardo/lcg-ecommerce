"use client"

import { useEffect, useRef } from "react"

export interface ZoneMarker {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
}

interface GoogleMap {
  setMap?: (map: GoogleMap | null) => void
}

interface GoogleOverlay {
  setMap?: (map: GoogleMap | null) => void
}

interface GoogleMarker extends GoogleOverlay {
  addListener: (event: string, handler: () => void) => void
}

interface GoogleInfoWindow {
  open: (map: GoogleMap, marker: GoogleMarker) => void
}

interface GoogleMapsApi {
  google?: {
    maps?: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap
      Circle: new (options: Record<string, unknown>) => GoogleOverlay
      Marker: new (options: Record<string, unknown>) => GoogleMarker
      InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindow
    }
  }
}

export function ClientZoneMap({
  apiKey,
  center,
  radiusKm,
  markers,
}: {
  apiKey?: string
  center: { lat: number; lng: number } | null
  radiusKm: number
  markers: ZoneMarker[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleMap | null>(null)
  const overlaysRef = useRef<GoogleOverlay[]>([])

  // Create / recreate the map when key or center changes
  useEffect(() => {
    if (!apiKey || !center || !containerRef.current) return
    let cancelled = false

    const init = () => {
      if (cancelled || !containerRef.current) return
      const g = (window as unknown as GoogleMapsApi).google
      if (!g?.maps) return
      const maps = g.maps
      const map = new maps.Map(containerRef.current, {
        center,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      })
      mapRef.current = map
      drawOverlays()
    }

    const drawOverlays = () => {
      const g = (window as unknown as GoogleMapsApi).google
      const map = mapRef.current
      if (!g?.maps || !map) return
      const maps = g.maps
      overlaysRef.current.forEach((o) => o.setMap?.(null))
      overlaysRef.current = []
      const circle = new maps.Circle({
        map,
        center,
        radius: radiusKm * 1000,
        strokeColor: "#1D53C4",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#1D53C4",
        fillOpacity: 0.12,
      })
      overlaysRef.current.push(circle)
      markers.forEach((m) => {
        const mk = new maps.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          title: m.title,
        })
        const info = new maps.InfoWindow({
          content: `<div style="font-size:12px"><strong>${m.title}</strong>${
            m.subtitle ? `<br/>${m.subtitle}` : ""
          }</div>`,
        })
        mk.addListener("click", () => info.open(map, mk))
        overlaysRef.current.push(mk)
      })
    }

    if ((window as unknown as GoogleMapsApi).google?.maps) {
      init()
    } else if (!document.querySelector("script[data-gmaps-loader]")) {
      const s = document.createElement("script")
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
      s.async = true
      s.dataset.gmapsLoader = "1"
      s.onload = init
      document.head.appendChild(s)
    } else {
      const check = setInterval(() => {
        if ((window as unknown as GoogleMapsApi).google?.maps) {
          clearInterval(check)
          init()
        }
      }, 300)
      return () => clearInterval(check)
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markers are redrawn by the dedicated effect below; adding them here would recreate the map on every marker change
  }, [apiKey, center, radiusKm])

  // Update markers without recreating the map
  useEffect(() => {
    const g = (window as unknown as GoogleMapsApi).google
    const map = mapRef.current
    if (!g?.maps || !map || !center) return
    const maps = g.maps
    overlaysRef.current.forEach((o) => o.setMap?.(null))
    overlaysRef.current = []
    const circle = new maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      strokeColor: "#1D53C4",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#1D53C4",
      fillOpacity: 0.12,
    })
    overlaysRef.current.push(circle)
    markers.forEach((m) => {
      const mk = new maps.Marker({ map, position: { lat: m.lat, lng: m.lng }, title: m.title })
      const info = new maps.InfoWindow({
        content: `<div style="font-size:12px"><strong>${m.title}</strong>${
          m.subtitle ? `<br/>${m.subtitle}` : ""
        }</div>`,
      })
      mk.addListener("click", () => info.open(map, mk))
      overlaysRef.current.push(mk)
    })
  }, [markers, center, radiusKm])

  if (!apiKey) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <div>
          <p className="text-sm font-medium text-gray-700">Carte Google Maps indisponible</p>
          <p className="mt-1 text-xs text-gray-500">
            Définissez la variable <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> dans le fichier{" "}
            <code>.env</code> (clé de l&apos;API JavaScript Maps). La liste des clients reste
            disponible sans la carte.
          </p>
        </div>
      </div>
    )
  }

  if (!center) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          Zone non définie. Renseignez le centre (latitude / longitude) de la zone pour afficher la
          carte.
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl border border-gray-200" />
}