"use client"

import { useEffect } from "react"

/** Au plus un signal de vie par ce délai (la session se libère après SESSION_IDLE_MS sans signal). */
const PING_EVERY_MS = 2 * 60 * 1000
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"]

/**
 * Prévient le serveur qu'une personne utilise réellement le poste. Sans cela, le compte est libéré
 * pour une connexion ailleurs après SESSION_IDLE_MS : un onglet oublié ne bloque plus le compte.
 */
export function useActivityPing(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    let last = 0
    const ping = () => {
      if (document.visibilityState === "hidden") return
      const now = Date.now()
      if (now - last < PING_EVERY_MS) return
      last = now
      void fetch("/api/session-ping", { method: "POST", keepalive: true }).catch(() => {})
    }
    EVENTS.forEach((event) => document.addEventListener(event, ping, { passive: true }))
    ping()
    return () => EVENTS.forEach((event) => document.removeEventListener(event, ping))
  }, [enabled])
}
