# Rapport de certification HQ 2.0 (version publique), 23 novembre 2026

- **Auteur :** Grok Bot (contrôle technique automatisé, lecture seule), le 23 novembre 2026 vers 21h15 heure de Toronto. Relevé GitHub de suivi à 21h35 : **aucun changement**.
- **Version publique caviardée.** Le dépôt est public et la production présente des faiblesses non corrigées. Les détails techniques (scénarios, références de code, journaux, résultats test par test) sont conservés hors dépôt.
- **Ce rapport n'est pas une approbation humaine indépendante.**

## 1. Avancées confirmées par GitHub et Workers Builds

| Avancée | Preuve |
|---|---|
| Production à `45c701abd8aebcae18a44e8980bfec35c15fd3a3` | PR #13, fusionnée le 23 novembre |
| CI réelle en place : tests du dépôt + scan de secrets (gitleaks) | Runs 45207740919 et 45208519133 : success |
| Build de production réussi sur 45c701a | Workers Builds 3bc841a7 (le build est lisible ; la version active ne l'est pas directement) |
| Bureau HQ v1 intégré : commandes, claim avec bail, statuts, missions | PR #5, #7, #9, #10, #11 ; 9 builds de production en success |
| Hub Admin produits et sondes de sites | PR #1 à #4 |
| Specs HQ 2.0, distributeur V2, harnais | PR #12 **brouillon, non fusionnée** (CI 45261615463 success) |

**Pas avancé sur GitHub :**
- code du distributeur V2 ;
- heartbeat, file d'échecs, priorités effectives, arrêt d'urgence global ;
- adaptateurs Kontak et GitHub ;
- **aucun correctif P0/P1.**

PR #1 à #11 ont été fusionnées avant l'existence de la CI GitHub Actions.

## 2. Tests

| Test | Où | Résultat |
|---|---|---|
| `ci / tests` (4 scripts du dépôt) | GitHub Actions, run 45208519133 | **Succès** |
| `ci / secret-scan` (gitleaks) | GitHub Actions, run 45208519133 | **Succès** |
| Workers Builds de la production | Cloudflare, build 3bc841a7 | **Succès** |
| Tests du dépôt sur 45c701a | Local, clone isolé | 4/4 OK |
| Harnais de sécurité de référence (22 contrôles), 3 exécutions | Local, isolé, jamais contre la production | Stable, 0 écart entre exécutions : **2 protégés, 9 vulnérables, 7 partiels, 2 non testables**. Détail non publié |
| `npm audit` | Local | 4 alertes « high », toutes dans l'outillage de développement |

**La CI verte ne prouve pas la sécurité** : le harnais de sécurité ne fait pas partie de la CI.

## 3. Travaux Codex

| Élément | Statut | Preuve |
|---|---|---|
| Nouvelle PR ou branche Codex depuis 45c701a / f3b0e2d | **Aucune : rien à certifier** | 13 PR et 15 branches inchangées (relevés de 21h15 et 21h35) |
| Têtes annoncées 1ab1a24, d52f17b, 371deb0, eddbf4a | **Absentes de GitHub** | HTTP 422 dans les 6 dépôts suivis |
| Archive Codex 5.1 | **Non reçue, donc non auditée** | — |
| Travaux validés / refusés | 0 / 0 | — |

Quand une livraison arrive, on applique `procedure-controle-pr-codex.md` (dans ce dossier).

## 4. Performances des agents

- Commandes HQ en production au 23 novembre, 21h14 heure de Toronto : **3**.
  - 2 sont terminées.
  - 1 est restée en cours sans exécutant pendant plus de 100 h. Elle est en quarantaine en attente d'une décision humaine.
- Toutes les PR et tous les commits sont signés d'un **compte GitHub unique** : aucune attribution par agent n'est possible.
- Indicateurs par agent : document interne, non publié (il contient des données d'usage).
- Postes, chevauchements et remplacements : voir `rh/`.
- Missions pilotes et continuité : voir `missions/`.

## 5. Risques résiduels

- **5 risques P0 et 8 risques P1 restent ouverts** sur 45c701a. Ils touchent les permissions des identités machine, l'approbation humaine, la fiabilité des preuves de livraison, la reprise et l'anti-doublon, ainsi que la gouvernance de fusion.
- Détails non publiés : le dépôt est public et les correctifs ne sont pas livrés.
- Le cloisonnement des secrets des agents est en préparation (lots 0 et 1, hors dépôt).

## 6. Décisions attendues

La liste complète est dans `rapport-autorisations-2026-11-23.md` (version publique). Points principaux :
- revue humaine indépendante (2e compte GitHub, CODEOWNERS, ruleset) avant toute fusion de correctif ;
- réception de l'archive Codex ;
- lots de cloisonnement des secrets ;
- renouvellement d'un jeton GitHub avant le 11 décembre.

## 7. Verdict

**NO-GO** pour l'autonomie des agents, pour toute fusion vers la production et pour la certification de Codex 5.1.

**GO limité** pour les opérations supervisées (lecture, préparation, contrôles locaux, aucune action externe).

Réévaluation possible après trois conditions :
- une livraison Codex VALIDÉE selon la procédure (3 exécutions stables, 0 régression) ;
- la mise en place de la revue humaine indépendante ;
- l'approbation humaine de la PR.
