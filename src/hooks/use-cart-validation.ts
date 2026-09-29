"use client"

import { useEffect, useRef } from "react"
import { useCart } from "@/contexts/cart-context"

interface CatalogueVariant {
  id: string
  price?: number
  promoPrice?: number | null
}

interface CatalogueProduct {
  id: string
  variants?: CatalogueVariant[]
}

/**
 * Vérifie au montage que chaque article du panier existe encore dans le
 * catalogue (/api/produits) : retire les références obsolètes et
 * resynchronise les prix (prix catalogue + promotion active).
 */
export function useCartValidation(onRemoved?: (names: string[]) => void) {
  const { items, removeItem, updatePrice } = useCart()
  const itemsRef = useRef(items)
  const onRemovedRef = useRef(onRemoved)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    onRemovedRef.current = onRemoved
  }, [onRemoved])

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/produits")
        if (!res.ok) return
        const data = await res.json()
        const products: CatalogueProduct[] = Array.isArray(data)
          ? data
          : Array.isArray((data as { products?: unknown })?.products)
            ? ((data as { products: CatalogueProduct[] }).products)
            : []
        if (products.length === 0) return

        const valid = new Set<string>()
        const prices = new Map<string, number>()
        for (const p of products) {
          for (const v of p.variants ?? []) {
            valid.add(String(v.id))
            if (typeof v.price === "number") {
              prices.set(String(v.id), v.promoPrice ?? v.price)
            }
          }
        }

        const stale = itemsRef.current.filter((i) => !valid.has(String(i.id)))
        if (stale.length > 0) {
          stale.forEach((i) => removeItem(i.id))
          onRemovedRef.current?.(stale.map((s) => `${s.name} (${s.format})`))
        }

        for (const i of itemsRef.current) {
          if (stale.some((s) => s.id === i.id)) continue
          const cataloguePrice = prices.get(String(i.id))
          if (cataloguePrice !== undefined && cataloguePrice !== i.price) {
            updatePrice(i.id, cataloguePrice)
          }
        }
      } catch {
        // catalogue indisponible : on laisse le panier tel quel
      }
    }
    void init()
  }, [removeItem, updatePrice])
}
