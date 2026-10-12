import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { formatPrice } from "@/lib/utils"

// Journal d'activité : liste chronologique consolidée de ce que font les
// utilisateurs. Réservé à l'ADMIN. Deux origines complémentaires :
//  - les tables opérationnelles (mouvements de stock, commandes, sessions de
//    caisse, livraisons, connexions) : elles couvrent tout l'historique passé ;
//  - la table ActivityLog (module ≠ "auth") : les actions journalisées par le
//    code (changements de statut, affectations, modifications, suppressions).
// On exclut les lignes "auth" d'ActivityLog pour ne pas doubler les connexions
// déjà lues depuis LoginLog.

const CATEGORIES = [
  { key: "vente", label: "Ventes" },
  { key: "commande", label: "Commandes" },
  { key: "stock", label: "Stock & production" },
  { key: "caisse", label: "Caisse" },
  { key: "livraison", label: "Livraisons" },
  { key: "connexion", label: "Connexions" },
  { key: "journal", label: "Autres actions" },
] as const

const MOVEMENT_CATEGORY: Record<string, string> = {
  SALE: "vente",
  PRODUCTION: "stock",
  ADJUSTMENT_IN: "stock",
  ADJUSTMENT_OUT: "stock",
  TRANSFER_IN: "stock",
  TRANSFER_OUT: "stock",
  RETURN: "stock",
  LOSS: "stock",
}

const MOVEMENT_LABEL: Record<string, string> = {
  SALE: "Vente",
  PRODUCTION: "Production",
  ADJUSTMENT_IN: "Entrée de stock",
  ADJUSTMENT_OUT: "Sortie de stock",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  RETURN: "Retour",
  LOSS: "Perte",
}

const MODULE_CATEGORY: Record<string, string> = {
  ventes: "vente",
  commandes: "commande",
  stock: "stock",
  production: "stock",
  lots: "stock",
  "etat-stock": "stock",
  tracabilite: "stock",
  caisse: "caisse",
  livraisons: "livraison",
  distribution: "livraison",
}

const LOGIN_LABEL: Record<string, string> = {
  SUCCESS: "Connexion",
  FAILED: "Échec de connexion",
  LOGOUT: "Déconnexion",
  BLOCKED: "Connexion refusée (compte déjà ouvert ailleurs)",
}

const SOURCE_LABEL: Record<string, string> = {
  WEB: "En ligne",
  OPERATOR: "Opérateur",
  CAISSE: "Caisse",
  RESERVATION: "Pré-commande",
}

interface ActivityEvent {
  id: string
  date: string
  userId: string | null
  userName: string | null
  category: string
  action: string
  detail: string
  reference: string | null
  href: string | null
}

