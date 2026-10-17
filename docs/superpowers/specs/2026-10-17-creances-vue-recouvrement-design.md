# Recouvrement des créances B2B — sous-projet A : vue recouvrement (KPI + balance âgée + encours par client)

Date : 2026-10-17
Statut : design validé oralement par l'utilisateur (réponse « OUI » au design présenté) — **à relire par l'utilisateur**.

## 1. Contexte et objectif

L'application POS LCG facture ses clients B2B (documents `FACTURE` du module B2B) et encaisse des règlements. Le module actuel permet de **lister** les factures non soldées et d'enregistrer des règlements, mais ne donne aucune **vision de pilotage du recouvrement** : pas de total à recevoir, pas de retard agrégé, pas de balance âgée, pas d'encours par client, alors que le plafond de crédit (`Client.creditLimit`) n'est affiché que de façon cosmétique.

> Demande utilisateur (verbatim) :
> - « comment traiter les créances des factures de la lcg »
> - interrogé sur l'ampleur du travail : « oui. Tout ce qui existe dans ce genre de cas de façon professionnelle »
> - découpage validé : « A → B → C → D → E (Recommandé) »
> - emplacement de cette vue : « Dans /admin/creances, en onglets (Recommandé) »

**Objectif de ce spec (sous-projet A)** : dans l'écran `/admin/creances` existant, ajouter une **vue de pilotage du recouvrement** en lecture seule — bandeau d'indicateurs, **balance âgée** et **encours par client** — calculée exactement sur les mêmes données que la liste de créances actuelle.

### Découpage d'ensemble (chaque sous-projet aura son propre cycle spec → plan → implémentation)

