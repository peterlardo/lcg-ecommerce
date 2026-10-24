"use client"

import { signOut, useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { formatPrice } from "@/lib/utils"
import { canSeeModule, isCashierRole, isCommercialRole, moduleOfPath } from "@/lib/permissions"
import type { AppNotification } from "@/hooks/use-notifications"
import type { PosModeOverride } from "@/hooks/use-pos-mode"
import {
  type LucideIcon,
  Activity,
  Archive,
  BadgePercent,
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Bike,
  Building2,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Factory,
  FileSignature,
  FileText,
  HandCoins,
  Handshake,
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
  Tags,
  TicketCheck,
  Truck,
  UserPlus,
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
      { href: "/admin/rapport-global", label: "Rapport global", icon: BarChart3 },
    ],
  },
  {
    title: "Ventes",
    icon: ShoppingCart,
    links: [
      { href: "/admin/ventes", label: "Ventes", icon: ReceiptText },
      { href: "/admin/tickets", label: "Tickets de vente", icon: TicketCheck },
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/reservations", label: "Pré-commandes", icon: CalendarRange },
      { href: "/admin/archives", label: "Archives", icon: Archive },
      { href: "/admin/caisse", label: "Caisse", icon: CircleDollarSign },
      { href: "/admin/clients-b2b", label: "Clients B2B", icon: Building2 },
    ],
  },
  {
    title: "Commercial",
    icon: BriefcaseBusiness,
    links: [
      { href: "/admin/commercial", label: "Tableau de bord commercial", icon: BriefcaseBusiness },
      { href: "/admin/nouveau-client", label: "Nouveau client", icon: UserPlus },
      { href: "/admin/devis-b2b", label: "Devis", icon: FileText },
      { href: "/admin/bons-b2b", label: "Factures et livraisons", icon: ReceiptText },
      { href: "/admin/creances", label: "Créances", icon: HandCoins },
      { href: "/admin/encaissements", label: "Encaissements", icon: Banknote },
      { href: "/admin/contrats-b2b", label: "Contrats B2B", icon: FileSignature },
      { href: "/admin/tarifs-b2b", label: "Tarifs B2B", icon: Tags },
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
      { href: "/admin/activite", label: "Journal d'activité", icon: Activity },
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/partenaires", label: "Partenaires", icon: Handshake },
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

// Les menus (navGroups) sont affichés tels quels dans la barre, chacun avec sa liste déroulante :
// il n'y a plus de menu « Plus » qui regroupait le reste.
const newClientLink: NavLink = { href: "/admin/nouveau-client", label: "Nouveau client", icon: UserPlus }

// Les commerciaux et le responsable commercial ont leur propre menu : Pilotage, Ventes et Commercial
// (demande du 2026-10-16). Il remplace le menu général ; les écrans cochés en plus se rangent dans « Plus ».
const commercialLinks: NavLink[] = [
  { href: "/admin/commercial", label: "Tableau de bord commercial", icon: BriefcaseBusiness },
  { href: "/admin/nouveau-client", label: "Nouveau client", icon: UserPlus },
  {
    href: "/admin/clients-b2b",
    label: "Clients",
    icon: Building2,
    children: [
      { href: "/admin/clients-b2b", label: "Clients B2B (zone)", icon: Building2 },
      { href: "/admin/clients", label: "Portefeuille et attribution", icon: Users },
    ],
  },
  { href: "/admin/devis-b2b", label: "Devis", icon: FileText },
  { href: "/admin/bons-b2b", label: "Factures et livraisons", icon: ReceiptText },
  {
    href: "/admin/creances",
    label: "Créances",
    icon: HandCoins,
    children: [
      { href: "/admin/creances", label: "Créances", icon: HandCoins },
      { href: "/admin/encaissements", label: "Encaissements", icon: Banknote },
    ],
  },
  {
    href: "/admin/contrats-b2b",
    label: "Contrats et tarifs",
    icon: FileSignature,
    children: [
      { href: "/admin/contrats-b2b", label: "Contrats", icon: FileSignature },
      { href: "/admin/tarifs-b2b", label: "Tarifs", icon: Tags },
    ],
  },
  { href: "/admin/zone-commerciale", label: "Zone commerciale", icon: Map },
]
// à plat pour le menu du téléphone : un lien à sous-menu y est remplacé par ses sous-liens
const commercialFlatLinks = commercialLinks.flatMap((link) => link.children ?? [link])
// Pilotage des commerciaux : leur tableau de bord est le tableau de bord commercial (le leur), pas le général
const commercialPilotageGroup = {
  title: "Pilotage",
  icon: LayoutDashboard,
  links: [
    { href: "/admin/commercial", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/admin/rapports", label: "Rapports", icon: BarChart3 },
  ],
}
// menu Commercial : le reste du module (le tableau de bord est dans Pilotage)
const commercialModuleLinks = commercialFlatLinks.filter((link) => link.href !== "/admin/commercial")
// Menu Ventes des commerciaux : le menu général, sans l'élément « Ventes » (l'écran de caisse) — 2026-10-16
const commercialVentesGroup = (() => {
  const group = navGroups.find((g) => g.title === "Ventes")!
  // Clients B2B est déjà dans leur menu Commercial
  return { ...group, links: group.links.filter((link) => link.href !== "/admin/ventes" && link.href !== "/admin/clients-b2b") }
})()
// Menus des commerciaux dans la barre : Pilotage, Ventes, Commercial (« Nouveau client » est à part, en accès direct)
const commercialBarGroups = [
  commercialPilotageGroup,
  commercialVentesGroup,
  { title: "Commercial", icon: BriefcaseBusiness, links: commercialModuleLinks.filter((link) => link.href !== newClientLink.href) },
]
// menu du téléphone : les mêmes, « Nouveau client » compris dans le menu Commercial
const commercialGroups = [commercialPilotageGroup, commercialVentesGroup, { title: "Commercial", icon: BriefcaseBusiness, links: commercialModuleLinks }]
const commercialHrefs = new Set(commercialGroups.flatMap((group) => group.links.map((link) => link.href)))
const SUBMENU_OFFSET = 100

interface AdminTopNavProps {
  recent: AppNotification[]
  newCount: number
  onMarkAllRead: () => void
  /** Caisse tactile : barre réduite au logo, aux écrans de vente et à la déconnexion. */
  posMode: boolean
  onPosModeChange: (value: PosModeOverride) => void
}

export function AdminTopNav({ recent, newCount, onMarkAllRead, posMode, onPosModeChange }: AdminTopNavProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [openSide, setOpenSide] = useState<"left" | "right">("left")
  const [notifOpen, setNotifOpen] = useState(false)
  // cloche en rouge tant qu'une livraison est prévue demain
  const hasReminders = recent.some((notification) => notification.kind === "rappel")
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

  // Même règle que les API et l'écran « Utilisateurs » (src/lib/permissions.ts)
  const canSee = (module: string) => canSeeModule(session?.user, module)

  // commerciaux et responsable commercial : menus Pilotage, Ventes, Commercial (demande du 2026-10-16)
  const isCommercial = isCommercialRole(session?.user?.role)
  // Ils gardent, en plus, les écrans que l'administrateur leur a cochés expressément (livraisons, stock…) :
  // leurs menus suivent les leurs dans la barre.
  const granted = (module: string) => (session?.user?.permissions ?? []).some((p) => p.module === module && p.canView)
  const commercialExtras = navGroups
    // ni Pilotage, ni Ventes : les leurs sont à part (sans l'écran de caisse), même si des cases sont cochées
    .filter((group) => group.title !== "Pilotage" && group.title !== "Ventes")
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => !commercialHrefs.has(link.href) && granted(moduleOfPath(link.href))),
    }))
    .filter((group) => group.links.length > 0)
  const groups = isCommercial ? [...commercialGroups, ...commercialExtras] : navGroups
  // « Nouveau client » en accès direct, en tête de la barre : c'est leur geste le plus fréquent sur le terrain.
  const topLinks = isCommercial ? [newClientLink] : []
  const topHrefs = isCommercial ? new Set([newClientLink.href]) : new Set<string>()

  // Certains écrans se pilotent depuis la permission d'un module voisin
  // (les livreurs sont gérés avec le module « livraisons »).
  const moduleOf = moduleOfPath

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

  // Menus de la barre : ceux du menu général (ou, pour les commerciaux, Pilotage, Ventes, Commercial puis ceux
  // des écrans cochés en plus), limités aux écrans que l'utilisateur peut ouvrir.
  const barGroups = (isCommercial ? [...commercialBarGroups, ...commercialExtras] : navGroups)
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => {
        if (topHrefs.has(link.href)) return false
        return canSee(link.href === "/admin" ? "dashboard" : moduleOf(link.href))
      }),
    }))
    .filter((group) => group.links.length > 0)

  // Sur mobile la barre de liens cède la place à un menu complet : on y liste toutes les entrées.
  const mobileSections = groups
    .map((group) => ({
      title: group.title,
      links: group.links.filter((link) =>
        canSee(link.href === "/admin" ? "dashboard" : moduleOf(link.href)),
      ),
    }))
    .filter((section) => section.links.length > 0)

  // Barre de la caisse tactile : les gestes du comptoir, rien d'autre.
  const posLinks = [
    { href: "/admin/caisse", label: "Caisse", icon: CircleDollarSign },
    { href: "/admin/ventes", label: "Ventes", icon: ReceiptText },
  ].filter((link) => isCashierRole(session?.user?.role) || canSee(moduleOf(link.href)))

  return (
    <header ref={navRef} className="sticky top-0 z-40 border-b border-[#123b82] bg-[#16489f] shadow-sm">
      <div className={posMode ? "flex flex-nowrap items-center gap-x-1.5 px-2 py-1.5 sm:gap-x-2 sm:px-3" : "flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1.5 px-2 pb-2 pt-10 sm:gap-x-4 sm:px-4"}>
        <Link href={isCommercial ? "/admin/commercial" : "/admin"} className="flex shrink-0 items-center gap-2">
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
          className={`rounded-lg p-2.5 text-white/85 transition-colors hover:bg-white/10 hover:text-white ${posMode ? "" : "lg:hidden"}`}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {posMode &&
          posLinks.map((link) => {
            const Icon = link.icon
            const active = isLinkActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
                  active ? "bg-white text-[#16489f]" : "text-white/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">{link.label}</span>
              </Link>
            )
          })}

        <nav
          aria-label="Menu principal"
          className={posMode ? "hidden" : "hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 lg:flex"}
        >
          {topLinks.map((link, linkIndex) => {
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
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors ${activeClass}`}
                >
                  <Icon className="hidden h-5 w-5 shrink-0 xl:block" />
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
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors ${activeClass}`}
                >
                  <Icon className="hidden h-5 w-5 shrink-0 xl:block" />
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
                          className={`flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors ${
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

          {barGroups.map((group, groupIndex) => {
            // un menu qui n'a qu'un écran visible est un lien direct
            if (group.links.length === 1) {
              const link = group.links[0]
              const Icon = link.icon
              return (
                <Link
                  key={group.title}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                    isLinkActive(link.href) ? "bg-white text-[#16489f]" : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="hidden h-5 w-5 shrink-0 xl:block" />
                  <span className="whitespace-nowrap">{link.label}</span>
                </Link>
              )
            }
            const GroupIcon = group.icon
            const open = openIndex === groupIndex
            const active = group.links.some((link) => isLinkActive(link.href))
            return (
              <div key={group.title} className="relative shrink-0">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={(event) => {
                    if (open) {
                      setOpenIndex(null)
                      return
                    }
                    const rect = event.currentTarget.getBoundingClientRect()
                    setOpenSide(rect.left + 270 > window.innerWidth ? "right" : "left")
                    setOpenIndex(groupIndex)
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                    open || active ? "bg-white text-[#16489f]" : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <GroupIcon className="hidden h-5 w-5 shrink-0 xl:block" />
                  <span className="whitespace-nowrap">{group.title}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div
                    className={`absolute top-full z-50 mt-1.5 w-max max-w-[calc(100vw-1.5rem)] min-w-[240px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl ${
                      openSide === "right" ? "right-0" : "left-0"
                    }`}
                  >
                    {group.links.map((link) => {
                      const Icon = link.icon
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpenIndex(null)}
                          className={`flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors ${
                            isLinkActive(link.href) ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span>{link.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className={`${posMode ? "ml-auto " : ""}flex shrink-0 items-center gap-1 sm:gap-2`}>
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
              className={`relative rounded-lg p-2.5 transition-colors ${
                hasReminders ? "bg-red-600 text-white hover:bg-red-700" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
              title={hasReminders ? "Livraisons prévues demain" : undefined}
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
                  if (notification.kind === "rappel") {
                    // rappel de la veille : en rouge, en tête de liste
                    return (
                      <Link
                        key={notification.id}
                        href={notification.href || "/admin/commandes"}
                        onClick={() => {
                          setNotifOpen(false)
                          onMarkAllRead()
                        }}
                        className="block border-l-4 border-t border-l-red-600 border-t-red-100 bg-red-50 px-4 py-2.5 transition-colors hover:bg-red-100"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-red-800">{notification.orderNumber}</span>
                          <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            {notification.pickup ? "Retrait demain" : "Livraison demain"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-red-700">
                          {notification.customerName || "Client"} · {formatPrice(notification.total)}
                          {notification.scheduledDate
                            ? ` · ${new Date(notification.scheduledDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Brazzaville" })}`
                            : ""}
                        </p>
                      </Link>
                    )
                  }
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

          {!posMode && (
            <div className="flex items-center gap-2 text-[15px]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                {session?.user?.name?.charAt(0) || "U"}
              </div>
              <span className="hidden max-w-[160px] truncate text-white 2xl:inline">{session?.user?.name}</span>
            </div>
          )}

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
        <div className={`overflow-y-auto overscroll-contain border-t border-white/15 bg-[#16489f] px-2 pb-4 ${posMode ? "max-h-[calc(100dvh-3.5rem)]" : "max-h-[calc(100dvh-4rem)] lg:hidden"}`}>
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
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
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
          <div className="mt-3 border-t border-white/15 pt-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">Affichage</p>
            <button
              type="button"
              onClick={() => {
                onPosModeChange(posMode ? "off" : "on")
                setMobileOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Menu className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate">{posMode ? "Afficher le menu complet" : "Passer en mode caisse"}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
