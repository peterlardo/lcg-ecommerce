# Vue recouvrement des créances (sous-projet A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à l'écran `/admin/creances` une vue de pilotage du recouvrement (bandeau de 6 KPI, balance âgée, encours par client) calculée sur les mêmes données que la liste existante, sans aucune écriture ni changement de schéma.

**Architecture:** Les agrégats sont des **fonctions pures** ajoutées à `src/lib/commercial.ts` (le module qui alimente déjà la liste des créances), exportées telles quelles : `creanceSummary`, `creanceAging`, `creanceByClient`. La route existante `GET /api/commercial/creances` (même chemin, même garde, même portée) renvoie trois clés supplémentaires (`summary`, `aging`, `byClient`) et rien d'autre ne change. La page `src/app/(admin)/admin/creances/page.tsx` reçoit ces clés et affiche un bandeau de KPI + 3 onglets ; les onglets « Balance âgée » et « Par client » sont en lecture seule.

**Tech Stack:** Next.js 16.2.12, React 19.2.4, Prisma 7.9.1, Neon Postgres (production), Tailwind 4, next-auth v5 beta. Aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-10-17-creances-vue-recouvrement-design.md` (commit `a251d0e`).

## Décisions de plan (précisions apportées au spec)

1. **Le détail par tranche vient du serveur.** Le spec (§5) déclare `AgingBucket = { key, label, balance, count, clients }` et (§7) exige « sous la colonne le détail des factures de la tranche » sans préciser d'où vient ce détail. Le plan ajoute une clé **additive** `lines` à chaque tranche (`{ id, reference, clientName, balance, dueDate, daysLate }[]`). Cela évite de réimplémenter la règle de tranche dans le navigateur (le spec interdit la duplication de la règle de solde, même logique) et supprime tout écart de frontière de jour entre le serveur et l'affichage.
2. **Une facture échue depuis moins de 24 h va dans « 1 à 30 j ».** Le spec (§5.1) définit `daysLate = floor((now − dueDate) / 86 400 000)` et ne couvre pas `daysLate === 0` alors que `overdue === true`. Le plan retient `daysLate = overdue ? max(1, floor(...)) : 0` : une ligne en retard ne peut jamais tomber dans « Non échu » (sinon l'invariant Σ tranches = total serait rompu).
3. **Les types de la page sont importés en `import type`.** La page est un composant client ; `import type { CreanceSummary, AgingBucket, ClientCreance } from "@/lib/commercial"` est effacé à la compilation (aucun bundle Prisma côté navigateur), ce qui évite de dupliquer les contrats.
4. **`total` de la réponse reste inchangé** et doit rester égal à `summary.totalBalance` (mêmes arrondis) — vérifié par test.

## Global Constraints

- **Lire `node_modules/next/dist/docs/`** avant d'écrire du code Next.js (règle `AGENTS.md` du repo : version de Next modifiée par rapport aux connaissances d'entraînement).
- Vérification obligatoire : `node node_modules/typescript/bin/tsc --noEmit` → **0 erreur** ; `npx eslint` ciblé sur les fichiers touchés → **aucun problème nouveau**. (Baseline connue et préexistante : ~28 problèmes dans `src/app/(admin)/admin/page.tsx`, non concerné ici.)
- **Aucun changement de schéma Prisma, aucune migration, aucune écriture en base.** La base Neon visée est la **PRODUCTION**.
- Ne pas toucher aux fichiers d'une **session concurrente** : `prisma/schema.prisma`, `src/app/(admin)/admin/utilisateurs/page.tsx`, `src/app/api/utilisateurs/[id]/route.ts`, `src/lib/auth.ts`, `src/lib/device-session.ts`, `prisma/session-limit-migration.sql`, `dev-current.log`.
- `COMMERCIAL` n'est pas dans `MANAGEMENT_ROLES` → la route doit garder sa liste explicite `["ADMIN", "COMMERCIAL", "COMPTABLE"]` (aucune modification de garde dans ce sous-projet).
- Contraintes POS (l'application tourne sur un terminal de caisse) : cibles tactiles ≥ 44 px (`min-h-11`), aucune action dépendant du survol, tableaux scrollables horizontalement.
- Devise FCFA via `formatPrice` (déjà importé dans la page) ; arrondis à 2 décimales ; aucun texte en anglais.
- Commandes PowerShell : quoter les chemins contenant `(admin)` → `git add "src/app/(admin)/admin/creances/page.tsx"`. Pas de `head`/`tail` (`Select-Object -Last`, `Select-String`).
- Scripts de test = **jetables** `scripts/tmp-*.mjs` (gitignorés) : jamais committés. Les commits ne contiennent que les fichiers source.
- Convention de commit du repo : **une ligne, en français, sans accentu** (ex. `feat(creances): agregats de recouvrement`).
- Jeton de test forgé : `encode({ token: { id, sub, role }, secret: NEXTAUTH_SECRET, salt: "authjs.session-token" })` sur http (cookie `__Secure-authjs.session-token` en https) ; `NEXTAUTH_SECRET` lu dans `.env` **sans guillemets** ; `DATABASE_URL` pour Node **sans `-pooler.`**.
- Le serveur de dev doit tourner sur :3000 (PID actuel 18440) pour les tests HTTP. Ne pas lancer `npm run build` ni `npm run deploy` (déploiement uniquement à la demande de l'utilisateur).

## Faits vérifiés en base (production, 2026-10-17)

- Rôles : 4 ADMIN, 4 STOCK_MANAGER, 3 CAISSIERE, **2 COMMERCIAL**, 1 RESPONSABLE_COMMERCIAL, 1 OPERATEUR_ACCUEIL, 1 DELIVERY_AGENT, 1 CUSTOMER, 1 PRODUCTION, 1 COMPTABLE.
- Comptes COMMERCIAL : `dorcas@lcg.cg` (`cmv5485rz001e01s6h2qfwjzu`, « Maba Dorcas », `supervisesB2b = false`) et `erica@lcg.cg` (`cmv545p7z000i01s6zqysmz3p`, « Sompila Debora Erica »).
- Clients : 104 au total, **103 sans commercial** (`commercialId = null`), **1 rattaché à dorcas** ; erica n'a aucun client.
- Factures `FACTURE` + `INVOICED` : **4**, toutes rattachées à un client.
- Conséquence pour les tests de portée : ADMIN voit tout, **dorcas** ne voit que son client, **erica** ne voit rien (agrégats à zéro).

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `src/lib/commercial.ts` | Règles et agrégats des créances (module serveur) | **Modifier** : 2 champs sur `CreanceLine`, 1 colonne au `select`, 3 types + 3 helpers purs |
| `src/app/api/commercial/creances/route.ts` | Endpoint lecture des créances | **Modifier** : ajouter `summary`, `aging`, `byClient` à la réponse |
| `src/app/(admin)/admin/creances/page.tsx` | Écran `/admin/creances` (client) | **Modifier** : bandeau de 6 KPI + 3 onglets + filtre client |
| `scripts/tmp-creances-helpers.mjs` | Tests purs (jetable, gitignoré) | **Créer** |
| `scripts/tmp-creances-api.mjs` | Tests HTTP + portée (jetable, gitignoré) | **Créer** |

## Review Focus

Ces cas ne sont couverts par aucun test automatisé du repo (pas de framework de test) — chacun est poussé dans le script jetable de la tâche qui possède le code :

1. **Facture soldée avec un règlement en attente de validation** (`balance = 0`, `pendingAmount > 0`) → exclue de la balance âgée ET de l'encours par client (ni montant, ni compteur), mais toujours présente dans `creances`/`count` ; sinon les compteurs de retard sont gonflés. → Task 1 (ligne `l7`).
2. **Facture échue depuis moins de 24 h** (`overdue === true`, `daysLate` calculé = 0) → doit atterrir dans « 1 à 30 j » et jamais dans « Non échu » (sinon Σ tranches ≠ `totalBalance`). → Task 1 (ligne `l8`).
3. **Client sans plafond** (`creditLimit === null`) avec un gros encours → jamais « au-dessus du plafond », absent de `creditLimitTotal`. → Task 1 (clients B, E, F).
4. **Plafond atteint à l'identique** (`balance === creditLimit`) → pas de dépassement ; à `+ 0,02` → dépassement (tolérance 0,01). → Task 1 (clients C vs D).
5. **Portée d'un commercial** : `dorcas` (1 client) et `erica` (0 client) doivent voir des agrégats bornés à leur portefeuille, jamais le total de l'ADMIN. → Task 2.

---

### Task 1: Agrégats purs dans `src/lib/commercial.ts`

**Files:**
- Modify: `src/lib/commercial.ts` (fichier de 161 lignes ; ajouts à la fin + 3 retouches dans `creanceLines`)
- Test: `scripts/tmp-creances-helpers.mjs` (jetable, gitignoré)

**Interfaces:**
- Consumes (déjà présent) : `interface CreanceLine` (l.80-103), `creanceLines(user, now?)` (l.109-161), `round2` (l.62, privé, accessible dans le fichier), le champ `Client.creditLimit` et la relation `Client.commercial` → `User.name`.
- Produces (utilisés par Task 2 et Task 3) :
  - `CreanceLine.commercialName: string | null`, `CreanceLine.promisePendingCount: number` ;
  - `type CreanceSummary = { totalBalance, overdueBalance, notYetDueBalance, openInvoices, debtorClients, promisePendingAmount, promisePendingCount, clientsOverLimit, creditLimitTotal }` (tous `number`) ;
  - `type AgingBucketKey = "not_due" | "d1_30" | "d31_60" | "d61_90" | "d90_plus"` ;
  - `type AgingLine = { id, reference, clientName, balance, dueDate, daysLate }` ; `type AgingBucket = { key: AgingBucketKey; label: string; balance: number; count: number; clients: number; lines: AgingLine[] }` ;
  - `type ClientCreance = { clientId, clientName, balance, overdueBalance, oldestOverdueDays, creditLimit, overLimit, openInvoices, nextDueDate, commercialName }` ;
  - `function creanceDaysLate(line: CreanceLine, now?: Date): number` ;
  - `function creanceAging(lines: CreanceLine[], now?: Date): AgingBucket[]` (toujours 5 tranches, dans l'ordre `not_due`, `d1_30`, `d31_60`, `d61_90`, `d90_plus`) ;
  - `function creanceByClient(lines: CreanceLine[], now?: Date): ClientCreance[]` (trié `balance` desc puis `clientName` asc) ;
  - `function creanceSummary(lines: CreanceLine[], now?: Date): CreanceSummary`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `scripts/tmp-creances-helpers.mjs` (script jetable, gitignoré) :

```js
// Jetable — tests purs des agrégats de recouvrement (aucune base, aucun serveur).
import { creanceSummary, creanceAging, creanceByClient, creanceDaysLate } from "../src/lib/commercial"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-17T12:00:00.000Z")
const at = (days) => new Date(NOW.getTime() + days * DAY).toISOString()

