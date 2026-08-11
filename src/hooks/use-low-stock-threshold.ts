"use client"

import { useState, useEffect } from "react"

const STORAGE_KEY = "lowStockThreshold"
const DEFAULT_THRESHOLD = 10

export function useLowStockThreshold(): [number, (value: number) => void] {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setThreshold(Number(saved) || DEFAULT_THRESHOLD)
  }, [])

  const update = (value: number) => {
    const clamped = Math.max(1, value)
    setThreshold(clamped)
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }

  return [threshold, update]
}
