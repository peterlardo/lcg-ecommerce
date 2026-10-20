"use client"

import { useEffect } from "react"

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
      return
    }
    let cancelled = false
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return
        void reg.update()
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // nouvelle version prete : on recharge pour servir les nouveaux chunks
              window.location.reload()
            }
          })
        })
      })
      .catch((err) => {
        if (!cancelled) console.warn("PWA: service worker non enregistre:", err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return null
}