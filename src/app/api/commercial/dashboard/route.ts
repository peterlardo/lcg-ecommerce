import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { b2bClientScope, clientDisplayName, creanceLines, currentMonth, INVOICE_CREDITS, invoiceSituation, seesAllB2b, type SessionUser } from "@/lib/commercial"

export const dynamic = "force-dynamic"

/** Lecture : gestionnaires + responsable comptable (KPI financiers B2B). */
const READ_ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE"]

const clientNames = { companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } as const

/** Tableau de bord commercial : chiffres du mois, portefeuille, créances, derniers devis et bons de livraison. */
export async function GET() {
  const forbidden = await requireManagementAccess(READ_ALLOWED)
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const user = session?.user as SessionUser
    const selfId = user?.id
    if (!selfId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const prisma = getPrisma()
    const { yearMonth, start, end } = currentMonth()
    const scope = b2bClientScope(user)
    const inScope = { client: { is: scope } }
    const thisMonth = { gte: start, lt: end }

    const [
      ca, target, inProgress, newClients, contractsActive, contractsCreated, encaissements, devisOuverts,
      paiementsPending, promesses, commandesRecues, bonsLivraison, factures, avoirs, recentDevis, recentLivraisons, lines,
    ] = await Promise.all([
      // chiffre d'affaires du mois : bons de commande confirmés, livrés ou facturés
      prisma.b2bDocument.aggregate({
        where: { type: "COMMANDE", status: { in: ["CONFIRMED", "DELIVERED", "INVOICED"] }, createdAt: thisMonth, ...inScope },
        _sum: { total: true },
      }),
      prisma.commercialTarget.findUnique({ where: { userId_yearMonth: { userId: selfId, yearMonth } } }),
      prisma.b2bDocument.count({ where: { type: "COMMANDE", status: { in: ["DRAFT", "SENT"] }, ...inScope } }),
      prisma.client.count({ where: { type: "B2B", createdAt: { gte: start }, ...scope } }),
      prisma.b2bContract.count({ where: { status: "ACTIVE", ...inScope } }),
      prisma.b2bContract.count({ where: { createdAt: thisMonth, ...inScope } }),
      prisma.customerPayment.aggregate({
        where: { validationStatus: "VALIDATED", createdAt: thisMonth, b2bDocument: { is: inScope } },
        _sum: { amount: true },
      }),
      prisma.b2bDocument.count({ where: { type: "DEVIS", status: { in: ["SENT", "CONFIRMED"] }, ...inScope } }),
      prisma.customerPayment.aggregate({
        where: { validationStatus: "PENDING", b2bDocument: { is: inScope } },
        _sum: { amount: true },
      }),
      prisma.paymentPromise.aggregate({ where: { status: "PENDING", b2bDocument: { is: inScope } }, _sum: { amount: true } }),
      prisma.b2bDocument.count({ where: { type: "COMMANDE", status: { not: "CANCELLED" }, ...inScope } }),
      prisma.b2bDocument.count({ where: { type: "LIVRAISON", status: { not: "CANCELLED" }, ...inScope } }),
      prisma.b2bDocument.aggregate({ where: { type: "FACTURE", status: "INVOICED", ...inScope }, _count: { _all: true }, _sum: { total: true } }),
      // avoirs émis : ils viennent en déduction du montant facturé
      prisma.b2bDocument.aggregate({ where: { type: "AVOIR", status: "INVOICED", ...inScope }, _sum: { total: true } }),
      prisma.b2bDocument.findMany({
        where: { type: "DEVIS", ...inScope },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, reference: true, status: true, total: true, createdAt: true, client: { select: clientNames } },
      }),
      prisma.b2bDocument.findMany({
        where: { type: "LIVRAISON", ...inScope },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, reference: true, status: true, total: true, createdAt: true, client: { select: clientNames } },
      }),
      creanceLines(user),
    ])

    // derniers bons de commande et dernières factures (avec leur état de paiement)
    const [recentCommandes, recentFactures] = await Promise.all([
      prisma.b2bDocument.findMany({
        where: { type: "COMMANDE", ...inScope },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, reference: true, status: true, total: true, createdAt: true, client: { select: clientNames } },
      }),
      prisma.b2bDocument.findMany({
        where: { type: "FACTURE", ...inScope },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, reference: true, status: true, total: true, createdAt: true, client: { select: clientNames },
          payments: { select: { amount: true, validationStatus: true } },
          children: INVOICE_CREDITS,
        },
      }),
    ])

    const caMonth = ca._sum.total ?? 0
    const targetAmount = target?.targetAmount ?? 0
    const recent = (rows: typeof recentDevis) =>
      rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, clientName: clientDisplayName(r.client), total: r.total, createdAt: r.createdAt.toISOString() }))
    // état de paiement d'une facture : payée, partiellement payée (reste), non payée, annulée par avoir
    const invoiceRows = recentFactures.map((f) => {
      const s = invoiceSituation(f.total, f.payments, f.children)
      const paymentState = s.credited > 0 && s.due <= 0.005 ? "CANCELLED" : s.balance <= 0.005 ? "PAID" : s.paid > 0 || s.credited > 0 ? "PARTIAL" : "UNPAID"
      return { id: f.id, reference: f.reference, status: f.status, clientName: clientDisplayName(f.client), total: f.total, createdAt: f.createdAt.toISOString(), paymentState, balance: s.balance }
    })

    return NextResponse.json({
      dashboard: {
        month: yearMonth,
        /** true : tout le portefeuille (admin, comptable, superviseur) ; false : les clients du commercial connecté */
        allPortfolio: seesAllB2b(user),
        ca: caMonth,
        target: targetAmount,
        rate: targetAmount > 0 ? Math.round((caMonth / targetAmount) * 1000) / 10 : null,
        inProgress,
        newClients,
        contractsActive,
        contractsCreated,
        encaissements: encaissements._sum.amount ?? 0,
        devisOuverts,
        paiementsPending: paiementsPending._sum.amount ?? 0,
        promesses: promesses._sum.amount ?? 0,
        receivables: Math.round(lines.reduce((s, l) => s + Math.max(0, l.balance), 0) * 100) / 100,
        toRemind: lines.filter((l) => l.overdue).length,
        commandesRecues,
        bonsLivraison,
        facturesCount: factures._count._all,
        facturesMontant: Math.round(((factures._sum.total ?? 0) - (avoirs._sum.total ?? 0)) * 100) / 100,
        avoirsMontant: avoirs._sum.total ?? 0,
        recentDevis: recent(recentDevis),
        recentLivraisons: recent(recentLivraisons),
        recentCommandes: recent(recentCommandes),
        recentFactures: invoiceRows,
      },
    })
  } catch (error) {
    console.error("GET commercial/dashboard error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