let pass = 0
let fail = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${label}`) }
  else { fail++; console.log(`FAIL  ${label}\n      attendu: ${JSON.stringify(expected)}\n      obtenu : ${JSON.stringify(actual)}`) }
}

/** Ligne de créance minimale : seuls les champs lus par les agrégats sont signifiants. */
const line = (over) => ({
  id: "x", reference: "FAC-X", clientId: "A", clientName: "Client A",
  total: 0, credited: 0, paid: 0, pendingAmount: 0,
  promisePending: 0, promisePendingCount: 0, balance: 0,
  creditLimit: null, paymentTermsDays: 30, dueDate: at(0), overdue: false,
  createdAt: at(0), reminderCount: 0, lastReminderAt: null,
  ...over,
})

const lines = [
  line({ id: "l1", reference: "FAC-1", clientId: "A", clientName: "Alpha", balance: 50000, dueDate: at(10), creditLimit: 100000 }),
  line({ id: "l2", reference: "FAC-2", clientId: "A", clientName: "Alpha", balance: 60000, dueDate: at(-45), overdue: true, creditLimit: 100000, promisePendingCount: 2 }),
  line({ id: "l3", reference: "FAC-3", clientId: "B", clientName: "Bravo", balance: 20000, dueDate: at(-5), overdue: true }),
  line({ id: "l4", reference: "FAC-4", clientId: "C", clientName: "Charlie", balance: 10000, dueDate: at(20), creditLimit: 10000 }),
  line({ id: "l5", reference: "FAC-5", clientId: "D", clientName: "Delta", balance: 10000.02, dueDate: at(-120), overdue: true, creditLimit: 10000, promisePending: 2000 }),
  line({ id: "l6", reference: "FAC-6", clientId: "E", clientName: "Echo", balance: 3000, dueDate: at(-61), overdue: true }),
  line({ id: "l7", reference: "FAC-7", clientId: "E", clientName: "Echo", balance: 0, pendingAmount: 5000, dueDate: at(-200), overdue: true }),
  line({ id: "l8", reference: "FAC-8", clientId: "F", clientName: "Foxtrot", balance: 7000, dueDate: at(-0.5), overdue: true, commercialName: "Maba Dorcas", promisePendingCount: 1 }),
  line({ id: "l9", reference: "FAC-9", clientId: "A", clientName: "Alpha", balance: 4000, dueDate: at(30), creditLimit: 100000 }),
]

const summary = creanceSummary(lines, NOW)
const aging = creanceAging(lines, NOW)
const byClient = creanceByClient(lines, NOW)

// ─── Référence Focus #2 : échue de moins de 24 h → 1 à 30 j, jamais Non échu
check("daysLate(l8) = 1 (jamais 0)", creanceDaysLate(lines[7], NOW), 1)
check("daysLate(l1) = 0 (non échue)", creanceDaysLate(lines[0], NOW), 0)

// ─── Les cinq tranches, toujours renvoyées dans l'ordre
check("tranches (ordre)", aging.map((b) => b.key), ["not_due", "d1_30", "d31_60", "d61_90", "d90_plus"])
check("tranche Non échu (balance/count/clients)", [aging[0].balance, aging[0].count, aging[0].clients], [64000, 3, 2])
check("tranche 1 à 30 j", [aging[1].balance, aging[1].count, aging[1].clients], [27000, 2, 2])
check("tranche 31 à 60 j", [aging[2].balance, aging[2].count, aging[2].clients], [60000, 1, 1])
check("tranche 61 à 90 j", [aging[3].balance, aging[3].count, aging[3].clients], [3000, 1, 1])
check("tranche + 90 j", [aging[4].balance, aging[4].count, aging[4].clients], [10000.02, 1, 1])

// ─── Invariant : Σ tranches = totalBalance (tolérance 0,01)
const sumAging = aging.reduce((s, b) => s + b.balance, 0)
check("invariant Σ tranches = totalBalance", Math.abs(sumAging - summary.totalBalance) <= 0.01, true)

// ─── Référence Focus #1 : la facture soldée (balance 0) sort des tranches et des compteurs
check("facture soldée hors tranches (l7 absente)", aging.flatMap((b) => b.lines).some((l) => l.id === "l7"), false)
check("détail de tranche (références d1_30)", aging[1].lines.map((l) => l.reference), ["FAC-3", "FAC-8"])
check("détail de tranche (jours de retard d1_30)", aging[1].lines.map((l) => l.daysLate), [5, 1])

// ─── Résumé
check("summary.totalBalance", summary.totalBalance, 164000.02)
check("summary.overdueBalance", summary.overdueBalance, 100000.02)
check("summary.notYetDueBalance", summary.notYetDueBalance, 64000)
check("summary.openInvoices (l7 exclue)", summary.openInvoices, 8)
check("summary.debtorClients (A..F = 6)", summary.debtorClients, 6)
check("summary.promisePendingAmount", summary.promisePendingAmount, 2000)
check("summary.promisePendingCount", summary.promisePendingCount, 3)
// ─── Références Focus #3 et #4 : plafonds
check("summary.clientsOverLimit (A et D, pas B/E/F sans plafond)", summary.clientsOverLimit, 2)
check("summary.creditLimitTotal (A 100000 + C 10000 + D 10000)", summary.creditLimitTotal, 120000)

// ─── Encours par client (tri balance desc)
check("byClient ordre + encours", byClient.map((c) => [c.clientId, c.balance]), [
  ["A", 110000], ["B", 20000], ["D", 10000.02], ["C", 10000], ["F", 7000], ["E", 3000],
])
const clientA = byClient.find((c) => c.clientId === "A")
check("client A : 3 factures, dont 1 en retard", [clientA.openInvoices, clientA.overdueBalance], [3, 60000])
check("client A : plus ancien retard = 45 j", clientA.oldestOverdueDays, 45)
check("client A : prochaine échéance = la plus petite (échue de 45 j)", clientA.nextDueDate, at(-45))
check("client A : plafond dépassé", [clientA.creditLimit, clientA.overLimit], [100000, true])
const clientC = byClient.find((c) => c.clientId === "C")
check("client C : plafond atteint pile → pas de dépassement", [clientC.creditLimit, clientC.overLimit], [10000, false])
const clientD = byClient.find((c) => c.clientId === "D")
check("client D : plafond + 0,02 → dépassement", [clientD.creditLimit, clientD.overLimit], [10000, true])
const clientE = byClient.find((c) => c.clientId === "E")
check("client E : 1 seule facture comptée (soldée exclue)", clientE.openInvoices, 1)
const clientF = byClient.find((c) => c.clientId === "F")
check("client F : commercial repris", clientF.commercialName, "Maba Dorcas")

console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run (depuis `C:\Users\HP\Desktop\Designlabs\lcg-website`) : `npx tsx scripts/tmp-creances-helpers.mjs`

Attendu : **échec** — `SyntaxError`/`TypeError` de type « The requested module does not provide an export named 'creanceSummary' » (le module n'exporte pas encore les helpers).

Si `tsx` ne résout pas l'alias `@/*` utilisé en interne par `src/lib/commercial.ts`, relancer avec `npx tsx --tsconfig ./tsconfig.json scripts/tmp-creances-helpers.mjs`. (L'alias `@/*` → `./src/*` est déclaré dans `tsconfig.json`.)

- [ ] **Step 3: Ajouter les deux champs de `CreanceLine`**

Dans `src/lib/commercial.ts`, remplacer l'interface `CreanceLine` (l.80-103) par :

```ts
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
```

- [ ] **Step 4: Ajouter le commercial au `select` et remplir les deux champs**

Dans `creanceLines` (l.109-161) :

a) dans `select.client.select` (l.120-123), ajouter la relation après `creditLimit: true,` :

```ts
          creditLimit: true,
          commercial: { select: { name: true } },
```

b) dans le calcul (après la ligne `const promisePending = …`, l.135), ajouter :

```ts
      const promisePendingCount = d.promises.filter((p) => p.status === "PENDING").length
```

c) dans l'objet retourné, après `promisePending: round2(promisePending),` (l.149), ajouter :

```ts
        promisePendingCount,
```

et après `creditLimit: d.client?.creditLimit ?? null,` (l.151), ajouter :

```ts
        commercialName: d.client?.commercial?.name ?? null,
```

- [ ] **Step 5: Ajouter les types et les trois helpers en fin de fichier**

À la fin de `src/lib/commercial.ts` (après la fonction `creanceLines`, dernière ligne du fichier), ajouter :

```ts
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
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il passe**

Run : `npx tsx scripts/tmp-creances-helpers.mjs` (ou avec `--tsconfig ./tsconfig.json`)

Attendu : `31 PASS / 0 FAIL` et code de sortie 0. (Le compte exact de lignes `PASS` importe peu ; **0 FAIL** est le critère.)

- [ ] **Step 7: Vérifier le typage**

Run : `node node_modules/typescript/bin/tsc --noEmit`
Attendu : aucune sortie (0 erreur).

- [ ] **Step 8: Commit**

```bash
git add src/lib/commercial.ts
git commit -m "feat(creances): agregats de recouvrement (resume, balance agee, encours par client)"
```

---

### Task 2: Exposer les agrégats dans `GET /api/commercial/creances`

**Files:**
- Modify: `src/app/api/commercial/creances/route.ts` (32 lignes)
- Test: `scripts/tmp-creances-api.mjs` (jetable, gitignoré)

**Interfaces:**
- Consumes (Task 1) : `creanceSummary(lines, now?)`, `creanceAging(lines, now?)`, `creanceByClient(lines, now?)`, `creanceLines(user)`.
- Produces : la réponse JSON de `GET /api/commercial/creances` gagne `summary: CreanceSummary`, `aging: AgingBucket[5]`, `byClient: ClientCreance[]` (consommés par Task 3). `creances`, `count`, `total`, `canValidate` restent inchangés.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `scripts/tmp-creances-api.mjs` (jetable, gitignoré) :

```js
// Jetable — tests HTTP de l'API des créances (agrégats + portée). LECTURE SEULE.
import fs from "node:fs"
import { encode } from "next-auth/jwt"
import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const BASE = process.env.TEST_BASE || "http://localhost:3000"
const env = {}
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}
const SECRET = env.NEXTAUTH_SECRET
const pool = new pg.Pool({ connectionString: (env.DATABASE_URL || "").replace("-pooler.", "."), max: 3, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let pass = 0
let fail = 0
const check = (label, ok, detail = "") => {
  if (ok) { pass++; console.log(`PASS  ${label}`) }
  else { fail++; console.log(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`) }
}
const cookieFor = async (user) =>
  `authjs.session-token=${await encode({ token: { id: user.id, sub: user.id, role: user.role }, secret: SECRET, salt: "authjs.session-token" })}`
const get = async (path, cookie) => {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* page HTML */ }
  return { status: res.status, json, text }
}
const round2 = (n) => Math.round(n * 100) / 100

