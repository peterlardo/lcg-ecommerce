"use client"

import { useEffect, useSyncExternalStore } from "react"

// ─── MODE CAISSE (POS) ────────────────────────────────────────
// L'administration doit s'adapter seule au poste : sur une caisse tactile (écran bas, pas de
// souris) la barre se réduit à l'essentiel, sur un ordinateur elle reste complète.
//
// Détection : un appareil purement tactile se reconnaît à « pas de survol » ET « pointeur grossier ».
// Un portable à écran tactile garde un pointeur fin : il n'est donc PAS mis en mode caisse.
// La détection peut se tromper (caisse tactile branchée sur grand écran, fenêtre réduite sur PC) :
// on peut forcer un mode avec l'adresse `?pos=1` / `?pos=0`, retenu ensuite dans le navigateur.

const OVERRIDE_KEY = "lcg-pos-mode"
const OVERRIDE_EVENT = "lcg-pos-mode"
const TOUCH_ONLY_QUERY = "(hover: none) and (pointer: coarse)"

export type PosModeOverride = "on" | "off" | null

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  const query = window.matchMedia(TOUCH_ONLY_QUERY)
  query.addEventListener("change", callback)
  window.addEventListener("resize", callback)
  window.addEventListener(OVERRIDE_EVENT, callback)
  return () => {
    query.removeEventListener("change", callback)
    window.removeEventListener("resize", callback)
    window.removeEventListener(OVERRIDE_EVENT, callback)
  }
}

function storedOverride(): PosModeOverride {
  if (typeof window === "undefined") return null
  const fromUrl = new URLSearchParams(window.location.search).get("pos")
  if (fromUrl === "1" || fromUrl === "on") return "on"
  if (fromUrl === "0" || fromUrl === "off") return "off"
  const stored = window.localStorage.getItem(OVERRIDE_KEY)
  return stored === "on" || stored === "off" ? stored : null
}

function isPosSnapshot(): boolean {
  if (typeof window === "undefined") return false
  const override = storedOverride()
  if (override) return override === "on"
  try {
    return window.matchMedia(TOUCH_ONLY_QUERY).matches
  } catch {
    return false
  }
}

/** Force (ou libère) le mode caisse ; le choix est retenu dans le navigateur. */
export function setPosModeOverride(value: PosModeOverride) {
  if (typeof window === "undefined") return
  if (value === null) window.localStorage.removeItem(OVERRIDE_KEY)
  else window.localStorage.setItem(OVERRIDE_KEY, value)
  window.dispatchEvent(new Event(OVERRIDE_EVENT))
}

/**
 * `posMode` est vrai sur une caisse tactile ; `setOverride` permet de forcer un mode à la main.
 * Le rendu serveur part toujours du mode complet : pas de décalage à l'hydratation.
 */
export function usePosMode() {
  const posMode = useSyncExternalStore(subscribe, isPosSnapshot, () => false)

  // Un `?pos=…` dans l'adresse devient le réglage retenu, puis disparaît de l'adresse.
  useEffect(() => {
    if (typeof window === "undefined") return
    const fromUrl = new URLSearchParams(window.location.search).get("pos")
    if (fromUrl !== "1" && fromUrl !== "on" && fromUrl !== "0" && fromUrl !== "off") return
    setPosModeOverride(fromUrl === "1" || fromUrl === "on" ? "on" : "off")
    const url = new URL(window.location.href)
    url.searchParams.delete("pos")
    window.history.replaceState(null, "", url.toString())
  }, [])

  return { posMode, setOverride: setPosModeOverride }
}
