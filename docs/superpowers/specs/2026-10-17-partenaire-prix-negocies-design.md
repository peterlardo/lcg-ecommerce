# Module Partenaire — prix négociés par format (ventes comptoir) — Design

Date : 2026-10-17
Statut : conception présentée et validée par l'utilisateur (« traite tous les points 1, 2 et 3 ») — à relire par l'utilisateur.

## 1. Contexte et objectif

Dans **lcg-website** (Next.js 16 + Prisma + Neon Postgres, POS déployé sur Cloudflare Workers), une vente au comptoir (`POST /api/sales`, écran Ventes → Nouvelle vente) est toujours facturée au **prix public** `ProductVariant.price` : le prix envoyé par le client est ignoré, aucune saisie de prix n'est possible. Les **prix négociés** existent déjà mais uniquement côté B2B (`B2bContractItem.unitPrice` / `B2bContract.discountPercent`, résolus par `contractUnitPrice()` dans `src/lib/b2b.ts`), et ils ne s'appliquent qu'aux documents B2B, jamais aux ventes comptoir.

L'utilisateur veut que des **partenaires** puissent bénéficier de **prix négociés par format** lors des ventes de produits LCG, via un **module Partenaire** dans le menu **Administration** où l'on fixe, pour chaque format, le prix partenaire ; et, à la vente, un **champ « Partenaire »** qui récupère le partenaire et son prix privilégié associé.

> Exigences utilisateur (verbatim) :
> - « je veux que concernant les ventes des produits lcg que les partenaires puissent bénéficier des pris négociés »
> - « je veux plutot un module partenaire ou on fixe pour chaque format le prix partenaire et au niveau de la vente un champ pour recupérer le partenaire avec le prix privilégié associé »
> - « dans le menu Administration, je veux un module partenaire ou je peux gérer les prix des partenaires par format »

## 2. Décisions validées

1. **Notion « Partenaire » dédiée à créer** : référentiel indépendant (ni un flag sur `Client` ni sur `B2BClient`). Gestion dédiée des privilèges de prix.
2. **Grille par partenaire ET par format** : chaque partenaire a sa propre grille (un prix par `ProductVariant`). À la vente, la ligne se pré-remplit avec le prix partenaire du format et **reste modifiable** par tout vendeur.
3. **Périmètre : ventes comptoir (POS) uniquement** (`POST /api/sales`, écran Ventes → Nouvelle vente). Aucune incidence sur les documents B2B, les contrats, ni les commandes web.
4. **Champ « Partenaire » dédié**, à côté du champ client B2B dans l'écran de vente (pas de liste unifiée, pas d'interrupteur). Choisir un partenaire pré-remplit le client de la vente et active ses prix privilégiés.
5. **ADMIN gère** les partenaires et leur grille (nouveau module de permission `partenaires`) ; **tout vendeur** peut ajuster le prix d'une ligne partenaire à la vente.
6. **Fiche partenaire** : `name` (obligatoire), `companyName`, `phone`, `email`, `address`, `notes`, `isActive`.
7. **Traçabilité** : tout prix appliqué ≠ prix public (prix partenaire ou ajustement manuel) est **journalisé** dans le journal d'activité (`logActivity`, module « ventes »).
8. **Grille partielle** : un partenaire peut ne pas avoir de prix pour certains formats → la ligne reste au **prix public** (et reste modifiable).

## 3. Modèle de données (Prisma + migration Neon)

### 3.1 Nouvelles tables

| Modèle Prisma | Colonnes | Annotations |
|---|---|---|
| `Partner` | `id`, `name String`, `companyName String?`, `phone String?`, `email String?`, `address String?`, `notes String?`, `isActive Boolean @default(true)`, `createdById String?`, `createdAt`, `updatedAt` | `@@index([isActive])`, `@@index([name])` |
| `PartnerPrice` | `id`, `partnerId → Partner` (Cascade), `variantId → ProductVariant` (Cascade), `price Float`, `createdAt`, `updatedAt` | `@@unique([partnerId, variantId])`, `@@index([partnerId])`, `@@index([variantId])` |

Un seul prix par couple `(partenaire, format)`. `price` est une **valeur absolue** (FCFA), pas un pourcentage.

### 3.2 Extensions de tables existantes

- `Order` += `partnerId String?` → `Partner?` (onDelete `SetNull`) + `@@index([partnerId])`.
- `ProductVariant` += relation inverse `partnerPrices PartnerPrice[]`.

### 3.3 Migration

Fichier **`prisma/partner-migration.sql`** écrit à la main (convention du repo, comme `prisma/delivery-model-migration.sql`, `prisma/order-cashier-migration.sql`, `prisma/commercial-module-migration.sql`), appliqué **à la main sur Neon**, puis `npx prisma generate` + **redémarrage du serveur de dev** (sinon 500/404 massifs).

Contenu : `CREATE TABLE "Partner"`, `CREATE TABLE "PartnerPrice"` (+ contraintes uniques et FK), `ALTER TABLE "Order" ADD COLUMN "partnerId" TEXT`, FK `Order.partnerId → Partner.id ON DELETE SET NULL`, index `Order_partnerId_idx`, `PartnerPrice_partnerId_variantId_key`.