const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, select: { id: true, role: true } })
const dorcas = await prisma.user.findUnique({ where: { email: "dorcas@lcg.cg" }, select: { id: true, role: true } })
const erica = await prisma.user.findUnique({ where: { email: "erica@lcg.cg" }, select: { id: true, role: true } })
const stock = await prisma.user.findFirst({ where: { role: "STOCK_MANAGER", isActive: true }, select: { id: true, role: true } })

const adminRes = await get("/api/commercial/creances", await cookieFor(admin))
check("ADMIN → 200", adminRes.status === 200, `status ${adminRes.status}`)
const body = adminRes.json || {}
check("réponse : creances/count/total/canValidate inchangés", Array.isArray(body.creances) && typeof body.count === "number" && typeof body.total === "number" && typeof body.canValidate === "boolean")
check("réponse : summary présent (9 clés)", body.summary && Object.keys(body.summary).length === 9, JSON.stringify(body.summary))
check("réponse : aging = 5 tranches dans l'ordre", Array.isArray(body.aging) && body.aging.map((b) => b.key).join() === "not_due,d1_30,d31_60,d61_90,d90_plus", JSON.stringify(body.aging?.map((b) => b.key)))
check("réponse : byClient présent", Array.isArray(body.byClient))

if (body.summary && Array.isArray(body.aging)) {
  check("cohérence total = summary.totalBalance", Math.abs(body.total - body.summary.totalBalance) <= 0.01, `total ${body.total} vs ${body.summary.totalBalance}`)
  const sumAging = body.aging.reduce((s, b) => s + b.balance, 0)
  check("invariant Σ tranches = totalBalance", Math.abs(sumAging - body.summary.totalBalance) <= 0.01, `${sumAging} vs ${body.summary.totalBalance}`)
  check("chaque tranche a count = lignes et clients = clients distincts", body.aging.every((b) =>
    b.count === b.lines.length && b.clients === new Set(b.lines.map((l) => l.clientName)).size))
  check("chaque ligne de tranche porte reference/dueDate/daysLate", body.aging.every((b) => b.lines.every((l) =>
    typeof l.reference === "string" && typeof l.dueDate === "string" && typeof l.daysLate === "number")))
  check("tranches en retard : daysLate >= 1", body.aging.filter((b) => b.key !== "not_due").every((b) => b.lines.every((l) => l.daysLate >= 1)))
  check("summary.openInvoices = factures à solde positif", body.summary.openInvoices === body.creances.filter((c) => c.balance > 0.005).length)
  check("summary.totalBalance = Σ soldes positifs de la liste", Math.abs(body.summary.totalBalance - round2(body.creances.reduce((s, c) => s + Math.max(0, c.balance), 0))) <= 0.01)
  const clientsOfLines = new Set(body.creances.filter((c) => c.balance > 0.005 && c.clientId).map((c) => c.clientId))
  check("summary.debtorClients = clients distincts de la liste", body.summary.debtorClients === clientsOfLines.size)
}

