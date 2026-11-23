# HQ 2.0 — Phase 0 : audit réel du dépôt

Audit rédigé le 23 novembre 2026 (heure de Toronto) sur la branche `cursor/klirline-control-center`, commit `d754179`. Aucun code applicatif n'a été modifié. Rien n'a été déployé, migré ni envoyé.

Sources lues : `README.md`, `wrangler.jsonc`, `package.json`, `src/` (worker, accès, moteur de démonstration, `hq/`, `org/`), `scripts/`, `public/app.js`, `knowledge/` (dont `bureau-architecture.md`, `hq-bureau.md`, `bureau-exploitation.md`, `procedures/`), l'historique git complet (47 commits, toutes branches) et l'historique Workers Builds du Worker (lecture seule).

## 1. Résumé

- Le centre a déjà l'ossature d'un siège : un Worker unique, un Durable Object SQLite par organisation (`CompanyState`), une authentification Cloudflare Access solide et deux couches de travail, les **commandes HQ** et les **missions**.
- Les commandes HQ ont une réservation atomique (claim avec bail de 30 min), un jeton de tentative haché, une reprise documentée et une preuve obligatoire pour clore.
- Les missions ont des tâches dépendantes, trois tentatives, un plafond de coût, une validation distincte de l'auteur liée à une empreinte du contenu, et un blocage des actions externes.
- Ce qui manque pour HQ 2.0 : un registre de rôles unique (deux organigrammes coexistent), l'autonomie A0 à A3, un journal de décisions durable, l'arrêt d'urgence, une file d'échecs, les heartbeats, l'idempotence à la création, les adaptateurs produit et une interface pour les missions.
- **Aucun agent ne s'exécute dans le Worker.** Les agents Grok réels lisent la file via `/api/hq/*`. C'est un bon choix et il faut le garder.
- Le scan des secrets sur l'arbre et l'historique ne trouve **aucun jeton, aucune clé et aucun mot de passe**. Il trouve quelques identifiants d'infrastructure et une adresse courriel personnelle dans les métadonnées des commits (section 6).

## 2. Ce qui existe et se réutilise

### 2.1 Déploiement

