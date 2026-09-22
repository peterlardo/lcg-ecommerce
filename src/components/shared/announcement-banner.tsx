"use client"

import { useCallback, useEffect, useState } from "react"

interface Announcement {
  id: string
  message: string
  tone: string
  expiresAt: string | null
  createdAt: string
}

const TONE_CLASSES: Record<string, string> = {
  danger: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-600 text-white",
}

const DISMISSED_KEY = "dismissed-announcements"

function getDismissed(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function markDismissed(id: string) {
  const current = getDismissed()
  if (!current.includes(id)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, id]))
  }
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as Announcement[]
      const dismissed = getDismissed()
      setAnnouncements(data.filter((a) => !dismissed.includes(a.id)))
    } catch {
      // ignore network errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/announcements", { cache: "no-store", signal: controller.signal })
        if (!res.ok) return
        const data = (await res.json()) as Announcement[]
        const dismissed = getDismissed()
        if (!controller.signal.aborted) setAnnouncements(data.filter((a) => !dismissed.includes(a.id)))
      } catch {
        // ignore network errors
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    const interval = setInterval(load, 60_000)
    return () => {
      controller.abort()
      window.removeEventListener("focus", onFocus)
      clearInterval(interval)
    }
  }, [load])

  const dismiss = (id: string) => {
    markDismissed(id)
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }

  if (loading || announcements.length === 0) return null

  return (
    <div className="space-y-2">
      {announcements.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium shadow-sm ${
            TONE_CLASSES[a.tone] ?? TONE_CLASSES.danger
          }`}
          role="alert"
        >
          <span className="flex-1 whitespace-pre-wrap break-words">{a.message}</span>
          <button
            onClick={() => dismiss(a.id)}
            aria-label="Fermer"
            className="shrink-0 rounded-md p-1 opacity-80 transition-colors hover:bg-black/10 hover:opacity-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