const adminClients = new Set(body.creances.map((c) => c.clientId).filter(Boolean))

// ─── Référence Focus #5 : portée d'un commercial
const dorcasClients = new Set((await prisma.client.findMany({ where: { commercialId: dorcas.id }, select: { id: true } })).map((c) => c.id))
const dorcasRes = await get("/api/commercial/creances", await cookieFor(dorcas))
check("COMMERCIAL (dorcas) → 200", dorcasRes.status === 200, `status ${dorcasRes.status}`)
const dorcasBody = dorcasRes.json || {}
check("dorcas : chaque créance appartient à ses clients", (dorcasBody.creances || []).every((c) => dorcasClients.has(c.clientId)),
  `clients renvoyés ${JSON.stringify([...new Set((dorcasBody.creances || []).map((c) => c.clientId))])} / attendus ${JSON.stringify([...dorcasClients])}`)
check("dorcas : byClient borné à ses clients", (dorcasBody.byClient || []).every((c) => dorcasClients.has(c.clientId)))
check("dorcas : agrégats ⊆ portefeuille attendu", dorcasClients.size === 1 && (dorcasBody.creances || []).every((c) => c.clientId === [...dorcasClients][0]))
check("dorcas : ne voit pas plus de factures que l'ADMIN", (dorcasBody.count ?? 0) <= (body.count ?? 0))

