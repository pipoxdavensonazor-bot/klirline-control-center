# HQ 2.0 — Phase 5 : audit indépendant Grok Bot (distributeur, identités, certification multi-agents)

Rédigé le 23 novembre 2026 vers 15 h 30 (heure de Toronto) par Grok Bot (Office Klirline), à la demande de Philippe (mission t86u). Codex développe, Grok Bot audite. **Aucun code produit n'a été modifié.** Aucun déploiement, aucune fusion, aucun secret ni réglage GitHub ou Cloudflare modifié, aucun appel payant, aucun envoi externe, aucune approbation.

Ce que valent les preuves :

- **Attaques T1 à T14 et E1** : exécutées **en local uniquement** (`wrangler dev --local`, workerd et Durable Object SQLite) sur le SHA de production, par le harnais `docs/hq2/probes/phase5/harness.mjs`. Un pilote local injecte l'identité (`x-actor`, `x-scopes`, `x-human`) et l'horloge, à la place de Cloudflare Access. **Ce ne sont pas des résultats de production.** Sortie brute : `docs/hq2/probes/phase5/resultats-45c701a.json`. Deux exécutions supplémentaires ont donné les mêmes verdicts.
- **Contrôles I1 à I5** : appels Node directs aux modules `src/access.js`, `src/hq/machine-auth.js` et `src/limits.js` du même SHA. Les JWT sont signés par une clé RSA générée localement, sans aucun appel réseau.
- **Observations de production** : seulement des **lectures GET** non destructives sur `centre.klirline.com`, avec le jeton `service:hq-poll` (voir §3.3). Aucune écriture, aucun claim.

## 1. Versions certifiées

| Version | SHA | Rôle | Ce qui a été vérifié |
| --- | --- | --- | --- |
| Production `cursor/klirline-control-center` | `45c701abd8aebcae18a44e8980bfec35c15fd3a3` | Fusion squash de la PR #13 (CI), déployée par Workers Builds (build `3bc841a7-…`, succès, 10 h 44) | `git ls-remote` et l'API confirment ce SHA. CI `ci` (run 45208519133, événement push) : succès. Harnais phase 5 : 20 contrôles, résultats au §2 |
| Base phase 0 | `d754179bab2222417ab76a992c8b7712c03671f4` | Parent de 45c701a | `git diff --stat d754179 45c701a` : seuls `.github/workflows/ci.yml` et `.gitleaksignore` changent. **`src/` et `scripts/` sont identiques**, donc les sondes P1 à P9 de la phase 0 restent valables |
| PR d'audit #12 (`cursor/hq2-phase0-audit`) | `688ae79` avant ce document | Documentation et sondes | Relue (§1.1) |
| Branche Codex `fix/office-reliability` | **inaccessible** | Correctifs annoncés | **Non testable.** Absente de GitHub (`git ls-remote` : 30 références, aucune `office-reliability`). `GET /commits/<sha>` → 422 pour `d52f17b`, `371deb0`, `23af27f`, `aeddce2`, `db0cb96` et `eddbf4a` |

**Incohérence à signaler (PH5-15).** Quatre têtes différentes ont été annoncées pour la même branche : `d52f17b` (réconciliation de la phase 0), `371deb0` (« rebasée sur 45c701a » : `23af27f`, `aeddce2`, `db0cb96`), `eddbf4a` (brief de la phase 5), puis **`1ab1a24`**, annoncée par Philippe le 23 nov. à 15 h 31 comme commit final de Codex, sur la base `45c701a`. `1ab1a24` n'est pas non plus publiée sur GitHub. C'est la tête retenue pour la certification : `verify-bundle.sh` refusera tout bundle dont la tête n'est pas `1ab1a24` ou dont le prérequis n'est pas `45c701a`. Aucune n'est publiée. Le bundle que déposera Philippe doit permettre de trancher : `git bundle verify`, `git log --oneline 45c701a..<tête>`, puis vérifier que la tête retenue descend bien de `45c701a`. **Rien n'est conclu sur les corrections de Codex** : aucun défaut ci-dessous n'est réputé présent ni absent dans sa branche.

### 1.1 Relecture des documents de la PR #12

- `audit.md`, `reconciliation.md` et `probes/resultats-d754179.json` restent exacts pour 45c701a, puisque le code est identique. Le harnais de la phase 5 reproduit P2, P3, P3b, P4, P5, P6, P7, P8 et P9, et confirme P1 (un seul `issued` sur 10 claims concurrents).
- **Correction (23 nov., 15 h 40).** La première version de ce rapport disait que le ruleset était « non activé », en s'appuyant sur un `GET /rulesets` vide fait à 10 h 45. C'était faux à l'heure du rapport : Philippe a créé les deux rulesets à 10 h 52, après ce contrôle, et je ne l'avais pas relu. Relecture faite à 15 h 35 par `GET /rules/branches/…` et `GET /rulesets/<id>`, qui n'exigent pas la permission Administration :
  - `27914655` `production-klirline-control-center` est **actif** sur `refs/heads/cursor/klirline-control-center`, avec `bypass_actors: []`. Règles : `deletion`, `non_fast_forward`, `required_linear_history`, `pull_request` (0 approbation, `dismiss_stale_reviews_on_push`, `required_review_thread_resolution`) et `required_status_checks` en mode strict (`ci / tests`, `ci / secret-scan`, `Workers Builds: klirline-control-center`).
  - `27914662` `main-frozen` est **actif** sur `refs/heads/main`, avec les règles `deletion`, `non_fast_forward` et `update`, et `bypass_actors: []`.
  - La production est sur `45c701a` et exige une PR et les 3 checks. Aucun accès Administration n'est demandé ni nécessaire pour ces vérifications.
