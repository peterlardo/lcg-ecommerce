"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useCart } from "@/contexts/cart-context"
import { ShoppingCart, Menu, X, User, LogOut, Package, Settings } from "lucide-react"
import { useState } from "react"

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/produits", label: "Produits" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
]

export function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { itemCount } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <img src="/logo.jpeg" alt="LCG" className="h-8 w-auto" />
              <span className="hidden sm:inline">LCG</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === link.href
                      ? "text-primary-700 bg-primary-50"
                      : "text-gray-500 hover:text-primary-600 hover:bg-primary-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/panier"
              className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-primary-500 hover:text-primary-600 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Panier</span>
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary-500 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            {session?.user ? (
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-primary-500 transition-colors">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{session.user.name}</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1">
                    <Link
                      href="/compte"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Package className="h-4 w-4" />
                      Mes commandes
                    </Link>
                    <Link
                      href="/compte/parametres"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="h-4 w-4" />
                      Paramètres
                    </Link>
                    {(session.user as any)?.role !== "CUSTOMER" && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4" />
                        Administration
                      </Link>
                    )}
                    <hr className="my-1" />
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/auth/connexion"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
              >
                Connexion
              </Link>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-primary-600"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 text-sm font-medium rounded-md ${
                  pathname === link.href
                    ? "text-primary-700 bg-primary-50"
                    : "text-gray-500 hover:text-primary-600 hover:bg-primary-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
