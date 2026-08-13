"use client"

import { SessionProvider } from "next-auth/react"
import { CartProvider } from "@/contexts/cart-context"
import { ToastProvider } from "@/contexts/toast-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <ToastProvider>{children}</ToastProvider>
      </CartProvider>
    </SessionProvider>
  )
}
