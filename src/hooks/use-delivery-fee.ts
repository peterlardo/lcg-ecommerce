"use client"

import { useEffect, useState } from "react"

interface DeliverySettings {
  deliveryFee?: number
  freeDeliveryThreshold?: number
}

export function useDeliveryFee(subtotal: number) {
  const [settings, setSettings] = useState<DeliverySettings>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.delivery || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const fee = settings.deliveryFee ?? 0
  const threshold = settings.freeDeliveryThreshold ?? 0
  const isFree = threshold > 0 && subtotal >= threshold

  return {
    deliveryFee: isFree ? 0 : fee,
    isFreeDelivery: isFree,
    threshold,
    loading,
  }
}
