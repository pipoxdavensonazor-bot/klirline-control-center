# HQ 2.0 — Plan priorisé des phases 1 à 7

Chaque phase se fait sur sa propre branche avec une PR en brouillon vers `cursor/klirline-control-center`. **Aucun merge sans l'accord explicite de Philippe**, parce qu'un merge déploie la production par Workers Builds. Les efforts sont en jours de travail effectif (voir `docs/hq2/audit.md` §7).

## Avant la phase 1 : ce que Philippe valide

1. **Ce document et l'architecture** (`architecture.md`) : un seul DO, des agents externes en *pull*, pas de Queues, et des tables ajoutées sans migration de classe.
2. **La liste des 36 postes** et les **6 à 8 postes actifs** au départ (proposition : Chief of Staff, directeur commercial, agent de vente KlirProspect, Klir AI, Ops qualité, sécurité et conformité, plus éventuellement marketing et support).
3. **La règle « une machine n'approuve jamais »**, qui casse l'actuel relecteur machine `coo` de `config/hq-machines.example.json` et de `scripts/hq-execution-check.mjs`.
4. **Le statut du dépôt** : rester public ou repasser en privé (adresse courriel personnelle dans les métadonnées, conception d'Access lisible par tous).
5. **La protection de la branche de base** sur GitHub (PR obligatoire et vérifications) et le maintien du budget de modèle à **0 $** jusqu'à la phase 6.

## Phases

| Phase | Contenu | Critère de validation | Effort | Dépend de | Approbation de Philippe |
| --- | --- | --- | --- | --- | --- |
| **1. Registre des rôles** | `src/hq/roles.js` : 36 postes, 8 départements, `reportsTo`, niveau maximal A0 à A3, `rosterSlug` vers les 15 cartes Grok, `active`. Table `hq_role` pour l'état. `GET /api/hq/roles`. Lien avec `ACCESS_ACCOUNTS.role`. | Le self-check vérifie 36 postes uniques, aucun cycle hiérarchique, 6 à 8 actifs, aucune carte orpheline. L'API est en lecture seule. | 1,5–2 j | Phase 0 validée | La liste des postes et des postes actifs, et le niveau maximal de chacun |
| **2. Orchestrateur** | Correctifs R2, R3 et R5. Heartbeat, `alarm()` du DO (baux, purge de l'idempotence), file d'échecs (`failure.code`), `Idempotency-Key` sur les créations, arrêt d'urgence `hq_switch`, plafonds `hq_budget` (0 par défaut). Port du test DO paramétrable, script `npm test`. | Tests : double claim, bail expiré, heartbeat, rejeu idempotent, arrêt d'urgence (423), dépassement de budget (409), approbation machine refusée (403). `hq-do-check` passe sur workerd local. | 4–6 j | 1 | Le principe de l'arrêt d'urgence et les plafonds (0 $ au départ) |
| **3. Politique et journal des décisions** | `src/hq/policy-hq.js` : `decide(action, actor, mission)` renvoie `allow`, `require_approval` ou `deny` avec un motif. Table `hq_journal` append-only chaînée. État `awaiting_human`. Fiche de décision (options, analyse, sources, recommandation). `GET /api/hq/journal`. | Toutes les actions A3 passent par `awaiting_human`. Le journal est vérifiable (chaîne de hachage). Une décision sans source est refusée. Aucune élévation possible (tests). | 3–4 j | 2 | La matrice action × niveau et les seuils de montant (repris de `THRESHOLDS`) |
| **4. Adaptateurs produit** | Contrat commun, puis dans l'ordre : Klir AI (lecture du catalogue, études), **KlirProspect** (contrat de `architecture.md` §6.2), GitHub (lecture, puis PR en brouillon seulement), KlirPay (**lecture seule**), NORIA, KlirBuild, KlirMarket. | Pour chaque adaptateur : tests contre un serveur factice (succès, 401, 409, 429, 5xx, idempotence), aucun donnée personnelle dans le journal, arrêt d'urgence par adaptateur. KlirProspect : un test d'intégration en lecture contre l'API réelle, avec l'accord de Philippe. | 8–14 j | 3, et l'API réelle de chaque produit | **Chaque nouveau secret Worker** (jeton par adaptateur) et toute portée d'écriture |
| **5. Interface du bureau virtuel** | L'onglet Bureau affiche les départements et les rôles, les missions (aujourd'hui invisibles dans l'UI), la boîte d'approbations humaines, le journal, les budgets, la file d'échecs et le bouton d'arrêt d'urgence. Une vue Ventes avec le pipeline du Sales Center (lecture KlirProspect). | Parcours testé en local : approuver ou rejeter, arrêter puis relancer. CSP inchangée (`script-src 'self'`). Aucune action A3 sans clic humain. | 4–6 j | 3, et 4 pour la vue Ventes | La maquette avant le développement |
| **6. Trois missions pilotes** | (1) Étude de marché : Klir AI, puis analyse du directeur commercial, puis 30 pistes KlirProspect, puis brouillons de l'agent de vente, puis approbation humaine, puis suivi du pipeline. (2) Préparation de démonstration KlirProspect (5 agences, sans envoi). (3) Mission interne : rapport hebdomadaire du Chief of Staff. | Chaque mission atteint `done` avec un journal complet, une approbation humaine réelle et un coût conforme au plafond. **Zéro envoi externe automatique.** Les résultats réels sont séparés des simulations. | 3–5 j | 4 (Klir AI, KlirProspect), 5 | Le lancement de chaque pilote, tout plafond de modèle supérieur à 0 $ et tout envoi, qui reste manuel |
| **7. Sécurité et qualité** | Revue Access (aucune route publique ajoutée), tests d'abus (usurpation, élévation, rejeu, injection dans les livrables), protection des aperçus, scan des secrets en CI, branche protégée, documents `permissions.md`, `operations.md` et `test-report.md`. | Toutes les vérifications passent. Scan de secrets propre. Rapport de tests avec les sorties réelles. Procédure d'arrêt d'urgence répétée. | 3–4 j (dont une partie en continu dès la phase 2) | 2 à 6 | Le GO de mise en production (merge), au cas par cas |

**Total : 27 à 41 jours effectifs**, soit environ 6 à 10 semaines calendaires avec les validations.

## Hors périmètre tant que Philippe n'a pas donné son accord

Merge, `wrangler deploy`, migration ou écriture distante dans le DO de production, création ou rotation de secrets, activation de Queues ou d'un plan payant, appels de modèle facturés, tout envoi (courriel, SMS, social), toute écriture KlirPay.

## Réestimation du 23 nov. 2026 (après la réconciliation et l'audit du distributeur)

Le commit `d52f17b` n'est pas sur GitHub. Rien de son contenu n'a pu être réutilisé, et l'estimation part donc de `d754179`. Lot « sécurisation avant les agents » (chantiers 1 à 5 d'Office) :

| Lot | Effort |
| --- | --- |
| CI GitHub Actions (tests et gitleaks) et ruleset (`distributeur-spec.md` §4) | 0,5–1 j |
| Correctifs P2, P3, P3b, P4 et P9, avec états terminaux irréversibles | 1–1,5 j |
| Approbation réservée aux humains (P5), avec mise à jour des tests qui l'exigent | 0,5 j |
| Heartbeat et alarme DO idempotente (P6, P7) | 1,5–2 j |
| Idempotence à la création (P8) | 0,5–1 j |
| Journal d'audit persistant | 1,5–2 j |
| Distributeur v2 : identité `dispatch`, route `/brief`, baux, skill v2, tests D1 à D18 | 2–3 j |
| **Total** | **7,5–11 j** |

Si `d52f17b` corrige vraiment une partie des défauts P2, P3, P4 et P9, on peut retirer 1 à 2 jours, une fois les sondes rejouées. Le total HQ 2.0 (27 à 41 jours) ne change pas : ce lot remplace en grande partie la phase 2 et commence la phase 7.
