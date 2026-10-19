# Filtres Devis / Factures / Livraisons B2B + cohérence

## Décisions user (2026-10-19)
- Garder **2 pages** : `/admin/devis-b2b` + `/admin/bons-b2b` (onglets Factures/Livraisons/Avoirs) — écran partagé `b2b-documents-screen.tsx`.
- **Tous les filtres** : client, période (du/au), état de règlement (factures), tri, réinitialiser, compteurs d'onglets.

## 1. API `GET /api/b2b-documents` (route.ts)
- Nouveaux params : `clientId`, `from`, `to` (AAAA-MM-JJ, regex + parse → 400 sinon ; `to` = fin de journée), `payment` (`PAID|PARTIAL|UNPAID|CANCELLED`, uniquement `type=FACTURE` sinon 400), `sort` (`date_desc|date_asc|amount_desc|amount_asc`, sinon 400).
- Restructuration : `baseWhere` (q + portée client + clientId + dates) → `countsWhere = {...baseWhere}` (sans type/statut/paiement) pour les compteurs d'onglets ; `where` = baseWhere + type/statut (+ `children none` en mode available) + ids paiement.
- `payment` : findMany candidates (id, total, payments VALIDATED, children AVOIR non-annulés) → calcule l'état facture (logique identique à `invoiceState` côté client) → `where.id = { in: ids }` (vide = 0 résultat).
- Portée : `client.is { id?, commercialId (si !seesAll) }`.
- Réponse `counts` (déjà groupBy) recalculée sur `countsWhere`.

## 2. UI `src/components/admin/b2b-documents-screen.tsx`
- États : `clientIdFilter`, `fromDate`, `toDate`, `payment`, `sort` ("date_desc"), `filterClients` (fetch mount `/api/clients?type=B2B&active=true`, auto-scopé pour le commercial simple).
- Effet liste : params supplémentaires ; deps étendues ; tout changement → `setPage(1)`.
- Barre de filtres (flex-wrap) : Recherche (+ bouton ✕ si vide) | Client | Statut | **Paiement (FACTURE)** | Du | Au | Tri | **Réinitialiser** (si `hasFilters`).
- `changeType` remise aussi `payment` à "" (sinon 400 côté API).
- `STATUS_BY_TYPE.FACTURE/AVOIR = ["INVOICED","CANCELLED"]` ; libellé contextuel « Émise » dans le select.
- Onglets : badge compteur depuis `data.counts`.
- État vide différencié (filtres actifs vs liste vide).

## 3. Vérifs
- `tsc --noEmit`, `eslint` sur fichiers touchés.
- e2e jetable `scripts/tmp-b2b-filters.mjs` (JWT dorcas/lyse, base dev) : params valides 200 + résultats cohérents ; `payment` hors FACTURE → 400 ; `sort`/`from` invalides → 400 ; portée inchangée ; pages 200 ; 401/403.
- Nettoyage script en fin de session.