| Élément | Où | Constat |
| --- | --- | --- |
| Worker | `wrangler.jsonc`, `main: src/worker.js` | Domaine personnalisé `centre.klirline.com`, `nodejs_compat`, observabilité et traces actives. |
| Durable Object | `wrangler.jsonc` → `durable_objects.bindings[COMPANY]`, `exports.CompanyState` en `storage: "sqlite"` | Un seul binding. Les aperçus ont leur propre espace DO (`previews`). |
| Actifs | `assets.directory: ./.assets`, `run_worker_first: ["/api/*"]`, `scripts/stage-assets.mjs` | Les actifs sont copiés avant le déploiement (`npm run deploy`). |
| Workers Builds | Configuré dans le tableau de bord, pas dans le dépôt | Lecture seule de l'API Builds : le dernier build de production est `d754179`, le 9 nov. 2026 à 9 h 12 (heure de Toronto), et il a réussi. Les 8 builds listés portent tous sur `cursor/klirline-control-center`. **Tout push sur cette branche part en production.** |
| Cron, Queues, alarmes DO | Absents | Aucun `triggers.crons`, aucun `queues`, aucun `alarm()` dans `CompanyState`. |
| Secrets attendus | Commentaire de `wrangler.jsonc` et `README.md` | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ACCESS_ACCOUNTS`, `ACCESS_SERVICE_CLIENT_IDS`, `PROSPECTS_READ_TOKEN`, et en plus `HQ_MACHINE_IDENTITIES` (lu dans `src/hq/machine-auth.js:18`). Aucune valeur dans le dépôt. |
| Pas de `AGENTS.md` | Racine | Le dépôt n'a pas de fichier `AGENTS.md`. Les règles d'agent sont dans `knowledge/` et `.cursor/skills/`. |

### 2.2 Authentification (à garder telle quelle)

- `src/worker.js:52` `authenticate()` lit `Cf-Access-Jwt-Assertion` puis appelle `verifyAccessJwt()` (`src/access.js:150`). La signature RS256 est vérifiée avec les certificats de l'équipe (mis en cache 1 h, `src/worker.js:31`), ainsi que `iss`, `aud`, `exp` et `nbf`.
- **JWT humain** : il porte un courriel, puis le rôle et l'`orgId` sont pris dans `ACCESS_ACCOUNTS` (`parseAccessAccounts`, `identityFromAccess`). Les portées viennent de `accessScopes()` (`src/hq/machine-auth.js:97`) : `ceo`, `coo` et `chief-of-staff` ont `work` et `review`, les autres seulement `work`.
- **JWT de service** : pas de courriel, `common_name` en `<32 hex>.access`, `type: app`. Il est accepté seulement si le Client ID figure dans `ACCESS_SERVICE_CLIENT_IDS`. Deux cas :
  - si `HQ_MACHINE_IDENTITIES` contient une fiche avec cet `accessClientId`, l'identité vient de cette fiche (`resolveServiceMachine`, scopes `work`/`review`) ;
  - sinon, c'est `service:hq-poll` (`bindServiceIdentity`), sur l'unique `orgId` de `ACCESS_ACCOUNTS`.
- `assertServiceRoute()` (`src/access.js:117`) limite toute identité de service à `/api/hq/*`.
- Limitation de débit : 60 requêtes par minute par IP puis par courriel, dans un DO dédié `api-rate` (`src/limits.js`, `CompanyState.consume`, `src/worker.js:227`). Corps limité à 32 Ko (`readJson`).
- Les routes publiques sont `/api/health`, `GET /api/sites` et `/api/playbooks/*` (`src/routes.js`). Tout le reste de `/api/*` passe par Access.

### 2.3 Durable Object `CompanyState` (`src/worker.js:113`)

Tables créées au constructeur, sans migration de classe :

| Table | Schéma | Usage |
| --- | --- | --- |
| `company` | `id, body` (JSON) | État de la journée de démonstration des 34 postes, ligne `main`. |
| `hq_command` | `id, status, owner_slug, division, created_at, body` + index `hq_command_lookup` (`src/hq/sql.js`) | Commandes du bureau réel. |
| `hq_mission` | `id, status, owner_slug, created_at, body` + index `hq_mission_lookup` | Missions, avec tâches, livrables, brouillons, approbations et événements dans `body`. |
| `rate` | `key, window_start, count` | Compteur de débit (dans l'objet `api-rate`). |

Les méthodes RPC (`hqClaim`, `hqComplete`, `hqMissionOperate`…) font la lecture, la décision pure (`decideClaim`, `decideCompletion`, `runMissionOperation`) puis l'écriture **dans le même appel synchrone du DO**. Ce schéma lecture-décision-écriture est atomique, parce qu'un DO exécute ses requêtes une par une. C'est la base de la « réservation atomique » de la phase 2.

### 2.4 Commandes HQ (`src/hq/commands.js`, `src/hq/dispatch.js`)

- 9 statuts (`HQ_STATUSES`) : `pending, queued, dispatched, running, awaiting_validation, blocked, done, failed, cancelled`.
- `decideClaim()` (l. 263) : un claim sur `pending`/`queued` émet un bail (`issueLease`, 30 min, `HQ_LEASE_MS`) et un `claimToken` montré une seule fois, dont seule l'empreinte SHA-256 est stockée. Un second claim pendant le bail répond `held`. Un bail `dispatched` expiré donne une reprise documentée. Un `running` trop ancien passe `blocked`.
- `decideCompletion()` (l. 208) : écrire un résultat exige `attemptId` et `claimToken`, ou une identité qui a `review` ou qui est humaine. Une seconde écriture identique répond `duplicate`, ce qui donne une **idempotence de complétion**.
- `rejectImpersonation()` (l. 194) refuse `actorId`, `role`, `orgId`, `validatorId`, `createdBy`, `readers`, `permissions` et `makeAdmin` dans tout corps de requête.
- `routeCommand()` (`src/hq/roster.js:189`) route par mots-clés vers 15 cartes.

### 2.5 Missions (`src/hq/missions.js`)

- Machine d'états `TRANSITIONS` (l. 8) : `qualify → ready → running → in_review → done`, avec `blocked`, `rework`, `failed` et `cancelled`.
- Tâches avec `dependsOn`, `attempts`/`maxAttempts = 3` et lien vers une commande HQ (`startMissionTask`, l. 218).
- Coût : `cost.capCents = 0` par défaut, et `recordCost()` refuse tout dépassement (409). `runModelAdapter()` (`src/hq/model-run.js:20`) refuse tout appel de modèle quand le plafond vaut 0 $.
- Validation : `decideMission()` (l. 354) exige que le validateur ne soit pas l'auteur et soit `validatorId` (`coo` par défaut) ou `ceo`. L'approbation est liée à `missionContentHash()` (empreinte FNV de l'objectif, du critère et des livrables) et expire après 7 jours. Tout nouveau livrable l'invalide.
- Actions externes : `prepareExternalAction()` (l. 396) enregistre un brouillon (`sent: false`) et répond toujours 403, que la mission soit approuvée ou non. Aucun envoi n'est possible.
- Garde-fous métier : `claimsBookedDemos()` refuse qu'un résultat compte des démonstrations non réservées.
- Deux modèles existent, `klirprospect-demos` (4 tâches) et `klirprospect-synthese` (1 tâche, exécutée par `scripts/hq-executor.mjs` en `deterministic-script`).

### 2.6 Organisation et bureau

- **34 postes de démonstration** (`src/org/*.js`, `DEPARTMENTS` dans `src/org/index.js:10`) : 7 départements (direction 3, ventes 5, marketing 4, opérations 9 dont 8 chefs produit, clients 5, finance 6, sécurité 2). Ils servent `ACCESS_ACCOUNTS.role` et le moteur `src/engine.js` (`decide`, `execute`, `logCall`, `issueCommand`), avec les seuils de `THRESHOLDS` (`src/policy.js`) : paiement 500 $, contrat 2 500 $, remise 10 %, publicité 1 000 $, 4 courriels au plus.
- **15 cartes HQ** (`HQ_ROSTER`, `src/hq/roster.js:15`) : les agents Grok réels (Office, Ops, KlirBuild, KlirMarket, KlirProspect, Klirline AI, NORIA, BWN, Social, YouTube, deux comptes de trading, All Question, Sandbox). `officeProfile()` les marque tous `executable: false`, `costCapCents: 0`.
- Inventaire des connexions (`src/hq/connections.js`) : KlirProspect en lecture optionnelle, courriel désactivé, calendrier et GitHub absents, `send: false` partout.
- Registre de compétences (`src/hq/skills.js`) : consultatif, `enabled: false`, et `POST /api/hq/skills` répond 403.
- Dossiers clients de démonstration (`src/hq/clients.js`) avec une liste de lecteurs (`readers`), ce qui donne un modèle d'isolation réutilisable.
- Interface : l'onglet **Bureau** de `public/app.js` (l. 563 à 860) affiche le roster et les commandes, crée une commande et change un statut par PATCH. **Il n'affiche aucune mission** : `public/app.js` n'appelle jamais `/api/hq/missions`.
- Procédures versionnées : `knowledge/procedures/` contient 13 procédures, dont KlirProspect (synthèse, qualité de liste, relance de démo), commercial, KlirPay et support.

### 2.7 Tests existants

| Commande | Ce qu'elle vérifie |
| --- | --- |
| `node src/self-check.js` | Moteur de démonstration, chaîne de validation, Access (JWT humain et service), commandes, missions, SQL HQ sur `node:sqlite`. |
| `node scripts/hq-flow.mjs` | Serveur local : commande `pending → done` par une identité machine. |
| `node scripts/hq-execution-check.mjs` | Mission `klirprospect-synthese` de bout en bout : exécuteur `machine-klirprospect`, relecteur `coo`, preuve JSON. |
| `node scripts/hq-do-check.mjs` | `wrangler dev --local` : tables du DO, mission persistée après redémarrage, brouillon non envoyé. |

Les sorties réelles sont dans la section 8.

## 3. Ce qui manque pour HQ 2.0

| Besoin HQ 2.0 | État | Écart |
| --- | --- | --- |
| Registre de 36 rôles | Partiel | Deux organigrammes séparés (34 postes de démonstration et 15 cartes réelles) sans lien entre eux. Pas de « planificateur stratégique », pas de « directeur technologie » ni de département Produits et marchés. Pas d'état actif/inactif par rôle. |
| Autonomie A0 à A3 | Absent | Seul `LEVEL` (AUTO, SUPERVISOR, CEO) existe, dans le moteur de démonstration. Les routes HQ ne connaissent que les portées `work` et `review`. |
| Approbation humaine **prouvée** | Insuffisant | `decideMission()` ne vérifie pas `options.human`. Une identité machine configurée avec `actorId: "coo"` et la portée `review` (c'est le cas de l'exemple `config/hq-machines.example.json`) peut approuver une mission. |
| Journal des décisions | Absent | Les `events` d'une mission sont limités à 80 (`EVENT_LIMIT`) et réécrits avec le corps. Aucun journal append-only, aucune décision motivée (options, analyse, sources). |
| Budgets | Partiel | Un `capCents` par mission, à 0. Pas de budget par rôle, par département ni par mois, et pas de registre des dépenses. |
| Arrêt d'urgence | Absent | `interrupt` ajoute une note sans changer le statut ni révoquer le bail. Aucun interrupteur global. |
| Heartbeats | Absent | Le bail est fixe (30 min) et il n'y a pas de renouvellement. `officeProfile()` annonce « 15 minutes », ce qui contredit le code. |
| File d'échecs | Partiel | `blocked` et `failed` existent, mais aucune vue ni aucune règle de reprise, et aucun motif structuré. |
| Idempotence à la création | Absent | `POST /api/hq/command` et `POST /api/hq/missions` n'acceptent aucune clé d'idempotence. Un double envoi crée deux objets. |
| Planificateur (réveil, expiration) | Absent | Aucun cron ni aucune alarme DO. Les baux expirés ne sont traités qu'au prochain claim. |
| Adaptateurs produit | Partiel | Seule la lecture KlirProspect existe (`src/prospect-feed.js`), vers une fonction Supabase avec `PROSPECTS_READ_TOKEN`, et elle n'alimente que la démonstration. Rien pour Klir AI, GitHub, KlirPay, NORIA, KlirBuild ni KlirMarket. |
| CRM / Sales Center | Absent dans le centre | `clients.js` contient 2 dossiers fictifs. KlirProspect reste la source des fiches. Le pipeline Découvert → Gagné/Perdu n'existe nulle part ici. |
| Interface du bureau virtuel | Partiel | Le Bureau gère les commandes, pas les missions, les approbations, les décisions ni les budgets. |
| Tests | Partiel | Scripts maison sans exécuteur commun (`package.json` n'a pas de `test`). Le port du test DO est figé à 8791. Il n'y a pas de CI dans le dépôt. |

## 4. Risques

| # | Risque | Gravité | Détail et preuve |
| --- | --- | --- | --- |
| R1 | Le push sur la branche de base déploie la production | Élevée | Workers Builds construit `cursor/klirline-control-center` (8 builds sur 8). Toute PR fusionnée part en ligne sans étape d'approbation dans le dépôt. |
| R2 | Une machine peut approuver comme un humain | Élevée | `decideMission()` (`src/hq/missions.js:354`) et la branche `reviewer` de `decideCompletion()` (`src/hq/commands.js:245`) acceptent une portée `review` sans exiger `human === true`. C'est contraire à A3. |
| R3 | Statut modifiable sans jeton de tentative | Moyenne | Un `PATCH` sans `result` ni `proof` (`decideCompletion`, branche `!writesResult`) change le statut (par exemple `cancelled`, `pending` ou `awaiting_validation`) pour toute identité authentifiée, y compris `service:hq-poll`. `POST /api/hq/command` et `/interrupt` ne vérifient pas non plus la portée `work`. |
| R4 | Dépôt public | Moyenne | Le code, les procédures, la conception d'Access, les noms d'équipe et l'identifiant du Worker sont lisibles par tous (section 6). Il n'y a pas de secret, mais la surface est documentée publiquement. |
| R5 | Fenêtres de lecture tronquées | Moyenne | `hqMissionOperate` passe `hqList({})` (limité à 200 commandes) à `runMissionOperation`. Au-delà de 200 commandes, la commande d'une tâche ancienne n'est plus trouvée : `startMissionTask` en recrée une, et `addDeliverable` répond 409. `HQ_MISSION_SELECT` est limité à 100. |
| R6 | Journal non durable | Moyenne | Les événements sont limités à 80 et stockés dans le corps JSON. Une réécriture complète du corps peut perdre l'historique, et rien ne reste pour un audit. |
| R7 | Un seul DO de débit pour tout le trafic | Faible | L'objet `api-rate` reçoit chaque requête `/api/*`, ce qui en fait un goulot (un DO traite ses requêtes en série). C'est acceptable au volume actuel, à surveiller avec des agents qui interrogent souvent. |
| R8 | Documentation incohérente | Faible | Le bail est de 15 min selon `roster.js` et `knowledge/bureau-architecture.md`, mais de 30 min dans le code. Le commit #9 parle aussi de 15 min. |
| R9 | Coût et dette d'un JSON par ligne | Faible | Une mission complète (tâches, livrables jusqu'à 4 000 caractères, brouillons, approbations) tient dans une seule cellule. Le plafond d'une ligne SQLite de DO est de 2 Mo. Il faut externaliser les livrables volumineux. |
| R10 | Aucune CI ni branche protégée visible | Moyenne | Les tests ne tournent pas avant le build, et rien dans le dépôt n'empêche un push direct. |

## 5. Contraintes Cloudflare

- **Durable Objects SQLite** : une instance traite ses requêtes en série, ce qui garantit l'atomicité claim/écriture sans verrou. Limites documentées : 10 Go par objet, 2 Mo par ligne. Ajouter une table avec `CREATE TABLE IF NOT EXISTS` ne demande **aucune migration de classe** dans `wrangler.jsonc`. Ajouter une nouvelle classe DO en demanderait une, ce qui est à éviter.
- **Alarmes DO** : une seule alarme programmée par objet, et un gestionnaire limité à 15 minutes de temps réel. Une alarme reprogrammée à la prochaine échéance (bail, heartbeat, rappel d'approbation) suffit. Elle évite un cron global.
- **Cron Triggers** : un appel planifié dure au plus 15 minutes. C'est utile pour un rapport quotidien, pas indispensable.
- **Queues** : disponibles sur le plan gratuit depuis le 4 févr. 2026 (10 000 opérations par jour, rétention de 24 h). Sur le plan payant, 1 M d'opérations par mois sont incluses, puis 0,40 $ US par million. **Elles ne sont pas nécessaires** : les agents réels sont externes et font du *pull* sur `/api/hq/*`. La file persistante, c'est la table SQLite du DO. Le plan Workers actuel du compte n'a pas été vérifié.
- **Coût** : le plan Workers Paid coûte au minimum 5 $ US par mois par compte, s'il n'est pas déjà actif. Le surcoût de HQ 2.0 tient surtout aux **appels de modèle** des agents, pas à Cloudflare. Ces appels sont aujourd'hui interdits par `capCents = 0`.
- **Aperçus** : `previews` donne à chaque aperçu son propre DO. Les URL d'aperçu sont publiques tant qu'Access ne les protège pas (`knowledge/bureau-exploitation.md`). Il faut les protéger avant de tester HQ 2.0 sur un aperçu.

## 6. Scan des secrets et des données sensibles

Méthode : `gitleaks 8.21.2` en mode `git --log-opts=--all` (43 commits analysés) et en mode `dir` sur l'arbre, puis des greps de motifs sur `git log --all -p` (47 commits, toutes branches) : courriels, Client ID Access, domaines d'équipe Access, empreintes hexadécimales de 32 et 64 caractères, JWT (`eyJ…`), préfixes de clés Stripe, GitHub, Slack, AWS et Google, clés privées PEM, références Supabase, numéros de téléphone, `password`, `secret=` et `token=`. Aucune valeur n'est reproduite ici.

**Résultat : aucun jeton, aucune clé d'API, aucune clé privée, aucun JWT et aucun mot de passe dans l'arbre ni dans l'historique.** Aucun fichier `.env`, `.dev.vars`, `data/` ou `.wrangler/` n'a jamais été commité.

| # | Fichier | Commit(s) | Type | Gravité | Action proposée |
| --- | --- | --- | --- | --- | --- |
| S1 | `knowledge/bureau-exploitation.md` (l. 56) | introduit dans `bbb5a77`, encore présent dans `d754179` et HEAD | Identifiant interne du Worker Cloudflare (32 hex). Gitleaks le signale à tort comme `generic-api-key`. | Faible : ce n'est pas un secret, il ne donne aucun accès. | Facultatif : remplacer par `<worker_id>` dans une prochaine PR. |
| S2 | `knowledge/bureau-exploitation.md` (l. 29) | `bbb5a77`, `d754179` | Nom réel de l'équipe Cloudflare Zero Trust. | Faible : la redirection publique de `centre.klirline.com` l'expose déjà. | Facultatif : le remplacer par `<équipe>`. |
| S3 | `src/prospect-feed.js` (l. 1) | depuis `8cde9b0` | Référence de projet Supabase dans l'URL de la fonction `prospects`. | Faible : c'est un point d'accès protégé par un jeton bearer, qui reste hors du dépôt. | Garder, ou la déplacer en variable d'environnement non secrète. |
| S4 | Métadonnées git (auteur de 10 commits de fusion et ligne `Co-authored-by` de plusieurs messages) | `f37b80d` à `d754179` | Adresse courriel personnelle du fondateur. | Moyenne (donnée personnelle) : elle est publique tant que le dépôt l'est. | La réécriture de l'historique est déconseillée. Il vaut mieux remettre le dépôt en privé, ou activer « Keep my email address private » dans GitHub pour les prochains commits. |
| S5 | `src/seed.js`, `src/self-check.js`, `knowledge/` | plusieurs | Courriels en `@example.com` ou `.example` et numéros en 555 | Aucune : données fictives. | Rien. |
| S6 | `knowledge/bureau-exploitation.md` | `bbb5a77` | Identifiant de build Workers Builds | Aucune | Rien. |

Les Client ID et les AUD présents dans les tests sont des valeurs factices (`aaaa…`, `bbbb…`, `cccc…`).

## 7. Effort honnête

Estimation pour un agent de développement assisté, avec la relecture de Philippe à chaque phase. Un « jour » correspond à une journée de travail effectif, sans compter l'attente des validations.

| Phase | Effort |
| --- | --- |
| 1. Registre des rôles | 1,5 à 2 j |
| 2. Orchestrateur | 4 à 6 j |
| 3. Politique et journal des décisions | 3 à 4 j |
| 4. Adaptateurs (7 produits) | 8 à 14 j, selon l'API réelle de chaque produit (non auditée ici) |
| 5. Interface du bureau virtuel | 4 à 6 j |
| 6. Trois missions pilotes | 3 à 5 j, dont l'attente des approbations |
| 7. Sécurité et qualité | 3 à 4 j, dont une partie en continu |
| **Total** | **27 à 41 jours effectifs**, soit environ 6 à 10 semaines calendaires avec les validations |

Le plan détaillé se trouve dans `docs/hq2/plan.md`. L'architecture cible est dans `docs/hq2/architecture.md`.

## 8. Sortie réelle des tests (23 nov. 2026, Node v24.22.1)

```text
$ node src/self-check.js
OK — 34 postes, 46 tâches, chaîne de validation tenue.

$ node scripts/hq-flow.mjs
OK — commande hq-c8ecfe27-76d9-400a-9a10-caeabb2cb7fd : pending → done. Démonstration et hub intacts.

$ node scripts/hq-execution-check.mjs
… (JSON de la mission : approbation et transition in_review → done par "coo", exécuteur "machine-klirprospect")
OK — preuve /tmp/klirline-execution-proof-520254.json

$ node scripts/hq-do-check.mjs
✘ [ERROR] Address already in use (127.0.0.1:8791)
Error: wrangler dev s'est arrêté (1).
```

Le test DO a échoué **pour une raison d'environnement** : le port 8791, codé en dur dans le script, était déjà occupé sur la machine d'audit par un autre processus. Une copie temporaire du script (port 8893, sans autre changement, supprimée ensuite) a réussi :

```text
{ "runtime": "local-workerd", "remoteCloudflare": false,
  "tables": ["__miniflare_do_name","company","hq_command","hq_mission"],
  "status": "rework", "deliverables": 2, "draftSent": false }
OK — Durable Object local, stockage conservé après redémarrage.
```

Ce sont des tests locaux (`node:sqlite`, workerd local). Aucun test n'a touché Cloudflare à distance.