export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden

  try {
    const prisma = getPrisma()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")?.trim() || ""
    const category = searchParams.get("category")?.trim() || ""
    const from = searchParams.get("from")?.trim() || ""
    const to = searchParams.get("to")?.trim() || ""
    const q = searchParams.get("q")?.trim().toLowerCase() || ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const perPage = Math.min(200, Math.max(10, Number(searchParams.get("perPage")) || 50))

    // Brazzaville : UTC+1, sans heure d'été (le serveur, lui, est en UTC)
    const after: Date | undefined = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00+01:00`) : undefined
    const before: Date | undefined = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999+01:00`) : undefined
    const range = after || before ? { gte: after, lte: before } : undefined
    const inRange = (d: Date | null | undefined): boolean => {
      if (!d) return false
      if (after && d < after) return false
      if (before && d > before) return false
      return true
    }

    const [movements, orders, sessions, deliveries, logins, logs, users] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { ...(range ? { createdAt: range } : {}), ...(userId ? { userId } : {}) },
        select: {
          id: true,
          type: true,
          quantity: true,
          reason: true,
          reference: true,
          userId: true,
          createdAt: true,
          user: { select: { name: true } },
          variant: { select: { format: true, product: { select: { name: true } } } },
          pointOfSale: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.order.findMany({
        where: { ...(range ? { createdAt: range } : {}), ...(userId ? { userId } : {}) },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          total: true,
          source: true,
          userId: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.cashSession.findMany({
        where: userId ? { openedById: userId } : {},
        select: {
          id: true,
          openedById: true,
          openedAt: true,
          closedAt: true,
          openingBalance: true,
          closingBalance: true,
          reportReference: true,
          openedBy: { select: { name: true } },
          pointOfSale: { select: { name: true } },
        },
        orderBy: { openedAt: "desc" },
        take: 500,
      }),
      prisma.delivery.findMany({
        where: userId ? { agent: { userId } } : {},
        select: {
          id: true,
          assignedAt: true,
          deliveredAt: true,
          status: true,
          address: true,
          city: true,
          agent: { select: { name: true, userId: true } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { id: "desc" },
        take: 500,
      }),
      prisma.loginLog.findMany({
        where: { ...(range ? { createdAt: range } : {}), ...(userId ? { userId } : {}) },
        select: {
          id: true,
          userId: true,
          email: true,
          status: true,
          deviceName: true,
          ip: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.activityLog.findMany({
        where: { ...(range ? { createdAt: range } : {}), ...(userId ? { userId } : {}), NOT: { module: "auth" } },
        select: {
          id: true,
          userId: true,
          module: true,
          action: true,
          entity: true,
          entityId: true,
          summary: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
    ])

    const events: ActivityEvent[] = []

    for (const m of movements) {
      const product = m.variant?.product?.name ?? "Produit"
      const fmt = m.variant?.format ? ` (${m.variant.format})` : ""
      const pos = m.pointOfSale?.name ? ` · ${m.pointOfSale.name}` : ""
      events.push({
        id: `mv-${m.id}`,
        date: m.createdAt.toISOString(),
        userId: m.userId ?? null,
        userName: m.user?.name ?? null,
        category: MOVEMENT_CATEGORY[m.type] ?? "stock",
        action: MOVEMENT_LABEL[m.type] ?? m.type,
        detail: `${m.quantity} × ${product}${fmt}${pos}${m.reason ? ` · ${m.reason}` : ""}`,
        reference: m.reference ?? null,
        href: MOVEMENT_CATEGORY[m.type] === "vente" ? "/admin/ventes" : "/admin/stock",
      })
    }

    for (const o of orders) {
      events.push({
        id: `or-${o.id}`,
        date: o.createdAt.toISOString(),
        userId: o.userId ?? null,
        userName: o.user?.name ?? null,
        category: "commande",
        action: "Commande créée",
        detail: `${o.orderNumber} · ${o.customerName || "Client"} · ${formatPrice(o.total)} · ${SOURCE_LABEL[o.source] ?? o.source}`,
        reference: o.orderNumber,
        href: `/admin/commandes`,
      })
    }

    for (const s of sessions) {
      const pos = s.pointOfSale?.name ?? "Point de vente"
      if (inRange(s.openedAt)) {
        events.push({
          id: `cs-open-${s.id}`,
          date: s.openedAt.toISOString(),
          userId: s.openedById ?? null,
          userName: s.openedBy?.name ?? null,
          category: "caisse",
          action: "Ouverture de caisse",
          detail: `${pos} · fond de caisse ${formatPrice(s.openingBalance)}`,
          reference: null,
          href: "/admin/caisse",
        })
      }
      if (s.closedAt && inRange(s.closedAt)) {
        events.push({
          id: `cs-close-${s.id}`,
          date: s.closedAt.toISOString(),
          userId: s.openedById ?? null,
          userName: s.openedBy?.name ?? null,
          category: "caisse",
          action: "Fermeture de caisse",
          detail: `${pos} · solde ${formatPrice(s.closingBalance ?? 0)}${s.reportReference ? ` · ${s.reportReference}` : ""}`,
          reference: s.reportReference ?? null,
          href: "/admin/caisse",
        })
      }
    }

    for (const d of deliveries) {
      const ref = d.order?.orderNumber ?? "Commande"
      const place = `${d.address}${d.city ? `, ${d.city}` : ""}`
      const agentUserId = d.agent?.userId ?? null
      const agentName = d.agent?.name ?? null
      if (d.assignedAt && inRange(d.assignedAt)) {
        events.push({
          id: `dl-assign-${d.id}`,
          date: d.assignedAt.toISOString(),
          userId: agentUserId,
          userName: agentName,
          category: "livraison",
          action: "Livraison affectée",
          detail: `${ref} · ${place}${agentName ? ` · ${agentName}` : ""}`,
          reference: ref,
          href: "/admin/livraisons",
        })
      }
      if (d.deliveredAt && inRange(d.deliveredAt)) {
        events.push({
          id: `dl-deliver-${d.id}`,
          date: d.deliveredAt.toISOString(),
          userId: agentUserId,
          userName: agentName,
          category: "livraison",
          action: "Livraison livrée",
          detail: `${ref} · ${place}${agentName ? ` · ${agentName}` : ""}`,
          reference: ref,
          href: "/admin/livraisons",
        })
      }
    }

    for (const l of logins) {
      events.push({
        id: `lg-${l.id}`,
        date: l.createdAt.toISOString(),
        userId: l.userId ?? null,
        userName: l.user?.name ?? l.email ?? null,
        category: "connexion",
        action: LOGIN_LABEL[l.status] ?? l.status,
        detail: `${l.email ?? l.user?.name ?? "Utilisateur"}${l.deviceName ? ` · ${l.deviceName}` : ""}${l.ip ? ` · ${l.ip}` : ""}`,
        reference: null,
        href: "/admin/utilisateurs",
      })
    }

    for (const a of logs) {
      events.push({
        id: `ac-${a.id}`,
        date: a.createdAt.toISOString(),
        userId: a.userId,
        userName: a.user?.name ?? null,
        category: MODULE_CATEGORY[a.module] ?? "journal",
        action: `${a.module} · ${a.action}`,
        detail: a.summary ?? `${a.module} · ${a.action}`,
        reference: a.entityId ?? null,
        href: null,
      })
    }

    const filtered = events
      .filter((e) => (category ? e.category === category : true))
      .filter((e) =>
        q
          ? `${e.userName ?? ""} ${e.action} ${e.detail} ${e.reference ?? ""}`.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    const total = filtered.length
    const start = (page - 1) * perPage
    const pageEvents = filtered.slice(start, start + perPage)

    return NextResponse.json({
      events: pageEvents,
      total,
      page,
      perPage,
      categories: CATEGORIES,
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    })
  } catch (error) {
    console.error("GET activite error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
