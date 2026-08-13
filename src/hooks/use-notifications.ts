"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface Notification {
  id: string
  orderNumber: string
  customerName: string
  status: string
  total: number
  createdAt: string
  source: string
}

export function useNotifications(pollInterval = 15000) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const seenIds = useRef(new Set<string>())
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const res = await fetch("/api/notifications")
        if (!res.ok) return
        const data: Notification[] = await res.json()
        if (!active) return

        const fresh = data.filter((n) => !seenIds.current.has(n.id))
        if (fresh.length > 0 && seenIds.current.size > 0) {
          setNotifications((prev) => [...fresh, ...prev].slice(0, 10))
          setNewCount((c) => c + fresh.length)
        }
        data.forEach((n) => seenIds.current.add(n.id))
      } catch {}
    }

    check()
    const timer = setInterval(check, pollInterval)
    return () => { active = false; clearInterval(timer) }
  }, [pollInterval])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => { setNotifications([]); setNewCount(0) }, [])

  return { notifications, newCount, dismiss, dismissAll }
}
