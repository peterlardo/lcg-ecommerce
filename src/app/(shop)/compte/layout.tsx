"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useCart } from "@/contexts/cart-context"
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  MapPin,
  Settings,
  ShoppingCart,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/compte", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/compte/produits", label: "Nos produits", icon: ShoppingBag, exact: false },
  { href: "/compte/commandes", label: "Mes commandes", icon: Package, exact: false },
  { href: "/compte/adresses", label: "Mes adresses", icon: MapPin, exact: false },
  { href: "/compte/parametres", label: "Paramètres", icon: Settings, exact: false },
]

export default function CompteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { itemCount } = useCart()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Mobile header bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-white/90 backdrop-blur-md px-4 py-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="font-display text-sm font-bold text-[#1f4fa3]">LCG Clients</span>
        <Link href="/panier" className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-border px-6 py-5">
            <img
              src="/logo-lcg.jpeg"
              alt="LCG"
              className="h-11 w-11 rounded-full object-cover ring-2 ring-[#1f4fa3]/20"
            />
            <div>
              <h1 className="font-display text-base font-bold text-[#1f4fa3]">LCG Clients</h1>
              <p className="text-[11px] text-gray-400">La Congolaise des Glaçons</p>
            </div>
          </div>

          {/* User info */}
          {session?.user && (
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1f4fa3] to-[#163a72] text-sm font-bold text-white">
                  {(session.user.name || session.user.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{session.user.name || "Client"}</p>
                  <p className="truncate text-xs text-gray-400">{session.user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href, item.exact)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? "bg-[#1f4fa3] text-white shadow-md shadow-[#1f4fa3]/25"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-white" : "text-gray-400"}`} />
                    {item.label}
                    {item.href === "/compte/produits" && itemCount > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {itemCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Quick actions */}
          <div className="border-t border-border px-3 py-4">
            <Link
              href="/panier"
              className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm font-semibold text-gray-500 transition-all hover:border-[#1f4fa3]/30 hover:bg-[#1f4fa3]/5 hover:text-[#1f4fa3]"
            >
              <ShoppingCart className="h-5 w-5" />
              Mon panier
              {itemCount > 0 && (
                <span className="ml-auto rounded-full bg-[#1f4fa3] px-2 py-0.5 text-[10px] font-bold text-white">
                  {itemCount} article{itemCount > 1 ? "s" : ""}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
            >
              <LogOut className="h-5 w-5" />
              Déconnexion
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
