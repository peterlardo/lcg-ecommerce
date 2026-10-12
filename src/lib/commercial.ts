import type { Prisma } from "@prisma/client"
import { getPrisma } from "./prisma"
import { B2B_SCOPE_USERS } from "./b2b"

// ─── ESPACE COMMERCIAL B2B ────────────────────────────────────
// Règles communes au tableau de bord commercial, aux créances et aux encaissements
// (portage du module « commercial » de lcgapp3).

/** Brazzaville : UTC+1, sans heure d'été. Le serveur tourne en UTC. */
const TZ_OFFSET_MS = 60 * 60 * 1000

/** Délai de règlement appliqué quand le client n'a pas de contrat actif. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 30

export type SessionUser = { id?: string; role?: string; supervisesB2b?: boolean } | null | undefined

/** Admin, comptable ou superviseur : tout le portefeuille. Sinon le commercial ne voit que ses clients. */
export function seesAllB2b(user: SessionUser): boolean {
  const role = user?.role
  return (!!role && (B2B_SCOPE_USERS as readonly string[]).includes(role)) || user?.supervisesB2b === true
}

/** Filtre « clients de la portée » à poser sur la relation `client` d'un document ou d'un contrat. */
export function b2bClientScope(user: SessionUser): Prisma.ClientWhereInput {
  return seesAllB2b(user) ? {} : { commercialId: user?.id ?? "__aucun__" }
}

type ClientNames = { companyName?: string | null; tradeName?: string | null; contactName?: string | null; firstName?: string | null; lastName?: string | null }

/** Nom d'affichage d'un client : raison sociale, enseigne, contact, puis prénom et nom. */
export function clientDisplayName(client: ClientNames | null | undefined): string {
  if (!client) return "Client"
  return client.companyName || client.tradeName || client.contactName || `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Client"
}

/** Mois en cours à Brazzaville : « AAAA-MM », premier instant du mois et du mois suivant. */
export function currentMonth(now: Date = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MS)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth()
  return {
    yearMonth: `${year}-${String(month + 1).padStart(2, "0")}`,
    start: new Date(Date.UTC(year, month, 1) - TZ_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - TZ_OFFSET_MS),
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface CreanceLine {
  id: string
  reference: string
  clientId: string | null
  clientName: string
  total: number
  /** règlements validés */
  paid: number
  /** règlements saisis, en attente de validation */
  pendingAmount: number
  /** promesses de paiement en cours */
  promisePending: number
  /** reste à recouvrer : total − validé − en attente − promis */
  balance: number
  creditLimit: number | null
  paymentTermsDays: number
  dueDate: string
  overdue: boolean
  createdAt: string
  reminderCount: number
  lastReminderAt: string | null
}

/**
 * Créances de la portée : factures B2B émises (FACTURE, INVOICED) qui ne sont pas soldées,
 * ou qui ont encore un règlement à valider. De la plus ancienne à la plus récente.
 */
export async function creanceLines(user: SessionUser, now: Date = new Date()): Promise<CreanceLine[]> {
  const docs = await getPrisma().b2bDocument.findMany({
    where: { type: "FACTURE", status: "INVOICED", clientId: { not: null }, client: { is: b2bClientScope(user) } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reference: true,
      clientId: true,
      total: true,
      createdAt: true,
      client: {
        select: {
          companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true, creditLimit: true,
          b2bContracts: { where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" }, take: 1, select: { paymentTermsDays: true } },
        },
      },
      payments: { select: { amount: true, validationStatus: true } },
      promises: { select: { amount: true, status: true } },
      reminders: { select: { createdAt: true } },
    },
  })

  return docs
    .map((d) => {
      const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0)
      const paid = sum(d.payments.filter((p) => p.validationStatus === "VALIDATED"))
      const pendingAmount = sum(d.payments.filter((p) => p.validationStatus === "PENDING"))
      const promisePending = sum(d.promises.filter((p) => p.status === "PENDING"))
      const days = Math.max(0, d.client?.b2bContracts[0]?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS)
      const due = new Date(d.createdAt.getTime() + days * 24 * 60 * 60 * 1000)
      const balance = round2(d.total - paid - pendingAmount - promisePending)
      const lastReminder = d.reminders.reduce<Date | null>((max, r) => (!max || r.createdAt > max ? r.createdAt : max), null)
      return {
        id: d.id,
        reference: d.reference,
        clientId: d.clientId,
        clientName: clientDisplayName(d.client),
        total: d.total,
        paid: round2(paid),
        pendingAmount: round2(pendingAmount),
        promisePending: round2(promisePending),
        balance,
        creditLimit: d.client?.creditLimit ?? null,
        paymentTermsDays: days,
        dueDate: due.toISOString(),
        overdue: balance > 0 && due < now,
        createdAt: d.createdAt.toISOString(),
        reminderCount: d.reminders.length,
        lastReminderAt: lastReminder?.toISOString() ?? null,
      }
    })
    .filter((line) => line.balance > 0.005 || line.pendingAmount > 0)
}
