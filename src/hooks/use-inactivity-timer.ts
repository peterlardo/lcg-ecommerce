"use client"

import { useEffect, useRef } from "react"
import { signOut } from "next-auth/react"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000
const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"]

export function useInactivityTimer(enabled = true) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        signOut({ callbackUrl: "/auth/connexion?reason=timeout" })
      }, INACTIVITY_TIMEOUT)
    }

    EVENTS.forEach((event) => document.addEventListener(event, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      EVENTS.forEach((event) => document.removeEventListener(event, resetTimer))
    }
  }, [enabled])
}