| # | Sous-projet | Contenu | État |
|---|---|---|---|
| **A** | **Vue recouvrement** | KPI de recouvrement + balance âgée + encours par client, en onglets dans `/admin/creances` | **ce spec** |
| B | Promesses de paiement | saisie/suivi sur la facture (`PaymentPromise` existe en base, aucune UI/API), statuts tenue/méconvenue, plan de trésorerie | à venir |
| C | Relances | modèle de message par canal, envoi réel ou copie 1 clic, relances automatiques (J-3, J+5, J+15), historique et compteurs | à venir |
| D | Relevé de compte client | relevé imprimable + exports PDF/Excel (mêmes libs que les rapports) | à venir |
| E | Contrôle du plafond de crédit | alerte/blocage à la création de facture (aujourd'hui cosmétique) | à venir |

Contraintes connues, rappelées lors du cadrage : pas d'envoi d'e-mail fonctionnel (identifiants SMTP Brevo invalides), aucun fournisseur SMS/WhatsApp payant en place, l'application tourne aussi sur un poste POS (cibles tactiles ≥ 44 px, pas de fonctionnalité dépendant du survol).

## 2. Décisions validées

1. **Une seule source de vérité.** Les agrégats sont calculés **depuis le tableau de `creanceLines()`** — la fonction qui alimente déjà la liste — et non en SQL (`groupBy`) ni dans la page. Évite toute divergence entre le total affiché et la somme des lignes.
2. **Étendre la route existante** `GET /api/commercial/creances` (même chemin, mêmes garde et portée) avec trois objets supplémentaires : `summary`, `aging`, `byClient`. Pas de nouvelle route, pas de nouvelle permission.
3. **Montants sur le solde.** Tous les agrégats portent sur `balance` = reste **à recouvrer** (`open` = total − avoirs − validé − en attente, puis − promesses en attente). Les promesses sont affichées **à part** (jamais fondues dans le retard).
4. **Balance âgée par échéance.** Les tranches sont calculées d'après `dueDate` (échéance = `createdAt` + `paymentTermsDays` du contrat ACTIVE, défaut 30 j) — la date contractuelle — et non d'après l'ancienneté de la facture.
5. **Lecture seule.** Les onglets « Balance âgée » et « Par client » ne portent aucune action. Les actions (Encaisser / Relancer / Valider) restent dans l'onglet « Factures ouvertes », inchangé.
6. **Aucun changement de schéma, aucune migration.** A n'écrit rien en base (les trois helpers sont purs). Les seules modifications de données transmises sont des **colonnes ajoutées au `select`** existant (`commercial`, et deux compteurs calculés en mémoire).

Approches écartées : calcul dans la page React (duplication de la règle de solde, risque d'écart avec la liste) ; route `groupBy` SQL (réimplémente la notion de solde et d'avoirs en SQL, écart garanti avec la liste).

## 3. Périmètre

**Dans le périmètre (A)** :

- Trois helpers purs dans `src/lib/commercial.ts` : `creanceSummary`, `creanceAging`, `creanceByClient`.
- Deux champs ajoutés aux lignes de créance : `commercialName` et `promisePendingCount` (aucune requête supplémentaire : les données sont déjà sélectionnées).
- Extension de la réponse de `GET /api/commercial/creances`.
- Refonte de `/admin/creances` en **bandeau de KPI + 3 onglets**.

**Hors périmètre (A)** : saisie/suivi de promesses (B), envoi réel de relances (C), relevé de compte et exports PDF/Excel (D), blocage au plafond (E), nouvelle notion « règlements à valider » dans le bandeau (prévue en C), interface de réglage des délais de paiement, toute écriture en base.

## 4. Modèle de données

**Aucun changement de schéma Prisma, aucune migration Neon.** A est en lecture seule.

Modifications de code sur les données lues (`src/lib/commercial.ts`, fonction `creanceLines`) :

- `select.client` gagne `commercial: { select: { name: true } }` (relation `Client.commercial` → `User?`, scalaire `commercialId`).
- `CreanceLine` gagne deux champs :
  - `commercialName: string | null` = `d.client?.commercial?.name ?? null` ;
  - `promisePendingCount: number` = nombre de promesses `PENDING` de la facture (compté sur `d.promises`, déjà sélectionnées).
- La règle de filtrage de la liste ne change pas (`balance > 0.005 || pendingAmount > 0`, factures `FACTURE` + `INVOICED`, `clientId` non nul).

## 5. Contrats de données

Trois fonctions **pures** exportées de `src/lib/commercial.ts` (entrée : `CreanceLine[]`, éventuellement `now: Date`) — testables sans base de données.

```ts
export type CreanceSummary = {
  totalBalance: number          // Σ max(0, balance) arrondi à 2 déc.
  overdueBalance: number        // Σ balance des lignes en retard (overdue === true)
  notYetDueBalance: number      // totalBalance − overdueBalance
  openInvoices: number          // nombre de lignes avec balance > 0.005
  debtorClients: number         // nombre de clientId distincts avec balance > 0.005
  promisePendingAmount: number  // Σ promisePending (déjà déduit de balance)
  promisePendingCount: number   // Σ promisePendingCount
  clientsOverLimit: number      // clients dont l'encours dépasse le plafond défini
  creditLimitTotal: number      // Σ des plafonds définis des clients présents
}

export type AgingBucketKey = "not_due" | "d1_30" | "d31_60" | "d61_90" | "d90_plus"
export type AgingBucket = {
  key: AgingBucketKey
  label: string        // "Non échu" | "1 à 30 j" | "31 à 60 j" | "61 à 90 j" | "+ 90 j"
  balance: number
  count: number        // nombre de factures de la tranche
  clients: number      // nombre de clients distincts de la tranche
}
export type ClientCreance = {
  clientId: string
  clientName: string
  balance: number
  overdueBalance: number
  oldestOverdueDays: number   // 0 si aucun retard
  creditLimit: number | null
  overLimit: boolean          // creditLimit !== null && balance > creditLimit + 0.01
  openInvoices: number        // factures avec balance > 0.005
  nextDueDate: string | null  // ISO de la plus proche échéance parmi les factures ouvertes
  commercialName: string | null
}
```

### 5.1 Balance âgée (`creanceAging`)

- Une ligne à solde > 0,005 va dans `not_due` si elle n'est pas en retard (`overdue === false`, champ existant calculé comme `balance > 0 && dueDate < now`), sinon dans la tranche de son retard.
- `daysLate = floor((now − dueDate) / 86 400 000)` pour les lignes en retard ; `1..30` → `d1_30` ; `31..60` → `d31_60` ; `61..90` → `d61_90` ; `> 90` → `d90_plus`.
- Les cinq tranches sont **toujours renvoyées**, même vides (affichage stable).
- **Invariant : Σ des `balance` des cinq tranches = `summary.totalBalance`** (tolérance 0,01 FCFA, arrondis à 2 déc.).
- **Seules les lignes à `balance > 0,005` entrent dans la balance âgée** : les lignes à solde nul (règlement encore en attente de validation) ne comptent ni en montant, ni en `count`, ni en `clients` — elles restent visibles dans l'onglet « Factures ouvertes ». Sans cette règle, une facture soldée mais échue gonflerait le nombre de factures « en retard ».

### 5.2 Encours par client (`creanceByClient`)

- Regroupement par `clientId` sur les **seules lignes à `balance > 0,005`** (même exclusion que la balance âgée ; les lignes sans `clientId` — impossibles en pratique, le filtre SQL l'interdit — sont ignorées).
- Tri : `balance` décroissant, puis `clientName` croissant.
- `oldestOverdueDays` = `floor((now − min dueDate des lignes en retard) / 86 400 000)`, 0 s'il n'y a pas de retard.
- `nextDueDate` = plus petite échéance parmi les lignes à `balance > 0.005`.
- `clientsOverLimit` (résumé) et `overLimit` (ligne) = `creditLimit !== null && balance > creditLimit + 0.01` (même tolérance que l'écran actuel, qui colore ces lignes en rouge).
- `creditLimitTotal` = Σ des `creditLimit` non nuls des clients présents dans `byClient`.

## 6. API

`GET /api/commercial/creances` — **chemin, méthode, garde et portée inchangés** (`requireManagementAccess(["ADMIN", "COMMERCIAL", "COMPTABLE"])`, portée via `creanceLines(user)` : tout le portefeuille si `seesAllB2b`, sinon les clients du commercial ; `créances` réservé à ces trois rôles dans `permissions.ts`).

Réponse étendue :

```jsonc
{
  "creances": [ /* inchangé */ ],
  "count": 12,                                    // inchangé
  "total": 1234567.89,                            // inchangé (reste = summary.totalBalance)
  "canValidate": false,                           // inchangé
  "summary": { /* CreanceSummary */ },
  "aging": [ /* AgingBucket[5] */ ],
  "byClient": [ /* ClientCreance[] */ ]
}
```

Erreurs inchangées : 401 sans session, 403 sans droit sur `créances`, 500 avec `console.error` sur exception.

Note : `count` (inchangé) compte les lignes retenues par `creanceLines` (solde > 0,005 **ou** règlement en attente), tandis que `summary.openInvoices` ne compte que les factures à solde > 0,005. `count >= openInvoices` est donc normal ; le bandeau affiche `openInvoices`, la liste affiche `count`.

## 7. Interface — `/admin/creances`

Écran existant (`src/app/(admin)/admin/creances/page.tsx`), enrichi sans rien retirer :

- **Bandeau de KPI** (au-dessus des onglets) : « À recevoir » (`totalBalance`), « En retard » (`overdueBalance`, rouge), « Promesses en cours » (`promisePendingAmount` + nombre), « Clients débiteurs » (`debtorClients`), « Au-dessus du plafond » (`clientsOverLimit`), « Plafonds accordés » (`creditLimitTotal`).
- **3 onglets** :
  1. **Factures ouvertes** — la liste actuelle, **inchangée** (recherche, filtre « en retard seulement », colonnes, actions Encaisser / Relancer / Valider, arrivée par `?q=<référence>` depuis une facture ou un bon de livraison).
  2. **Balance âgée** — 5 colonnes (une par tranche), chacune avec son montant, son nombre de factures et de clients, et sous la colonne le détail des factures de la tranche (référence, client, montant, échéance, jours de retard).
  3. **Par client** — tableau : client, encours, dont en retard, plus ancien retard (jours), nombre de factures ouvertes, prochaine échéance, plafond / état (« dépassé » en rouge), commercial. **Clic sur un client → bascule sur l'onglet « Factures ouvertes » filtré sur ce client.**
- **Lien `?q=`** continue d'atterrir sur l'onglet « Factures ouvertes » (comportement actuel préservé).
- Les onglets « Balance âgée » et « Par client » sont **en lecture seule** (aucun bouton d'action).
- Contraintes POS : cibles tactiles ≥ 44 px, pas de dépendance au survol, tableaux scrollables horizontalement sur petit écran.

## 8. Tests

Script jetable `scripts/tmp-*.mjs` (gitignoré), exécuté avec `npx tsx` :

1. **Tests purs des helpers** (sans base) : jeu synthétique de `CreanceLine` couvrant les 5 tranches, une ligne à solde nul, un client sans plafond, un client à plusieurs factures, une promesse en attente → assertions sur `summary`, l'invariant Σ tranches = `totalBalance` (tolérance 0,01), le regroupement et le tri de `byClient`, la frontière `overLimit` (limite exacte / +0,01).
2. **HTTP sur dev :3000** (cookie JWT forgé, salt `authjs.session-token`) :
   - `GET /api/commercial/creances` en ADMIN → 200, présence de `summary` / `aging` (5 tranches) / `byClient` ;
   - **cohérence avec la liste** : les trois objets recalculés dans le script depuis `creances` doivent être égaux à ceux de la réponse ;
   - **portée commercial** : jeton du commercial (compte réel) → 200 et chaque `clientId` des lignes appartient aux clients de ce commercial (vérifié par une requête Prisma `Client.commercialId`) ;
   - **403** : rôle sans droit sur `créances` ;
   - **401** : sans cookie ;
   - page `/admin/creances` → 200.
3. Aucune écriture en base (pas de nettoyage nécessaire).

## 9. Contrôles qualité et mise en service

- `node node_modules/typescript/bin/tsc --noEmit` : 0 erreur ; `npx eslint` ciblé sur les fichiers touchés : aucun problème nouveau.
- Commit `feat(creances): ...` (une ligne, convention du repo). **Aucun changement de schéma ni de variable d'environnement.**
- Déploiement : à la demande de l'utilisateur (`npm run deploy`, dev arrêté au préalable).
- Vérification post-déploiement : `GET /api/commercial/creances` 200 avec les trois objets, page `/admin/creances` 200.

## 10. Ordre d'implémentation

1. `src/lib/commercial.ts` : `select.client.commercial`, champs `commercialName` / `promisePendingCount` sur `CreanceLine`, types et helpers purs (`creanceSummary`, `creanceAging`, `creanceByClient`).
2. `src/app/api/commercial/creances/route.ts` : appeler les trois helpers et les ajouter à la réponse.
3. Tests purs + tests HTTP (script jetable) → verts.
4. `src/app/(admin)/admin/creances/page.tsx` : bandeau de KPI, 3 onglets, renvoi clic-client → onglet Factures filtré.
5. `tsc` / `eslint`, vérification des pages, commit.

## 11. Points tranchés (ambiguïtés levées explicitement)

1. **Facture arrivée à échéance aujourd'hui** : `overdue === false` (le calcul existant exige `dueDate < now`) → tranche « Non échu ».
2. **Lignes à solde nul mais règlement en attente** : exclues de la balance âgée et de l'encours par client (ni montant, ni compte), inchangées dans la liste des factures ouvertes ; le KPI « règlements à valider » est renvoyé au sous-projet C.
3. **Clients sans plafond** (`creditLimit === null`) : jamais « au-dessus du plafond », exclus de `creditLimitTotal`.
4. **Plafond atteint à l'identique** (`balance === creditLimit`) : pas de dépassement (tolérance 0,01, identique à l'écran actuel).
5. **Promesses** : uniquement affichées (montant + nombre) ; jamais fusionnées dans le retard ni dans la balance âgée — elles expliquent une partie du solde.
6. **Devise** : FCFA, affichage via `formatPrice` existant ; tous les arrondis à 2 décimales.
7. **Portée** : A ne modifie pas la portée ; un commercial ne voit que ses clients, un ADMIN/COMPTABLE tout le portefeuille.
