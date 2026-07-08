"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useCart } from "@/contexts/cart-context"
import { Menu, X, ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"

const navLinks = [
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isHome = pathname === "/"
  const transparent = isHome && !scrolled

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        transparent
          ? "bg-transparent"
          : "bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-lcg.jpeg" alt="Logo LCG — La Congolaise des Glaçons" className="h-9 w-auto" />
            <div className="flex flex-col">
              <span className={`text-sm font-bold leading-tight ${transparent ? "text-white" : "text-gray-900"}`}>LCG</span>
              <span className={`text-[10px] leading-tight ${transparent ? "text-white/70" : "text-gray-500"}`}>La Congolaise des Glaçons</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    transparent
                      ? isActive ? "text-white bg-white/15" : "text-white/80 hover:text-white hover:bg-white/10"
                      : isActive ? "text-blue-600 bg-blue-50" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
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
              className={`relative text-sm font-medium transition-colors ${
                transparent
                  ? "text-white/80 hover:text-white"
                  : "text-gray-600 hover:text-blue-600"
              } ${itemCount > 0 ? "pr-4" : ""}`}
            >
              Panier
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-600 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            {session?.user ? (
              <div className="relative group">
                <button className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  transparent ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-blue-600"
                }`}>
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
              <Link
                href="/auth/connexion"
                className={`text-sm font-medium transition-colors ${
                  transparent
                    ? "text-white/80 hover:text-white"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                Connexion
              </Link>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${
                transparent ? "text-white/80 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-blue-600"
              }`}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav className="lg:hidden border-t border-gray-100 bg-white shadow-lg">
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
            <Link href="/panier" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-blue-600">
              Panier
            </Link>
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
