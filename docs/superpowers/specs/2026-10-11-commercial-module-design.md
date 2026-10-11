# Portage du module commercial (lcgapp3 PHP → lcg-website TypeScript/Next.js) — Design

Date : 2026-10-11
Statut : brouillon validé oralement par l'utilisateur (design présenté simplement, section par section) — à relire par l'utilisateur.

## 1. Contexte et objectif

Le POS LCG existe en deux versions :

- **lcg-website** (Next.js 16 + Prisma + Neon Postgres, déployé sur Cloudflare Workers) : application actuelle de production.
- **lcgapp3** (PHP / MySQL XAMPP, `D:\Myserver\htdocs\lcgapp3`) : application historique qui contient un **module commercial / B2B** complet que lcg-website ne possède pas (aucun modèle devis, contrat, créance, encaissement, objectif).

L'utilisateur veut recopier ce module dans lcg-website, converti en TypeScript, **sans toucher à l'original PHP** (il reste en place).

> Exigences utilisateur (verbatim) :
> - « dans lcgapp3 tu vas trouver un module dédié aux commerciaux, je veux avoir tout ce module en typescript déployé sur lcg-website »
> - « le module doit rester en php, tu fais juste la copie »
> - « le module d'origine reste en php, tu prendras juste une copie du module, convertir en typescript et déployer sur lcg-website »
> - Portée demandée : « tout le module d'un coup » (un seul livrable complet).

## 2. Décisions validées

1. **Rattachement du client B2B** : les documents B2B (`B2bDocument.clientId`) référencent le **modèle `Client` existant** (type `B2B`, avec `commercialId`), conformément à lcgapp3 (table `clients` fichier unique). Le catalogue historique `B2BClient` (104 lignes importées) reste tel quel pour la carte et l'historique. Les `Order.b2bClientId` existantes (pointant vers `B2BClient`) ne sont pas touchées.
2. **`User.supervisesB2b`** : rendu **éditable par un ADMIN** dans la fiche utilisateur (dans lcgapp3 cette case était figée en base). C'est la porte de portée « voit tous les clients B2B ».
3. **Menu dédié commercial** : un utilisateur de rôle `COMMERCIAL` voit un menu **dédié** qui remplace le menu général, fidèle à `NAV_COMMERCIAL` de lcgapp3.
4. Le module est **architectural** (nouvelles tables, routes, pages) ; l'original PHP ne bouge pas ; déploiement via la chaîne habituelle lcg-website (branche `feat/report-lcgapp3`, migration Neon, `npm run deploy`).

## 3. Modèle de données (Prisma + migrations Neon)

### 3.1 Nouvelles tables