const ericaRes = await get("/api/commercial/creances", await cookieFor(erica))
check("COMMERCIAL (erica, 0 client) → 200 et agrégats vides", ericaRes.status === 200 && (ericaRes.json?.byClient || []).length === 0 && (ericaRes.json?.summary?.totalBalance ?? null) === 0 && (ericaRes.json?.count ?? null) === 0,
  `status ${ericaRes.status} body ${JSON.stringify(ericaRes.json)}`)

const stockRes = await get("/api/commercial/creances", await cookieFor(stock))
check("rôle sans droit (STOCK_MANAGER) → 403", stockRes.status === 403, `status ${stockRes.status}`)
const anonRes = await get("/api/commercial/creances", null)
check("sans cookie → 401", anonRes.status === 401, `status ${anonRes.status}`)
const page = await get("/admin/creances", await cookieFor(admin))
check("page /admin/creances → 200", page.status === 200, `status ${page.status}`)

await prisma.$disconnect()
await pool.end()
console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run : `npx tsx scripts/tmp-creances-api.mjs` (serveur de dev requis sur :3000)

Attendu : **échec** sur `réponse : summary présent (9 clés)`, `aging = 5 tranches`, `byClient présent` (la route ne les renvoie pas encore) ; les contrôles de portée peuvent déjà passer.

