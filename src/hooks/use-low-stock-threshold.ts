"use client"

import { useState } from "react"

const STORAGE_KEY = "lowStockThreshold"
const DEFAULT_THRESHOLD = 10

export function useLowStockThreshold(): [number, (value: number) => void] {
  const [threshold, setThreshold] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_THRESHOLD
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved ? Number(saved) || DEFAULT_THRESHOLD : DEFAULT_THRESHOLD
    } catch {
      return DEFAULT_THRESHOLD
    }
  })

  const update = (value: number) => {
    const clamped = Math.max(1, value)
    setThreshold(clamped)
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }

  return [threshold, update]
}
