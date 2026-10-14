import type { Prisma } from "@prisma/client"
import { getPrisma } from "./prisma"
import { B2B_SCOPE_USERS } from "./b2b"
import { COMMERCIAL_MANAGER_ROLE } from "./permissions"

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
  return (!!role && (B2B_SCOPE_USERS as readonly string[]).includes(role)) || role === COMMERCIAL_MANAGER_ROLE || user?.supervisesB2b === true
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

/** « AAAA-MM-JJ » (jour à Brazzaville) → premier instant de ce jour ; null si la date est invalide. */
export function localDayStart(ymd: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? "")
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - TZ_OFFSET_MS)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Jour à Brazzaville d'un instant, au format « AAAA-MM-JJ ». */
export function localDay(date: Date): string {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10)
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Avoirs d'une facture : documents AVOIR non annulés qui lui sont rattachés. */
export const INVOICE_CREDITS = { where: { type: "AVOIR" as const, status: { not: "CANCELLED" as const } }, select: { total: true } }

/**
 * Situation d'une facture. Seuls les règlements validés comptent comme payés ; un règlement refusé ne compte pas.
 * `open` : ce qui peut encore être réglé ou crédité (total − avoirs − validé − en attente).
 */
export function invoiceSituation(total: number, payments: { amount: number; validationStatus: string }[], credits: { total: number }[]) {
  const sum = (status: string) => payments.filter((p) => p.validationStatus === status).reduce((s, p) => s + p.amount, 0)
  const credited = round2(credits.reduce((s, c) => s + c.total, 0))
  const paid = round2(sum("VALIDATED"))
  const pending = round2(sum("PENDING"))
  const due = round2(Math.max(0, total - credited))
  return { credited, paid, pending, due, balance: round2(Math.max(0, due - paid)), open: round2(Math.max(0, due - paid - pending)) }
}

export interface CreanceLine {
  id: string
  reference: string
  clientId: string | null
  clientName: string
  total: number
  /** avoirs émis sur la facture */
  credited: number
  /** règlements validés */
  paid: number
  /** règlements saisis, en attente de validation */
  pendingAmount: number
  /** promesses de paiement en cours */
  promisePending: number
  /** reste à recouvrer : total − avoirs − validé − en attente − promis */
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
      children: INVOICE_CREDITS,
    },
  })

  return docs
    .map((d) => {
      const situation = invoiceSituation(d.total, d.payments, d.children)
      const promisePending = d.promises.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0)
      const days = Math.max(0, d.client?.b2bContracts[0]?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS)
      const due = new Date(d.createdAt.getTime() + days * 24 * 60 * 60 * 1000)
      const balance = round2(situation.open - promisePending)
      const lastReminder = d.reminders.reduce<Date | null>((max, r) => (!max || r.createdAt > max ? r.createdAt : max), null)
      return {
        id: d.id,
        reference: d.reference,
        clientId: d.clientId,
        clientName: clientDisplayName(d.client),
        total: d.total,
        credited: situation.credited,
        paid: situation.paid,
        pendingAmount: situation.pending,
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
