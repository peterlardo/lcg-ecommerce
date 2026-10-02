"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export interface CartItem {
  id: string
  productId: string
  name: string
  image: string
  format: string
  price: number
  quantity: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "quantity">) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  updatePrice: (id: string, price: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
  /** false tant que le panier enregistré n'a pas été relu (premier rendu). */
  hydrated: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  // Panier vide au premier rendu, comme côté serveur (sinon l'affichage diffère entre serveur
  // et navigateur) ; le panier enregistré est relu juste après.
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const raw = window.localStorage.getItem("lcg-cart")
        if (raw) setItems(JSON.parse(raw) as CartItem[])
      } catch {
        // stockage indisponible ou illisible : panier vide
      }
      setHydrated(true)
    }
    void init()
  }, [])

  useEffect(() => {
    // Ne pas écraser le panier enregistré avec le panier vide du premier rendu.
    if (hydrated) window.localStorage.setItem("lcg-cart", JSON.stringify(items))
  }, [items, hydrated])

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    )
  }, [removeItem])

  const updatePrice = useCallback((id: string, price: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id && i.price !== price ? { ...i, price } : i))
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, updatePrice, clearCart, itemCount, subtotal, hydrated }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used within CartProvider")
  return context
}
