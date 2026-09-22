export interface GeoPoint {
  lat: number
  lng: number
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key || !query.trim()) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query
    )}&region=cd&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    if (data?.status === "OK" && Array.isArray(data.results) && data.results.length) {
      const loc = data.results[0].geometry.location
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch (error) {
    console.error("geocodeAddress error:", error)
  }
  return null
}