⚠️ Ne **pas** appliquer un `prisma migrate diff` complet : il supprimerait des tables hors périmètre (`SellerDailyStock`, `_backup_*`, …).

## 4. Règles métier

- **Prix appliqué à une ligne de vente** (avec partenaire sélectionné) : `unitPrice` saisi par le vendeur si fourni (≥ 0), sinon **prix partenaire du format** s'il est défini dans la grille, sinon **prix public** `ProductVariant.price`.
- **Sans partenaire** : prix public uniquement (comportement actuel inchangé) ; tout `unitPrice` envoyé est ignoré.
- Le prix négocié est **propre au couple (partenaire, format)** : deux partenaires peuvent avoir des prix différents pour le même format.
- **Grille partielle** autorisée : absence de prix partenaire pour un format = prix public.
- **Ajustement libre** : la ligne reste modifiable à la vente (bornes : prix ≥ 0).
- **Journalisation** : chaque fois que le prix appliqué diffère du prix public, écrire un `logActivity` (module « ventes ») avec : n° de commande, partenaire, format, prix public, prix appliqué, auteur.

## 5. Portée et droits

- Nouveau module **`partenaires`** dans `src/lib/permissions.ts` :
  - `PERMISSION_MODULES` += `"partenaires"` ; `PERMISSION_MODULE_LABELS += { partenaires: "Partenaires" }`.
  - `MODULE_ROLES.partenaires = ["ADMIN"]` (module réservé ADMIN).
  - Seed des `RoleProfile` (5 profils) mis à jour et **exécuté sur Neon** (le module apparaît dans Rôles & permissions).
