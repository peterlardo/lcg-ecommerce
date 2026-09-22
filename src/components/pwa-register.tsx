"use client"

import { useEffect } from "react"

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let cancelled = false
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        if (!cancelled) console.warn("PWA: service worker non enregistre:", err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return null
}