import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { CASHIER_ROLES, isCashierRole } from "@/lib/permissions"
import { b2bClientScope, clientDisplayName, currentMonth, localDay, localDayStart, seesAllB2b, type SessionUser } from "@/lib/commercial"
import { RECEIPT_METHODS } from "@/lib/payment-methods"

export const dynamic = "force-dynamic"

// Journal des encaissements : tous les règlements reçus sur les factures B2B, sur une période.
// Les ventes au comptoir n'y figurent pas : elles sont payées au moment du ticket (voir Caisse, Tickets).

const ALLOWED = ["ADMIN", "COMMERCIAL", "COMPTABLE", ...CASHIER_ROLES]
const STATUSES = ["PENDING", "VALIDATED", "REJECTED"]
const MAX_ROWS = 500
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const forbidden = await requireManagementAccess(ALLOWED, [["encaissements"], "view"])
  if (forbidden) return forbidden

  try {
    const session = await auth()
    const user = session?.user as SessionUser
    const url = new URL(req.url)

    // période : du premier au dernier jour inclus (jours de Brazzaville), mois en cours par défaut
    const month = currentMonth()
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")
    const from = fromParam ? localDayStart(fromParam) : month.start
    const toDay = toParam ? localDayStart(toParam) : null
    const to = toParam ? (toDay ? new Date(toDay.getTime() + DAY_MS) : null) : month.end
    if (!from || !to || to <= from) return NextResponse.json({ error: "Période invalide" }, { status: 400 })
    if (to.getTime() - from.getTime() > 400 * DAY_MS) return NextResponse.json({ error: "Période trop longue (13 mois au plus)" }, { status: 400 })

    const method = (url.searchParams.get("method") ?? "").toUpperCase()
    if (method && !(RECEIPT_METHODS as readonly string[]).includes(method)) return NextResponse.json({ error: "Moyen de règlement invalide" }, { status: 400 })
    const status = (url.searchParams.get("status") ?? "").toUpperCase()
    if (status && !STATUSES.includes(status)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    const q = url.searchParams.get("q")?.trim().slice(0, 80) ?? ""

    // la caisse valide les règlements de tout le portefeuille ; un commercial ne voit que ceux de ses clients
    const scope: Prisma.B2bDocumentWhereInput = seesAllB2b(user) || isCashierRole(user?.role) ? {} : { client: { is: b2bClientScope(user) } }
    const where: Prisma.CustomerPaymentWhereInput = {
      createdAt: { gte: from, lt: to },
      b2bDocument: {
        is: {
          ...scope,
          ...(q
            ? {
                OR: [
                  { reference: { contains: q, mode: "insensitive" } },
                  { client: { is: { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { tradeName: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }] } } },
                ],
              }
            : {}),
        },
      },
      ...(method ? { method: method as Prisma.CustomerPaymentWhereInput["method"] } : {}),
    }
    const listWhere: Prisma.CustomerPaymentWhereInput = { ...where, ...(status ? { validationStatus: status as Prisma.CustomerPaymentWhereInput["validationStatus"] } : {}) }

    const prisma = getPrisma()
    const [rows, count, byStatus, byMethod] = await Promise.all([
      prisma.customerPayment.findMany({
        where: listWhere,
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
        select: {
          id: true, amount: true, method: true, reference: true, bank: true, notes: true, validationStatus: true, validatedAt: true, rejectReason: true,
          receivedById: true, validatedById: true, createdAt: true,
          proofs: { select: { id: true, fileName: true, mimeType: true }, orderBy: { createdAt: "asc" } },
          b2bDocument: { select: { id: true, reference: true, client: { select: { companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true } } } },
        },
      }),
      prisma.customerPayment.count({ where: listWhere }),
      // totaux de la période (tous statuts, quel que soit le filtre de statut) : sert aux cartes du haut
      prisma.customerPayment.groupBy({ by: ["validationStatus"], where, _sum: { amount: true }, _count: { _all: true } }),
      prisma.customerPayment.groupBy({ by: ["method"], where: { ...where, validationStatus: "VALIDATED" }, _sum: { amount: true }, _count: { _all: true } }),
    ])

    const people = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.flatMap((r) => [r.receivedById, r.validatedById]).filter((x): x is string => Boolean(x)))] } },
      select: { id: true, name: true, email: true },
    })
    const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name || people.find((p) => p.id === id)?.email || null : null)
    const round2 = (n: number) => Math.round(n * 100) / 100
    const statusTotal = (s: string) => byStatus.find((g) => g.validationStatus === s)

    return NextResponse.json({
      period: { from: localDay(from), to: localDay(new Date(to.getTime() - 1)) },
      payments: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        amount: r.amount,
        method: r.method,
        reference: r.reference,
        bank: r.bank,
        notes: r.notes,
        proofs: r.proofs,
        validationStatus: r.validationStatus,
        validatedAt: r.validatedAt?.toISOString() ?? null,
        rejectReason: r.rejectReason,
        receivedBy: nameOf(r.receivedById),
        validatedBy: nameOf(r.validatedById),
        invoice: r.b2bDocument ? { id: r.b2bDocument.id, reference: r.b2bDocument.reference } : null,
        clientName: clientDisplayName(r.b2bDocument?.client),
      })),
      count,
      truncated: count > rows.length,
      totals: {
        validated: round2(statusTotal("VALIDATED")?._sum.amount ?? 0),
        validatedCount: statusTotal("VALIDATED")?._count._all ?? 0,
        pending: round2(statusTotal("PENDING")?._sum.amount ?? 0),
        pendingCount: statusTotal("PENDING")?._count._all ?? 0,
        rejected: round2(statusTotal("REJECTED")?._sum.amount ?? 0),
        rejectedCount: statusTotal("REJECTED")?._count._all ?? 0,
        byMethod: byMethod.map((g) => ({ method: g.method, amount: round2(g._sum.amount ?? 0), count: g._count._all })),
      },
      // seuls l'administrateur et la caisse valident ou refusent un règlement saisi par un commercial
      canValidate: user?.role === "ADMIN" || isCashierRole(user?.role),
    })
  } catch (error) {
    console.error("GET encaissements error:", error)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
