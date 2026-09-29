#!/usr/bin/env node
/**
 * Geocodage des clients B2B LCG (Brazzaville) vers des coordonnees GPS.
 *
 *   node scripts/geocode-b2b.mjs google   -> interroge Google Geocoding API, met en cache
 *   node scripts/geocode-b2b.mjs report   -> affiche le tableau de correspondance
 *   node scripts/geocode-b2b.mjs apply    -> ecrit en base (demande --yes)
 *
 * La ligne de reference OpenStreetMap (data/b2b-osm-coordinates.json) est fusionnee
 * avec le resultat Google : les deux sources concordantes font monter la confiance.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OSM_FILE = join(ROOT, "data", "b2b-osm-coordinates.json")
const CACHE_FILE = join(ROOT, "data", "b2b-google-geocoding.json")
const MODE = process.argv[2] || "report"

// Emprise de Brazzaville : filtre les homonymes etrangers.
const BBOX = { minLat: -4.45, maxLat: -4.10, minLng: 15.10, maxLng: 15.45 }
const CENTRE = { lat: -4.2634, lng: 15.2429 }
const AGREEMENT_KM = 0.25

function loadEnv() {
  const file = join(ROOT, ".env")
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(line)
    if (!m) continue
    const value = m[2].trim().replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1")
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
}

const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {})

function haversineKm(a, b) {
  const t = (x) => (x * Math.PI) / 180
  const s = Math.sin(t(b.lat - a.lat) / 2) ** 2
    + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

const inBbox = (lat, lng) => lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng

async function loadClients() {
  loadEnv()
  const { PrismaClient } = await import("@prisma/client")
  const { Pool } = await import("pg")
  const { PrismaPg } = await import("@prisma/adapter-pg")
  const url = new URL(process.env.DATABASE_URL)
  url.hostname = url.hostname.replace(/-pooler\./, ".")
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url.toString(), max: 2, ssl: { rejectUnauthorized: false } })) })
  try {
    const rows = await prisma.b2BClient.findMany({
      orderBy: { externalId: "asc" },
      select: { externalId: true, name: true, category: true, phone: true },
    })
    // Coordonnees deja enregistrees : optionnel, depend de l'etat de la migration.
    let existing = []
    try {
      existing = await prisma.b2BClient.findMany({ select: { externalId: true, latitude: true, longitude: true } })
    } catch {
      console.warn("Colonnes latitude/longitude indisponibles (migration non appliquee ou client Prisma non regenere).")
    }
    const byId = new Map(existing.map((r) => [r.externalId, r]))
    return rows.map((r) => ({ ...r, latitude: byId.get(r.externalId)?.latitude ?? null, longitude: byId.get(r.externalId)?.longitude ?? null }))
  } finally {
    await prisma.$disconnect()
  }
}

async function googleGeocode(client, apiKey) {
  const query = `${client.name}, Brazzaville, Congo`
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("address", query)
  url.searchParams.set("key", apiKey)
  url.searchParams.set("language", "fr")
  url.searchParams.set("region", "cg")
  url.searchParams.set("components", "country:CG")
  url.searchParams.set("bounds", `${BBOX.minLat},${BBOX.minLng}|${BBOX.maxLat},${BBOX.maxLng}`)

  const r = await fetch(url, { headers: { "User-Agent": "lcg-website-geocoder/1.0" } })
  const j = await r.json()
  if (j.status !== "OK") return { error: j.status, query }
  const hit = (j.results || []).find((x) => inBbox(x.geometry.location.lat, x.geometry.location.lng))
  if (!hit) return { error: "ZERO_RESULTS_IN_BBOX", query, candidates: (j.results || []).length }
  return {
    query,
    googleName: hit.formatted_address,
    address: hit.formatted_address,
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
    placeId: hit.place_id,
    types: hit.types || [],
  }
}

function merge(clients, google, osm) {
  return clients.map((c) => {
    const o = osm.find((x) => x.externalId === c.externalId) || null
    const g = google[c.externalId] || null
    const osmPoint = o && o.latitude ? { lat: o.latitude, lng: o.longitude } : null
    const gPoint = g && g.lat ? { lat: g.lat, lng: g.lng } : null

    let lat = c.latitude ?? null
    let lng = c.longitude ?? null
    let source = c.latitude != null ? "manuel" : "aucune"
    let confidence = c.latitude != null ? "manuel" : "non-trouve"

    if (gPoint && osmPoint) {
      const km = haversineKm(gPoint, osmPoint)
      if (km <= AGREEMENT_KM) {
        lat = gPoint.lat; lng = gPoint.lng; source = "google+osm"; confidence = "confirme"
      } else {
        lat = gPoint.lat; lng = gPoint.lng; source = "google"; confidence = "divergence"
      }
    } else if (gPoint) {
      lat = gPoint.lat; lng = gPoint.lng; source = "google"; confidence = "google"
    } else if (osmPoint) {
      lat = osmPoint.lat; lng = osmPoint.lng; source = "openstreetmap"
      confidence = o.confiance === "high" ? "osm-fort" : o.confiance === "medium" ? "osm-moyen" : "osm-faible"
    }

    return {
      externalId: c.externalId,
      name: c.name,
      category: c.category,
      phone: c.phone,
      lat: lat == null ? null : +lat.toFixed(6),
      lng: lng == null ? null : +lng.toFixed(6),
      address: g?.address ?? null,
      source,
      confidence,
      divergenceKm: gPoint && osmPoint ? +haversineKm(gPoint, osmPoint).toFixed(3) : null,
      km: lat == null ? null : +haversineKm(CENTRE, { lat, lng }).toFixed(2),
      googleError: g?.error ?? null,
    }
  })
}

async function runGoogle() {
  loadEnv()
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY absente ou vide dans .env — voir .env.example pour la demarche.")
    process.exit(1)
  }
  const clients = await loadClients()
  const cache = readJson(CACHE_FILE)
  let done = 0
  for (const c of clients) {
    if (cache[c.externalId]?.lat) { done++; continue }
    try {
      cache[c.externalId] = await googleGeocode(c, apiKey)
    } catch (e) {
      cache[c.externalId] = { error: "REQUEST_FAILED", query: c.name, message: String(e?.message || e) }
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
    process.stdout.write(`\r${done}/${clients.length} interroges, ${Object.keys(cache).length} en cache   `)
    await new Promise((r) => setTimeout(r, 250))
  }
  const ok = Object.values(cache).filter((v) => v.lat).length
  console.log(`\nTermine : ${ok}/${clients.length} geocodes Google, cache dans data/b2b-google-geocoding.json`)
}

async function runReport() {
  const clients = await loadClients()
  const rows = merge(clients, readJson(CACHE_FILE), readJson(OSM_FILE))
  const counts = rows.reduce((a, r) => ((a[r.confidence] = (a[r.confidence] || 0) + 1), a), {})
  console.log(`\n${rows.length} clients B2B —`, counts)
  const pad = (v, n) => String(v ?? "").padEnd(n)
  console.log(pad("id", 4) + pad("client", 30) + pad("confiance", 14) + pad("source", 16) + pad("km", 7) + "coords")
  for (const r of rows) {
    console.log(pad(r.externalId, 4) + pad(r.name.slice(0, 28), 30) + pad(r.confidence, 14) + pad(r.source, 16)
      + pad(r.km, 7) + (r.lat == null ? "—" : `${r.lat}, ${r.lng}`) + (r.divergenceKm != null ? `  (div ${r.divergenceKm} km)` : ""))
  }
  writeFileSync(join(ROOT, "data", "b2b-merged-coordinates.json"), JSON.stringify(rows, null, 2))
  console.log("\nFusion ecrite dans data/b2b-merged-coordinates.json")
}

async function runApply() {
  if (!process.argv.includes("--yes")) {
    console.error("Refus d'ecrire en base sans --yes. Lancer d'abord : node scripts/geocode-b2b.mjs report")
    process.exit(1)
  }
  const apply = process.argv.includes("--apply-verified")
  const rows = merge(await loadClients(), readJson(CACHE_FILE), readJson(OSM_FILE))
  const targets = apply ? rows.filter((r) => r.confidence === "confirme") : rows.filter((r) => r.lat != null)
  if (!apply && !process.argv.includes("--apply-all")) {
    console.log(`${targets.length} clients ont des coordonnees. Relaver avec --apply-all pour tout ecrire,`)
    console.log("ou --apply-verified pour n'ecrire que les lignes confirmees (Google + OSM concordants).")
    return
  }
  loadEnv()
  const { PrismaClient } = await import("@prisma/client")
  const { Pool } = await import("pg")
  const { PrismaPg } = await import("@prisma/adapter-pg")
  const url = new URL(process.env.DATABASE_URL)
  url.hostname = url.hostname.replace(/-pooler\./, ".")
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url.toString(), max: 2, ssl: { rejectUnauthorized: false } })) })
  let n = 0
  try {
    for (const r of targets) {
      await prisma.b2BClient.update({
        where: { externalId: r.externalId },
        data: { latitude: r.lat, longitude: r.lng, address: r.address, geoSource: r.source, geoConfidence: r.confidence },
      })
      n++
    }
  } finally {
    await prisma.$disconnect()
  }
  console.log(`${n} clients B2B mis a jour.`)
}

const mode = { google: runGoogle, report: runReport, apply: runApply }[MODE]
if (!mode) { console.error(`Mode inconnu : ${MODE}. Attendu : google | report | apply`); process.exit(1) }
await mode()