- [ ] **Step 3: Étendre la réponse de la route**

Dans `src/app/api/commercial/creances/route.ts` :

a) compléter l'import (l.5) :

```ts
import { creanceAging, creanceByClient, creanceLines, creanceSummary, type SessionUser } from "@/lib/commercial"
```

b) remplacer le corps du `try` (l.18-27) par :

```ts
    const session = await auth()
    const user = session?.user as SessionUser
    const now = new Date()
    const creances = await creanceLines(user, now)
    return NextResponse.json({
      creances,
      count: creances.length,
      // total à recouvrer : identique à summary.totalBalance (mêmes arrondis)
      total: Math.round(creances.reduce((s, c) => s + Math.max(0, c.balance), 0) * 100) / 100,
      // seuls l'administrateur et la caisse valident un règlement saisi par un commercial
      canValidate: user?.role === "ADMIN" || isCashierRole(user?.role),
      // vue de recouvrement (sous-projet A) : calculée sur les mêmes lignes, jamais en SQL
      summary: creanceSummary(creances, now),
      aging: creanceAging(creances, now),
      byClient: creanceByClient(creances, now),
    })
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run : `npx tsx scripts/tmp-creances-api.mjs`

Attendu : `0 FAIL` (les assertions de portée dépendent des données de production : dorcas a 1 client, erica 0).

- [ ] **Step 5: Vérifier le typage et le lint**

Run : `node node_modules/typescript/bin/tsc --noEmit`
Puis : `npx eslint src/lib/commercial.ts "src/app/api/commercial/creances/route.ts"`
Attendu : 0 erreur, aucun problème eslint.

- [ ] **Step 6: Commit**

```bash
git add src/lib/commercial.ts "src/app/api/commercial/creances/route.ts"
git commit -m "feat(creances): expose resume, balance agee et encours par client dans l api"
```

---

### Task 3: Écran `/admin/creances` — bandeau de KPI + 3 onglets

**Files:**
- Modify: `src/app/(admin)/admin/creances/page.tsx` (460 lignes, composant client)

**Interfaces:**
- Consumes (Task 2) : `summary`, `aging`, `byClient` de `GET /api/commercial/creances` ; types `CreanceSummary`, `AgingBucket`, `ClientCreance` importés **en `import type`** depuis `@/lib/commercial` (effacé à la compilation, aucun Prisma dans le bundle navigateur).
- Produces : rien (feuille de l'arbre).

- [ ] **Step 1: Ajouter les types et les états**

a) Après l'interface `Creance` (l.9-27), ajouter l'import de type en tête de fichier (après la ligne `import { prepareProof } …`, l.7) :

```ts
import type { AgingBucket, ClientCreance, CreanceSummary } from "@/lib/commercial"
```

b) Dans le composant (après l'état `submitting`, l.55), ajouter :

```ts
  const [tab, setTab] = useState<"factures" | "aging" | "clients">("factures")
  const [summary, setSummary] = useState<CreanceSummary | null>(null)
  const [aging, setAging] = useState<AgingBucket[]>([])
  const [byClient, setByClient] = useState<ClientCreance[]>([])
  const [clientFilter, setClientFilter] = useState<string | null>(null)