| Modèle Prisma | Colonnes (mapping lcgapp2) | Annotations |
|---|---|---|
| `B2bDocument` | `id`, `type B2bDocumentType`, `reference` @unique, `clientId → Client` (SetNull), `parentId → B2bDocument?` (SetNull), `status B2bDocumentStatus`, `pointOfSaleId → PointOfSale?` (SetNull), `subtotal/discount/total Float`, `notes String?`, `validUntil DateTime?`, `deliveryTerms String?`, `requestedDeliveryDate DateTime?`, `createdById → User?` (SetNull), `receivedAt/deliveredAt/invoicedAt DateTime?`, `cancelledAt DateTime?`, `cancelledById String?`, `cancelReason String?`, `createdAt`, `updatedAt` | type enum `B2bDocumentType { DEVIS, COMMANDE, LIVRAISON, FACTURE }` ; status enum `B2bDocumentStatus { DRAFT, SENT, CONFIRMED, REJECTED, DELIVERED, INVOICED, CANCELLED }` ; `@@index([type])`, `@@index([clientId])`, `@@index([status])` |
| `B2bDocumentItem` | `id`, `documentId → B2bDocument` (Cascade), `productVariantId → ProductVariant?` (SetNull), `quantity Int`, `unitPrice Float`, `lineTotal Float`, `createdAt` | `@@index([documentId])` |
| `B2bContract` | `id`, `clientId → Client` (Cascade), `status B2bContractStatus`, `startsAt DateTime`, `endsAt DateTime?`, `paymentTermsDays Int @default(30)`, `minOrderAmount Float`, `deliveryFrequency String?`, `discountPercent Float?`, `notes String?`, `createdById String?`, `createdAt`, `updatedAt` | enum `B2bContractStatus { ACTIVE, SUSPENDED, EXPIRED }` ; 1 contrat ACTIVE max/client (contrôle applicatif) ; `@@index([clientId])` |
| `B2bContractItem` | `id`, `contractId → B2bContract` (Cascade), `productVariantId → ProductVariant` (Cascade), `unitPrice Float` | `@@unique([contractId, productVariantId])` |
| `CommercialTarget` | `id`, `userId → User` (Cascade), `yearMonth String` (char 7, ex. "2026-10"), `targetAmount Float`, `createdById String?` | `@@unique([userId, yearMonth])` |
| `PaymentPromise` | `id`, `b2bDocumentId → B2bDocument` (Cascade), `amount Float`, `dueDate DateTime`, `status PaymentPromiseStatus`, `notes String?`, `createdById → User?` (SetNull), `createdAt`, `updatedAt` | enum `PaymentPromiseStatus { PENDING, KEPT, BROKEN }` |
| `CustomerPayment` | `id`, `b2bDocumentId → B2bDocument?` (SetNull), `orderId String?` (**sans relation Prisma** : lien applicatif, on évite de toucher le modèle `Order`), `amount Float`, `method PaymentMethod`, `notes String?`, `customerName String?`, `validationStatus PaymentValidationStatus @default(PENDING)`, `validatedById → User?` (SetNull), `createdAt`, `updatedAt` | enum `PaymentValidationStatus { PENDING, VALIDATED }` ; `@@index([b2bDocumentId])` |
| `PaymentReminder` | `id`, `b2bDocumentId → B2bDocument?` (SetNull) (sinon `orderId String?` pour les ventes), `type PaymentReminderType @default(PAYMENT_DUE)`, `sentAt DateTime?`, `channel String @default("WHATSAPP")`, `notes String?`, `createdById String?`, `createdAt`, `updatedAt` | enum `PaymentReminderType { PAYMENT_DUE, OVERDUE, FOLLOW_UP }` |

**Décision de modélisation** : rattacher les paiements/relances à la fois à `B2bDocument` (documents B2B) et à `Order` (ventes comptoir) — relation nullable des deux côtés, comme le schéma PHP. Si la relation `Order` est difficile à rétro-fitter (schéma figé), on peut laisser `orderId String?` sans relation Prisma et gérer le lien en app.

### 3.2 Extensions de tables existantes

- `Client` += `creditLimit Float?`, `category String?`.
- `ProductVariant` += `wholesalePrice Float?` (prix de gros).
- `User` += `supervisesB2b Boolean @default(false)` (+ champ éditable via utilisateurs — ADMIN seulement).

### 3.3 Enums à mapper

- `B2bDocumentType { DEVIS, COMMANDE, LIVRAISON, FACTURE }`
- `B2bDocumentStatus { DRAFT, SENT, CONFIRMED, REJECTED, DELIVERED, INVOICED, CANCELLED }`
- `B2bContractStatus { ACTIVE, SUSPENDED, EXPIRED }`
- `PaymentPromiseStatus { PENDING, KEPT, BROKEN }`
- `PaymentValidationStatus { PENDING, VALIDATED }`

**Encodage des modes de paiement d'un encaissement** : on réutilise l'enum existant `PaymentMethod { CARD, MOBILE_MONEY, CASH_ON_DELIVERY }` (les « Espèces » = `CASH_ON_DELIVERY`, comme le fait déjà le POS). On **n'ajoute pas** de valeur `BANK` à cet enum (partagé avec `Order`) : un règlement par virement/chèque est saisi avec `CASH_ON_DELIVERY` et décrit dans `notes`. Les relances utilisent `PaymentReminder.channel` (WhatsApp en premier).

### 3.4 Migrations

