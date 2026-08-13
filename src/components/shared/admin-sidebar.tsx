"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Factory,
  LayoutDashboard,
  MessageSquare,
  Package,
  ReceiptText,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  TicketCheck,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"

const sidebarGroups = [
  {
    title: "Pilotage",
    links: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/rapports", label: "Rapports", icon: BarChart3 },
    ],
  },
  {
    title: "Ventes",
    links: [
      { href: "/admin/ventes", label: "Ventes", icon: ReceiptText },
      { href: "/admin/tickets", label: "Tickets de vente", icon: TicketCheck },
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/reservations", label: "Pré-commandes", icon: CalendarRange },
      { href: "/admin/caisse", label: "Caisse", icon: CircleDollarSign },
      { href: "/admin/journal-caisse", label: "Journal de caisse", icon: BarChart3 },
    ],
  },
  {
    title: "Opérations",
    links: [
      { href: "/admin/stock", label: "Stock", icon: Warehouse },
      { href: "/admin/production", label: "Production", icon: Factory },
      { href: "/admin/lots", label: "Lots", icon: ScanBarcode },
      { href: "/admin/tracabilite", label: "Traçabilité", icon: ScanBarcode },
      { href: "/admin/distribution", label: "Distribution", icon: Truck },
      { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
    ],
  },
  {
    title: "Catalogue",
    links: [
      { href: "/admin/produits", label: "Produits", icon: Package },
    ],
  },
  {
    title: "Administration",
    links: [
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
      { href: "/admin/utilisateurs/roles", label: "Rôles & permissions", icon: ShieldCheck },
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/controle-distant", label: "Contrôle distant", icon: ShieldCheck },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} relative min-h-screen shrink-0 bg-primary transition-[width] duration-200`}>
      <div className="flex min-h-[65px] items-center border-b border-white/10 p-4">
        <Link href="/admin" className="flex min-w-0 items-center gap-2 font-bold text-primary-foreground">
          <img src="/logo.jpeg" alt="LCG" className="h-7 w-7 shrink-0 rounded-full" />
          <span className={`${collapsed ? "hidden" : "block"} truncate`}>LCG Admin</span>
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Déplier le menu" : "Plier le menu"}
        title={collapsed ? "Déplier le menu" : "Plier le menu"}
        className="absolute -right-3 top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-primary text-primary-foreground shadow-sm transition hover:bg-primary-foreground hover:text-primary"
      >
        <ToggleIcon className="h-3.5 w-3.5" />
      </button>
      <nav className="space-y-4 p-3">
        {sidebarGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className={`px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/40 ${collapsed ? "text-center" : ""}`}>
              {collapsed ? group.title.slice(0, 1) : group.title}
            </p>
            {group.links.map((link) => {
              const Icon = link.icon
              const module = link.href === "/admin" ? "dashboard" : link.href.split("/")[2]
              const canView = session?.user?.role === "ADMIN" || (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") || session?.user?.permissions?.some((permission) => permission.module === module && permission.canView)
              if (!canView) return null
              const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-white/15 text-primary-foreground" : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "hidden" : "block"}>{link.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}







