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
  /** nombre de promesses de paiement en cours */
  promisePendingCount: number
  /** reste à recouvrer : total − avoirs − validé − en attente − promis */
  balance: number
  creditLimit: number | null
  /** commercial qui suit le client */
  commercialName: string | null
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
          commercial: { select: { name: true } },
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
      const promisePendingCount = d.promises.filter((p) => p.status === "PENDING").length
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
        promisePendingCount,
        balance,
        creditLimit: d.client?.creditLimit ?? null,
        commercialName: d.client?.commercial?.name ?? null,
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

// ─── AGRÉGATS DE RECOUVREMENT (sous-projet A) ─────────────────
// Tout est calculé depuis les lignes de creanceLines() : une seule source de vérité.
// Aucune requête supplémentaire, aucune écriture.

const DAY_MS = 24 * 60 * 60 * 1000
/** En dessous de ce solde, la facture est considérée soldée. */
const OPEN_BALANCE_MIN = 0.005
/** Tolérance du plafond de crédit (identique à l'écran des créances). */
const LIMIT_TOLERANCE = 0.01

export type CreanceSummary = {
  /** total à recevoir */
  totalBalance: number
  /** part échue */
  overdueBalance: number
  /** part non encore échue */
  notYetDueBalance: number
  /** factures ouvertes (solde > 0,005) */
  openInvoices: number
  /** clients débiteurs distincts */
  debtorClients: number
  /** montant promis, en cours */
  promisePendingAmount: number
  /** nombre de promesses en cours */
  promisePendingCount: number
  /** clients dont l'encours dépasse le plafond défini */
  clientsOverLimit: number
  /** somme des plafonds définis des clients débiteurs */
  creditLimitTotal: number
}

export type AgingBucketKey = "not_due" | "d1_30" | "d31_60" | "d61_90" | "d90_plus"

/** Facture d'une tranche de la balance âgée. */
export type AgingLine = {
  id: string
  reference: string
  clientName: string
  balance: number
  dueDate: string
  /** 0 pour une facture non échue */
  daysLate: number
}

export type AgingBucket = {
  key: AgingBucketKey
  label: string
  balance: number
  /** nombre de factures de la tranche */
  count: number
  /** nombre de clients distincts de la tranche */
  clients: number
  /** détail des factures, du plus ancien retard au plus récent */
  lines: AgingLine[]
}

export type ClientCreance = {
  clientId: string
  clientName: string
  balance: number
  overdueBalance: number
  /** 0 si aucun retard */
  oldestOverdueDays: number
  creditLimit: number | null
  overLimit: boolean
  openInvoices: number
  /** plus petite échéance des factures ouvertes */
  nextDueDate: string | null
  commercialName: string | null
}

const AGING_BUCKETS: { key: AgingBucketKey; label: string }[] = [
  { key: "not_due", label: "Non échu" },
  { key: "d1_30", label: "1 à 30 j" },
  { key: "d31_60", label: "31 à 60 j" },
  { key: "d61_90", label: "61 à 90 j" },
  { key: "d90_plus", label: "+ 90 j" },
]

/**
 * Retard d'une facture en jours. 0 si elle n'est pas échue (le champ `overdue` fait foi),
 * au minimum 1 dès qu'elle est échue : une facture en retard ne peut pas tomber dans « Non échu ».
 */
export function creanceDaysLate(line: CreanceLine, now: Date = new Date()): number {
  if (!line.overdue) return 0
  return Math.max(1, Math.floor((now.getTime() - new Date(line.dueDate).getTime()) / DAY_MS))
}

function agingKeyOf(line: CreanceLine, now: Date): AgingBucketKey {
  const days = creanceDaysLate(line, now)
  if (days <= 0) return "not_due"
  if (days <= 30) return "d1_30"
  if (days <= 60) return "d31_60"
  if (days <= 90) return "d61_90"
  return "d90_plus"
}

/** Factures qui comptent dans les agrégats : solde strictement positif. */
const openLines = (lines: CreanceLine[]) => lines.filter((line) => line.balance > OPEN_BALANCE_MIN)
const sumBalances = (lines: CreanceLine[]) => round2(lines.reduce((sum, line) => sum + Math.max(0, line.balance), 0))
const distinctClients = (lines: CreanceLine[]) =>
  new Set(lines.map((line) => line.clientId).filter((id): id is string => id !== null)).size

/** Balance âgée par échéance : les cinq tranches sont toujours renvoyées, même vides. */
export function creanceAging(lines: CreanceLine[], now: Date = new Date()): AgingBucket[] {
  const open = openLines(lines)
  return AGING_BUCKETS.map(({ key, label }) => {
    const rows = open.filter((line) => agingKeyOf(line, now) === key)
    return {
      key,
      label,
      balance: sumBalances(rows),
      count: rows.length,
      clients: distinctClients(rows),
      lines: rows
        .map((line) => ({
          id: line.id,
          reference: line.reference,
          clientName: line.clientName,
          balance: round2(Math.max(0, line.balance)),
          dueDate: line.dueDate,
          daysLate: creanceDaysLate(line, now),
        }))
        .sort((a, b) => b.daysLate - a.daysLate),
    }
  })
}

/** Encours par client (factures ouvertes seulement), du plus gros encours au plus petit. */
export function creanceByClient(lines: CreanceLine[], now: Date = new Date()): ClientCreance[] {
  const groups = new Map<string, CreanceLine[]>()
  for (const line of openLines(lines)) {
    if (!line.clientId) continue
    const rows = groups.get(line.clientId)
    if (rows) rows.push(line)
    else groups.set(line.clientId, [line])
  }
  return [...groups.entries()]
    .map(([clientId, rows]) => {
      const balance = sumBalances(rows)
      const overdueRows = rows.filter((line) => line.overdue)
      const creditLimit = rows.find((line) => line.creditLimit !== null)?.creditLimit ?? null
      return {
        clientId,
        clientName: rows[0].clientName,
        balance,
        overdueBalance: sumBalances(overdueRows),
        oldestOverdueDays: overdueRows.reduce((max, line) => Math.max(max, creanceDaysLate(line, now)), 0),
        creditLimit,
        overLimit: creditLimit !== null && balance > creditLimit + LIMIT_TOLERANCE,
        openInvoices: rows.length,
        nextDueDate: rows.reduce<string | null>(
          (min, line) => (!min || new Date(line.dueDate).getTime() < new Date(min).getTime() ? line.dueDate : min),
          null,
        ),
        commercialName: rows.find((line) => line.commercialName !== null)?.commercialName ?? null,
      }
    })
    .sort((a, b) => b.balance - a.balance || a.clientName.localeCompare(b.clientName, "fr"))
}

/** Résumé de recouvrement : les KPI du bandeau de l'écran des créances. */
export function creanceSummary(lines: CreanceLine[], now: Date = new Date()): CreanceSummary {
  const open = openLines(lines)
  const totalBalance = sumBalances(open)
  const overdueBalance = sumBalances(open.filter((line) => line.overdue))
  const byClient = creanceByClient(lines, now)
  return {
    totalBalance,
    overdueBalance,
    notYetDueBalance: round2(totalBalance - overdueBalance),
    openInvoices: open.length,
    debtorClients: distinctClients(open),
    promisePendingAmount: round2(lines.reduce((sum, line) => sum + line.promisePending, 0)),
    promisePendingCount: lines.reduce((sum, line) => sum + line.promisePendingCount, 0),
    clientsOverLimit: byClient.filter((client) => client.overLimit).length,
    creditLimitTotal: round2(byClient.reduce((sum, client) => sum + (client.creditLimit ?? 0), 0)),
  }
}
