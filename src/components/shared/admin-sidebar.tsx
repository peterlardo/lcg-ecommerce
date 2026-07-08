"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  BarChart3,
  Settings,
  Warehouse,
  CalendarRange,
  MessageSquare,
} from "lucide-react"

const sidebarLinks = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/admin/stock", label: "Stock", icon: Warehouse },
  { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
  { href: "/admin/reservations", label: "Réservations", icon: CalendarRange },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/rapports", label: "Rapports", icon: BarChart3 },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-primary min-h-screen">
      <div className="p-4 border-b border-white/10">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-primary-foreground">
          <img src="/logo.jpeg" alt="LCG" className="h-7 w-auto rounded-full" />
          <span>LCG Admin</span>
        </Link>
      </div>
      <nav className="p-3 space-y-1">
        {sidebarLinks.map((link) => {
          const Icon = link.icon
          const isActive =
            pathname === link.href ||
            (link.href !== "/admin" && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-white/15 text-primary-foreground"
                  : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
