# HQ 2.0 — Réconciliation `d754179` ↔ `fix/office-reliability` (`d52f17b`)

Rédigé le 23 novembre 2026 vers 0 h 45 (heure de Toronto). Lecture, analyse et documentation uniquement.

## 1. La branche `fix/office-reliability` existe-t-elle sur GitHub ?

**Non.** Vérifications faites le 23 nov. 2026 :

| Vérification | Résultat |
| --- | --- |
| `git ls-remote origin` (28 références, branches et `refs/pull/*`) | Aucune `fix/office-reliability`, aucune référence vers `d52f17b…` |
| `git fetch origin d52f17b081081efedb1104e5407c389fea78c76e` | `fatal: remote error: upload-pack: not our ref` |
| `GET /repos/…/commits/d52f17b…` (API GitHub, anonyme puis authentifiée) | 422 `No commit found for SHA` |
| Recherche de commits `hash:d52f17b` | 0 résultat |
| `knowledge/hq-fiabilisation.md` dans les 14 branches et les 12 PR | Absent partout |

Ce commit n'existe donc vraisemblablement que dans le clone local de Philippe, sur son PC Windows. **Je n'ai pas accédé à ce PC.** Pour le publier sans toucher la production, Philippe doit lancer depuis ce clone :

```powershell
cd <dossier du clone klirline-control-center>
git status                                   # vérifier qu'il ne reste rien à commiter
git log -1 --format=%H fix/office-reliability # doit afficher d52f17b081081efedb1104e5407c389fea78c76e
git push origin fix/office-reliability
```

Ce `push` **ne déploie pas la production**. Workers Builds publiera seulement un *aperçu* `fix-office-reliability`, sans URL active (voir `distributeur-spec.md` §5). Ne pas pousser vers `cursor/klirline-control-center` ni vers `main`.

### Branches proches qui existent bel et bien

