"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useCart } from "@/contexts/cart-context"
import { ShoppingCart, Menu, X, ChevronDown } from "lucide-react"
import { useState } from "react"

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/produits", label: "Nos produits" },
  { href: "/professionnels", label: "Professionnels" },
  { href: "/zones-livraison", label: "Livraison" },
  { href: "/a-propos", label: "Qui sommes-nous" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
]

export function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { itemCount } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-lcg.jpeg" alt="LCG — La Congolaise des Glaçons" className="h-9 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 hover:text-blue-600 hover:bg-blue-50/50"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/panier"
              className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Panier</span>
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            {session?.user ? (
              <div className="relative group">
                <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                    {session.user.name?.charAt(0) || "U"}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1.5">
                    <Link href="/compte" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Mes commandes</Link>
                    <Link href="/compte/parametres" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Paramètres</Link>
                    {(session.user as any)?.role !== "CUSTOMER" && (
                      <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Administration</Link>
                    )}
                    <hr className="my-1" />
                    <button onClick={() => signOut()} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Déconnexion</button>
                  </div>
                </div>
              </div>
            ) : (
              <Link href="/auth/connexion" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                Connexion
              </Link>
            )}

            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 text-gray-600 hover:text-blue-600">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav className="lg:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 text-sm font-medium rounded-lg ${
                  pathname === link.href
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2" />
            {session?.user ? (
              <button onClick={() => signOut()} className="block w-full text-left px-3 py-2.5 text-sm text-red-600">Déconnexion</button>
            ) : (
              <Link href="/auth/connexion" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-blue-600">Connexion</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