```

- [ ] **Step 2: Recevoir les agrégats dans le chargement**

Dans l'effet de chargement (l.64-85), après `setCanValidate(Boolean(data.canValidate))` (l.76), ajouter :

```ts
        setSummary(data.summary ?? null)
        setAging(Array.isArray(data.aging) ? data.aging : [])
        setByClient(Array.isArray(data.byClient) ? data.byClient : [])
```

- [ ] **Step 3: Appliquer le filtre client à la liste des factures**

Remplacer `filtered` (l.87-92) par :

```ts
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return creances.filter(
      (c) =>
        (!clientFilter || c.clientId === clientFilter) &&
        (!term || c.clientName.toLowerCase().includes(term) || c.reference.toLowerCase().includes(term)) &&
        (!onlyOverdue || c.overdue),
    )
  }, [creances, search, onlyOverdue, clientFilter])
```

- [ ] **Step 4: Ajouter le bandeau de KPI et l'en-tête d'onglets**

Dans le JSX, après le bloc `{error && …}` (l.234-238) et avant le bloc `<div className="overflow-hidden rounded-xl border …">` (l.240), insérer :

```tsx
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              { label: "À recevoir", value: formatPrice(summary.totalBalance), detail: "", tone: "text-gray-900" },
              { label: "En retard", value: formatPrice(summary.overdueBalance), detail: "", tone: "text-red-700" },
              {
                label: "Promesses en cours",
                value: formatPrice(summary.promisePendingAmount),
                detail: `${summary.promisePendingCount} promesse${summary.promisePendingCount > 1 ? "s" : ""}`,
                tone: "text-blue-700",
              },
              { label: "Clients débiteurs", value: String(summary.debtorClients), detail: "", tone: "text-gray-900" },
              { label: "Au-dessus du plafond", value: String(summary.clientsOverLimit), detail: "", tone: summary.clientsOverLimit > 0 ? "text-red-700" : "text-gray-900" },
              { label: "Plafonds accordés", value: formatPrice(summary.creditLimitTotal), detail: "", tone: "text-gray-900" },
            ] as { label: string; value: string; detail: string; tone: string }[]
          ).map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{kpi.label}</p>
              <p className={`mt-1 text-lg font-bold sm:text-xl ${kpi.tone}`}>{kpi.value}</p>
              {kpi.detail && <p className="text-xs text-gray-500">{kpi.detail}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "factures", label: "Factures ouvertes" },
            { key: "aging", label: "Balance âgée" },
            { key: "clients", label: "Par client" },
          ] as { key: "factures" | "aging" | "clients"; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${tab === t.key ? "bg-primary text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
        {clientFilter && (
          <button
            type="button"
            onClick={() => setClientFilter(null)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Client : {byClient.find((c) => c.clientId === clientFilter)?.clientName ?? "sélectionné"}
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
```

- [ ] **Step 5: Ne montrer la recherche et le filtre « en retard » que dans l'onglet Factures**

Remplacer le conteneur des contrôles (l.210-225, le `<div className="flex flex-col gap-3 sm:flex-row sm:items-center">` … `</div>` qui contient la recherche et la case à cocher) par une version conditionnelle : envelopper son contenu par `{tab === "factures" && (…)}`. Conserver les classes existantes à l'intérieur.

Le bandeau de titre (l.206-208) reste inchangé lorsque `tab === "factures"` ; dans les autres onglets, remplacer son texte par les totaux du serveur :

```tsx
          <p className="mt-1 text-sm text-gray-500">
            {tab === "factures"
              ? `Factures B2B émises et pas encore soldées · ${filtered.length} facture${filtered.length > 1 ? "s" : ""} · reste à recouvrer ${formatPrice(totalBalance)}`
              : tab === "aging"
                ? `Balance âgée par échéance · ${aging.reduce((n, b) => n + b.count, 0)} facture(s) ouverte(s)`
                : `Encours par client · ${byClient.length} client(s) débiteur(s)`}
          </p>
```

- [ ] **Step 6: Onglet « Balance âgée »**

Conditionner le conteneur du tableau existant (`<div className="overflow-hidden rounded-xl border …">`, l.240 jusqu'à sa fermeture l.338) par `tab === "factures"` : `{tab === "factures" && (<div …>…</div>)}`, **sans modifier son contenu**.

Puis, juste après, insérer l'onglet balance âgée :

```tsx
      {tab === "aging" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="grid min-w-[900px] grid-cols-5 divide-x divide-gray-100">
            {aging.map((bucket) => (
              <div key={bucket.key} className="p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{bucket.label}</p>
                <p className={`mt-1 text-lg font-bold ${bucket.key === "not_due" ? "text-gray-900" : "text-red-700"}`}>{formatPrice(bucket.balance)}</p>
                <p className="text-xs text-gray-500">
                  {bucket.count} facture{bucket.count > 1 ? "s" : ""} · {bucket.clients} client{bucket.clients > 1 ? "s" : ""}
                </p>
                <ul className="mt-2 space-y-2">
                  {bucket.lines.map((line) => (
                    <li key={line.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                      <p className="font-mono text-gray-700">{line.reference}</p>
                      <p className="truncate font-semibold text-gray-900">{line.clientName}</p>
                      <p className="font-bold text-gray-900">{formatPrice(line.balance)}</p>
                      <p className="text-gray-500">
                        {formatDate(line.dueDate)} · {line.daysLate > 0 ? `${line.daysLate} j de retard` : "à échoir"}
                      </p>
                    </li>
                  ))}
                  {bucket.lines.length === 0 && <li className="text-gray-400">Aucune facture</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 7: Onglet « Par client »**

Insérer après l'onglet balance âgée :

```tsx
      {tab === "clients" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {byClient.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">Aucun client débiteur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2.5 sm:px-4">Client</th>
                    <th className="px-3 py-2.5 text-right">Encours</th>
                    <th className="px-3 py-2.5 text-right">Dont en retard</th>
                    <th className="px-3 py-2.5 text-right">Plus ancien retard</th>
                    <th className="px-3 py-2.5 text-right">Factures</th>
                    <th className="px-3 py-2.5">Prochaine échéance</th>
                    <th className="px-3 py-2.5">Plafond</th>
                    <th className="px-3 py-2.5 text-right sm:px-4">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byClient.map((client) => (
                    <tr key={client.clientId} className={client.overLimit ? "bg-red-50/60" : ""}>
                      <td className="px-3 py-2.5 sm:px-4">
                        <p className="font-semibold text-gray-900">{client.clientName}</p>
                        {client.commercialName && <p className="text-xs text-gray-500">Commercial : {client.commercialName}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-bold text-gray-900">{formatPrice(client.balance)}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${client.overdueBalance > 0 ? "text-red-700" : "text-gray-500"}`}>{formatPrice(client.overdueBalance)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-700">{client.oldestOverdueDays > 0 ? `${client.oldestOverdueDays} j` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-700">{client.openInvoices}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{client.nextDueDate ? formatDate(client.nextDueDate) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {client.creditLimit !== null ? (
                          <span className={client.overLimit ? "font-semibold text-red-700" : "text-gray-700"}>
                            {formatPrice(client.creditLimit)}{client.overLimit ? " · dépassé" : ""}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setClientFilter(client.clientId)
                            setTab("factures")
                          }}
                          className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Voir les factures
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 8: Vérifier le typage et le lint**

Run : `node node_modules/typescript/bin/tsc --noEmit`
Puis : `npx eslint "src/app/(admin)/admin/creances/page.tsx"`
Attendu : 0 erreur, aucun problème eslint.

- [ ] **Step 9: Vérifier la page et l'API de bout en bout**

Run : `npx tsx scripts/tmp-creances-api.mjs`

Attendu : `0 FAIL`, dont « page /admin/creances → 200 ».

Puis vérifier à la main dans le navigateur (dev :3000, session ADMIN) : `/admin/creances` affiche le bandeau (6 KPI), l'onglet « Balance âgée » montre les 5 colonnes avec le détail, l'onglet « Par client » liste les clients débiteurs et le bouton « Voir les factures » ramène à l'onglet Factures filtré (puce « Client : … ✕ » visible, clic sur ✕ → filtre retiré).

- [ ] **Step 10: Commit**

```bash
git add "src/app/(admin)/admin/creances/page.tsx"
git commit -m "feat(creances): vue recouvrement en kpi et onglets (balance agee, encours par client)"
```

---

## Auto-revue du plan (faite avant livraison)

- **Couverture du spec** : §2 décisions → Architecture + Tasks 1-3 ; §3 périmètre → Tasks 1-3 (rien de B/C/D/E touché) ; §4 données → Task 1 Steps 3-4 (select + 2 champs, aucune migration) ; §5 contrats → Task 1 Step 5 (types conformes, + `lines` documenté comme précision §7) ; §6 API → Task 2 ; §7 UI → Task 3 ; §8 tests → scripts jetables des Tasks 1-2 ; §9 qualité/commit → Steps de vérification + commits ; §10 ordre → ordre des tâches ; §11 points tranchés → Review Focus 1-5 + décision de plan n°2.
- **Placeholders** : aucun TBD/TODO ; chaque étape de code contient le code exact et la commande exacte.
- **Cohérence des types** : `CreanceSummary`/`AgingBucket`/`ClientCreance`/`AgingLine`/`CreanceLine` définis en Task 1, réutilisés à l'identique en Tasks 2-3 ; `creanceDaysLate`, `creanceAging`, `creanceByClient`, `creanceSummary` gardent la même signature partout ; les clés de tranche `not_due|d1_30|d31_60|d61_90|d90_plus` sont identiques dans le test, la route et l'UI.
- **Review Focus** : les 5 cas ont chacun leur assertion dans `scripts/tmp-creances-helpers.mjs` (cas 1 à 4) et `scripts/tmp-creances-api.mjs` (cas 5).
