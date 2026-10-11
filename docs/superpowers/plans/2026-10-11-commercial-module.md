# Portage du Module Commercial B2B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recopier le module commercial/B2B de lcgapp3 (PHP) dans lcg-website (TypeScript/Next.js), déployé sur la branche `feat/report-lcgapp3`, sans toucher à l'original PHP.

**Architecture:** 8 nouveaux modèles Prisma + extensions (`Client`, `ProductVariant`, `User`) appliqués par migration SQL sur Neon ; logique métier centralisée dans `src/lib/b2b.ts` ; routes API sous `/api/` protégées par `requireManagementAccess(["ADMIN","COMMERCIAL"])` avec portée `supervisesB2b`/`commercialId` ; pages admin sous `src/app/(admin)/admin/` ; menu dédié COMMERCIAL dans `admin-top-nav.tsx`. L'original PHP (lcgapp3) reste intact.

**Tech Stack:** Next.js 16.2.12, React 19.2.4, Prisma 7.9.1, Neon Postgres, Tailwind 4, next-auth v5 beta, PDFKit via `report-export.ts`.

**Spec:** `docs/superpowers/specs/2026-10-11-commercial-module-design.md`

## Global Constraints

- Vérification : `node node_modules/typescript/bin/tsc --noEmit` puis `npx eslint` — 0 erreur obligatoire avant tout commit (grep des erreurs eslint restantes `src/` = 0).
- Base = Neon Postgres **PRODUCTION**. Toute donnée créée par un test doit être supprimée en fin de test (nettoyage).
- Le modèle `Order.b2bClientId` (→ `B2BClient` legacy) n'est PAS modifié. `B2BClient` (catalogue 104 lignes) reste tel quel.
- `COMMERCIAL` n'est pas dans `MANAGEMENT_ROLES` → chaque route/action listera `["ADMIN","COMMERCIAL"]` explicitement.
- `NEXTAUTH_SECRET` lu dans `.env` **sans guillemets**. Forge JWT (scripts jetables) : `encode({ token: { id, sub, role, authorAt }, secret, salt: "authjs.session-token" })`.
- Ne jamais committer : `scripts/tmp-*`, `deploy*.log`, `prisma/backup-*.json`, PDF jetables.
- Serveur de dev : démarrer SI besoin avec `Start-Process node "node_modules/next/dist/bin/next" "dev","-p","3000"` ; arrêter via port 3000 avant tout `npm run deploy`. Pour l'e2e jetable il suffit de forger un JWT (aucune session réelle nécessaire), donc inutile de lancer le serveur sauf pour les pages.
- Les commandes PowerShell n'ont pas `tail`/`head` — utiliser `Select-Object -Last/Select-String` ou redirection vers `$env:TEMP`.
- `rtk` = wrapper pour lancer `npx --no-install`, `npm run deploy`, etc.
- Convention commit (repo) : une ligne `feat:`/`fix:` en français, rarement quelques lignes.
- Les scripts jetables utilisent le motif : `loadEnv()` (chargeur maison), `DATABASE_URL` **sans `-pooler.`**, `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.

## Review Focus

Ces cas ne sont pas des tests automatisés unitaires du repo (pas de framework de test) — chacun est poussé dans le script e2e jetable de la tâche qui possède le code :

1. **Devis sans items** → 400 « Ajoutez au moins un article » (pas de document vide créé). → Task 3.
2. **Transformer un devis non CONFIRMED ou non CONFIRMABLE (déjà transformé)** → 400 ; numéros séquentiels propres (DEV-2026-0001 puis -0002, jamais de trou réutilisé). → Task 3.
3. **Deux contrats ACTIVE simultanés pour le même client** → le second est refusé (400) — la règle « 1 ACTIVE max par client » doit interdire la création. → Task 4.
4. **Créance = total − paiements (VALIDATED + PENDING) − promesses PENDING** : tester avec un paiement PENDING qui « bloque » le solde et un paiement VALIDATED qui le réduit, et avec des paiements sur une autre facture qui **ne** comptent pas. → Task 5.
5. **Lien public devis sans token ou token incorrect** → 404 (jamais 401/500) ; avec le bon token → 200 avec les lignes et totaux. → Task 6.
6. **Portée : commercial `supervisesB2b=false` ne voit que `Client.commercialId = lui-même`** ; ADMIN et `supervisesB2b=true` voient tout. Testé GET, PATCH. → Task 7.

---

### Task 1: Schéma Prisma + extensions + migration Neon

**Files:**
- Modify: `prisma/schema.prisma` (ajouter enums+modèles à la suite ; éditer `Client`, `ProductVariant`, `User`)
- Create: `prisma/commercial-module-migration.sql` (généré puis revu)
- Create: `scripts/tmp-apply-commercial-sql.mjs` (gitignoré)
- Create: `scripts/tmp-commercial-schema-test.mjs` (gitignoré)

**Interfaces:**
- Produces: les enums `B2bDocumentType`, `B2bDocumentStatus`, `B2bContractStatus`, `PaymentPromiseStatus`, `PaymentValidationStatus`, `PaymentReminderType` ; les modèles `B2bDocument`, `B2bDocumentItem`, `B2bContract`, `B2bContractItem`, `CommercialTarget`, `PaymentPromise`, `CustomerPayment`, `PaymentReminder` ; extensions `Client.creditLimit/category`, `ProductVariant.wholesalePrice`, `User.supervisesB2b`.

- [ ] **Step 1: Ajouter les enums et modèles dans `prisma/schema.prisma`**

Copier en fin de fichier (juste avant les blocs existants des relations inverses à éditer) :

```prisma
enum B2bDocumentType { DEVIS COMMANDE LIVRAISON FACTURE }
enum B2bDocumentStatus { DRAFT SENT CONFIRMED REJECTED DELIVERED INVOICED CANCELLED }
enum B2bContractStatus { ACTIVE SUSPENDED EXPIRED }
enum PaymentPromiseStatus { PENDING KEPT BROKEN }
enum PaymentValidationStatus { PENDING VALIDATED }
enum PaymentReminderType { PAYMENT_DUE OVERDUE FOLLOW_UP }

model B2bDocument {
  id String @id @default(cuid())
  type B2bDocumentType
  reference String @unique
  status B2bDocumentStatus @default(DRAFT)
  clientId String?
  client Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)
  parentId String?
  parent B2bDocument? @relation("DocHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children B2bDocument[] @relation("DocHierarchy")
  pointOfSaleId String?
  subtotal Float
  discount Float @default(0)
  total Float
  notes String?
  validUntil DateTime?
  deliveryTerms String?
  requestedDeliveryDate DateTime?
  createdById String?
  items B2bDocumentItem[]
  payments CustomerPayment[]
  promises PaymentPromise[]
  reminders PaymentReminder[]
  receivedAt DateTime?
  deliveredAt DateTime?
  invoicedAt DateTime?
  cancelledAt DateTime?
  cancelledById String?
  cancelReason String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([type])
  @@index([clientId])
  @@index([status])
}

model B2bDocumentItem {
  id String @id @default(cuid())
  documentId String
  document B2bDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  productVariantId String?
  productVariant ProductVariant? @relation(fields: [productVariantId], references: [id], onDelete: SetNull)
  quantity Int
  unitPrice Float
  lineTotal Float
  createdAt DateTime @default(now())
  @@index([documentId])
}

model B2bContract {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)
  status B2bContractStatus @default(ACTIVE)
  startsAt DateTime
  endsAt DateTime?
  paymentTermsDays Int @default(30)
  minOrderAmount Float @default(0)
  deliveryFrequency String?
  discountPercent Float?
  notes String?
  createdById String?
  items B2bContractItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([clientId])
}

model B2bContractItem {
  id String @id @default(cuid())
  contractId String
  contract B2bContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  productVariantId String
  productVariant ProductVariant @relation(fields: [productVariantId], references: [id], onDelete: Cascade)
  unitPrice Float
  createdAt DateTime @default(now())
  @@unique([contractId, productVariantId])
}

