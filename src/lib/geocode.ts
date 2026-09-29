export interface GeoPoint {
  lat: number
  lng: number
}

export type GeocodeOutcome =
  | { ok: true; point: GeoPoint }
  | { ok: false; reason: "no-key" | "no-result" | "api-error" | "network"; message: string }

/**
 * Geocoding Google. Distingue « aucun résultat » d'une erreur d'API
 * (clé absente, API non activée, quota dépassé) : sans cette distinction
 * l'appelant ne peut afficher qu'un « aucun résultat » trompeur.
 */
export async function geocodeAddressDetailed(query: string): Promise<GeocodeOutcome> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    return {
      ok: false,
      reason: "no-key",
      message:
        "GOOGLE_MAPS_API_KEY absent du serveur. Ajoutez la clé dans .env puis redémarrez le serveur.",
    }
  }
  if (!query.trim()) {
    return { ok: false, reason: "no-result", message: "Adresse vide." }
  }

  let data: {
    status?: string
    error_message?: string
    results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query
    )}&region=cd&key=${key}`
    const res = await fetch(url)
    data = await res.json()
  } catch (error) {
    console.error("geocodeAddress error:", error)
    return {
      ok: false,
      reason: "network",
      message: "Appel à l'API Google impossible (réseau ou clé invalide).",
    }
  }

  if (data?.status === "OK" && data.results?.length) {
    const loc = data.results[0]?.geometry?.location
    if (loc) return { ok: true, point: { lat: loc.lat, lng: loc.lng } }
  }

  if (data?.status === "ZERO_RESULTS") {
    return {
      ok: false,
      reason: "no-result",
      message: "Aucune adresse trouvée pour cette recherche.",
    }
  }

  // REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, UNKNOWN_ERROR...
  const status = data?.status ?? "UNKNOWN"
  const detail = data?.error_message?.trim()
  const hint =
    status === "REQUEST_DENIED"
      ? " Vérifiez que la Geocoding API est activée sur votre projet Google Cloud."
      : ""
  return {
    ok: false,
    reason: "api-error",
    message: `Google Geocoding : ${status}.${detail ? ` ${detail}` : ""}${hint}`,
  }
}

/** Raccourci : point ou null. Ne lève jamais (appelants fire-and-forget). */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const outcome = await geocodeAddressDetailed(query)
  return outcome.ok ? outcome.point : null
}
