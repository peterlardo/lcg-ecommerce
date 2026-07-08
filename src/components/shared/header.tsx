"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/contexts/cart-context"
import { ShoppingCart, Menu, X, Shield } from "lucide-react"
import { useState } from "react"

const navLinks = [
  { href: "/produits", label: "Nos produits" },
  { href: "/professionnels", label: "Professionnels" },
  { href: "/zones-livraison", label: "Livraison" },
  { href: "/a-propos", label: "Qui sommes-nous" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
]

const adminLink = { href: "/admin", label: "Admin", icon: Shield }

export function Header() {
  const pathname = usePathname()
  const { itemCount } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/logo-lcg.jpeg"
            alt="Logo LCG — La Congolaise des Glaçons"
            width="40"
            height="40"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="leading-tight">
            <span className="block font-display text-lg font-bold tracking-tight text-primary">LCG</span>
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
              La Congolaise des Glaçons
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold transition-colors hover:text-primary ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
          <Link
            href={adminLink.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground/60 transition-colors hover:text-primary"
          >
            <Shield className="h-3.5 w-3.5" />
            {adminLink.label}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/panier"
            className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Panier</span>
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-primary-foreground bg-destructive rounded-full">
                {itemCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="lg:hidden border-t border-border bg-background shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 text-sm font-semibold rounded-lg ${
                  pathname === link.href
                    ? "text-primary bg-muted"
                    : "text-muted-foreground hover:text-primary hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-border" />
            <Link
              href="/panier"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-primary"
            >
              <ShoppingCart className="h-4 w-4" />
              Panier
            </Link>
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground/60 hover:text-primary"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