- **Écritures** (création/édition/grille/suppression) : `requireManagementAccess(["ADMIN"], [["partenaires"]])` (le module `partenaires` déclaré ADMIN). Réservé ADMIN.
- **Lecture pour le champ de vente** : `GET /api/partenaires` doit être lisible par les rôles qui peuvent vendre au comptoir → garde alignée sur le POST de `/api/sales` : `requireManagementAccess(["ADMIN","STOCK_MANAGER", ...CASHIER_ROLES])`, **sans** `rule`. (Le COMPTABLE, l'OPERATEUR_ACCUEIL et les commerciaux en sont exclus, comme pour la vente.)

## 6. API (routes Next.js)

| Route | Méthodes | Garde | Rôle |
|---|---|---|---|
| `/api/partenaires` | GET | `["ADMIN","STOCK_MANAGER", ...CASHIER_ROLES]` | Liste des partenaires (+ grille si `?withPrices=1`) ; filtres `?q=` (nom/société), `?active=` |
| `/api/partenaires` | POST | `["ADMIN"], [["partenaires"]]` | Création d'un partenaire |
| `/api/partenaires/[id]` | GET | idem GET liste | Fiche + grille du partenaire |
| `/api/partenaires/[id]` | PATCH | `["ADMIN"], [["partenaires"]]` | Modification de la fiche |
| `/api/partenaires/[id]` | DELETE | `["ADMIN"], [["partenaires"]]` | Suppression refusée (400) si des commandes sont rattachées ; sinon suppression |
| `/api/partenaires/[id]/prix` | PUT | `["ADMIN"], [["partenaires"]]` | Remplace la grille : `{ prices: [{ variantId, price }] }` |

Détails :
- `GET /api/partenaires?withPrices=1` renvoie `[{ id, name, companyName, isActive, prices: [{ variantId, price }] }]`. C'est l'appel utilisé par l'écran de vente pour construire la table des prix.
- `PUT .../prix` : transaction — supprime les `PartnerPrice` du partenaire absentes de la liste, upsert des présentes ; ignore/`400` sur `variantId` inconnu ; `price ≥ 0` requis.
- Normalisations : `name` requis (trim), `isActive` booléen, `price` nombre fini ≥ 0.

## 7. Statut « Partenaire » sur la vente et impact `Order`

- `Order.partnerId` est **indépendant** de `Order.b2bClientId` (les deux peuvent coexister).
- `OrderItem.price` porte le prix appliqué (public ou négocié) ; `Order.subtotal`/`Order.total` sont recalculés sur ces prix.
- Aucune écriture sur le stock n'est modifiée (débit inchangé via `consumePointOfSaleStockTx`).

## 8. Pages et navigation

- Nouvelle page **`src/app/(admin)/admin/partenaires/page.tsx`** :
  - Liste des partenaires (recherche nom/société, badge actif/inactif).
  - Bouton « Nouveau partenaire » → fiche (name, companyName, phone, email, address, notes, isActive).
  - Partenaire sélectionné → **tableau des formats** : produit · format · prix public · **prix partenaire** (input) ; bouton Enregistrer qui appelle `PUT /api/partenaires/[id]/prix`.
  - Réservé ADMIN (le module `partenaires` n'est visible que pour ADMIN).
- Navigation (`src/components/shared/admin-top-nav.tsx`) : entrée **« Partenaires »** ajoutée à la section **Administration** (à côté de « Clients »), module `partenaires`, filtrée par `canSeeModule`.

## 9. Écran de vente (`src/app/(admin)/admin/ventes/page.tsx`)

- Nouvel état `partners` (chargé depuis `GET /api/partenaires?withPrices=1`) + `selectedPartner`.
- Nouveau champ **« Partenaire »** (recherche + liste déroulante) placé **à côté** du champ client B2B.
- Sélection d'un partenaire :
  - Pré-remplit `customerName`/`customerPhone` de la vente s'ils sont vides (sans toucher au champ client B2B).
  - Les lignes du panier prennent le **prix partenaire du format** s'il existe, sinon restent au prix public.
  - Le champ **prix de chaque ligne devient modifiable** (input) pour tout vendeur.
- Retrait/changement de partenaire : les lignes sont réinitialisées au prix public.
- `submitSale()` : envoie `partnerId` et, par ligne, `unitPrice` (prix de la ligne). Sans partenaire : `partnerId` absent, pas d'`unitPrice` (inchangé).
- Paiements mobile/carte (paiement asynchrone via `/api/payments/initiate`) : le partenaire et les prix sont transmis de la même façon au retour.

## 10. `POST /api/sales` (contrat étendu)

- Corps étendu : `partnerId?: string`, `items?: { variantId, quantity, unitPrice? }[]`.
- Si `partnerId` fourni :
  - Valider que le partenaire existe et est actif → sinon 400/404.
  - Charger sa grille ; pour chaque article : prix = `unitPrice` (si fini ≥ 0), sinon prix de la grille, sinon `variant.price`.
  - Renseigner `Order.partnerId`.
- Si `partnerId` absent : prix = `variant.price` ; `unitPrice` ignoré (comportement actuel).
- `subtotal = Σ (prix × quantité)` ; `OrderItem.price` = prix appliqué ; `total = subtotal` (livraison 0 en comptoir).
- Stock : débit inchangé (`consumePointOfSaleStockTx`, type `SALE`, raison « Vente comptoir »).
- Journalisation : pour chaque article dont le prix appliqué ≠ prix public, `logActivity` (module « ventes ») avec partenaire, format, prix public, prix appliqué.

## 11. Contrôles de qualité et déploiement

- `node node_modules/typescript/bin/tsc --noEmit` (0 erreur) et `node node_modules/eslint/bin/eslint.js src` (0 sur les fichiers touchés ; baseline éventuelle hors périmètre comptée à part).
- Test e2e jetable `scripts/tmp-*.mjs` (gitignoré, JWT forgé, salt `authjs.session-token` quand http / `__Secure-...` quand https) :
  1. ADMIN crée un partenaire + une grille (2 formats).
  2. Vente au comptoir à ce partenaire → prix négociés appliqués, `Order.partnerId` renseigné.
  3. Ajustement manuel d'une ligne (prix ≠ grille) → prix appliqué retenu.
  4. Vente **sans** partenaire → prix public (et `unitPrice` envoyé est ignoré).
  5. Format sans prix dans la grille → prix public.
  6. `logActivity` écrit pour tout prix ≠ public.
  7. Guards : écritures partenaires refusées hors ADMIN (403) ; lecture autorisée pour une caissière.
  8. **Nettoyage complet** des données de test.
- Déploiement : arrêter le dev :3000 (`$env:TEMP\lcg_dev.pid`), purger `.next` + `.open-next`, `Start-Process cmd /c "npm run deploy > deploy-current.log 2>&1"` + poll « deploy: OK », redémarrer le dev. Vérif prod : pages 200, endpoints partenaires répondent, une vente partenaire applique bien le prix négocié.
- Commit `feat:` FR une ligne, push sur `feat/report-lcgapp3`.

## 12. Ordre d'implémentation proposé

1. Schéma Prisma (`Partner`, `PartnerPrice`, `Order.partnerId`, `ProductVariant.partnerPrices`) + `prisma/partner-migration.sql` appliqué sur Neon + `prisma generate` + restart dev.
2. Module de permission `partenaires` (`permissions.ts`) + seed des `RoleProfile`.
3. API `/api/partenaires` (GET liste/grille, POST) et `/api/partenaires/[id]` (GET, PATCH, DELETE) et `/api/partenaires/[id]/prix` (PUT).
4. Page `/admin/partenaires` + entrée de nav Administration.
5. Extension `POST /api/sales` (`partnerId` + `unitPrice`) + journalisation.
6. Écran de vente : champ « Partenaire » + prix de ligne modifiable.
7. tsc/eslint, e2e, nettoyage, commit, push, deploy.

## 13. Hors périmètre (YAGNI)

- Pas de prix partenaire en pourcentage global ni de remise par partenaire.
- Pas d'application aux documents B2B / contrats / commandes web / livraisons.
- Pas de portail partenaire ni d'authentification partenaire.
- Pas de rattachement d'un partenaire à un `B2BClient` ou à un `Client` existant.