| Référence | Commit | Date | Dans `d754179` ? |
| --- | --- | --- | --- |
| `cursor/hq-command-reliability-e950` (= PR #8, non fusionnée) | `91bfb22` | 5 nov. | Non, 1 commit d'avance, sans doute remplacé par #7 et #9 |
| `cursor/hq-command-reliability-a575` | `a5cd0f4` | 5 nov. | Non, 1 commit d'avance |
| `main` | `962c04d` | 6 oct. | Oui. `main` est un ancêtre obsolète : la branche de production est `cursor/klirline-control-center` |

Ces branches sont antérieures à `d754179` et ne sont **pas** `d52f17b`. Je ne les ai pas rejouées.

## 2. Sondes rejouées

Le seul commit disponible était `d754179`, rejoué dans un worktree détaché. Je n'ai rien modifié dans `src/`.

- **workerd local** : `docs/hq2/probes/probe-workerd.mjs`. Il lance `wrangler dev --local` sur un port libre (8894) avec le pilote existant `scripts/hq-do-driver.mjs`, donc le vrai `CompanyState` et le vrai `dispatchHq`. Seule l'authentification Access est court-circuitée par les en-têtes `x-actor`, `x-scopes` et `x-human`.
- **Node** : `docs/hq2/probes/probe-node-service.mjs` utilise `dispatchHq` avec `memoryHqStore` et `scopes: undefined`. C'est la forme exacte de l'identité `service:hq-poll` produite par `src/worker.js` quand aucune fiche `HQ_MACHINE_IDENTITIES` ne correspond. Le pilote workerd ne peut pas produire `undefined`.
- Les sorties brutes sont dans `docs/hq2/probes/resultats-d754179.json`.

Pour rejouer sur `d52f17b` une fois la branche poussée :

```bash
git worktree add ../wt-d52f17b d52f17b081081efedb1104e5407c389fea78c76e
node docs/hq2/probes/probe-workerd.mjs ../wt-d52f17b 8895
node docs/hq2/probes/probe-node-service.mjs ../wt-d52f17b
```

## 3. Tableau des défauts et de leur statut

Pour la colonne `d52f17b`, il est impossible de dire « corrigé » sans le code. Ce que dit le rapport de fiabilisation n'a pas été vérifié.

| # | Défaut (audit phase 0) | Sonde | `d754179`, résultat réel | Statut sur `d754179` | Statut sur `d52f17b` |
| --- | --- | --- | --- | --- | --- |
| P1 | Double exécution par claims concurrents | 10 claims simultanés (workerd) | `issued=1`, `held=9` | **Non affecté** (le DO sérialise) | Non vérifiable |
| P2 | Remise en `pending` sans jeton, puis second claim | A claim, B `PATCH {status:"pending"}` sans jeton, B claim | PATCH 200, puis B obtient `issued` : **deux jetons valides pendant le bail de A** | **Non corrigé (P0)** | Non vérifiable |
| P3 | Annulation sans portée | `PATCH {status:"cancelled"}` avec `scopes=[]` (workerd) et `scopes=undefined` (Node) | 200 et 200 | **Non corrigé** | Non vérifiable |
| P3b | État terminal réversible | `cancelled → pending` avec `scopes=[]` | 200, statut `pending` | **Non corrigé** | Non vérifiable |
| P4 | `POST /api/hq/command` et `/interrupt` sans portée `work` | `scopes=[]`, puis `service:hq-poll` sans fiche | POST 201, interrupt 200 (statut inchangé, `dispatched`). Avec `undefined` : création 201 et **claim `issued`** | **Non corrigé** | Non vérifiable |
| P5 | Approbation par une machine `coo` | `POST …/approval` avec `actor=coo`, `scopes=[review]`, `human=false` | 200, `approvalValid=true`. Le test existant `hq-do-check.mjs` **exige** ce comportement (l. 167) | **Non corrigé (P0)** | Non vérifiable |
| P6 | Pas de heartbeat | `POST /api/hq/commands/:id/heartbeat` | 404 | **Absent (P0)** | Non vérifiable |
| P7 | Pas d'expiration autonome (pas d'alarme) | `GET` 2 h après un claim au bail de 30 min | toujours `dispatched`, `leaseUntil` dépassé | **Absent (P0)** | Non vérifiable |
| P8 | Pas d'idempotence à la création | 2 `POST /api/hq/command` identiques | 2 identifiants distincts | **Absent** | Non vérifiable |
| P9 | Troncature à 200 commandes | tâche démarrée, 205 commandes créées ensuite, puis livrable avec jeton valide | 409 `La commande de la tâche est introuvable.` | **Non corrigé** | Non vérifiable |
| P10 | Jeton de complétion | livrable d'une ancienne tentative après reprise (couvert par `hq-do-check`) | 409 (refusé) | **Correct** | Non vérifiable |
| P11 | Livraison non protégée (P0) | lecture de l'API GitHub et Workers Builds | Aucun `.github/`, aucun ruleset (`GET /rulesets` → `[]`). La protection de branche n'est pas lisible avec ce jeton (`Resource not accessible`). Les builds de production lancent `npm run deploy` | **Non corrigé** (protection classique non vérifiable) | Indépendant du code |
| P12 | Flux KlirProspect obsolète | `GET` anonyme sur la fonction `prospects` | 404 (une fonction existante répondrait 401 sans jeton) : la fonction semble retirée | **Non corrigé**, à confirmer avec un jeton par l'agent KlirProspect | Non vérifiable |

En résumé, sur `d754179` les défauts P0 confirmés par l'exécution sont P2, P5, P6/P7 et P11. P1 et P10 sont sains.

## 4. Ce qu'il faudra faire quand `d52f17b` sera poussé

1. `git merge-base d754179 d52f17b` et `git diff --stat d754179...d52f17b` pour savoir si la branche part de `d754179` ou d'un ancêtre plus ancien.
2. Lire `knowledge/hq-fiabilisation.md`.
3. Rejouer les deux sondes ci-dessus sur `d52f17b`, puis remplir la dernière colonne avec les sorties réelles.
4. Si P2, P3, P5 ou P9 restent présents, ce sont les premiers correctifs de la phase 2 (`plan.md`). Ne pas réécrire ce que `d52f17b` corrige déjà.

## 5. Tests exécutés pour ce document (23 nov. 2026)

| Commande | Environnement | Résultat |
| --- | --- | --- |
| `node docs/hq2/probes/probe-workerd.mjs <wt d754179> 8894` | wrangler 4.166.0, workerd local, persistance temporaire | exit 0, 10 sondes, résultats ci-dessus |
| `node docs/hq2/probes/probe-node-service.mjs <wt d754179>` | Node v24.22.1 | `create 201, claim issued, cancel 200, missionCreate 403` |
| `curl` (code HTTP seulement) sur la fonction `prospects` | Internet, sans jeton | 404 |
| API GitHub (lecture) : commits, check-runs, rulesets | — | voir P11 |

Aucun test n'a été lancé sur `d52f17b`, puisque ce commit est inaccessible. Aucun appel n'a touché le Worker de production, à part une requête `GET /api/health` qui a reçu la redirection 302 d'Access, sans authentification.