Un ou plusieurs fichiers SQL appliqués à la main sur Neon (comme `b2b-geo-migration.sql`), puis `prisma generate` + redémarrage du serveur de dev. Ordre recommandé : enums → B2bDocument + B2bDocumentItem → B2bContract + B2bContractItem → CommercialTarget → PaymentPromise → CustomerPayment → PaymentReminder → extensions Client/ProductVariant/User.

## 4. Cycle documentaire et règles métier

- **Numérotation auto** : `DEV-<annee>-NNNN` (devis), `BC-<annee>-NNNN` (commande), `BL-<annee>-NNNN` (livraison), `FAC-<annee>-NNNN` (facture). Fonction `nextDocumentReference(tx, prefix)` (comptage dans le jour/année, style `generateLotNumberTx`).
- **Cycle** : Devis (DRAFT → SENT → CONFIRMED / REJECTED) → Commande → Livraison (DRAFT → DELIVERED, **débit du stock** — réutiliser `consumePointOfSaleStockTx` si applicable) → Facture (INVOICED). Actions `confirmer | refuser | transformer` réservées à `ADMIN` et `COMMERCIAL`.
- **Annulation** : `cancelledAt`, `cancelledById`, `cancelReason` (motif obligatoire).
- **Contrat applicable** : 1 contrat ACTIVE maximum par client, fenêtré par `startsAt ≤ now ≤ (endsAt || infini)`, plus récent d'abord (`ORDER BY startsAt DESC LIMIT 1`). Prix négociés par variante via `B2bContractItem.unitPrice`.
- **Prix de gros** : `ProductVariant.wholesalePrice`, utilisé dans la comparaison de tarifs.
- **Créances (solde d'une facture)** : `total − Σ CustomerPayment(VALIDATED + PENDING) − Σ PaymentPromise(PENDING)`. Une facture est « non soldée » tant que son solde > 0.
- **Prospect public** : un devis est consultable sans compte via `GET /api/b2b/public/devis?ref=...&token=<32 hex>` ; vérification `hash_equals(token, hashSlug(ref+secret))` (dérivé de `devis_token` du PHP), 404 sinon.

## 5. Portée et droits

- `COMMERCIAL` n'est **pas** dans `MANAGEMENT_ROLES` → chaque garde TS utilisera `requireManagementAccess(["ADMIN", "COMMERCIAL", ...])` explicitement (même piège que `CASHIER_ROLES`).
- **Portée** : si `role === "COMMERCIAL" && user.supervisesB2b` → accès à tous les clients B2B ; sinon filtrer par `Client.commercialId === user.id`.
- `user_permissions` reste la seule source de droits par module ; nouveaux modules à déclarer : `b2b` (alias devis/bons), `contrats`, `tarifs`, `creances`, `encaissements` (et adapter `PERMISSION_MODULES`, `MODULE_ROLES`, `MODULE_ALIASES`, `roles/route.ts`, `utilisateurs/page.tsx`).
- `ADMIN` voit tout ; le menu dédié COMMERCIAL remplace le menu général pour le rôle `COMMERCIAL` (top-nav : nouveau jeu de liens, filtrage par `canSeeModule`).
- Création d'un commercial : exiger un `RoleProfile` `COMMERCIAL` actif (idempotent dans un seed) ; `emailVerified` posé à la création (déjà corrigé pour COMPTABLE).

## 6. API (routes Next.js)

| Route | Méthodes | Garde | Rôle |
|---|---|---|---|
| `/api/b2b-documents` | GET, POST | `["ADMIN","COMMERCIAL"]` | Liste/CRUD documents (scope portée) ; POST lit `body.items[]` |
| `/api/b2b-documents/[id]` | GET, PATCH, DELETE | idem | Détail, mise à jour, annulation (motif), actions `confirmer/refuser/transformer` |
| `/api/b2b-contracts` | GET, POST | `["ADMIN","COMMERCIAL"]` | Contrats (1 ACTIVE max/client) |
| `/api/b2b-contracts/[id]` | GET, PATCH, DELETE | idem | Mise à jour statut, lignes de prix |
| `/api/commercial/targets` | GET, POST | `["ADMIN","COMMERCIAL"]` | Objectifs mensuels (seul un COMMERCIAL peut en porter) |
| `/api/commercial/dashboard` | GET | `["ADMIN","COMMERCIAL"]` | KPI : CA mois, objectif, encaissements, créances |
| `/api/commercial/creances` | GET | `["ADMIN","COMMERCIAL"]` | Factures INVOICED non soldées + solde calculé |
| `/api/payments` | GET, POST | `["ADMIN","COMMERCIAL","CASHIER"]` | Encaissements (validation PENDING → VALIDATED), promesses, relances |
| `/api/b2b/public/devis` | GET | public | Consultation du devis tokenisé (sans auth) |

Fichiers de logique partagés : `src/lib/b2b.ts` (références, portée, contrat applicable, prix), `src/lib/stock-service.ts` réutilisée pour le débit de stock à la livraison.

## 7. Pages et navigation

Pages admin (dossier `src/app/(admin)/admin/`) :

- `commercial/page.tsx` — Tableau de bord commercial (KPI).
- `devis/page.tsx` — Liste + création/édition + transformer ; statuts.
- `bons/page.tsx` — Onglets Commandes / Livraisons / Factures (mêmes actions).
- `contrats/page.tsx` — Liste contrats, Modifier/Suspendre.
- `tarifs/page.tsx` — Lecture : client → contrat → comparaison prix public / gros / contrat.
- `creances/page.tsx` — Recherche + filtre « en retard » + solde.
- `encaissements/page.tsx` — Encaissements + validation + promesses + relances.
- `documents/[reference]/page.tsx` — Document imprimable (Devis/Commande/...) avec l'en-tête société et la **pastille logo encerclé** (`LOGO_BADGE_BASE64`).

Menu (composant unique `src/components/shared/admin-top-nav.tsx`) :

- Si `role === "COMMERCIAL"` → menu dédié : Tableau de bord, Clients B2B (sous-menu Contrats, Tarifs), Devis, Commandes (sous-menu Livraisons, Factures), Créances, Encaissements.
- Sinon menu général + entrées existantes (Clients B2B, Clients, Zone commerciale) si droits.

## 8. Impression et lien public

- Le document imprimable réutilise les helpers de `report-export.ts` (en-tête société + n° + adresse + logo). La pastille `LOGO_BADGE_BASE64` est déjà intégrée aux en-têtes ; le nouveau template de document B2B l'utilisera au même format (taille ~10×10 mm en en-tête, couverture optionnelle).
- Lien public : page simple qui charge `GET /api/b2b/public/devis?ref&token` et affiche le devis (totaux, lignes, montant).

## 9. Contrôles de qualité et déploiement

- `node node_modules/typescript/bin/tsc --noEmit` et `npx eslint` (0 erreur).
- e2e jetable (script `scripts/tmp-*.mjs` gitignoré, JWT forgé, salt `"authjs.session-token"`, valide uniquement sur dev :3000 — redémarrer le dev avec `-p 3000`) : cycle complet Devis → Commande → Livraison → Facture, calcul de créance, validation de paiement, portée (supervisesB2b true/false), guards 400/403/404. **Nettoyage des données de test.**
- Remise à plat des listes de modules désynchronisées (`roles/route.ts`, `utilisateurs/page.tsx`, `permissions.ts`).
- Commit `feat:` FR une ligne, push, deploy (arrêter dev + purger `.next` + `npm run deploy`) ; vérification prod `/auth/personnel` 200, `/api/orders` 401.

## 10. Ordre d'implémentation proposé

1. Schéma Prisma + migration Neon + `prisma generate`.
2. Helpers métier (`b2b.ts` : références, portée, prix, contrat).
3. Endpoints (documents, contrats, targets, dashboard, créances, paiements, public devis).
4. Pages (dashboard, devis, bons, contrats, tarifs, créances, encaissements, document).
5. Menu dédié COMMERCIAL + rôles/permissions (alignement modules).
6. Search/seed RoleProfile COMMERCIAL idempotent + champ supervisesB2b dans la fiche utilisateur.
7. tsc/eslint, e2e, nettoyage, commit, push, deploy.