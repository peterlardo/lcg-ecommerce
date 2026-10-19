# Plan — « Les produits ne chargent pas » dans le formulaire de création de devis (B2B)

## Constat (analyse statique, lecture seule)

Fichier : `src/components/admin/b2b-documents-screen.tsx` (lignes 223-246, select 738-751).

- Le formulaire charge **clients + produits en un seul `Promise.all`** avec un `AbortController` commun.
- Le select affiche « Chargement des produits… » tant que `variants.length === 0` (l.748) — **état ambigu** : indistinguable d'une erreur, d'un catalogue vide ou d'un échec réseau.
- Échecs **silencieux** : `catch {}` vide (l.242) + aucune branche `else` quand `!productsRes.ok`. Si `/api/produits?all=1` renvoie 500/réseau, ou si **l'appel clients** throw, `setVariants` n'est **jamais** appelé → select bloqué à l'infini sans message.
- `src/app/api/produits/route.ts` GET : **aucun try/catch** — toute exception DB (`getProducts` → `bootstrapProducts`/`getActivePromotions`) = 500 HTML, avalé silencieusement côté UI.
- Race historique déjà corrigée par commit `df1fc9e` (retrait de la dep `clients.length` qui annulait le fetch produits) — vérifier d'abord que le bug reproduit **n'est pas** déjà ce qui a été corrigé (plainte éventuellement antérieure au fix).

Aucune cause trouvée côté données : `getProducts` renvoie bien `name/isActive/variants[]` attendus par `productOptions` (`src/lib/b2b-contract.ts:45`), et `/api/clients` (GET) est autorisé pour COMMERCIAL/RESPONSABLE_COMMERCIAL.

## Étapes

### 1. Reproduire (dev :3000, base Neon)
- Démarrer le dev server, se connecter comme **dorcas@lcg.cg** (COMMERCIAL) puis **lyse.kissari@lcg.cg** (RESPONSABLE_COMMERCIAL).
- Ouvrir `/admin/devis-b2b` → « Nouveau devis » → observer l'onglet Network/Console : statut de `GET /api/produits?all=1` et de `GET /api/clients?type=B2B...`.
- Tester aussi `GET /api/produits?all=1` directement (avec cookie de session) et relever status/temps de réponse.
- **Décider de la cause racine** : échec silencieux (500/abort) vs catalogue vide vs race déjà corrigée.

### 2. Fix — découpler clients et produits
Dans l'effet `creating` (`b2b-documents-screen.tsx:226`) :
- Remplacer `Promise.all` par deux appels **indépendants** (chacun avec son propre `try/catch`), de sorte qu'une défaillance des clients n'efface/bloque pas le chargement des produits (et inversement).

### 3. Fix — états explicites du select produits
- Ajouter un état `productsState: "loading" | "ready" | "error"` (+ message d'erreur).
- Select : « Chargement des produits… » (loading) / « Aucun produit disponible » (ready vide) / message d'erreur + bouton **Réessayer** (error) au lieu du `catch {}` muet.
- Ne plus déduire le chargement de `variants.length`.

### 4. Fix — robustesse de l'API
- `GET /api/produits` : envelopper dans `try/catch` → 500 JSON `{error}` (aujourd'hui non protégé).

### 5. (Optionnel) même durcissement sur `/admin/contrats-b2b` (page.tsx:62, même pattern fetch produits).

### 6. Vérification
- `npx tsc --noEmit` (0 erreur) + `npx eslint` sur les fichiers touchés (baseline : 28 problèmes préexistants dans `src`).
- Script jetable `scripts/tmp-*.mjs` (gitignoré, **pas de `process.exit()` dans le try**, cleanup en `finally`) : avec JWT forgé dorcas + lyse (salt `authjs.session-token`, secret `NEXTAUTH_SECRET` sans guillemets, cookie `authjs.session-token`) → `GET /api/produits?all=1` = 200 et tableau non vide avec variantes ; `GET /api/clients?type=B2B&active=true` = 200 ; les 2 rôles.
- Contrôle visuel du formulaire (dev) : select rempli dès l'ouverture, message d'erreur visible si on coupe le réseau.
- Arbre git : ne rien committer sans demande ; ne pas toucher au baseline eslint.

## Risques / contraintes
- Le repo est réécrit périodiquement par un autre agent : `git status` avant d'agir, commits récents autour de `b31d964` (partenaire remise).
- `eslint react-hooks/set-state-in-effect` bloquant → respecter le pattern `const init = async () => {...}; void init()`.
- Lire `node_modules/next/dist/docs/` avant d'écrire du code Next (règle AGENTS.md).