- `reconciliation.md` ne cite que `d52f17b`. Voir PH5-15 ci-dessus.
- Collision de noms : dans `distributeur-spec.md` §1.6, « P1 » désigne le risque d'injection, alors que dans les sondes P1 désigne la course aux claims. Dans ce document, l'injection est **T10** et la course **T2**.
- Le test `scripts/hq-do-check.mjs:167-168` **exige** qu'une machine `coo` approuve (voir PH5-03). Il faudra l'inverser en même temps que le correctif. Il n'a pas été touché.

## 2. Résultats des attaques (version 45c701a, local)

Verdicts : **protégé** (l'attaque échoue), **vulnérable** (l'attaque réussit), **partiel** (une partie seulement est bloquée), **non testable** (la fonction n'existe pas ou dépend de composants sans code). Identités du pilote : `agent-a` et `agent-b` (portée `work`) ; `service:hq-poll` avec des **portées absentes**, ce qui correspond à l'identité réelle du poll en production (I1) ; `intrus` (portées `[]`) ; machine `coo` (`work` et `review`, `human=false`).

| # | Attaque | Verdict sur 45c701a | Résultat observé (extrait de `resultats-45c701a.json`) | Anomalie |
| --- | --- | --- | --- | --- |
| T1 | Reprise sans jeton | **vulnérable** | `PATCH done` de B sans jeton → 409 (protégé), mais `PATCH pending` de B sans jeton → 200, puis claim B → `issued`, alors que le bail de A est actif | PH5-01 |
| T2 | Deux exécutants | **partiel** | 10 claims concurrents → 1 seul `issued`. En revanche, `PATCH queued` par `service:hq-poll`, puis claim B → **deux jetons valides émis** | PH5-01, PH5-02 |
| T3 | Approbation par machine | **vulnérable** | `coo` avec `human=false` : approbation 200, `approvalValid=true`. La même machine clôt ensuite la mission (`done`) : 200 | PH5-03 |
| T4 | Annulation sans permission | **vulnérable** | Commande annulée par une identité à portées `[]` → 200 ; par `service:hq-poll` → 200 ; `interrupt` à portées `[]` → 200. Mission annulée par un tiers `work` → 403 (protégé) | PH5-01, PH5-02 |
| T5 | Création en doublon | **vulnérable** | Deux POST identiques simultanés → deux ids. L'en-tête `Idempotency-Key` est ignoré | PH5-06 |
| T6 | Heartbeat d'une mauvaise identité | **non testable** (pas de heartbeat) | `POST …/heartbeat` → 404. Substitut : `PATCH running` par B sans jeton → 200. Le titulaire reste A et `leaseUntil` ne change pas | PH5-05, PH5-01 |
| T7 | Heartbeat après expiration | **non testable** (pas de heartbeat) | 404. Substitut : `PATCH running` après l'expiration → 200, puis le claim suivant → `blocked`. La commande est bloquée au lieu d'être reprise | PH5-05 |
| T8 | Écriture avec une ancienne tentative | **partiel** | Après reprise : `done` avec l'ancien jeton → 409 (protégé). Mais `blocked` avec l'ancienne tentative et **sans jeton** → 200 | PH5-01 |
| T9 | Reprise d'une commande terminale | **vulnérable** | Claim direct sur `done` → 409 (protégé). Mais `PATCH pending` sans jeton (`service:hq-poll`) → 200, puis claim → `issued` : la commande terminée est rouverte et réexécutable | PH5-01 |
| T10 | Injection dans le texte | **partiel** | Champ `createdBy` forcé → 400. `status` et `claim` forcés sont ignorés : la commande est `pending`, `claim=null`. Le texte est restitué tel quel, comme une donnée. Le destinataire est **déduit du texte** si `ownerSlug` est absent (`routedBy=triage`). Le fait qu'un modèle obéisse ou non au texte **n'est pas testable côté serveur** | PH5-11 |
| T11 | Dépassement du budget | **partiel** | `start` avec `costCents=1` et un plafond de 0 → 409 « Plafond de dépense atteint ». `costCents="abc"` → démarrage accepté et coût 0. Le coût est **déclaré par l'appelant**, et les commandes hors mission n'ont aucun budget | PH5-09 |
| T12 | Livrable falsifié | **vulnérable** | B sans jeton, tâche en cours → 409 (protégé). **Machine `coo` sans jeton → 200.** B sans jeton après la livraison légitime → 200 : la mission repasse en `rework`, l'approbation est invalidée et il y a 2 livrables. `PATCH done` par une machine `review` sans jeton avec une « Preuve inventée » → 200 `completed` | PH5-04 |
| T13 | Arrêt et redémarrage | **partiel** | Redémarrage réel de workerd sur le même stockage : tentative conservée ; claim à +5 min → `held` ; à +31 min → `reclaimed` ; ancien jeton → 409 ; nouveau jeton → 200 (protégé). Mais une commande abandonnée reste `dispatched` 3 h après (aucune alarme), et une commande `running` expirée passe `blocked` au premier claim. Le redémarrage du **distributeur** (routine) est non testable : il n'a pas de code ni d'état | PH5-05 |
| T14 | API HQ indisponible | **partiel** | Pendant l'arrêt : GET et PATCH → `ECONNREFUSED`. Après la reprise, l'état est intact et la réécriture avec le même jeton → 200. **Côté distributeur, il n'y a ni file locale, ni relance bornée, ni alerte** : non testable, car c'est un texte de routine | PH5-10, §3 |
| E1 | Livrable légitime après 205 commandes | **vulnérable** | 409 « La commande de la tâche est introuvable » : la fenêtre de 200 commandes (`hqList`) sert aussi aux missions | PH5-07 |
| I1 | Identité du jeton de service hors fiche machine | **vulnérable** | `actorId=service:hq-poll`, `scopes=undefined` | PH5-02 |
| I2 | Machine déclarée `coo` ou `ceo` | **vulnérable** | `resolveServiceMachine` accepte `actorId: "coo"` (`review`) et `actorId: "ceo"` | PH5-03 |
| I3 | Liste d'autorisation des JWT de service | **protégé** | Client autorisé → `service` ; client non listé → 401 | — |
| I4 | Jeton de service hors `/api/hq/*` | **protégé** | `/api/bootstrap` → 403. Confirmé en production par un GET : 403 | — |
| I5 | Quota par identité | **partiel** | 60 requêtes par minute, avec la clé `email:service:hq-poll` commune à **tout** jeton de service non déclaré, en plus du quota par IP (tous les agents de la box partagent l'IP) | PH5-10 |

Bilan sur 45c701a : sur les 14 attaques, **0 protégée entièrement**. 6 sont vulnérables (T1, T3, T4, T5, T9, T12), 6 partielles (T2, T8, T10, T11, T13, T14) et 2 non testables (T6, T7), faute de heartbeat. S'y ajoutent les contrôles E1 (vulnérable) et I1 à I5.

## 3. État du distributeur

### 3.1 Composants réels examinés

- **Skill `pont-hq-centre-agents`**, chargé avec Skill le 23 nov. Ce sont des instructions en texte, **sans code** : poll `GET /api/hq/commands?status=pending`, routage par la carte du bureau si `ownerSlug` manque, passage en `dispatched` puis `running` par claim ou PATCH, brief `SendToAgent`, puis à la fin un PATCH `done`, `blocked` ou `cancelled` avec une preuve.
- **Routine « Poll commandes HQ centre »** : lun–ven, 9 h–18 h 30, toutes les 30 min (heure de Toronto), soit environ 95 tours par semaine. D'après le résumé de son prompt transmis par Philippe, elle lit `pending`, `dispatched` et `running`, traite le texte comme une donnée et signale une seule fois les baux expirés sans reprise. Le texte exact de la routine n'était pas lisible depuis cet environnement : l'audit porte sur ce résumé et sur le skill.
- **Côté serveur** : `src/hq/dispatch.js`, `src/hq/commands.js`, `src/hq/missions.js`, `src/access.js`, `src/hq/machine-auth.js` et `src/worker.js` à 45c701a.

### 3.2 Revue point par point

| Étape | Constat | Dépend d'une faille ? |
| --- | --- | --- |
| Découverte | Un GET par statut, limité à 200 résultats (`HQ_LIST_LIMIT`). Il ne voit **aucune mission** : `service:hq-poll` n'a pas la portée `review`, et `canReadMission` exige d'être `review`, créateur ou validateur. Observé en production : `GET /api/hq/missions` → 0 | Non, mais elle est aveugle aux missions |
| Destinataire | `ownerSlug` est explicite, sinon `routeCommand(text)` le déduit du texte (T10). Le skill ajoute un second routage par la carte du bureau. Les deux peuvent diverger | Non, mais c'est un risque d'injection (PH5-11) |
| Claim | **Fonctionne grâce à PH5-02** : la garde `Array.isArray(scopes) && !scopes.includes("work")` (`dispatch.js:118`) laisse passer des portées absentes | **Oui** |
| Passage en `running` | Fait par `PATCH status=running` **sans jeton** (`commands.js:216-225`). C'est le chemin même de PH5-01 | **Oui** |
| Transport du `claimToken` | Le jeton revient dans la réponse du claim, donc **dans le contexte du modèle** et dans le transcript. Le skill demande ensuite au propriétaire de faire le PATCH final, donc le jeton doit être recopié dans un brief entre agents | Non, mais il est exposé (PH5-13) |
| Brief | Il recopie `text`, une donnée non fiable, dans un message entre agents. Le texte gagne ainsi la confiance accordée à un coéquipier | Non (PH5-11) |
| Statut | `done` exige une preuve et le jeton, sauf pour les identités `human` ou `review` (PH5-04). Les autres statuts n'exigent rien (PH5-01) | Partiellement |
| Heartbeat | Inexistant (route 404) | — |
| Clôture | Le PATCH final peut être fait par n'importe qui pour `blocked` et `cancelled` | Oui (PH5-01) |
| Erreurs | Aucune règle de relance dans le skill. La routine signale seulement | — |
| Délais et expirations | Bail de 30 min, **sans alarme** (T13). En production, la commande `hq-33ebcef6…` (`black-wall-news`) est `running` **sans bail** depuis le 19 nov. à 1 h 49 (heure de Toronto). **Une routine qui cherche les « baux expirés » ne la voit pas**, puisque `claim=null` | — |
| Redémarrage | Le distributeur n'a aucun état propre. Le serveur conserve l'état (T13) | — |
| Relances | Aucun compteur de tentatives sur les commandes hors mission. Les missions ont `maxAttempts` | — |
| Quotas | Environ 95 tours par semaine, même quand la file est vide. Quota API de 60 req/min partagé (I5). Si le quota Grok Bot est épuisé, tout s'arrête et rien ne le signale | — |

**Conclusion : le distributeur actuel dépend de deux failles de permission (PH5-01 et PH5-02).** Si Codex les corrige sans changer le distributeur, le claim (portées absentes) et le passage en `running` (PATCH sans jeton) cesseront de fonctionner. Le correctif serveur et la nouvelle identité du distributeur (§4) doivent donc **arriver ensemble**.

### 3.3 Observations de production (GET seulement, 23 nov. vers 15 h 25)

- `GET /api/hq/commands` → 200 : 3 commandes, 2 `done` et 1 `running` sans bail (ci-dessus). Toutes ont été créées par `ceo`, entre le 5 et le 19 nov. Les textes n'ont pas été recopiés.
- `GET /api/hq/missions` → 200, 0 visible pour `service:hq-poll`.
- `GET /api/bootstrap` avec le même jeton → 403 (I4 confirmé).
- `GET /api/health` → 200.

## 4. État des identités

### 4.1 Constat (45c701a et box)

- **Une seule identité de service** : tout client Access autorisé et absent de `HQ_MACHINE_IDENTITIES` devient `service:hq-poll`, avec des portées absentes (I1). Il n'existe ni distinction par client, ni révocation ciblée côté Worker, ni journal par client.
- **Les machines peuvent porter un rôle humain.** `resolveServiceMachine` accepte `actorId: "coo"` ou `"ceo"` (I2), et `decideMission` ne vérifie jamais `human` (T3). L'interdiction d'approbation A3 par une machine repose donc sur la configuration, pas sur le code.
- **Secret partagé.** `/home/box/agent-data/secrets/cf-access-hq-office-poll.env` est en `600 box:box`, 255 octets, modifié le 22 nov. à 0 h 22. Le dossier est en `2755` et listable. **215 processus** tournent sous `box`, et 16 dossiers d'agents existent. Tous les agents peuvent donc lire ce fichier. À titre de comparaison, `box-secrets.json` appartient à `sand-host` (600). Le contenu n'a pas été lu : pour l'appel GET, le fichier a été chargé dans un sous-shell, sans affichage.
- **Journaux** : les réponses ne contiennent jamais `tokenHash` (`publicCommand`). En revanche, le `claimToken` en clair passe par la sortie de l'outil du distributeur.

### 4.2 Architecture cible (à valider par Philippe, sans coût)

1. **Une identité par service.** Il faut un jeton de service Access par exécutant (`machine-distributor` pour Office, puis un par agent qui appelle le centre), chacun avec sa fiche `HQ_MACHINE_IDENTITIES` (`id`, `actorId` unique, `orgId`, `scopes`). Le repli `service:hq-poll` est supprimé : un client sans fiche reçoit un **403**.
2. **Portées minimales.** De nouvelles portées : `dispatch` (lire `pending`, `queued` et les baux expirés, claim pour un tiers et remise) ; `work` (heartbeat et clôture **de sa propre tentative**) ; `create` (création de commande, pour les humains seulement par défaut) ; `review` (lecture large, **jamais** de décision A3 pour une machine). En l'absence de portées, c'est un refus (*default deny*).
3. **Aucune machine n'approuve une action A3.** `decideMission`, `transition done` et tout ce qui passe par `validApproval` exigent `human === true`, issu d'un JWT Access avec `email`. `resolveServiceMachine` refuse tout `actorId` appartenant à un rôle humain (`ceo`, `coo`, `chief-of-staff` et les rôles d'`ACCESS_ACCOUNTS`).
4. **Le `claimToken` n'est jamais transmis au modèle.** Le jeton reste dans un petit **assistant local déterministe** (un script de la box, aucune infrastructure nouvelle). Il fait le claim, garde le jeton dans un fichier `600` propre à la tentative et ne renvoie au modèle que `commandId`, `attemptId` et le brief. Le modèle demande « heartbeat », « done » ou « blocked » à l'assistant, qui ajoute le jeton. Le brief entre agents ne contient jamais de jeton. À défaut d'assistant, on peut opter pour une variante côté serveur : le jeton est lié à l'identité machine (`holder`) et à l'`attemptId`, et le serveur refuse toute écriture d'une autre identité, même si elle détient le jeton.
5. **Révocation.** Elle se fait par client Access (suppression du jeton de service dans Zero Trust, puis retrait du Client ID de `ACCESS_SERVICE_CLIENT_IDS` et de la fiche). Comme chaque identité est distincte, révoquer l'une n'arrête pas les autres. Le serveur refuse aussi les tentatives d'une identité révoquée : vérifier `holder` à chaque écriture.
6. **Journaux sans secret.** Une table `hq_attempt` (§7) avec `holder`, `attemptId`, des horodatages et le résultat, **sans jeton ni hash**. Les journaux du distributeur masquent tout en-tête `CF-Access-*` et tout `claimToken`. Un contrôle gitleaks est passé sur les journaux exportés.
7. **Isolation du secret.** L'option B ou C de `secret-access-rotation.md` §3 (coffre de la plateforme, ou utilisateur Unix distinct pour l'assistant). Tant que ce n'est pas fait, l'étape 1 réduit au moins ce que le secret permet.

### 4.3 Procédure de rotation (documentation seulement, **rien n'a été exécuté**)

Elle reprend `secret-access-rotation.md` §4, adaptée au découpage par identité :

1. Philippe crée dans Zero Trust un **nouveau** jeton de service (`klirline-distributor-<date>`), avec une durée d'un an et la politique Service Auth de l'application `centre.klirline.com`. L'ancien jeton reste actif.
2. Philippe ajoute le nouveau Client ID à `ACCESS_SERVICE_CLIENT_IDS` et sa fiche à `HQ_MACHINE_IDENTITIES` (secrets Worker), sans retirer l'ancien. **Ce changement de secret Worker relève de Philippe.**
3. Le nouveau Client Secret est déposé dans le stockage retenu (coffre ou fichier `600` de l'assistant), sans jamais passer par un chat, un document ou un transcript.
4. Contrôle par un GET `/api/hq/commands?status=pending` avec le nouveau jeton → 200, identité `machine-distributor` (et non `service:hq-poll`).
5. La routine bascule sur le nouveau jeton, puis on observe un cycle de poll.
6. L'ancien Client ID est retiré du Worker, puis l'ancien jeton est révoqué dans Zero Trust. Contrôle : l'ancien jeton reçoit 401 ou 403.
7. **Retour arrière** : tant que l'étape 6 n'est pas faite, il suffit de revenir à l'ancien fichier. Après l'étape 6, il faut créer un nouveau jeton : on ne réactive jamais un ancien.

## 5. Risques critiques restants (sur 45c701a, en production aujourd'hui)

1. **PH5-01** : n'importe quelle identité authentifiée sous `/api/hq/*` peut rouvrir, annuler ou bloquer une commande, **y compris une commande terminée**, sans jeton (T1, T4, T8, T9).
2. **PH5-02** : le jeton de service commun (portées absentes) peut créer, prendre, interrompre et modifier des commandes (I1, T2, T4, T9). Il est lisible par tous les agents de la box.
3. **PH5-03** : une machine déclarée `coo` approuve une mission et la clôture (T3, I2). Le test du dépôt exige ce comportement.
4. **PH5-04** : une preuve ou un livrable peut être fabriqué sans jeton par une identité `review` ou `human`, et un livrable validé peut être écrasé par un tiers `work` (T12).
5. **PH5-05** : pas de heartbeat ni d'alarme. Des commandes restent en cours indéfiniment : c'est observé en production (`hq-33ebcef6…`, `running` sans bail depuis le 19 nov.).

Atténuation actuelle : l'API n'est joignable que derrière Cloudflare Access, et les identités sont peu nombreuses. Les risques viennent donc d'un agent manipulé ou d'un secret partagé, pas d'Internet.

## 6. Recommandations de correction (fiches pour Codex)

**Fichiers concernés, pour éviter des corrections concurrentes** : `src/hq/commands.js`, `src/hq/dispatch.js`, `src/hq/missions.js`, `src/hq/machine-auth.js`, `src/access.js`, `src/worker.js` et `scripts/hq-do-check.mjs`. Ce sont vraisemblablement ceux que touche `fix/office-reliability`. **Grok Bot n'y écrit pas.** Il ne touche que `docs/hq2/**`. Codex reprend les fiches ci-dessous **après** comparaison avec sa branche, et ne réécrit pas ce qu'elle corrige déjà. Les numéros de ligne correspondent à 45c701a.

Pour toutes les fiches, la reproduction se fait avec `node docs/hq2/probes/phase5/harness.mjs --ref <ref> --out r.json`, puis en lisant le test indiqué. Les attentes ci-dessous valent pour la version corrigée.

| ID | Sév. | Fichier (45c701a) | Reproduction | Attendu | Observé | Correction recommandée | Test d'acceptation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PH5-01 | Critique | `src/hq/commands.js:173-190` (`applyHqPatch`), `:216-225` (branche `!writesResult`) | T1, T4, T8, T9 | Tout changement de statut d'une commande louée exige `attemptId` et `claimToken` du titulaire actuel, ou un humain avec une raison. Les états `done`, `failed` et `cancelled` sont immuables. `pending` et `queued` ne s'atteignent que par l'expiration côté serveur | Un PATCH sans jeton donne 200 vers `pending`, `queued`, `cancelled`, `blocked` ou `running`, même depuis `done` | Matrice de transitions explicite (statut source, statut cible, qui, preuve). Refus 409 hors matrice. Annulation réservée aux humains (portée `create` ou rôle humain) | T1, T4, T8 et T9 → **protégé** ; `PATCH {status:"pending"}` sur `done` → 409 |
| PH5-02 | Critique | `src/worker.js:72-85` (repli), `src/access.js:93-107`, `src/hq/dispatch.js:108-142` | I1, T2, T4 | Portées absentes = refus. Création, claim et interruption exigent une portée explicite | `scopes=undefined` passe le claim (`:118`) ; création et interruption sans contrôle de portée | Supprimer le repli `service:hq-poll` (403 si le client n'a pas de fiche). `allows()` partout (`create`, `dispatch`, `work`). Garde par défaut `if (!Array.isArray(scopes)) return 403` en tête de `dispatchHq` | I1 → identité refusée ; T2, T4 → **protégé** ; création avec `scopes=[]` → 403 |
| PH5-03 | Critique | `src/hq/missions.js:354-362` (`decideMission`), `:196-201` (`transition done`), `src/hq/machine-auth.js:33-53`, `scripts/hq-do-check.mjs:167-168` | T3, I2 | Seul un humain (`human === true`, JWT avec `email`) approuve ou clôt une mission A3. Aucune machine ne porte `ceo`, `coo` ni `chief-of-staff` | La machine `coo` approuve (200, `approvalValid=true`) puis clôt (200) | `if (options.human !== true) fail(403)` dans `decideMission` et `transition done`. `resolveServiceMachine` rejette les `actorId` humains. Inverser l'assertion `hq-do-check:167` : la machine `coo` → 403, puis approbation par un humain (`x-human: 1`) → 200 | T3 et I2 → **protégé** ; `hq-do-check` vert avec l'assertion inversée |
| PH5-04 | Critique | `src/hq/commands.js:245` (contournement `reviewer`), `src/hq/missions.js:297-319` (commande `done` → révision sans jeton) | T12 | Un résultat ou un livrable n'est écrit que par la tentative en cours (jeton). Une révision après `done` exige soit une nouvelle tentative (claim), soit un humain | La machine `review` écrit `done` avec une preuve inventée (200). La machine `coo` dépose un livrable sans jeton (200). B écrase le livrable validé (200) | Supprimer le contournement `reviewer` pour `done` et `failed` (un humain peut **rejeter**, pas écrire la preuve). Dans `addDeliverable` sur une commande `done` : 409, sauf humain | T12 → **protégé** dans les 4 sous-cas |
| PH5-05 | Élevée | `src/hq/commands.js:102-112` (`leaseActive`), `:293-311` ; `src/worker.js` (pas d'`alarm()`) | T6, T7, T13 et la production (`hq-33ebcef6…`) | Heartbeat lié à la tentative. Une alarme du DO expire les baux : `dispatched` expiré → `queued` (nombre de tentatives + 1, plafond), `running` sans heartbeat → `blocked` avec une raison. Aucun `running` sans bail | Route heartbeat 404. Une commande abandonnée reste `dispatched` 3 h après. Un `running` sans bail persiste 4 jours en production | `POST /api/hq/commands/:id/heartbeat {attemptId, claimToken}` (titulaire seulement, refus après expiration) ; `ctx.storage.setAlarm(min(leaseUntil))` ; refuser `running` sans `claim` | T6 et T7 deviennent testables et **protégés** (heartbeat de B → 403 ou 409 ; heartbeat après expiration → 409). T13 : commande abandonnée → `queued` puis `blocked` après N tentatives, sans appel externe |
| PH5-06 | Élevée | `src/hq/dispatch.js:108-112`, `src/hq/commands.js:134-171` | T5 | Une `Idempotency-Key` par identité renvoie la même commande | Deux ids | Colonne ou table `idem(actor, key)` UNIQUE dans le DO, réponse 200 avec la commande existante | T5 → **protégé** (même id, 2e réponse 200) |
| PH5-07 | Élevée | `src/worker.js:200` (`this.hqList({})` passé à `runMissionOperation`), `src/hq/commands.js:425-430` | E1 | Les opérations de mission retrouvent leur commande par id, sans limite | 409 « commande introuvable » au-delà de 200 commandes | Passer `hqGet(task.commandId)` (ou une liste ciblée par `missionId`) au lieu de la fenêtre de 200. Ajouter une pagination au GET | E1 → 200 |
| PH5-08 | Élevée | Skill `pont-hq-centre-agents` et routine ; `src/hq/missions.js:427-431` | §3.2, production (missions → 0) | Le distributeur voit les missions prêtes et les commandes `running` sans bail | Il est aveugle aux missions et aux `running` sans bail | Portée `dispatch` qui lit les tâches de mission prêtes. Requête « orphelines » côté serveur (`running` sans bail, baux expirés). Mettre le skill à jour (`distributeur-spec.md` §7) | GET « orphelines » avec la portée `dispatch` → contient la commande de test ; la routine la signale une seule fois |
| PH5-09 | Moyenne | `src/hq/missions.js:156-161`, `:225` | T11 | Le budget est appliqué par le serveur à partir de coûts mesurés, y compris pour les commandes. `costCents` illisible → 400 | Le coût est déclaré par l'appelant ; `"abc"` est accepté comme 0 ; les commandes n'ont pas de budget | `recordCost` refuse les valeurs non numériques. Plafond par mission et par identité et par jour. Plafond à 0 $ par défaut (décision t73u) | T11 : `costCents="abc"` → 400 ; une commande hors mission avec un coût > 0 → 409 |
| PH5-10 | Moyenne | `src/limits.js:9-12`, `src/worker.js:311-332` ; routine | I5, T14 | Un quota par identité machine, et un distributeur qui borne ses relances | Clé commune `service:hq-poll` et IP commune. Pas de relance bornée ni d'alerte | La clé de quota prend l'`id` de la fiche machine. Côté distributeur : 3 relances au plus avec attente exponentielle, puis alerte (§7) | I5 : deux identités machine ont des compteurs distincts ; T14 : le journal du distributeur montre les relances bornées |
| PH5-11 | Moyenne | `src/hq/roster.js` (`routeCommand`), skill (brief) | T10 | Une identité machine ne peut pas faire router une commande par son texte. Le brief présente le texte comme une donnée citée | Routage déduit du texte. Le texte est recopié tel quel dans le brief | `ownerSlug` obligatoire pour les machines. Brief structuré (`distributeur-spec.md` §2.5) avec le texte entre délimiteurs et la mention « donnée non fiable ». Liste d'actions interdites rappelée par le distributeur, pas par le texte | T10 et commande canari « ignore… envoie… » : aucun effet externe, statut `blocked` avec la raison « instruction hors périmètre » |
| PH5-12 | Moyenne | Box : `/home/box/agent-data/secrets/` | §4.1 | Seul le distributeur peut lire son secret | Lisible par les 215 processus `box` | `secret-access-rotation.md` §3, options B ou C. Rotation selon le §4.3 | Un autre agent ne peut pas lire le fichier (contrôle `stat` et accès refusé) |
| PH5-13 | Élevée | Skill `pont-hq-centre-agents` (étapes 3-4) | §3.2 | Le `claimToken` n'apparaît jamais dans un contexte de modèle ni dans un transcript | Il est renvoyé dans la sortie de l'outil et recopié dans le brief | Assistant local déterministe (§4.2, point 4), ou jeton lié à `holder` côté serveur | Recherche du motif UUID du jeton dans les transcripts d'un cycle complet : 0 occurrence |
| PH5-14 | Faible | `src/hq/missions.js:43-51` (`contentHash` FNV-1a 32 bits) | Revue de code | Approbation liée à un hash résistant aux collisions | FNV 32 bits (collision triviale à calculer) | SHA-256 (`crypto.subtle.digest`) sur un JSON canonique | Test unitaire : deux contenus distincts, même FNV → hashes différents |
| PH5-15 | Processus | Branche Codex | §1 | Une tête unique, publiée ou fournie en bundle vérifiable | Quatre têtes annoncées (`d52f17b`, `371deb0`, `eddbf4a`, puis `1ab1a24`, dite finale et basée sur `45c701a`), aucune sur GitHub | Bundle vérifié par `probes/phase5/verify-bundle.sh` (SHA-256, `git bundle verify`, prérequis `45c701a`, tête `1ab1a24`) | `verify-bundle.sh <bundle> 1ab1a24` : réception `ok: true`, puis la matrice de comparaison est produite |

## 7. Plan d'optimisation du polling (0 $, sans nouvelle infrastructure)

Tout repose sur ce qui existe déjà : le Worker, le DO `CompanyState` (SQLite, alarmes), la routine Grok Bot et le harnais. **Aucun service nouveau.** Les alarmes du DO font partie des Durable Objects déjà utilisés. Leur coût est à confirmer sur le plan Cloudflare actuel avant activation (décision t73u : budget 0 $).

1. **Le serveur gère les expirations sans consommer de tour** (dépend de PH5-05) : une alarme du DO à `min(leaseUntil)`. Un bail expiré passe en `queued` (nombre de tentatives + 1). Au-delà de 3 tentatives, la commande passe `blocked` avec une raison. Une commande `running` sans heartbeat depuis 2 baux passe `blocked`. Résultat : plus aucune commande orpheline, et le distributeur n'a plus besoin de repasser pour les détecter.
2. **Point de contrôle peu coûteux** : un `GET /api/hq/queue` (portée `dispatch`) renvoie seulement des compteurs (`pending`, `queued`, `orphelines`) et une `etag`. Si l'`etag` n'a pas changé, la routine s'arrête au premier appel, avec un tour minimal.
3. **Polling adaptatif.** La routine passe à **4 créneaux fixes** (9 h, 12 h, 15 h et 18 h, lun–ven, heure de Toronto), soit 20 tours par semaine au lieu d'environ 95. En cas d'activité (file non vide), le skill traite toute la file, puis **un seul** passage de suivi est programmé 30 min plus tard. Il n'y a pas de boucle.
4. **Réveil événementiel authentifié, si la plateforme le permet** : à la création d'une commande de priorité `haute`, le Worker envoie un appel sortant signé (HMAC, avec un secret dédié) vers le réveil (*wake*) prévu par le skill. Seuls l'`id` et la priorité sont transmis, **jamais le texte**. Il y a au plus un réveil toutes les 15 min. Ce point est à valider : existence et authentification de l'entrée de réveil côté plateforme, et ajout d'un secret Worker par Philippe. Sans validation, on reste sur les points 1 à 3.
5. **Reprise contrôlée** : seule l'alarme remet une commande en `queued`. Le distributeur ne rouvre jamais une commande lui-même (fin de PH5-01). Chaque reprise crée une nouvelle tentative et invalide l'ancienne (déjà protégé, T8).
6. **Journal des tentatives** : une table `hq_attempt` (`command_id`, `attempt_id`, `holder`, `claimed_at`, `lease_until`, `last_heartbeat_at`, `outcome`, `closed_at`, `reason`), sans jeton ni hash. Elle est lisible par `review` et affichée au Bureau.
7. **Quotas** : au plus 5 remises par passage et 1 brief par commande et par tentative. Quota API par identité machine (PH5-10). Si un appel renvoie 429, on s'arrête jusqu'au créneau suivant. Si le quota Grok Bot est bas, la routine ne traite que la priorité `haute`.
8. **Alertes, sans envoi externe** : le distributeur écrit `POST /api/hq/distributor/heartbeat` à chaque passage. Si ce signal manque pendant plus de 2 créneaux, si des commandes sont orphelines ou si 3 échecs se suivent, le Bureau affiche un bandeau. Le signalement à Philippe se fait dans le chat Office, une seule fois par incident.

Gain estimé : environ 95 tours par semaine aujourd'hui, contre 20 tours plus les événements. Les expirations ne coûtent plus de tour.

## 8. Critères de certification d'un agent IA réel

Un agent (distributeur ou exécutant) n'est certifié qu'après **tous** les critères suivants, chacun prouvé par une sortie conservée dans `docs/hq2/probes/` :

1. **Version** : SHA publié sur GitHub (ou bundle vérifié), descendant de la production, CI `ci / tests` et `ci / secret-scan` vertes.
2. **Harnais** : `harness.mjs` sur ce SHA donne **protégé** pour T1 à T9, T12, E1, I1 et I2. T10, T11, T13 et T14 sont au moins partiels avec la part distributeur couverte par 7 et 8 ci-dessous. Aucun résultat « non testable » sur T6 et T7.
3. **Identité propre** : un jeton de service et une fiche machine, avec un `actorId` non humain et les portées minimales. Le jeton n'est utilisable que par cet agent.
4. **Aucune action A3** : 0 approbation, 0 clôture de mission, 0 envoi, 0 dépense dans son journal. Tout essai reçoit 403.
5. **Jeton hors modèle** : 0 occurrence du `claimToken` dans les transcripts d'un cycle complet (recherche automatique).
6. **Preuves** : chaque `done` porte une preuve vérifiable. Toute preuve absente donne `blocked`. Aucun « succès » sans preuve sur 3 cycles.
7. **Résistance à l'injection** : la commande canari (T10) ne produit aucun effet externe et passe `blocked` avec une raison.
8. **Robustesse** : redémarrage pendant une tentative, puis reprise par l'alarme sans double exécution. API coupée pendant 5 min, puis relances bornées et une seule alerte. Une réponse 429 est respectée.
9. **Journaux sans secret** : gitleaks sur les journaux et transcripts exportés → 0 fuite.
10. **Essai encadré** : 3 cycles réels sur `sandbox-klirline` (commandes fictives), puis **validation humaine de Philippe**. La certification est révocable à tout moment.

## 9. Décision GO / NO-GO

| Objet | Décision | Motif |
| --- | --- | --- |
| Production `45c701a`, en tant que socle multi-agents autonome | **NO-GO** | PH5-01 à PH5-05 sont reproduits en local. Aucune des 14 attaques n'est entièrement protégée |
| Distributeur actuel (skill et routine), pour une extension à de nouveaux agents ou à des actions réelles | **NO-GO** | Il dépend de PH5-01 et PH5-02, le jeton passe par le modèle, il n'a ni heartbeat ni alerte. Le maintien de l'usage actuel, supervisé et limité aux briefs, relève de Philippe |
| Branche Codex `fix/office-reliability` | **Non testable / en attente** | Aucune tête n'est accessible (PH5-15). Dès réception du bundle : `node docs/hq2/probes/phase5/harness.mjs --ref <tête> --out docs/hq2/probes/phase5/resultats-<sha>.json`, puis comparaison avec `resultats-45c701a.json` |
| Rulesets | **Actifs** (créés par Philippe le 23 nov. à 10 h 52) | `27914655` exige une PR et les 3 checks sur la production, avec 0 approbation ; `27914662` fige `main`. Il reste à ajouter une revue humaine indépendante : `distributeur-v2-spec.md` §8 |

### Rejouer sur la branche Codex (dès que le bundle est disponible)

Méthode recommandée, en une seule commande :

```bash
docs/hq2/probes/phase5/verify-bundle.sh <fichier>.bundle 1ab1a24
```

Le script calcule le SHA-256, lance `git bundle verify` et `list-heads`, et contrôle que le prérequis est `45c701a` et la tête `1ab1a24`. Il importe le bundle dans un clone isolé (`/workspace/hq2/codex-verify`), fait un scan gitleaks des nouveaux commits et lance les tests du dépôt, puis le harnais. Il produit enfin `comparaison-45c701a-1ab1a24.json` : la matrice des 14 attaques et le verdict final. Une exécution à blanc sur un bundle de test a fonctionné, ainsi que deux refus (mauvaise tête, mauvais prérequis). Méthode manuelle équivalente :

```bash
cd <clone klirline-control-center>
git bundle verify <fichier>.bundle
git fetch <fichier>.bundle 'refs/heads/*:refs/remotes/codex/*'
git merge-base --is-ancestor 45c701a codex/fix-office-reliability && echo "descend de la prod"
git diff --stat 45c701a codex/fix-office-reliability
# Si Codex a nommé la route autrement : HQ_HEARTBEAT_ROUTE=/api/hq/commands/:id/<route>
node docs/hq2/probes/phase5/harness.mjs --ref codex/fix-office-reliability --repo . --port 8897 \
  --out docs/hq2/probes/phase5/resultats-<sha court>.json
```

Le harnais crée un worktree détaché temporaire, lance `npm ci`, un pilote local et workerd sur un stockage jetable, puis supprime le tout. Il ne fait aucun appel à la production et ne lit aucun secret. Si Codex change les exports (`CompanyState`, `hqDurableStore`, `dispatchHq`) ou les formes de réponse, le JSON porte `fatal` ou des verdicts « non testable » : il faudra alors adapter le harnais, **pas** conclure à une correction.
