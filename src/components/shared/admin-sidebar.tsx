"use client"

import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  BarChart3,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Factory,
  LayoutDashboard,
  Map,
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
  X,
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
      { href: "/admin/clients-b2b", label: "Clients B2B", icon: Building2 },
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
      { href: "/admin/zone-commerciale", label: "Zone commerciale", icon: Map },
      { href: "/admin/controle-distant", label: "Contrôle distant", icon: ShieldCheck },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    ],
  },
]

const STORAGE_KEY = "lcg-sidebar-collapsed-groups"

function loadCollapsedGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function AdminSidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => loadCollapsedGroups())
  const [prevPathname, setPrevPathname] = useState<string | null>(null)
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft

  // Toujours déplier le groupe contenant la page active (au montage et à la navigation).
  // Ajustement d'état pendant le render (pattern React documenté) : évite setState synchrone dans un effet.
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    const activeGroup = sidebarGroups.find((group) =>
      group.links.some((link) => pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))),
    )
    if (activeGroup && collapsedGroups[activeGroup.title]) {
      setCollapsedGroups((prev) => {
        const next = { ...prev, [activeGroup.title]: false }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
    }
  }

  useEffect(() => {
    onMobileClose?.()
  }, [pathname, onMobileClose])

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const renderNav = () => (
    <nav className="space-y-4 p-3">
      {sidebarGroups.map((group) => {
        const isGroupCollapsed = !!collapsedGroups[group.title]
        // Filtre visibilité selon permissions (masque groupe vide)
        const visibleLinks = group.links.filter((link) => {
          const activeModule = link.href === "/admin" ? "dashboard" : link.href.split("/")[2]
          return session?.user?.role === "ADMIN" || (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") || session?.user?.permissions?.some((permission) => permission.module === activeModule && permission.canView)
        })
        if (visibleLinks.length === 0) return null
        return (
          <div key={group.title} className="space-y-1">
            <button
              type="button"
              onClick={() => {
                if (!collapsed) toggleGroup(group.title)
              }}
              disabled={collapsed}
              aria-expanded={!isGroupCollapsed}
              aria-label={collapsed ? group.title : `${isGroupCollapsed ? "Déplier" : "Replier"} ${group.title}`}
              className={`flex w-full items-center gap-1 rounded-md px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/40 transition-colors ${collapsed ? "cursor-default justify-center" : "hover:bg-white/5 hover:text-primary-foreground/60"}`}
            >
              <span className={collapsed ? "text-center" : "flex-1 text-left"}>{collapsed ? group.title.slice(0, 1) : group.title}</span>
              {!collapsed && <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : "rotate-0"}`} />}
            </button>
            <div className={`${!collapsed && isGroupCollapsed ? "hidden" : "block"} space-y-1`}>
              {group.links.map((link) => {
                const Icon = link.icon
                const activeModule = link.href === "/admin" ? "dashboard" : link.href.split("/")[2]
                const canView = session?.user?.role === "ADMIN" || (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") || session?.user?.permissions?.some((permission) => permission.module === activeModule && permission.canView)
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
          </div>
        )
      })}
    </nav>
  )

  return (
    <>
      <aside className={`${collapsed ? "w-20" : "w-64"} relative min-h-screen shrink-0 bg-primary transition-[width] duration-200 max-md:hidden`}>
        <div className="flex min-h-[65px] items-center border-b border-white/10 p-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-2 font-bold text-primary-foreground">
            <Image src="/logo.jpeg" alt="LCG" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full" />
            <span className={`${collapsed ? "hidden" : "block"} truncate`}>LCG Gestion des Ventes</span>
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
        {renderNav()}
      </aside>
    </>
  )
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => loadCollapsedGroups())
  const [prevPathname, setPrevPathname] = useState<string | null>(null)
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null)

  // Toujours déplier le groupe contenant la page active (au montage et à la navigation).
  // Ajustement d'état pendant le render (pattern React documenté) : évite setState synchrone dans un effet.
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    const activeGroup = sidebarGroups.find((group) =>
      group.links.some((link) => pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))),
    )
    if (activeGroup && collapsedGroups[activeGroup.title]) {
      setCollapsedGroups((prev) => {
        const next = { ...prev, [activeGroup.title]: false }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
    }
  }

  // Re-synchroniser l'état replié depuis le localStorage à l'ouverture du tiroir
  if (open && prevOpen !== open) {
    setPrevOpen(open)
    setCollapsedGroups(loadCollapsedGroups())
  }

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-primary transition-transform duration-300 md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex min-h-[65px] items-center justify-between border-b border-white/10 p-4">
          <Link href="/admin" onClick={onClose} className="flex min-w-0 items-center gap-2 font-bold text-primary-foreground">
            <Image src="/logo.jpeg" alt="LCG" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full" />
            <span className="truncate">LCG Gestion des Ventes</span>
          </Link>
          <button onClick={onClose} className="rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-4 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 65px)" }}>
          {sidebarGroups.map((group) => {
            const isGroupCollapsed = !!collapsedGroups[group.title]
            const visibleLinks = group.links.filter((link) => {
              const activeModule = link.href === "/admin" ? "dashboard" : link.href.split("/")[2]
              return session?.user?.role === "ADMIN" || (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") || session?.user?.permissions?.some((permission) => permission.module === activeModule && permission.canView)
            })
            if (visibleLinks.length === 0) return null
            return (
              <div key={group.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={!isGroupCollapsed}
                  className="flex w-full items-center gap-1 rounded-md px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/40 transition-colors hover:bg-white/5 hover:text-primary-foreground/60"
                >
                  <span className="flex-1 text-left">{group.title}</span>
                  <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : "rotate-0"}`} />
                </button>
                <div className={`${isGroupCollapsed ? "hidden" : "block"} space-y-1`}>
                  {group.links.map((link) => {
                    const Icon = link.icon
                    const activeModule = link.href === "/admin" ? "dashboard" : link.href.split("/")[2]
                    const canView = session?.user?.role === "ADMIN" || (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") || session?.user?.permissions?.some((permission) => permission.module === activeModule && permission.canView)
                    if (!canView) return null
                    const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-white/15 text-primary-foreground" : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </div>
    </>
  )
}