model CommercialTarget {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  yearMonth String
  targetAmount Float
  createdById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, yearMonth])
}

model PaymentPromise {
  id String @id @default(cuid())
  b2bDocumentId String
  b2bDocument B2bDocument @relation(fields: [b2bDocumentId], references: [id], onDelete: Cascade)
  amount Float
  dueDate DateTime
  status PaymentPromiseStatus @default(PENDING)
  notes String?
  createdById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model CustomerPayment {
  id String @id @default(cuid())
  b2bDocumentId String?
  b2bDocument B2bDocument? @relation(fields: [b2bDocumentId], references: [id], onDelete: SetNull)
  orderId String?
  amount Float
  method PaymentMethod
  notes String?
  customerName String?
  validationStatus PaymentValidationStatus @default(PENDING)
  validatedById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([b2bDocumentId])
}

model PaymentReminder {
  id String @id @default(cuid())
  b2bDocumentId String?
  b2bDocument B2bDocument? @relation(fields: [b2bDocumentId], references: [id], onDelete: SetNull)
  orderId String?
  type PaymentReminderType @default(PAYMENT_DUE)
  sentAt DateTime?
  channel String @default("WHATSAPP")
  notes String?
  createdById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Éditer les 3 modèles existants (relations inverses + champs)**

Dans `model Client` (vers `productVariants` / après `commercialId`) ajouter :
```prisma
  creditLimit Float?
  category String?
  b2bDocuments B2bDocument[]
  b2bContracts B2bContract[]
```

Dans `model ProductVariant` (vers `lots`/`movements`) ajouter :
```prisma
  wholesalePrice Float?
  b2bDocumentItems B2bDocumentItem[]
  contractItems B2bContractItem[]
```

Dans `model User` (vers `createdDeliveries` etc.) ajouter :
```prisma
  supervisesB2b Boolean @default(false)
  commercialTargets CommercialTarget[]
```

- [ ] **Step 3: Générer et appliquer la migration sur Neon**

Générer le SQL (Prisma 7 : `--from-url` est supprimé → `--from-config-datasource`) :
```bash
rtk npx --no-install prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script > prisma/commercial-module-migration.sql
```
Relire le fichier : il doit contenir CREATE TYPE pour les 6 enums, CREATE TABLE pour les 8 modèles, ALTER TABLE ADD COLUMN pour `Client.creditLimit/category`, `ProductVariant.wholesalePrice`, `User.supervisesB2b`, et les index. **Vérifier qu'aucun DROP / ALTER TABLE DROP n'apparaît** (si oui : arrêter, ne pas l'appliquer).

Créer `scripts/tmp-apply-commercial-sql.mjs` (gitignoré) :
```js
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
config();
process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", "");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const sql = readFileSync(new URL("../prisma/commercial-module-migration.sql", import.meta.url), "utf8");
for (const stmt of sql.split(/;\s*\n/).filter((s) => s.trim())) {
  try { await prisma.$executeRawUnsafe(stmt + ";"); } catch (e) { console.error("ÉCHEC:", e.meta?.message ?? e.message, "\nSQL:", stmt); process.exitCode = 1; }
}
await prisma.$disconnect();
```
Exécuter : `rtk npx --no-install tsx scripts/tmp-apply-commercial-sql.mjs` — attendu : aucun « ÉCHEC ». Puis `rtk npx --no-install prisma generate`.

- [ ] **Step 4: Vérifier le schéma compilé + roundtrip minimal**

Créer `scripts/tmp-commercial-schema-test.mjs` (gitignoré, même préambule que plus haut avec `prisma`) :
```js
const now = new Date();
const target = await prisma.commercialTarget.create({ data: { userId: "<uid_ADMIN_prod>", yearMonth: "2099-12", targetAmount: 0 } });
const doc = await prisma.b2bDocument.create({
  data: { type: "DEVIS", reference: "DEV-TEST-SCHEMA", status: "DRAFT", subtotal: 0, discount: 0, total: 0 },
});
const item = await prisma.b2bDocumentItem.create({ data: { documentId: doc.id, quantity: 0, unitPrice: 0, lineTotal: 0 } });
console.log("crea OK", target.id.length > 0, doc.reference, item.documentId === doc.id);
await prisma.b2bDocumentItem.delete({ where: { id: item.id } });
await prisma.b2bDocument.delete({ where: { id: doc.id } });
await prisma.commercialTarget.delete({ where: { id: target.id } });
await prisma.$disconnect();
```
Exécuter `rtk npx --no-install tsx scripts/tmp-commercial-schema-test.mjs` — attendu : `crea OK true DEV-TEST-SCHEMA true`. Les 3 lignes de test sont supprimées.

- [ ] **Step 5: tsc + eslint + commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
npx eslint
git add prisma/schema.prisma prisma/commercial-module-migration.sql
git commit -m "feat: schema commercial B2B (documents, contrats, paiements, objectifs) + migration Neon"
```
(`scripts/tmp-*` sont gitignorés.)

---

### Task 2: Logique métier `src/lib/b2b.ts`

**Files:**
- Create: `src/lib/b2b.ts`
- Create: `scripts/tmp-b2b-helpers.mjs` (gitignoré)

**Interfaces:**
- Consumes: models de Task 1.
- Produces: `PRIMARY_DOC_TYPES`, `B2B_SCOPE_USERS`, `nextDocumentReference(tx, prefix("DEV"|"BC"|"BL"|"FAC"), year) → string`, `applicableContract(prisma, clientId) → B2bContract|null`, `contractUnitPrice(contract, variantId) → Float`, `computeCreance(total, payments, promises) → Float`, `buildDevisToken(ref, secret) → sha256(ref|secret)`.
- Remarque : la **portée** (`commercialId`/`supervisesB2b`) est filtrée **inline** dans chaque route (Tasks 3, 4, 5) — modifier `src/lib/b2b.ts` en fonction des helpers réellement consomés (T2 n'exporte PAS `applyClientScope` ; le filtrage inline garde la cohérence avec `b2bClientScope` de Task 7).

- [ ] **Step 1: Écriture du fichier `src/lib/b2b.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

export const PRIMARY_DOC_TYPES = ["DEVIS", "COMMANDE", "LIVRAISON", "FACTURE"] as const;

export const B2B_SCOPE_USERS = ["ADMIN", "COMPTABLE"] as const;

export async function nextDocumentReference(
  tx: PrismaClient,
  prefix: "DEV" | "BC" | "BL" | "FAC",
  year = new Date().getFullYear()
): Promise<string> {
  const count = await tx.b2bDocument.count({
    where: { reference: { startsWith: `${prefix}-${year}-` } },
  });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}
```

> (La portée se manipule au niveau de la requête dans chaque route : `where.client = { is: { commercialId: user.id } }` sauf `ADMIN`/`COMPTABLE`/`supervisesB2b`.)

```ts
export async function applicableContract(prisma: PrismaClient, clientId: string) {
  const now = new Date();
  return prisma.b2bContract.findFirst({
    where: { clientId, status: "ACTIVE", startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    orderBy: { startsAt: "desc" },
    include: { items: true },
  });
}

export async function contractUnitPrice(contract: { items: { productVariantId: string; unitPrice: number }[] } | null, variantId: string) {
  return contract?.items.find((i) => i.productVariantId === variantId)?.unitPrice ?? null;
}

export function computeCreance(total: number, payments: { amount: number; validationStatus: string }[], promises: { amount: number; status: string }[]) {
  const paid = payments
    .filter((p) => p.validationStatus === "VALIDATED" || p.validationStatus === "PENDING")
    .reduce((s, p) => s + p.amount, 0);
  const promised = promises.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  return Math.max(0, total - paid - promised);
}

export function buildDevisToken(ref: string, secret: string) {
  return createHash("sha256").update(ref + secret).digest("hex");
}
```

- [ ] **Step 2: Scaffold d'un client/contrat/client B2B pour le test**

`scripts/tmp-b2b-helpers.mjs` (préambule Prisma habituel). Créer un `Client` test (`type: "B2B"`, `name: "TEST-B2B-HELPERS"`, `commercialId: "<uid_ADMIN_prod>"`, `isActive: true`), un `B2bContract` ACTIVE avec `startsAt` hier + un item, puis (Step 3) appeler les helpers — les helpers étant dans `src/`, **ne pas** les importer depuis un `.mjs` (ls .mjs est JS pur) — au lieu de ça, répliquer la même logique inline pour vérifier le ordre des références contre la logique attendue, ou utiliser `npx tsx` (qui peut importer le TS). Utiliser `npx tsx` et importer :
```js
import { nextDocumentReference, contractUnitPrice, computeCreance } from "../src/lib/b2b.ts";
```

- [ ] **Step 3: Tester les helpers**

Assertions :
```js
const r1 = await nextDocumentReference(prisma, "DEV", 2026);          // "DEV-2026-0001" si aucune
const r2 = await nextDocumentReference(prisma, "DEV", 2026);          // "DEV-2026-0002"
const c = await prisma.b2bContract.create({ data: { clientId, status: "ACTIVE", startsAt: new Date(Date.now() - 86400000), minOrderAmount: 0, items: { create: [{ productVariantId: variantId, unitPrice: 2500 }] } } });
const applicable = await prisma.b2bContract.findFirst({ where: { clientId, status: "ACTIVE", startsAt: { lte: new Date() } }, orderBy: { startsAt: "desc" }, include: { items: true } });
const up = contractUnitPrice(applicable, variantId);                   // 2500
const up2 = contractUnitPrice(applicable, "variant-inconnu");          // null
const creance = computeCreance(10000, [{ amount: 4000, validationStatus: "VALIDATED" }, { amount: 1000, validationStatus: "PENDING" }], [{ amount: 2000, status: "PENDING" }]); // 3000
console.log(r1, r2, up, up2 === null, creance);
// attendu : DEV-2026-0001 DEV-2026-0002 2500 true 3000
```
Puis nettoyer (supprimer le contrat, le client, recréer les références si nécessaire) — et si r1/r2 ont créé des lignes, les supprimer.

- [ ] **Step 4: Commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/lib/b2b.ts
git commit -m "feat: logique metier B2B (references, contrat applicable, creances, jeton devis)"
```

---

### Task 3: API documents B2B (CRUD + cycle + validation + portée)

**Files:**
- Create: `src/app/api/b2b-documents/route.ts`
- Create: `src/app/api/b2b-documents/[id]/route.ts`
- Create: `scripts/tmp-b2b-e2e.mjs` (gitignoré)

**Interfaces:**
- Consumes: Task 1 (models), Task 2 (`nextDocumentReference`, `computeCreance`).
- Produces: `GET /api/b2b-documents?type=&status=&q=` → `{documents, types, statuses, counts}` ; `POST /api/b2b-documents` (body `{type, clientId, notes?, items:[{productVariantId, quantity, unitPrice}], discount?}`) → 201 `{document}` ; `GET /api/b2b-documents/[id]` ; `PATCH /api/b2b-documents/[id]` (mise à jour lignes ou `{action:"confirm"|"reject"|"transform"|"cancel"}`) ; 400 si items vides, 404 si introuvable, 403 hors portée.

- [ ] **Step 1: `src/app/api/b2b-documents/route.ts` (GET + POST)**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { nextDocumentReference, PRIMARY_DOC_TYPES } from "@/lib/b2b";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL"];

export async function GET(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const where: Record<string, unknown> = type ? { type } : {};
  if (status) where.status = status;
  if (q) where.OR = [{ reference: { contains: q, mode: "insensitive" } }, { client: { is: { name: { contains: q, mode: "insensitive" } } } }];
  if (auth.user.role !== "ADMIN" && auth.user.supervisesB2b !== true) where.client = { is: { commercialId: auth.user.id } };
  const [documents, counts, total] = await Promise.all([
    prisma.b2bDocument.findMany({ where, orderBy: { createdAt: "desc" }, take: 20, skip: (page - 1) * 20, include: { client: { select: { id: true, name: true, tradeName: true } }, _count: { select: { items: true } } } }),
    prisma.b2bDocument.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.b2bDocument.count({ where }),
  ]);
  return NextResponse.json({ documents, counts, total, page, types: PRIMARY_DOC_TYPES });
}

export async function POST(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const body = await req.json();
  if (!PRIMARY_DOC_TYPES.includes(body.type)) return NextResponse.json({ error: "Type de document invalide" }, { status: 400 });
  if (!body.clientId) return NextResponse.json({ error: "Choisissez un client B2B" }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0) return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 });
  const client = await prisma.client.findFirst({ where: { id: body.clientId, type: "B2B" } });
  if (!client) return NextResponse.json({ error: "Client B2B introuvable" }, { status: 404 });
  const reference = await nextDocumentReference(prisma, body.type === "DEVIS" ? "DEV" : body.type === "COMMANDE" ? "BC" : body.type === "LIVRAISON" ? "BL" : "FAC");
  const subtotal = body.items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity, 0);
  const discount = Number(body.discount ?? 0);
  const document = await prisma.b2bDocument.create({
    data: {
      type: body.type, reference, clientId: body.clientId, status: "DRAFT",
      subtotal, discount, total: Math.max(0, subtotal - discount),
      notes: body.notes ?? null, createdById: auth.user.id,
      items: { create: body.items.map((i: { productVariantId: string; quantity: number; unitPrice: number }) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.quantity })) },
    },
    include: { client: true, items: { include: { productVariant: true } } },
  });
  await logActivity({ module: "b2b", action: "create", entity: "B2bDocument", entityId: document.id, json: { reference: document.reference, type: document.type } });
  return NextResponse.json({ document }, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/b2b-documents/[id]/route.ts` (GET/PATCH — cycle et validation)**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { nextDocumentReference } from "@/lib/b2b";

const ALLOWED = ["ADMIN", "COMMERCIAL"];

export const dynamic = "force-dynamic";

async function getDocOrNull(id: string, userId: string, role: string, supervisesB2b: boolean) {
  const prisma = getPrisma();
  const doc = await prisma.b2bDocument.findUnique({ where: { id }, include: { items: { include: { productVariant: true } }, client: true } });
  if (!doc) return { doc: null, prisma, status: 404 };
  if (role !== "ADMIN" && !supervisesB2b && doc.client?.commercialId !== userId) return { doc: null, prisma, status: 403 };
  return { doc, prisma, status: 200 };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManagementAccess(ALLOWED);
  const { id } = await params;
  const { doc, status } = await getDocOrNull(id, auth.user.id, auth.user.role, auth.user.supervisesB2b);
  if (!doc) return NextResponse.json({ error: status === 404 ? "Introuvable" : "Non autorisé" }, { status });
  return NextResponse.json({ document: doc });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManagementAccess(ALLOWED);
  const { id } = await params;
  const { doc, prisma, status } = await getDocOrNull(id, auth.user.id, auth.user.role, auth.user.supervisesB2b);
  if (!doc) return NextResponse.json({ error: status === 404 ? "Introuvable" : "Non autorisé" }, { status });
  const body = await req.json();
  if (body.action === "cancel") {
    if (!body.cancelReason) return NextResponse.json({ error: "Le motif d'annulation est obligatoire" }, { status: 400 });
    const updated = await prisma.b2bDocument.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: auth.user.id, cancelReason: body.cancelReason } });
    await logActivity({ module: "b2b", action: "cancel", entity: "B2bDocument", entityId: id, json: { id } });
    return NextResponse.json({ document: updated });
  }
  if (body.action === "reject") {
    const updated = await prisma.b2bDocument.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ document: updated });
  }
  if (body.action === "transform") {
    const nextType: Record<string, string> = { DEVIS: "COMMANDE", COMMANDE: "LIVRAISON", LIVRAISON: "FACTURE" };
    const target = nextType[doc.type];
    if (!target) return NextResponse.json({ error: "Impossible de transformer ce statut" }, { status: 400 });
    if (doc.status !== "CONFIRMED" && doc.status !== "DRAFT") return NextResponse.json({ error: "Le document doit être CONFIRMED pour être transformé" }, { status: 400 });
    return await prisma.$transaction(async (tx) => {
      if (target === "LIVRAISON") {
        const { ensureOperationalStockLocations } = await import("@/lib/stock-service");
        const { consumePointOfSaleStockTx } = await import("@/lib/stock-service");
        await consumePointOfSaleStockTx(tx, await ensureOperationalStockLocations(tx), doc.items.map((i) => ({ variantId: i.productVariantId, quantity: i.quantity })));
      }
      const reference = await nextDocumentReference(tx, target === "COMMANDE" ? "BC" : target === "LIVRAISON" ? "BL" : "FAC");
      const created = await tx.b2bDocument.create({
        data: {
          type: target as "COMMANDE" | "LIVRAISON" | "FACTURE", reference,
          clientId: doc.clientId, parentId: doc.id, status: target === "FACTURE" ? "INVOICED" : "DRAFT",
          subtotal: doc.subtotal, discount: doc.discount, total: doc.total,
          notes: doc.notes, createdById: auth.user.id,
          items: { create: doc.items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })) },
        },
        include: { client: true, items: true },
      });
      await tx.b2bDocument.update({ where: { id }, data: { status: doc.type === "LIVRAISON" ? "DELIVERED" : "CONFIRMED" } });
      await logActivity({ module: "b2b", action: "transform", entity: "B2bDocument", entityId: created.id, json: { from: doc.reference, to: created.reference } });
      return created;
    }).then((created) => NextResponse.json({ document: created }, { status: 201 }));
  }
  if (body.action === "confirm") {
    if (doc.status === "CANCELLED" || doc.status === "REJECTED" || doc.status === "INVOICED")
      return NextResponse.json({ error: "Ce document ne peut pas être confirmé" }, { status: 400 });
    const updated = await prisma.b2bDocument.update({ where: { id }, data: { status: "CONFIRMED", receivedAt: new Date() } });
    return NextResponse.json({ document: updated });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
```

> Note **stock** : la LIVRAISON débite le stock via `consumePointOfSaleStockTx` (même helper et même PDV par défaut que `src/app/api/sales/route.ts`, voir `ensureOperationalStockLocations`/`pointOfSaleStockRows` dans `src/lib/stock-service.ts`). En cas de stock insuffisant la transaction échoue (rollback) → intercepter `P2002`/erreur et renvoyer 400 « Stock insuffisant ».

- [ ] **Step 3: e2e `scripts/tmp-b2b-e2e.mjs` (jetable, préambule habituel + `tsx`)**

Scénario (client + variante de TEST créés puis supprimés) :
1. Forger JWT ADMIN (`id`/`sub` = uid ADMIN prod, `role:"ADMIN"`, `authorAt = Date.now()`) et un token `COMMERCIAL` (uid = même uid, `role:"COMMERCIAL"`).
2. `POST /api/b2b-documents` DEVIS `{clientId, items:[{productVariantId, quantity:2, unitPrice:1500}]}` → 201, `reference = DEV-2026-NNNN`, `total=3000`.
3. `POST` DEVIS **sans items** → 400 « Ajoutez au moins un article » ; pas de ligne créée en base.
4. `PATCH [id] {action:"confirm"}` → `status=CONFIRMED`.
5. `GET` avec le token COMMERCIAL sur un doc dont `client.commercialId` ≠ uid → 403 (portée).
6. `PATCH [id] {action:"transform"}` → 201 `type=COMMANDE`, `reference=BC-2026-NNNN`, `parentId=doc.id`, l'original passe `status=CONFIRMED`.
7. `PATCH [id2] {action:"reject"}` puis re-transform → 400 (déjà transformé).
8. `PATCH [id1] {action:"cancel", cancelReason:""}` → 400 « motif obligatoire » ; avec motif → CANCELLED.
9. Nettoyage : supprimer documents enfants puis parents créés, le client test doubles.

- [ ] **Step 4: tsc + eslint + commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/app/api/b2b-documents/route.ts src/app/api/b2b-documents/[id]/route.ts
git commit -m "feat: API documents B2B (CRUD, cycle devis/commande/livraison/facture, portee)"
```

---

### Task 4: API contrats B2B

**Files:**
- Create: `src/app/api/b2b-contracts/route.ts`
- Create: `src/app/api/b2b-contracts/[id]/route.ts`
- Create: `scripts/tmp-b2b-contracts-e2e.mjs` (gitignoré)

**Interfaces:**
- Consumes: Task 1, Task 2 (`applicableContract`).
- Produces: `GET /api/b2b-contracts?clientId=` → `{contracts}` ; `POST` (body `{clientId, status?, startsAt, endsAt?, paymentTermsDays, minOrderAmount, deliveryFrequency?, discountPercent?, notes?, items:[{productVariantId, unitPrice}]}`) → 201 ; refus si **1 ACTIVE max/client** → 400 ; `PATCH [id]` (statut, lignes `items` remplacées) ; `DELETE [id]` (404 si introuvable).

- [ ] **Step 1: `src/app/api/b2b-contracts/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL"];

export async function GET(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const clientId = new URL(req.url).searchParams.get("clientId") ?? undefined;
  const where: Record<string, unknown> = clientId ? { clientId } : {};
  if (auth.user.role !== "ADMIN" && auth.user.supervisesB2b !== true) where.client = { is: { commercialId: auth.user.id } };
  const contracts = await prisma.b2bContract.findMany({ where, orderBy: [{ startsAt: "desc" }], include: { client: { select: { id: true, name: true, tradeName: true } }, items: { include: { productVariant: { select: { id: true, format: true } } } } } });
  return NextResponse.json({ contracts, clientId, count: contracts.length });
}

export async function POST(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const body = await req.json();
  if (!body.clientId) return NextResponse.json({ error: "Choisissez un client B2B" }, { status: 400 });
  const client = await prisma.client.findFirst({ where: { id: body.clientId, type: "B2B" } });
  if (!client) return NextResponse.json({ error: "Client B2B introuvable" }, { status: 404 });
  if (!Array.isArray(body.items) || body.items.length === 0) return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 });
  const active = await prisma.b2bContract.findFirst({ where: { clientId: body.clientId, status: "ACTIVE" } });
  if (active && body.status !== "SUSPENDED") return NextResponse.json({ error: "Ce client a déjà un contrat actif" }, { status: 400 });
  const contract = await prisma.b2bContract.create({
    data: {
      clientId: body.clientId, status: body.status ?? "ACTIVE", startsAt: new Date(body.startsAt) ?? new Date(),
      endsAt: body.endsAt ? new Date(body.endsAt) : null, paymentTermsDays: body.paymentTermsDays ?? 30,
      minOrderAmount: body.minOrderAmount ?? 0, deliveryFrequency: body.deliveryFrequency ?? null,
      discountPercent: body.discountPercent ?? null, notes: body.notes ?? null, createdById: auth.user.id,
      items: { create: body.items.map((i: { productVariantId: string; unitPrice: number }) => ({ productVariantId: i.productVariantId, unitPrice: i.unitPrice })) },
    },
    include: { items: true, client: true },
  });
  await logActivity({ module: "contrats", action: "create", entity: "B2bContract", entityId: contract.id, json: { id: contract.id } });
  return NextResponse.json({ contract }, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/b2b-contracts/[id]/route.ts` (PATCH + DELETE)**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const ALLOWED = ["ADMIN", "COMMERCIAL"];
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const { id } = await params;
  const exists = await prisma.b2bContract.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  const body = await req.json();
  if (body.status === "ACTIVE") {
    const otherActive = await prisma.b2bContract.findFirst({ where: { clientId: exists.clientId, status: "ACTIVE", id: { not: id } } });
    if (otherActive) return NextResponse.json({ error: "Ce client a déjà un contrat actif" }, { status: 400 });
  }
  const contract = await prisma.b2bContract.update({
    where: { id },
    data: {
      status: body.status, paymentTermsDays: body.paymentTermsDays, minOrderAmount: body.minOrderAmount,
      deliveryFrequency: body.deliveryFrequency, discountPercent: body.discountPercent,
      notes: body.notes,
      items: Array.isArray(body.items) ? { deleteMany: {}, create: body.items.map((i: { productVariantId: string; unitPrice: number }) => ({ productVariantId: i.productVariantId, unitPrice: i.unitPrice })) } : undefined,
    },
    include: { items: true, client: true },
  });
  await logActivity({ module: "contrats", action: "update", entity: "B2bContract", entityId: id, json: { id } });
  return NextResponse.json({ contract });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManagementAccess(ALLOWED);
  void auth;
  const prisma = getPrisma();
  const { id } = await params;
  const exists = await prisma.b2bContract.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  await prisma.b2bContract.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: e2e `scripts/tmp-b2b-contracts-e2e.mjs`**

1. JWT ADMIN.
2. Client B2B test + 2 variantes test.
3. `POST` contrat ACTIVE (items 2) → 201 ; `POST` second contrat ACTIVE même client → **400 « Ce client a déjà un contrat actif »**.
4. `PATCH [id] {status:"SUSPENDED"}` → OK ; le 2e `POST` ACTIVE passe → 201 (l'ancien est suspendu).
5. `PATCH [id]` avec `items` remplacés → items réécrits (count 1).
6. `DELETE [id]` → ok ; second `DELETE` → 404.
7. Nettoyage complet.

- [ ] **Step 4: Commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/app/api/b2b-contracts/route.ts src/app/api/b2b-contracts/[id]/route.ts
git commit -m "feat: API contrats B2B (1 actif max, items de prix, statuts)"
```

---

### Task 5: API dashboard commercial, objectifs, créances

**Files:**
- Create: `src/app/api/commercial/dashboard/route.ts`
- Create: `src/app/api/commercial/targets/route.ts`
- Create: `src/app/api/commercial/creances/route.ts`
- Create: `scripts/tmp-b2b-dashboard-e2e.mjs` (gitignoré)

**Interfaces:**
- Consumes: Task 1, Task 2 (`computeCreance`).
- Produces: `GET /api/commercial/dashboard` → `{kpi:{caMois, objectifMois, encaisseMois, creances}, recent:[documents]}` ; `GET/POST /api/commercial/targets` (body `{userId, yearMonth, targetAmount}`) ; `GET /api/commercial/creances` → `{creances:[{document, client, solde, total, payments, promises}]}` (factures INVOICED non soldées).

- [ ] **Step 1: `src/app/api/commercial/targets/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL"];

export async function GET(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const month = new URL(req.url).searchParams.get("month"); // "YYYY-MM"
  const where: Record<string, unknown> = month ? { yearMonth: month } : {};
  const targets = month
    ? await prisma.commercialTarget.findMany({ where, include: { user: { select: { id: true, name: true } } } })
    : await prisma.commercialTarget.findMany({ include: { user: { select: { id: true, name: true } } }, orderBy: { yearMonth: "desc" }, distinct: ["userId"] });
  return NextResponse.json({ targets });
}

export async function POST(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const body = await req.json();
  if (!body.userId || !body.yearMonth || body.targetAmount == null)
    return NextResponse.json({ error: "userId, yearMonth et targetAmount sont requis" }, { status: 400 });
  const target = await prisma.commercialTarget.upsert({
    where: { userId_yearMonth: { userId: body.userId, yearMonth: body.yearMonth } },
    update: { targetAmount: Number(body.targetAmount) },
    create: { userId: body.userId, yearMonth: body.yearMonth, targetAmount: Number(body.targetAmount), createdById: auth.user.id },
  });
  return NextResponse.json({ target }, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/commercial/creances/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { computeCreance } from "@/lib/b2b";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL"];

export async function GET() {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const clientWhere: Record<string, unknown> = {};
  if (auth.user.role !== "ADMIN" && auth.user.supervisesB2b !== true) clientWhere.commercialId = auth.user.id;
  const docs = await prisma.b2bDocument.findMany({
    where: { type: "FACTURE", status: "INVOICED", client: { is: clientWhere } },
    include: {
      client: { select: { id: true, name: true, tradeName: true } },
      payments: { select: { amount: true, validationStatus: true } },
      promises: { select: { amount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const creances = docs.map((d) => ({ document: { id: d.id, reference: d.reference, total: d.total, createdAt: d.createdAt }, client: d.client, solde: computeCreance(d.total, d.payments, d.promises) })).filter((c) => c.solde > 0);
  return NextResponse.json({ creances, count: creances.length });
}
```

- [ ] **Step 3: `src/app/api/commercial/dashboard/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL"];

export async function GET() {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const clientWhere: Record<string, unknown> = {};
  if (auth.user.role !== "ADMIN" && auth.user.supervisesB2b !== true) clientWhere.commercialId = auth.user.id;
  const [caMois, target, encaisse, creanceRows, recent] = await Promise.all([
    prisma.b2bDocument.aggregate({ where: { type: "FACTURE", status: "INVOICED", createdAt: { gte: start }, client: { is: clientWhere } }, _sum: { total: true } }),
    prisma.commercialTarget.findUnique({ where: { userId_yearMonth: { userId: auth.user.id, yearMonth: ym } } }),
    prisma.customerPayment.aggregate({ where: { validationStatus: "VALIDATED", createdAt: { gte: start }, b2bDocument: { is: { client: { is: clientWhere } } } }, _sum: { amount: true } }),
    prisma.b2bDocument.findMany({ where: { type: "FACTURE", status: "INVOICED", client: { is: clientWhere } }, include: { payments: true, promises: true }, select: { id: true, reference: true, total: true, payments: { select: { amount: true, validationStatus: true } }, promises: { select: { amount: true, status: true } } } }),
    prisma.b2bDocument.findMany({ where: { client: { is: clientWhere } }, orderBy: { createdAt: "desc" }, take: 10, include: { client: { select: { id: true, name: true } } } }),
  ]);
  return NextResponse.json({
    kpi: {
      caMois: caMois._sum.total ?? 0,
      objectifMois: target?.targetAmount ?? 0,
      encaisseMois: encaisse._sum.amount ?? 0,
      creances: creanceRows.map(({ id, reference, total, payments, promises }) => ({ id, reference, solde: Math.max(0, total - payments.filter((p) => p.validationStatus === "VALIDATED" || p.validationStatus === "PENDING").reduce((s, p) => s + p.amount, 0) - promises.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0)) })).filter((c) => c.solde > 0).length,
    },
    recent,
  });
}
```

- [ ] **Step 4: e2e `scripts/tmp-b2b-dashboard-e2e.mjs`**

1. JWT COMMERCIAL (uid gérant le client test) et ADMIN.
2. Créer client B2B test (`commercialId: uid`), facture INVOICED `total=10 000`.
3. `POST /api/commercial/targets {userId: uid, yearMonth: "2099-01", targetAmount: 100000}` → 201 ; GET month → contient la cible.
4. `POST /api/commercial/targets` même clé `targetAmount: 120000` → upsert (201, montant MAJ).
5. Ajouter un paiement PENDING 4 000 + une promesse PENDING 2 000 sur la facture → `GET /api/commercial/creances` → `solde = 4000` (10 000 − 4 000 − 2 000). Ajouter un paiement VALIDATED sur **une autre** facture → ne change pas le solde.
6. `GET /api/commercial/dashboard` → `kpi.caMois` recoupe `Σ factures INVOICED du mois`.
7. Nettoyage (supprime paiements/promesses/factures/client test).

- [ ] **Step 5: Commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/app/api/commercial/dashboard/route.ts src/app/api/commercial/targets/route.ts src/app/api/commercial/creances/route.ts
git commit -m "feat: API commercial (dashboard, objectifs mensuels, creances)"
```

---

### Task 6: API encaissements + relances + devis public

**Files:**
- Create: `src/app/api/payments/route.ts`
- Create: `src/app/api/payments/[id]/route.ts`
- Create: `src/app/api/b2b/public/devis/route.ts`
- Create: `scripts/tmp-b2b-payments-e2e.mjs` (gitignoré)

**Interfaces:**
- Consumes: Task 1, Task 2 (`computeCreance`, `buildDevisToken`).
- Produces: `GET /api/payments?documentId=&status=` → `{payments, promises, reminders}` ; `POST /api/payments` (`{b2bDocumentId?, orderId?, amount, method, notes?, customerName?}`) ; `PATCH /api/payments/[id]` `{validationStatus:"VALIDATED"}` (ADMIN/COMPTABLE seulement) ; `POST /api/payments` avec `{type:"promise", ...}` → `PaymentPromise` ; `{type:"reminder", ...}` → `PaymentReminder` ; `GET /api/b2b/public/devis?ref=&token=` public.

- [ ] **Step 1: `src/app/api/payments/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL", "CASHIER", "CAISSIERE"];

export async function GET(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const wherePay: Record<string, unknown> = documentId ? { b2bDocumentId: documentId } : {};
  if (status === "PENDING" || status === "VALIDATED") wherePay.validationStatus = status;
  const [payments, promises, reminders] = await Promise.all([
    prisma.customerPayment.findMany({ where: wherePay, orderBy: { createdAt: "desc" }, include: { b2bDocument: { select: { reference: true } } } }),
    prisma.paymentPromise.findMany({ where: documentId ? { b2bDocumentId: documentId } : {}, orderBy: { dueDate: "asc" }, include: { b2bDocument: { select: { reference: true } } } }),
    prisma.paymentReminder.findMany({ where: documentId ? { b2bDocumentId: documentId } : {}, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ payments, promises, reminders, count: payments.length });
}

export async function POST(req: Request) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const body = await req.json();
  if (body.type === "promise") {
    if (!body.b2bDocumentId || body.amount == null || !body.dueDate) return NextResponse.json({ error: "document, montant et échéance requis" }, { status: 400 });
    const promise = await prisma.paymentPromise.create({ data: { b2bDocumentId: body.b2bDocumentId, amount: Number(body.amount), dueDate: new Date(body.dueDate), notes: body.notes ?? null, createdById: auth.user.id } });
    return NextResponse.json({ promise }, { status: 201 });
  }
  if (body.type === "reminder") {
    if (!body.b2bDocumentId) return NextResponse.json({ error: "document requis" }, { status: 400 });
    const reminder = await prisma.paymentReminder.create({ data: { b2bDocumentId: body.b2bDocumentId, type: body.promiseType ?? "PAYMENT_DUE", channel: body.channel ?? "WHATSAPP", notes: body.notes ?? null, createdById: auth.user.id } });
    return NextResponse.json({ reminder }, { status: 201 });
  }
  if (!body.amount) return NextResponse.json({ error: "Montant requis" }, { status: 400 });
  if (body.b2bDocumentId) {
    const doc = await prisma.b2bDocument.findUnique({ where: { id: body.b2bDocumentId } });
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  const payment = await prisma.customerPayment.create({
    data: {
      b2bDocumentId: body.b2bDocumentId ?? null, orderId: body.orderId ?? null,
      amount: Number(body.amount), method: body.method ?? "CASH_ON_DELIVERY",
      notes: body.notes ?? null, customerName: body.customerName ?? null,
    },
  });
  await logActivity({ module: "creances", action: "create", entity: "CustomerPayment", entityId: payment.id, json: { amount: payment.amount, documentId: body.b2bDocumentId } });
  return NextResponse.json({ payment }, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/payments/[id]/route.ts` (validation)**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const VALIDATORS = ["ADMIN", "COMPTABLE"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManagementAccess(VALIDATORS);
  const prisma = getPrisma();
  const { id } = await params;
  const body = await req.json();
  if (body.validationStatus !== "VALIDATED") return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  const exists = await prisma.customerPayment.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  const payment = await prisma.customerPayment.update({ where: { id }, data: { validationStatus: "VALIDATED", validatedById: auth.user.id } });
  await logActivity({ module: "creances", action: "validate", entity: "CustomerPayment", entityId: id, json: { id } });
  return NextResponse.json({ payment });
}
```

- [ ] **Step 3: `src/app/api/b2b/public/devis/route.ts` (lien public, sans auth)**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { buildDevisToken } from "@/lib/b2b";

export const dynamic = "force-dynamic";
const SECRET = process.env.NEXTAUTH_SECRET!;

export async function GET(req: Request) {
  const prisma = getPrisma();
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const token = url.searchParams.get("token");
  if (!ref || !token) return NextResponse.json({ error: "Paramètres manquants" }, { status: 404 });
  if (buildDevisToken(ref, SECRET) !== token) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  const doc = await prisma.b2bDocument.findUnique({ where: { reference: ref }, include: { items: { include: { productVariant: true } }, client: { select: { name: true, tradeName: true, email: true, phone: true } } } });
  if (!doc || doc.type !== "DEVIS") return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  return NextResponse.json({ document: doc });
}
```

- [ ] **Step 4: e2e `scripts/tmp-b2b-payments-e2e.mjs`**

1. JWT ADMIN + client B2B + facture INVOICED `total=10 000`.
2. `POST /api/payments` (paiement simple 2 000) → 201 `validationStatus=PENDING`.
3. `POST /api/payments` promise 3 000 due demain → 201 ; reminder → 201.
4. `PATCH /api/payments/[p] {validationStatus:"VALIDATED"}` → VALIDATED (doté `validatedById`).
5. `GET /api/payments?documentId=` → 1 payment + 1 promise + 1 reminder.
6. **Lien public** : `buildDevisToken(ref, NEXTAUTH_SECRET)` → `GET /api/b2b/public/devis?ref&token` → 200 avec items ; token faux → **404** ; sans token → 404 ; ref non-DEVIS → 404.
7. Nettoyage complet.

- [ ] **Step 5: Commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/app/api/payments/route.ts src/app/api/payments/[id]/route.ts src/app/api/b2b/public/devis/route.ts
git commit -m "feat: API encaissements, promesses, relances et lien public devis"
```

---

### Task 7: Rôles, permissions, menu dédié COMMERCIAL, champ supervisesB2b

**Files:**
- Modify: `src/lib/permissions.ts` (labels/modules/aliases)
- Modify: `src/lib/api-auth.ts` (helper `canSeeB2b`) — [à confirmer selon l'existant]
- Modify: `src/components/shared/admin-top-nav.tsx` (branche COMMERCIAL)
- Modify: `src/app/api/roles/route.ts` + `src/app/(admin)/admin/roles/page.tsx` + `src/app/(admin)/admin/utilisateurs/page.tsx` (synchroniser MODULES ; édition du champ supervisesB2b + objectif mensuel)
- Modify: `src/app/api/utilisateurs/route.ts` + `src/app/api/utilisateurs/[id]/route.ts` (autoriser PATCH supervisesB2b par ADMIN)
- Modify: `scripts/seed-role-profiles.ts` (RoleProfile COMMERCIAL idempotent)
- Create: `scripts/tmp-roles-e2e.mjs` (gitignoré)

**Interfaces:**
- Consumes: Task 1 (`User.supervisesB2b`, `CommercialTarget`).
- Produces: `permissions.ts` : `COMMERCIAL_ROLE="COMMERCIAL"`, nouveaux modules `b2b` (label « Documents B2B »), `contrats`, `tarifs`, `creances`, `encaissements` ; `MODULE_ALIASES` += `{ "devis":"b2b", "bons":"b2b", "contrats":"contrats", "tarifs":"tarifs", "creances":"creances", "encaissements":"encaissements", "commercial":"commercial" }` ; `MODULE_ROLES` : ces modules → `[ADMIN, COMMERCIAL]`.
- Produces: `admin-top-nav.tsx` : branche si `session?.user.role === "COMMERCIAL"` → retourne les liens dédiés.

- [ ] **Step 1: `src/lib/api-auth.ts` — helper de portée**

Lire le fichier, repérer `seesOnlyOwnOrders`/`saleMovementsFilter` et ajouter, dans le même style :
```ts
export const CLIENT_B2B_ADMIN_ROLES = ["ADMIN", "COMPTABLE"];
export function b2bClientScope(user: { role: string; id: string; supervisesB2b?: boolean }) {
  if (CLIENT_B2B_ADMIN_ROLES.includes(user.role) || user.supervisesB2b) return {};
  return { commercialId: user.id };
}
```
Vérifier l'existence de `session.user.supervisesB2b` : la session est construite dans `src/lib/auth.ts` (objet `session.user` construit depuis `token`) ; **ajouter `supervisesB2b` au token et à `session.user`** si absent, sinon les routes ne verront jamais le champ. (Copier le pattern de `token.id = ...` déjà présent.)

- [ ] **Step 2: `src/lib/permissions.ts` + synchronisation**

Ajouter dans `PERMISSION_MODULES` (ou `MODULE_ROLES` selon structure existante) :
```ts
modules.push(
  { key: "b2b", label: "Documents B2B (devis/bons)" },
  { key: "contrats", label: "Contrats" },
  { key: "tarifs", label: "Tarifs" },
  { key: "creances", label: "Créances" },
  { key: "encaissements", label: "Encaissements" },
  { key: "commercial", label: "Espace commercial" }
);
```
Idem dans `src/app/api/roles/route.ts` (MODULES) et `src/app/(admin)/admin/utilisateurs/page.tsx` (liste). Ajouter les alias dans `MODULE_ALIASES`. Revoir `canSeeModule` pour traiter `role==="COMMERCIAL"` sur ces modules. Ajouter `logActivity` des nouveaux modules (déjà fait dans les routes Tasks 3-6 : `b2b`, `contrats`, `creances`).

- [ ] **Step 3: `src/components/shared/admin-top-nav.tsx` — branche COMMERCIAL**

Dans le composant (étudier `navGroups`, `priorityLinks`, `MODULE_ALIASES`, `canSeeModule`) : si `session?.user?.role === "COMMERCIAL"`, rendre à la place du menu général :
```tsx
const NAV_COMMERCIAL = [
  { href: "/admin/commercial", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/clients-b2b", label: "Clients B2B", icon: Users },
  { href: "/admin/contrats", label: "Contrats", icon: FileText },
  { href: "/admin/tarifs", label: "Tarifs", icon: Tags },
  { href: "/admin/devis", label: "Devis", icon: FilePlus },
  { href: "/admin/bons", label: "Commandes · Livraisons · Factures", icon: ShoppingCart },
  { href: "/admin/creances", label: "Créances", icon: Wallet },
  { href: "/admin/encaissements", label: "Encaissements", icon: Banknote },
];
```
(retourner ce tableau de liens en haut de page, brand + user à part). Icônes `lucide-react` déjà importées.

- [ ] **Step 4: fiche utilisateur — supervisesB2b + objectif mensuel**

`PATCH /api/utilisateurs/[id]` : accepter (ADMIN seulement) `supervisesB2b : boolean` et l'écrire sur le user. Dans `utilisateurs/page.tsx`, ajouter un champ « Voit tous les clients B2B » (checkbox, ADMIN seulement) + champ « Objectif mensuel (FCFA) » (enregistre `POST /api/commercial/targets` avec `userId` de l'utilisateur affiché et le mois courant). L'écran listé comme ADMIN_ROLES.

- [ ] **Step 5: Seed RoleProfile COMMERCIAL**

Dans `scripts/seed-role-profiles.ts`, rendre le bloc COMMERCIAL **idempotent** (upsert par name, comme les 5 existants) et exécuter `rtk npx --no-install tsx scripts/seed-role-profiles.ts` (n'entraîne aucune régression des profils existants). Noter le `RoleProfile.role` utilisé.

- [ ] **Step 6: e2e `scripts/tmp-roles-e2e.mjs`**

1. JWT ADMIN + créer un `User` COMMERCIAL test (`role:"COMMERCIAL"`, `supervisesB2b:false`, `emailVerified` à `now()`) puis un client B2B `commercialId: <id du commercial test>`.
2. `GET /api/b2b-documents` en tant que ce commercial → ne voit que ses docs ; après `PATCH /api/utilisateurs/[id] {supervisesB2b:true}` → voit tout (créer un 2e client B2B rattaché à un autre commercial).
3. `PATCH /api/utilisateurs/[id] {supervisesB2b:true}` par un token COMMERCIAL (non ADMIN) → **403**.
4. Nettoyage (supprimer users de test, clients, docs).

- [ ] **Step 7: Commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/lib/permissions.ts src/lib/api-auth.ts src/lib/auth.ts src/components/shared/admin-top-nav.tsx src/app/api/roles/route.ts "src/app/(admin)/admin/roles/page.tsx" "src/app/(admin)/admin/utilisateurs/page.tsx" src/app/api/utilisateurs/route.ts src/app/api/utilisateurs/[id]/route.ts scripts/seed-role-profiles.ts
git commit -m "feat: roles et permissions commercial (menu dedie, supervisesB2b editable, profile)"
```

---

### Task 8: Pages admin — dashboard, devis, bons, contrats, tarifs, créances, encaissements, document

**Files:**
- Create: `src/app/(admin)/admin/commercial/page.tsx`
- Create: `src/app/(admin)/admin/devis/page.tsx`
- Create: `src/app/(admin)/admin/bons/page.tsx`
- Create: `src/app/(admin)/admin/contrats/page.tsx`
- Create: `src/app/(admin)/admin/tarifs/page.tsx`
- Create: `src/app/(admin)/admin/creances/page.tsx`
- Create: `src/app/(admin)/admin/encaissements/page.tsx`
- Create: `src/app/(admin)/admin/documents/[reference]/page.tsx`
- Create: `src/app/(public)/b2b/devis/[reference]/page.tsx` (page publique du devis)
- Create: `scripts/tmp-b2b-pages-e2e.mjs` (gitignoré)

**Interfaces:**
- Consumes: routes Tasks 3–6 ; helpers Task 2.
- Produces: les écrans admin (client components) conformes aux patterns existants (`src/app/(admin)/admin/livraisons/page.tsx`, `commandes/page.tsx`).

- [ ] **Step 1: pages « données » (devis, bons, contrats, tarifs, créances, encaissements)**

Chaque page = un client component qui appelle son API (fetch) et rend des cartes/listes/tableaux sur le modèle de `admin/livraisons/page.tsx` (filtres `type`/`status`, recherche, pagination, toasts existants). Structure minimale (pattern identique par page) :
```tsx
"use client";
export default function DevisPage() {
  // useSession + filters (type=DEVIS, status, q) + GET /api/b2b-documents
  // table : reference, client, total, status badge, actions (Confirmer/Transformer/Refuser/Annuler) via PATCH /api/b2b-documents/[id]
  // bouton « Nouveau devis » → formulaire inline : client (GET /api/clients?type=B2B) + lignes (variantes via GET /api/produits?all=1) → POST /api/b2b-documents
}
```
- `bons/page.tsx` : onglets `COMMANDE | LIVRAISON | FACTURE` (réutilise le même composant avec `type` fixé + boutons « Transformer » qui enchaînent).
- `contrats/page.tsx` : liste + créé/modif (items avec prix par variante), badge ACTIVE/SUSPENDED/EXPIRED.
- `tarifs/page.tsx` (lecture) : select client → `GET /api/b2b-contracts?clientId=` + montrer prix public (`/api/produits?all=1`), `wholesalePrice`, et unitPrice du contrat.
- `encaisseements/page.tsx` : liste `GET /api/payments` + bouton « Valider » (PENDING→VALIDATED, visible ADMIN/COMPTABLE) + actions « Promesse » / « Relance » (POST via /api/payments).

- [ ] **Step 2: dashboard commercial `admin/commercial/page.tsx`**

KPI cards : `caMois`, `objectifMois`, `encaisseMois`, `creances` (GET /api/commercial/dashboard) + liste `recent` (derniers documents) — mêmes patterns KPI que `admin/page.tsx` (pastilles, nombres formatés FCFA).

- [ ] **Step 3: document imprimable `admin/documents/[reference]/page.tsx`**

Client component : `GET /api/b2b-documents/[id]` (trouver l'id via une recherche par référence — ajouter `rechercheParReference` si non couverte par le GET de Task 3, ou passer `?ref=` en paramètre de recherche côté route) ; rend le document (en-tête société LCG + pastille `LOGO_BADGE_BASE64` via le composant/helpers existants de report-export, lignes, totaux, statut, timeline parent/enfants) + bouton « Imprimer » (`window.print()` + CSS print) et « Lien public » (copie `https://<app>/b2b/devis/<reference>?token=<buildDevisToken>` — **ne PAS afficher `NEXTAUTH_SECRET`** ; construire le token via un endpoint dédié réservé aux ADMIN/COMMERCIAL : `GET /api/b2b-documents/[id]/public-token`).

- [ ] **Step 4: page publique `src/app/(public)/b2b/devis/[reference]/page.tsx`**

Client component sans auth : `GET /api/b2b/public/devis?ref=<reference>&token=<query token>` ; si 404 → « Devis introuvable » ; sinon rend le devis (lignes, totaux, infos client), bouton « Imprimer ».

- [ ] **Step 5: e2e `scripts/tmp-b2b-pages-e2e.mjs`**

Avec le serveur de dev démarré (`Start-Process node "node_modules/next/dist/bin/next" "dev","-p","3000"` — attendre `/api/health` ou un fetch 200) :
1. Créer client B2B + devis test via API (JWT forgé), puis `GET http://localhost:3000/admin/devis` → 200 et le doc présent dans le HTML.
2. `GET http://localhost:3000/admin/commercial` → 200 (KPI présents).
3. `GET http://localhost:3000/admin/documents/<ref>` → 200.
4. `GET http://localhost:3000/b2b/devis/<ref>?token=<bon jeton>` → 200 ; avec mauvais jeton → la page affiche « Devis introuvable ».
5. Arrêter le serveur (`taskkill /PID <pid> /T /F`), nettoyer les données de test.

- [ ] **Step 6: Commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add "src/app/(admin)/admin/commercial/page.tsx" "src/app/(admin)/admin/devis/page.tsx" "src/app/(admin)/admin/bons/page.tsx" "src/app/(admin)/admin/contrats/page.tsx" "src/app/(admin)/admin/tarifs/page.tsx" "src/app/(admin)/admin/creances/page.tsx" "src/app/(admin)/admin/encaissements/page.tsx" "src/app/(admin)/admin/documents/[reference]/page.tsx" "src/app/(public)/b2b/devis/[reference]/page.tsx"
git commit -m "feat: ecrans admin commercial (dashboard, devis, bons, contrats, tarifs, creances, encaissements, document)"
```

---

### Task 9: Intégration PDF du document + déploiement

**Files:**
- Modify: `src/lib/report-export.ts` (helper PDF du document B2B, dans le style `lot-doc-pdf.ts`)
- Create: `src/app/api/b2b-documents/[id]/print/route.ts`
- Modify: (selon charge) `src/app/(admin)/admin/documents/[reference]/page.tsx` (lien « Télécharger PDF »)

**Interfaces:**
- Consumes: Task 8, `LOGO_BADGE_BASE64` (déjà dans report-export / logo-badge-base64).
- Produces: `GET /api/b2b-documents/[id]/print` → PDF (binaire, `Content-Type: application/pdf`), garde Session ADMIN/COMMERCIAL + portée.

- [ ] **Step 1: helper PDF dans `src/lib/report-export.ts`**

Reprendre la structure du générateur PDF existant (en-tête société + `LOGO_BADGE_BASE64` + numéro + footer paginé `finalizePDF`). Fonction `buildB2bDocumentPdf(doc)` : en-tête (nom société, adresse, n°, date), bloc client (nom, téléphone, email), tableau des lignes (désignation/quantité/prix unitaire/total), sous-total, remise, **total** (FCFA), mention contrat/validité, statut. Retourner le buffer PDF.

- [ ] **Step 2: route `src/app/api/b2b-documents/[id]/print/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
const ALLOWED = ["ADMIN", "COMMERCIAL"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManagementAccess(ALLOWED);
  const prisma = getPrisma();
  const { id } = await params;
  const doc = await prisma.b2bDocument.findUnique({ where: { id }, include: { items: { include: { productVariant: true } }, client: true } });
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (auth.user.role !== "ADMIN" && auth.user.supervisesB2b !== true && doc.client?.commercialId !== auth.user.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const pdf = await buildB2bDocumentPdf(doc);   // importé de "@/lib/report-export"
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.reference}.pdf"` } });
}
```
(verrouillage : ne pas générer de PDF de test nommé `CLOTURE-TEST-*` — les PDF produits portent la référence du document.)

- [ ] **Step 3: lien « Télécharger PDF » sur la page document**

Ajouter un bouton dans `admin/documents/[reference]/page.tsx` : `window.open('/api/b2b-documents/<id>/print')`.

- [ ] **Step 4: vérif PDF + e2e**

Générer le PDF d'un document test → vérifier avec `rtk python %TEMP%\opencode\run2026\check_pdf.py <pdf>` (pages/images/texte). Nettoyer les fichiers générés hors repo.

- [ ] **Step 5: tsc + eslint + commit**

```bash
node node_modules/typescript/bin/tsc --noEmit && npx eslint
git add src/lib/report-export.ts src/app/api/b2b-documents/[id]/print/route.ts "src/app/(admin)/admin/documents/[reference]/page.tsx"
git commit -m "feat: impression PDF des documents B2B avec logo"
```

- [ ] **Step 6: Déploiement**

(i) Vérifier qu'aucune donnée de test ne subsiste (requêtes `count` sur les 8 tables + `Client`/`ProductVariant` test). (ii) Arrêter le dev serveur si actif, purger `.next`, `rtk npm run deploy` (`deploy: OK`). (iii) Vérifs prod : `/auth/personnel` 200, `/api/orders` 401, `/api/delivery-options` 200, et un `GET /api/b2b-documents` → 401 (auth requise), `GET /api/b2b/public/devis` sans params → 404.

---

## Self-Review

**1. Spec coverage :** chaque section de la spec a une tâche — données (T1), logique (T2), documents+cycle (T3), contrats (T4), dashboard/objectifs/créances (T5), encaissements+relances+devis public (T6), droits/menu/supervisesB2b (T7), écrans (T8), impression+déploiement (T9). Ordre d'implémentation du spec respecté.

**2. No placeholders :** audité — aucune référence « TBD » ; `applyClientScope` (helper mort) a été retiré de `src/lib/b2b.ts` (portée filtrée inline dans chaque route, Tasks 3-5, formalisée par `b2bClientScope` dans Task 7) ; le bloc `transform` de Task 3 est cohérent (un seul `update` du parent, statut enfant = `INVOICED` pour la FACTURE, `DRAFT` sinon) ; helpers exportés par Task 2 : `nextDocumentReference`, `applicableContract`, `contractUnitPrice`, `computeCreance`, `buildDevisToken`.

**3. Review Focus :** les 6 lignes du Review Focus ont toutes leur test : (1) T3 Step 3 ; (2) T3 Step 3 ; (3) T4 Step 3 ; (4) T5 Step 4 ; (5) T6 Step 4 ; (6) T7 Step 6. Aucune ligne du mode d'emploi ne reste sans tâche de rattachement.

> **Note exécution :** pas de framework de test unitaire dans ce repo — les « tests » sont les scripts jetables `scripts/tmp-*.mjs` (gitignorés) lancés via `npx tsx`, couplés à `tsc` + `eslint` + un déploiement de vérification finale. Le premier exécutant doit lire `node_modules/next/dist/docs/` (règle AGENTS.md) avant d'écrire du code Next.