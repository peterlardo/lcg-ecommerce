"use client"

import { signOut, useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { formatPrice } from "@/lib/utils"
import type { AppNotification } from "@/hooks/use-notifications"
import {
  type LucideIcon,
  Archive,
  BadgePercent,
  BarChart3,
  Bell,
  Bike,
  Building2,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Factory,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
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

const navGroups = [
  {
    title: "Pilotage",
    icon: LayoutDashboard,
    links: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/rapports", label: "Rapports", icon: BarChart3 },
    ],
  },
  {
    title: "Ventes",
    icon: ShoppingCart,
    links: [
      { href: "/admin/ventes", label: "Ventes", icon: ReceiptText },
      { href: "/admin/tickets", label: "Tickets de vente", icon: TicketCheck },
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/archives", label: "Archives", icon: Archive },
      { href: "/admin/caisse", label: "Caisse", icon: CircleDollarSign },
      { href: "/admin/clients-b2b", label: "Clients B2B", icon: Building2 },
    ],
  },
  {
    title: "Opérations",
    icon: Truck,
    links: [
      { href: "/admin/stock", label: "Stock", icon: Warehouse },
      { href: "/admin/etat-stock", label: "État de stock & caisse", icon: ClipboardCheck },
      { href: "/admin/production", label: "Production", icon: Factory },
      { href: "/admin/lots", label: "Lots", icon: ScanBarcode },
      { href: "/admin/tracabilite", label: "Traçabilité", icon: ScanBarcode },
      { href: "/admin/distribution", label: "Distribution", icon: Truck },
      { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
      { href: "/admin/livreurs", label: "Livreurs", icon: Bike },
    ],
  },
  {
    title: "Catalogue",
    icon: Package,
    links: [
      { href: "/admin/produits", label: "Produits", icon: Package },
      { href: "/admin/promotions", label: "Promotions", icon: BadgePercent },
    ],
  },
  {
    title: "Administration",
    icon: ShieldCheck,
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

interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  children?: NavLink[]
}

// Liens affichés directement dans la barre principale. Un lien peut porter des
// sous-liens (ils s'ouvrent au clic, comme le menu « Plus »).
const priorityLinks: NavLink[] = [
  { href: "/admin/ventes", label: "Ventes", icon: ReceiptText },
  { href: "/admin/tickets", label: "Tickets de caisse", icon: TicketCheck },
  {
    href: "/admin/commandes",
    label: "Commandes",
    icon: ShoppingCart,
    // Un menu avec sous-liens ne navigue pas : la liste des commandes doit y figurer.
    children: [
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/reservations", label: "Pré-commandes", icon: CalendarRange },
      { href: "/admin/archives", label: "Archives", icon: Archive },
    ],
  },
  { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
  { href: "/admin/rapports", label: "Rapports", icon: BarChart3 },
  { href: "/admin/etat-stock", label: "État de stock & caisse", icon: ClipboardCheck },
]
const priorityHrefs = new Set(priorityLinks.flatMap((link) => [link.href, ...(link.children ?? []).map((child) => child.href)]))
const MODULE_ALIASES: Record<string, string> = { livreurs: "livraisons", archives: "commandes" }
const PLUS_INDEX = navGroups.length
const SUBMENU_OFFSET = 100

interface AdminTopNavProps {
  recent: AppNotification[]
  newCount: number
  onMarkAllRead: () => void
}

export function AdminTopNav({ recent, newCount, onMarkAllRead }: AdminTopNavProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [openSide, setOpenSide] = useState<"left" | "right">("left")
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState<string | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const notifRef = useRef<HTMLDivElement | null>(null)

  // Ferme le menu déroulant à la navigation : ajustement d'état pendant le
  // render (pattern React documenté) — évite setState dans un effet.
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    if (openIndex !== null) setOpenIndex(null)
    if (notifOpen) setNotifOpen(false)
    if (mobileOpen) setMobileOpen(false)
  }

  const canSee = (module: string) =>
    session?.user?.role === "ADMIN" ||
    (!session?.user?.permissions?.length && session?.user?.role !== "CUSTOMER") ||
    session?.user?.permissions?.some((permission) => permission.module === module && permission.canView)

  // Certains écrans se pilotent depuis la permission d'un module voisin
  // (les livreurs sont gérés avec le module « livraisons »).
  const moduleOf = (href: string) => {
    const slug = href.split("/")[2]
    return MODULE_ALIASES[slug] ?? slug
  }

  const isLinkActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(href))

  useEffect(() => {
    if (openIndex === null) return
    const onPointerDown = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenIndex(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [openIndex])

  // Fermeture du panneau de notifications (clic extérieur + Échap)
  useEffect(() => {
    if (!notifOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotifOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [notifOpen])

  // Menu mobile : Échap referme, et le défilement de l'arrière-plan est bloqué.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  // Les éléments prioritaires sont affichés directement dans la barre ;
  // tous les autres sont masqués dans le menu « Plus ».
  const plusSections = navGroups
    .map((group) => ({
      title: group.title,
      links: group.links.filter((link) => {
        if (priorityHrefs.has(link.href)) return false
        const activeModule = link.href === "/admin" ? "dashboard" : moduleOf(link.href)
        return canSee(activeModule)
      }),
    }))
    .filter((section) => section.links.length > 0)

  // Sur mobile la barre de liens cède la place à un menu complet : on y liste
  // toutes les entrées (pas seulement celles du menu « Plus »).
  const mobileSections = navGroups
    .map((group) => ({
      title: group.title,
      links: group.links.filter((link) =>
        canSee(link.href === "/admin" ? "dashboard" : moduleOf(link.href)),
      ),
    }))
    .filter((section) => section.links.length > 0)

  return (
    <header ref={navRef} className="sticky top-0 z-40 border-b border-[#123b82] bg-[#16489f] shadow-sm">
      <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-2 sm:gap-x-4 sm:px-4">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <Image
            src="/logo-lcg-white-hd.png"
            alt="LCG"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
          />
        </Link>

        <button
          type="button"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          onClick={() => {
            setMobileOpen((value) => !value)
            setOpenIndex(null)
            setNotifOpen(false)
          }}
          className="rounded-lg p-2.5 text-white/85 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <nav
          aria-label="Menu principal"
          className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 lg:flex"
        >
          {priorityLinks.map((link, linkIndex) => {
            const activeModule = moduleOf(link.href)
            if (!canSee(activeModule)) return null
            const Icon = link.icon
            const active = isLinkActive(link.href)
            const subLinks = (link.children ?? []).filter(
              (child) => canSee(moduleOf(child.href)),
            )
            const activeClass =
              active || subLinks.some((child) => isLinkActive(child.href))
                ? "bg-white text-[#16489f]"
                : "text-white/85 hover:bg-white/10 hover:text-white"
            if (subLinks.length === 0) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors sm:px-4 ${activeClass}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap">{link.label}</span>
                </Link>
              )
            }
            const submenuIndex = SUBMENU_OFFSET + linkIndex
            return (
              <div key={link.href} className="relative shrink-0">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openIndex === submenuIndex}
                  onClick={(event) => {
                    if (openIndex === submenuIndex) {
                      setOpenIndex(null)
                      return
                    }
                    const rect = event.currentTarget.getBoundingClientRect()
                    setOpenSide(rect.left + 220 > window.innerWidth ? "right" : "left")
                    setOpenIndex(submenuIndex)
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors sm:px-4 ${activeClass}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap">{link.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${openIndex === submenuIndex ? "rotate-180" : ""}`}
                  />
                </button>
                {openIndex === submenuIndex && (
                  <div
                    className={`absolute top-full z-50 mt-1.5 w-max min-w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl ${
                      openSide === "right" ? "right-0" : "left-0"
                    }`}
                  >
                    {subLinks.map((child) => {
                      const ChildIcon = child.icon
                      const childActive = isLinkActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenIndex(null)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium transition-colors ${
                            childActive
                              ? "bg-primary-50 text-primary-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <ChildIcon className="h-5 w-5 shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {plusSections.length > 0 && (
            <div className="relative shrink-0">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openIndex === PLUS_INDEX}
                onClick={(event) => {
                  if (openIndex === PLUS_INDEX) {
                    setOpenIndex(null)
                    return
                  }
                  const rect = event.currentTarget.getBoundingClientRect()
                  setOpenSide(rect.left + 270 > window.innerWidth ? "right" : "left")
                  setOpenIndex(PLUS_INDEX)
                }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors sm:px-4 ${
                  openIndex === PLUS_INDEX
                    ? "bg-white text-[#16489f]"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="whitespace-nowrap">Plus</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${openIndex === PLUS_INDEX ? "rotate-180" : ""}`}
                />
              </button>
              {openIndex === PLUS_INDEX && (
                <div
                  className={`absolute top-full z-50 mt-1.5 w-max max-w-[calc(100vw-1.5rem)] min-w-[260px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl ${
                    openSide === "right" ? "right-0" : "left-0"
                  }`}
                >
                  {plusSections.map((section, sectionIndex) => (
                    <div
                      key={section.title}
                      className={sectionIndex > 0 ? "mt-1.5 border-t border-gray-100 pt-1.5" : ""}
                    >
                      <p className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {section.title}
                      </p>
                      {section.links.map((link) => {
                        const Icon = link.icon
                        const active = isLinkActive(link.href)
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpenIndex(null)}
                            className={`flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium transition-colors ${
                              active ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{link.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div ref={notifRef} className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((value) => !value)
                setOpenIndex(null)
              }}
              className="relative rounded-lg p-2.5 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Bell className="h-5 w-5" />
              {newCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {newCount > 99 ? "99+" : newCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl">
                <div className="flex items-center justify-between px-4 pb-1.5 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Notifications</p>
                  {newCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="text-xs font-medium text-[#16489f] hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>
                {recent.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-500">Aucune notification récente.</p>
                )}
                {recent.map((notification) => {
                  const isPrecommande = notification.kind === "precommande"
                  const isVente = notification.kind === "vente"
                  return (
                    <Link
                      key={notification.id}
                      href={notification.href || (isVente ? "/admin/ventes" : isPrecommande ? "/admin/reservations" : "/admin/commandes")}
                      onClick={() => {
                        setNotifOpen(false)
                        onMarkAllRead()
                      }}
                      className="block border-t border-gray-50 px-4 py-2.5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-gray-900">{notification.orderNumber}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isVente
                              ? "bg-emerald-100 text-emerald-700"
                              : isPrecommande
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isVente ? "Vente" : isPrecommande ? "Pré-commande" : "Commande"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {notification.customerName || "Client"} · {formatPrice(notification.total)} ·{" "}
                        {new Date(notification.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[15px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
              {session?.user?.name?.charAt(0) || "U"}
            </div>
            <span className="hidden max-w-[160px] truncate text-white sm:inline">{session?.user?.name}</span>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/personnel" })}
            className="rounded-lg p-2.5 text-white/85 transition-colors hover:bg-white/10 hover:text-red-300"
            title="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && mobileSections.length > 0 && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-white/15 bg-[#16489f] px-2 pb-4 lg:hidden">
          {mobileSections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={sectionIndex > 0 ? "mt-3 border-t border-white/15 pt-3" : "pt-3"}
            >
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {section.title}
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {section.links.map((link) => {
                  const Icon = link.icon
                  const active = isLinkActive(link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                        active
                          ? "bg-white text-[#16489f]"
                          : "text-white/90 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 truncate">{link.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
