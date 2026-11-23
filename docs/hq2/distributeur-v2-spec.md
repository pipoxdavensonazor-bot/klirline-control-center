# HQ 2.0 — Distributeur v2 : spécification couplée distributeur et serveur

Rédigé le 23 novembre 2026 vers 15 h 45 (heure de Toronto) par Grok Bot, pour Codex. **Spécification seulement** : aucun code produit, secret, réglage GitHub ou Cloudflare, ni aucune routine n'a été modifié. Ce document complète `distributeur-spec.md` (contrat cible) et `phase5-grokbot-audit.md` (fiches PH5-01 à PH5-15). Les numéros de ligne renvoient à `45c701a`. Codex vérifie d'abord ce que `1ab1a24` corrige déjà et ne réécrit pas ce qui l'est (contrôle : `probes/phase5/verify-bundle.sh`).

## 1. Ordre de livraison (sans casser le poll)

Le poll actuel fonctionne **grâce à** PH5-01 (PATCH sans jeton) et PH5-02 (portées absentes). Corriger le serveur d'abord couperait le poll. L'ordre ci-dessous permet de livrer chaque étape seule, et chacune est contrôlée par le harnais avant la suivante.

| Étape | Qui | Contenu | Le poll actuel fonctionne-t-il encore ? | Contrôle de sortie |
| --- | --- | --- | --- | --- |
| 0 | — | Situation actuelle (`service:hq-poll`, skill v1) | Oui | Référence `resultats-45c701a.json` |
| 1. Serveur, ajouts compatibles | Codex (PR, revue de Philippe) | Portées `dispatch`, `create` et `work` reconnues. Fiche machine `office-distributor`. Routes `heartbeat`, `queue` et `orphans`. Table `hq_attempt`. Alarme du DO. `Idempotency-Key`. **Le repli `service:hq-poll` reste accepté**, mais chaque appel est compté (`legacyCalls`) et journalisé | Oui (aucune règle existante n'est retirée) | Harnais : T5, T6, T7 et E1 protégés ; T13 protégé ou partiel ; tests existants verts |
| 2. Identité | **Philippe** (OK requis, §6) | Nouveau jeton de service Access, ajout du Client ID et de la fiche `office-distributor` | Oui (deux identités coexistent) | GET `/api/hq/queue` avec le nouveau jeton → 200, `actorId=office-distributor` |
| 3. Distributeur | Grok Bot (skill v2 et assistant local, §3) | Le skill v2 utilise l'assistant `hq-dispatch` et la nouvelle identité. Un jour en lecture seule (`next` uniquement), puis bascule | Bascule de v1 vers v2 | Un cycle complet sur `sandbox-klirline` : claim, heartbeat, `done` avec jeton et preuve. 0 `claimToken` dans les transcripts |
| 4. Serveur, durcissement | Codex | Suppression du repli (403). Matrice de transitions (PH5-01). A3 réservée aux humains (PH5-03). Preuves liées au jeton (PH5-04). Modification de `hq-do-check` (§5.4) | v1 coupée, v2 seule | Harnais : seuils de `compare.mjs` atteints (T1 à T9, T12, E1, I1 et I2 protégés) ; `legacyCalls` = 0 pendant 48 h avant l'étape |
| 5. Révocation | **Philippe** (OK requis, §6) | Révocation de l'ancien jeton `service:hq-poll` | v2 seule | L'ancien jeton reçoit 403 sur `/api/hq/queue` |

Règle de retour arrière : on peut revenir de l'étape 3 à la v1 tant que l'étape 4 n'est pas déployée. Après l'étape 4, revenir en arrière veut dire redéployer la version précédente du Worker par une PR. On ne rouvre jamais une faille par un réglage.

## 2. Identité de service dédiée et portées minimales

Fiche `HQ_MACHINE_IDENTITIES` (secret Worker, posé par Philippe). Ceci est un exemple **sans aucune valeur réelle** :

```json
[{ "id": "office-distributor", "actorId": "office-distributor", "orgId": "klirline",
   "accessClientId": "<client id du nouveau jeton>.access", "scopes": ["dispatch", "work"] }]
```

Règles d'identité (serveur) :

- `resolveServiceMachine` refuse tout `actorId` appartenant à un rôle humain (`ceo`, `coo`, `chief-of-staff`, et tout rôle d'`ACCESS_ACCOUNTS`). Une machine a toujours `human: false`.
- Un client de service sans fiche reçoit **403** (le repli `bindServiceIdentity` disparaît à l'étape 4).
- Portées absentes ou vides : refus par défaut dans `dispatchHq`, avant tout routage.
- La clé de quota prend l'`id` de la fiche (`rateKey({ email: "machine:office-distributor" })`), et non une clé commune.

Matrice des droits (cible) :

| Route | `dispatch` | `work` (titulaire de la tentative) | `create` | Humain (JWT avec email) |
| --- | --- | --- | --- | --- |
| `GET /api/hq/queue`, `GET /api/hq/orphans` | oui | non | non | oui |
| `GET /api/hq/commands[/:id]` | oui | oui (ses commandes) | non | oui |
| `POST /api/hq/command` | non | non | oui | oui |
| `POST …/:id/claim` | oui | non | non | non |
| `POST …/:id/heartbeat` | titulaire avec jeton | titulaire avec jeton | non | non |
| `PATCH …/:id` → `running`, `blocked`, `done`, `failed` | titulaire avec jeton | titulaire avec jeton | non | non (un humain **rejette** ou **annule**, il n'écrit pas la preuve) |
| `PATCH …/:id` → `cancelled` | non | non | non | oui, avec une raison |
| `PATCH …/:id` → `pending` ou `queued` | **jamais** (seule l'alarme remet en file) | jamais | jamais | `POST …/:id/requeue` avec une raison |
| Missions : `approval`, `transition done` | non | non | non | **oui, seulement** (§5) |

## 3. Le `claimToken` reste hors du modèle : assistant local `hq-dispatch`

C'est un petit script Node **sur la box**, sans dépendance réseau autre que `centre.klirline.com` et sans infrastructure nouvelle. Le modèle l'appelle par le shell. Le script lit seul le secret Access et garde les jetons. **Il n'affiche jamais un jeton ni un secret** : toute sortie passe par un filtre qui remplace les UUID de jeton et les en-têtes `CF-Access-*` par `***`.

| Commande | Effet serveur | Ce que voit le modèle |
| --- | --- | --- |
| `hq-dispatch next` | `GET /api/hq/queue`, puis la liste `pending`, `queued` et orphelines | `id`, `ownerSlug`, priorité, ancienneté, et le texte **entre délimiteurs**, étiqueté « donnée non fiable » |
| `hq-dispatch claim <id>` | `POST …/claim` | `commandId`, `attemptId`, `leaseUntil`, résultat (`issued`, `held`, `refused`). **Pas de jeton** |
| `hq-dispatch heartbeat <attemptId>` | `POST …/heartbeat` avec le jeton stocké | Nouveau `leaseUntil`, ou l'erreur |
| `hq-dispatch close <attemptId> done --proof-file <f>` | `PATCH done` avec le jeton et la preuve | `completed`, `duplicate` ou `rejected` |
| `hq-dispatch close <attemptId> blocked --reason <texte>` | `PATCH blocked` avec le jeton | Le résultat |
| `hq-dispatch status` | Aucun (lecture locale) | Les tentatives ouvertes : `attemptId`, `commandId`, échéance |

Stockage des tentatives : `~/.local/state/klirline-hq/attempts/<attemptId>.json` (mode 600). Le fichier contient `commandId`, `attemptId`, le jeton et les échéances. Il est supprimé à la clôture ou à l'expiration. **Limite connue** : tous les agents partagent l'utilisateur Unix `box`, donc un modèle qui chercherait ces fichiers pourrait les lire. Il faut deux défenses : (a) le serveur lie le jeton à `holder` (une autre identité est refusée même avec le jeton) ; (b) l'isolation par utilisateur distinct (§6, option C) quand la plateforme le permet.

Rôles :

- **Seul le distributeur (Office) détient la tentative.** L'agent propriétaire reçoit un brief **sans jeton** : objectif, critère de succès, `commandId`, `attemptId` (non secret), règle de remise de la preuve. Il rend sa preuve au distributeur par un handoff. C'est le distributeur qui ferme avec `hq-dispatch close`.
- Le brief suit `distributeur-spec.md` §2.5. Le texte de la commande est cité et délimité. Les actions interdites (publication, envoi, fusion, déploiement, dépense) sont rappelées par le distributeur, jamais par le texte.

## 4. Heartbeat, clôture et relances (serveur)

1. **Bail.** `leaseMs` par commande : 30 min par défaut. Pour une tâche d'agent, le bail vaut `agentLeaseMs`, qui doit couvrir l'intervalle entre deux passages (4 h 30 avec 4 créneaux par jour). Le serveur plafonne à 8 h.
2. **Heartbeat.** `POST /api/hq/commands/:id/heartbeat {attemptId, claimToken}` : 200 et `leaseUntil = now + bail` si l'identité est le titulaire (`holder`), le jeton et la tentative correspondent et le bail n'a pas expiré. Sinon : 403 pour une autre identité, 409 pour une tentative ancienne ou expirée. Chaque heartbeat est écrit dans `hq_attempt`.
3. **Clôture.** `done` exige le jeton de la tentative **en cours**, le titulaire et une preuve. `blocked` et `failed` exigent le jeton et une raison. Un `done` identique est idempotent (`duplicate`). Un `done` différent reçoit 409. Les états terminaux sont immuables.
4. **Expiration (alarme du DO).** `setAlarm(min(leaseUntil))` est recalculée à chaque claim, heartbeat et clôture. Quand elle se déclenche, un bail expiré fait passer la commande en `queued`, avec `attempts + 1` et la raison « bail expiré ». Une commande `running` sans bail devient invalide et passe en `queued` avec la raison « orpheline ». Au-delà de `maxAttempts = 3`, elle passe en `failed` avec la raison « limite de tentatives ». L'ancienne tentative est invalidée : son jeton reçoit 409.
5. **Relances côté distributeur.** Une erreur réseau ou un 5xx entraîne au plus 3 essais (attente de 2 s, 8 s puis 30 s), puis l'abandon jusqu'au créneau suivant. Un 429 respecte `Retry-After`, sinon le distributeur s'arrête jusqu'au créneau suivant. Un 409 ne se relance jamais : on relit l'état. Après 3 créneaux en échec, une seule alerte (§7 du rapport de phase 5).
6. **Journal** `hq_attempt` (`command_id`, `attempt_id`, `holder`, `claimed_at`, `lease_until`, `last_heartbeat_at`, `outcome`, `closed_at`, `reason`), **sans jeton ni hash**.
7. **Création.** `Idempotency-Key` (en-tête) est unique par identité pendant 24 h. Un second POST renvoie 200 avec la même commande.

## 5. A3 réservée aux humains, et preuves protégées

### 5.1 Identité humaine

Une identité est **humaine** si et seulement si toutes ces conditions sont réunies :

- le JWT Access est vérifié par `verifyAccessJwt` ;
- il porte une revendication `email` non vide ;
- cet email figure dans `ACCESS_ACCOUNTS`.

Un JWT de service (`type: "app"`, `common_name`) n'est **jamais** humain, quelle que soit sa fiche. `human` est fixé par `authenticate` (`src/worker.js:72-87`) et ne vient jamais d'un en-tête, du corps de la requête ou d'une fiche machine. L'approbation enregistre `approverEmail` (l'email du JWT) en plus de `approverId`.

### 5.2 Règles serveur

| # | Règle | Fichier (45c701a) |
| --- | --- | --- |
| R1 | `decideMission` : `if (options.human !== true) fail(403, "Une machine ne valide pas.")`, avant tout autre contrôle | `src/hq/missions.js:354-362` |
| R2 | `transitionMission(status="done")` : même règle, puisque la clôture d'une mission vaut action A3 | `src/hq/missions.js:196-205` |
| R3 | `validApproval` ne compte que les approbations avec `approverEmail` non vide (les anciennes approbations machine ne valent plus) | `src/hq/missions.js:167-176` |
| R4 | `prepareExternalAction` reste bloquée (aucun envoi), et toute future levée exigera R1 | `src/hq/missions.js:396-416` |
| R5 | `decideCompletion` : suppression du contournement `reviewer` (`human` ou `review`) pour `done` et `failed`. Seule la tentative en cours écrit un résultat | `src/hq/commands.js:245-252` |
| R6 | `addDeliverable` sur une commande `done` : 409, sauf demande humaine de révision. La révision crée une **nouvelle tentative** (claim), elle n'écrase pas | `src/hq/missions.js:297-319` |
| R7 | `resolveServiceMachine` refuse les `actorId` humains (§2) | `src/hq/machine-auth.js:33-53` |
| R8 | `contentHash` passe en SHA-256 sur un JSON canonique (PH5-14), avec migration : les approbations FNV existantes sont invalidées | `src/hq/missions.js:43-58` |

### 5.3 Modification de `scripts/hq-do-check.mjs` (à faire par Codex dans la même PR que R1 à R6)

Lignes actuelles 165-168 :

```js
const selfApproval = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve" }, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
assert(selfApproval.status === 403, "l'auteur s'est validé");
const approved = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve", note: "Vu." }, { actor: "coo", scopes: ["review"], now: t0 });
assert(approved.status === 200 && approved.payload.mission.approvalValid === true, "validation refusée");
```

Remplacement proposé :

```js
const selfApproval = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve" }, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
assert(selfApproval.status === 403, "l'auteur s'est validé");
const machineApproval = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve" }, { actor: "coo", scopes: ["review"], human: false, now: t0 });
assert(machineApproval.status === 403, "une machine a validé une action A3");
const approved = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve", note: "Vu." }, { actor: "coo", scopes: ["review"], human: true, now: t0 });
assert(approved.status === 200 && approved.payload.mission.approvalValid === true, "validation humaine refusée");
```

À adapter aussi :

- **ligne 124** : un humain `coo` passe la commande en `running` sans jeton. Avec la matrice du §2, ce passage se fait par le titulaire avec son jeton (`left` ou `right`, selon l'`issued`). Le test doit utiliser ce jeton.
- **lignes 198 à 200** (lecture après redémarrage par `coo` avec la portée `review`) : inchangées.

Le pilote local `scripts/hq-do-driver.mjs` garde `x-human` : ce n'est qu'un outil de test local, absent du Worker publié. `self-check.js` doit vérifier que `src/worker.js` n'a jamais d'en-tête `x-human`.

### 5.4 Tests d'acceptation

| ID | Test | Attendu |
| --- | --- | --- |
| AT-01 | Harnais T3 (machine `coo`, `human=false`) | Approbation 403, clôture 403. Contrôle positif humain : 200 |
| AT-02 | Harnais I2 (fiche machine `actorId: "coo"` ou `"ceo"`) | `resolveServiceMachine` → `null` |
| AT-03 | JWT de service avec une fiche `scopes: ["review"]` → `approval` | 403 |
| AT-04 | JWT humain avec un email absent d'`ACCESS_ACCOUNTS` | 403 |
| AT-05 | Harnais T12, 4 sous-cas (machine `coo` sans jeton, tiers après `done`, machine `review` `PATCH done`, tiers en cours) | Tous refusés. Contrôle positif (livrable légitime) : 200 |
| AT-06 | Une révision après approbation, par une nouvelle tentative | L'ancienne approbation est invalidée. Nouvelle approbation humaine requise |
| AT-07 | `hq-do-check` modifié (§5.3) | Vert |
| AT-08 | Recherche de `x-human` dans `src/` | Aucune occurrence |
| AT-09 | Harnais T1, T4, T8, T9 (matrice de transitions) | Protégés |
| AT-10 | `compare.mjs resultats-45c701a.json resultats-1ab1a24.json` | Verdict `GO TECHNIQUE`, avant toute demande de fusion à Philippe |

## 6. Isolation et rotation du secret Access (procédure finale, **rien n'est exécuté**)

Chaque étape attend un **OK explicite de Philippe** avant d'être lancée. Aucune valeur de secret n'apparaît dans un chat, un document, un commit ou un transcript. Les contrôles se font sur les codes HTTP, jamais en affichant des en-têtes.

| # | Action | Fait par | OK de Philippe | Contrôle | Retour arrière |
| --- | --- | --- | --- | --- | --- |
| 1 | Choisir le stockage du nouveau secret. **Option B** (coffre de la plateforme, lisible par Office seul) si la plateforme le permet. Sinon, **option C** : utilisateur Unix dédié, qui exécute seul `hq-dispatch`. À défaut, fichier `600` avec l'étape 1 de l'ordre de livraison (portées minimales) | Philippe décide, Grok Bot documente | **OK 1** : choix de l'option | — | — |
| 2 | Créer le jeton de service Access `klirline-office-distributor-2026-11` (durée 1 an), dans la politique Service Auth de l'application `centre.klirline.com` | Philippe (tableau de bord Zero Trust) | **OK 2** | Le jeton apparaît dans la liste. L'ancien jeton reste actif | Supprimer le nouveau jeton |
| 3 | Ajouter son Client ID à `ACCESS_SERVICE_CLIENT_IDS` et la fiche `office-distributor` à `HQ_MACHINE_IDENTITIES` (secrets du Worker), **sans retirer l'ancien** | Philippe | **OK 3** | `GET /api/health` → 200 | Remettre les deux secrets à leur valeur précédente |
| 4 | Déposer le Client Secret dans le stockage de l'étape 1, par Philippe lui-même (coffre, ou saisie locale `install -m 600`) | Philippe | **OK 4** | `stat` : mode et propriétaire attendus, taille non nulle. Le contenu n'est pas lu | Supprimer le fichier ou l'entrée du coffre |
| 5 | Vérifier la nouvelle identité : `hq-dispatch next` (lecture seule) | Grok Bot | **OK 5** | 200, et le journal serveur montre `actorId=office-distributor` | — |
| 6 | Basculer le skill et la routine sur v2 (étape 3 de l'ordre de livraison) | Grok Bot, sur instruction | **OK 6** | Un cycle complet sur `sandbox-klirline` | Revenir au skill v1 (l'ancien jeton est toujours actif) |
| 7 | Déployer le durcissement serveur (étape 4) | Codex (PR), Philippe fusionne | **OK 7** (fusion) | Harnais vert, `legacyCalls` = 0 depuis 48 h | Redéployer la version précédente par une PR |
| 8 | Retirer l'ancien Client ID des secrets du Worker | Philippe | **OK 8** | Ancien jeton : 403 | Remettre l'ancien Client ID (le jeton existe encore) |
| 9 | Révoquer l'ancien jeton dans Zero Trust et supprimer l'ancien fichier `cf-access-hq-office-poll.env` | Philippe (suppression du fichier sur son instruction explicite) | **OK 9** | Ancien jeton : refusé par Access. Le fichier n'existe plus | Aucun : il faut créer un nouveau jeton, on ne réactive jamais l'ancien |
| 10 | Noter la date et l'échéance (11 mois) dans le Bureau. Rotation planifiée et déclencheurs non planifiés : `secret-access-rotation.md` | Grok Bot | **OK 10** | — | — |

## 7. Coût des alarmes Durable Objects (vérifié dans la documentation Cloudflare, 23 nov. 2026)

Sources : `developers.cloudflare.com/durable-objects/platform/pricing/` et `…/workers/platform/pricing/`, page mise à jour le 13 nov. 2026, lue par le connecteur gratuit Cloudflare-docs.

| Dimension | Workers Free | Workers Paid |
| --- | --- | --- |
| Requêtes DO (**invocations d'alarme comprises**) | 100 000 par jour | 1 million par mois, puis 0,15 $ par million |
| Durée | 13 000 Go-s par jour | 400 000 Go-s par mois, puis 12,50 $ par million de Go-s |
| Lignes écrites (SQLite) : **chaque `setAlarm()` compte pour une ligne** | 100 000 par jour | 50 millions par mois, puis 1 $ par million |
| Lignes lues | 5 millions par jour | 25 milliards par mois |
| Stockage SQLite | 5 Go au total (non facturé sur Free) | 5 Go-mois, puis 0,20 $ par Go-mois (facturé depuis janvier 2026) |
| Dépassement | **Échec de l'opération**, aucune facturation (remise à zéro à 0 h UTC) | Facturé au-delà des quotas inclus. Un plafond de dépense DO est configurable |
| Durée d'un gestionnaire d'alarme | 15 min | 15 min |

Estimation pour le volume actuel : 3 commandes en 3 semaines en production. Même avec une hypothèse haute de 50 commandes par jour (claim, 3 heartbeats et clôture), il y aurait environ 250 `setAlarm` et 50 invocations par jour, soit **moins de 0,3 %** des quotas gratuits quotidiens. Sur Paid, cela reste dans les quotas inclus. **Coût marginal : 0 $ sur les deux plans.**

Plan du compte : **à confirmer par Philippe.**

- Les lectures gratuites disponibles ne l'indiquent pas : `workers_get_worker` ne renvoie que le nom et l'id du Worker, et les journaux du build `3bc841a7` ne mentionnent aucun plan.
- Le Worker utilise un DO SQLite, compatible avec les deux plans.
- Philippe peut le voir dans le tableau de bord Cloudflare (Workers & Pages, puis Plans).
- Sur Free, un dépassement ferait **échouer** les écritures au lieu de facturer. Il faut donc garder le volume d'alarmes borné : une seule alarme par DO, recalculée.

## 8. Revue humaine indépendante sur GitHub (options, **rien n'est appliqué**)

Constat : le ruleset `27914655` exige 0 approbation, et Philippe est le seul humain. Les agents et Philippe agissent avec le **même compte** `pipoxdavensonazor-bot` : connecteur cursor-github, PAT GITHUB_NORIA_TOKEN et compte de Philippe. GitHub ne peut donc pas distinguer une décision humaine d'une décision d'agent. **Toute option qui s'appuie sur ce compte seul ajoute de la friction, pas de l'indépendance.** Aucune ne demande un accès Administration permanent pour les agents : Philippe applique lui-même, par l'interface.

| # | Option | Ce qu'elle apporte | Limites | Ce qu'il faut |
| --- | --- | --- | --- | --- |
| A | `CODEOWNERS` (`* @<compte humain>`) et ruleset `require_code_owner_review: true`, `required_approving_review_count: 1`, `require_last_push_approval: true` | Une PR ne fusionne qu'avec l'approbation du propriétaire de code | **Avec un seul compte, c'est un blocage total** : l'auteur ne peut pas approuver sa propre PR. Ne vaut qu'avec l'option F | Philippe modifie le ruleset (interface). Ajout de `CODEOWNERS` par PR |
| B | Interdiction de s'auto-approuver | Native sur GitHub : l'auteur ne peut jamais approuver sa propre PR | Même compte : soit tout bloque, soit rien n'est vérifié. Ne vaut qu'avec F | Inclus dans A |
| C | Environnement GitHub `production` avec reviewer requis et « prevent self-review » | Validation humaine au moment du déploiement | Le déploiement se fait aujourd'hui par **Workers Builds** (app Cloudflare), et non par un job Actions. Il faudrait déplacer le déploiement dans Actions, avec un jeton API Cloudflare en secret GitHub (nouveau secret à créer) et la désactivation du déploiement automatique Workers Builds. Même limite de compte unique | Philippe : création de l'environnement, nouveau secret, réglage Cloudflare |
| D | Workers Builds en « approbation manuelle » : sur la branche de production, la commande de déploiement devient `npx wrangler versions upload` (une version est créée sans être publiée), puis Philippe publie la version dans le tableau de bord Cloudflare | Le geste de mise en production est séparé de la fusion, et il est fait dans Cloudflare | Il n'existe pas de bouton « approuver » dans Workers Builds : c'est un changement de commande. Les agents disposent de connecteurs Cloudflare liés au compte de Philippe, à vérifier : ils ne doivent pas pouvoir publier une version. Le check `Workers Builds` reste vert sans déploiement | Philippe : réglage Build de Workers Builds |
| E | Check `human-approval` (workflow Actions) vert seulement si le label `approuve-philippe` est posé, ajouté aux checks requis | Une étape explicite, visible et traçable | Avec un seul compte, un agent peut poser le label (le connecteur peut gérer les labels). C'est une convention, pas une garantie. Il faudrait l'événement de label posé par un **autre** acteur, ce qui ramène à F | Workflow par PR, puis ajout du check au ruleset par Philippe |
| F | **Second compte GitHub** : compte humain personnel de Philippe (gratuit), administrateur. Les agents gardent `pipoxdavensonazor-bot` comme compte machine, ou passent plus tard sur une GitHub App (`distributeur-spec.md` §4.3). Puis A et B | **Seule option qui crée une indépendance réelle** : l'approbation vient d'un compte que les agents n'utilisent pas | Un compte de plus à gérer, avec 2FA. Il faut idéalement transférer la propriété du dépôt au compte humain et réduire le compte machine au rôle `write`. Tant que le compte machine reste propriétaire, il peut modifier les rulesets via l'interface ou un jeton administrateur. Les jetons actuels n'ont pas cette permission, mais le connecteur OAuth est à vérifier | Philippe : création du compte, invitation, transfert éventuel, rulesets. Agents : aucune permission nouvelle |

**Recommandation** : **F, puis A et B**, avec `required_approving_review_count: 1`, `require_code_owner_review` et `require_last_push_approval`, et `bypass_actors` vide.

- En option, D comme second verrou de mise en production.
- E n'est utile que comme marqueur une fois F en place.
- En attendant F, on garde la règle actuelle : PR, 3 checks et **fusion faite par Philippe seulement, sur accord explicite**. La limite de ce contrôle est écrite dans `distributeur-spec.md` §4.3.
