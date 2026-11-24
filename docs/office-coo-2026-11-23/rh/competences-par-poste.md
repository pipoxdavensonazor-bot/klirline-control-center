# Compétences par poste — réutiliser ou proposer (rien n'est créé)

**Établi le :** 23 novembre 2026, 21:17 America/Toronto (UTC-5)  
**Auteur :** COO  
**Portée :** inventaire et propositions. **Aucune skill, routine, profil ou connecteur n'a été créé ou modifié.**

## Compétences existantes, lues et réutilisables

### Skills d'orchestration Klirline (vérifiées comme textes de procédure)

Voir aussi `procedures-inter-departements.md`.

| Skill | Postes principalement concernés | Usage prévu | Limite |
| --- | --- | --- | --- |
| `handoff-agent-klirline` | Tous, surtout COO, CoS, chef de projet, assistant administratif | Transfert d'owner avec brief | La « carte bureau » citée est celle des 15 agents, pas encore des 36 postes |
| `ex-cuter-un-objectif-klirline` | Tous | Normaliser objectif, owner, critère, échéance | Références O1–O5 à réconcilier plus tard, sans éditer la skill maintenant |
| `pont-hq-centre-agents` | COO, CoS, chef de projet | Poll, dispatch, write-back HQ | Roster live illisible depuis cette box le 23 nov. 2026 (403/1010). Aucun PATCH ici |
| `v-rifier-admin-produit-klirline` | Responsables produit, support, sécurité, COO | Diagnostic d'accès admin | Pas de test d'accès exécuté dans ce chantier |

### Procédures internes du dépôt (knowledge/procedures/)

Présentes dans le clone local, réutilisables comme sources, **non exécutées** ici :

| Fichier | Postes |
| --- | --- |
| `klirline-mission-handoff.md` | COO, CoS, chef de projet |
| `klirline-product-context.md` | Responsables produit, commercial, support |
| `klirprospect-demo-followup.md`, `klirprospect-list-quality.md`, `klirprospect-synthese.md`, `klirline-commercial-draft.md` | Agent commercial, prospecteur, directeur commercial, responsable KlirProspect |
| `klirline-support-triage.md` | Support |
| `klirpay-payment-reconciliation.md` | Responsable KlirPay, finance (lecture) |
| `klirsecure-evidence-report.md` | Sécurité, couverture Office sur KlirSecure |
| `klirbuild-project-report.md` | Responsable KlirBuild |
| `noria-learning-content.md` | Responsable NORIA |
| `bwn-editorial-verification.md` | Cellule média (hors 36, mais liée) |
| `klirline-meeting-notes.md` | CoS, assistant administratif |

`knowledge/skills-matrix.md` (5 nov. 2026) rappelle que les skills sous `.cursor/skills/` aident l'assistant de développement et **ne sont pas exécutables par le moteur du bureau**. Les skills épinglées dans le dépôt (Workers, Zero Trust, pre-ship-gate, orchestration, évaluation, mémoire, internal-comms) restent « procédures seulement » pour le bureau.

### Skills de profil déjà portées par les teammates (non réinventoriées une à une ici)

Les agents produit, Social et BWN ont des missions écrites dans leur `profile.json`. On les **réutilise telles quelles** : on ne les réécrit pas, on ne les fusionne pas. En particulier :

- KlirProspect, KlirBuild, NORIA, KlirMarket, Klirline AI, Kontak : compétence produit + dépôt.
- Klirline Social : calendrier et comptes officiels Klirline.
- Black wall news / BWN Rédaction : ligne et textes BWN.
- All Question : triage (à séparer de l'outreach réellement observé).
- Office · Ops : coordination et centre.
- IC MARKET / CMCMarkets : trading, hors 36 postes.

### Connecteurs

Seuls les connecteurs **observés sur le bot COO** dans cette session sont listés (voir fiche COO). Ce n'est pas un inventaire des autres agents, et ce n'est pas une autorisation d'écriture. **Proposition seulement :** un inventaire lecture seule des connecteurs par agent, plus tard, avec accord du CEO — sans brancher quoi que ce soit.

## Matrice : compétences à couvrir par poste

Légende : **R** = réutiliser une skill/procédure existante (adaptée) ; **P** = proposition à créer plus tard, non créée ici ; **V** = vacant, compétence nécessaire mais aucun titulaire pour l'exercer aujourd'hui.

| Poste | Réutiliser (R) | Propositions seulement (P) | État |
| --- | --- | --- | --- |
| COO | 4 skills Klirline ; procédures mission-handoff ; lecture GitHub/CI | Skill « certification PR Codex / GO-NO-GO » (canevas de preuves) | Pourvu, actif |
| Chief of Staff | Exécuter un objectif ; handoff ; rapport (exemples knowledge) | Skill « rapport stratégique hebdomadaire CEO » (mission C) | V |
| Analyste stratégique | Recherche sourcée générale ; pas de skill Klirline dédiée | Skill « note stratégique sourcée (faits vs interprétation) » | V |
| Chef de projet | Handoff ; mission-handoff.md | Skill « plan de chantier HQ (dépendances, preuves, baux) » | V |
| CTO | docs/hq2, audit existant, skills Cursor du dépôt (non exécutables par le bureau) | Rien à créer ici ; livrables = branches et PR brouillon | Désigné, dispo non prouvée |
| Architecte / devs / DevOps / ing. IA / ing. données | Skills dépôt (.cursor/skills, Workers, pre-ship) pour le développement | Playbooks d'environnement autorisé ; interdiction prod déjà écrite | V |
| Directeur commercial | klirline-commercial-draft.md, procédures KlirProspect | Skill « cadrage mission A (file, LCAP, démos seulement) » | V |
| Prospecteur | klirprospect-list-quality.md | Skill « liste qualifiée sans envoi » (garde LCAP/CASL) | V |
| Agent commercial KlirProspect | klirprospect-demo-followup.md, synthese, commercial-draft | Skill « dossier de démo (jamais « booké » sans preuve) » | V (proposition double casquette) |
| Responsable CRM | list-quality.md | Skill « hygiène CRM / pas d'export PII » | V |
| Customer Success | Accueil décrit dans src/org (démo) à adapter, pas à copier tel quel | Skill « plan d'accueil post-vente » (quand un client réel existera) | V |
| Directeur marketing | Contexte produit ; pas de skill campagne Klir IA | Skill « préparation campagne Klir IA (mission B), publication seulement après CEO » | V |
| Rédacteur | bwn-editorial-verification.md **pour BWN seulement** | Skill « brouillon campagne produit (sources + à vérifier) » | V |
| Designer | Aucune skill Klirline dédiée lue | Proposition : charte courte + checklist formats, pas une skill obligatoire | V |
| Responsable réseaux sociaux | Profil Social ; skill handoff vers produit | Skill « brouillon social + vérification de session » (Facebook déjà un bloqueur rapporté) | Pourvu (à confirmer), actif |
| Analyste SEO | Aucune skill SEO interne lue | Proposition de procédure d'audit sourcé (URL, date), sans outil payant | V |
| CFO / analyste / contrôleur | Usage déjà observable par le COO ; pas de skill finance dédiée lue | Skill « plafond 0 $ et alerte de quota » (mission continuité) | V |
| Responsable KlirProspect / NORIA / KlirBuild | Procédures produit citées plus haut ; skill admin produit | Éventuels adaptateurs (travail Codex, pas une skill Grok à créer ici) | Pourvus, actifs |
| Responsable KlirPay | klirpay-payment-reconciliation.md | Adaptateur lecture seule (Codex, plus tard, sans activation prod) | V |
| Portefeuille autres | product-context.md | Procédure « carte d'owners du portefeuille » | V |
| Responsable sécurité | docs/hq2, cloisonnement déjà écrit ailleurs, rejectImpersonation dans l'audit | Skill « revue sécurité PR + isolation des secrets (sans les afficher) » | V |
| Auditeur | Audit HQ déjà réalisé (ne pas le recommencer) ; skill évaluation du dépôt (non exécutable bureau) | Skill « audit indépendant (auteur ≠ auditeur) » | V |
| Ingénieur QA | Harnais / tests déjà présents dans docs/hq2/probes (à relire quand on certifiera, pas ici) | Skill « rejeu certification (permissions, récupération, non-régression), environnements autorisés » | V |
| Responsable conformité | Interdits LCAP/CASL déjà dans les règles CEO | Skill « check-list pré-envoi LCAP/CASL » | V |
| Responsable / agent support | klirline-support-triage.md ; skill admin produit | — | V |
| Assistant administratif | Handoff ; All Question (triage) si le CEO le cadre | Pas de nouvelle skill tant que le périmètre outreach n'est pas tranché | V |

## Ce qu'il ne faut pas créer

- Pas de nouvelles skills, routines ou agents pour « remplir » les 30 postes vacants.
- Pas de skill qui permettrait à une machine d'approuver une action A3.
- Pas de copie des skills commerciales externes examinées mais non installées (`revops`, `sales-automator`, etc., déjà écartées dans `knowledge/skills-matrix.md`).
- Pas d'activation du registre `/api/hq/skills` (déjà documenté comme consultatif et `enabled: false` côté Worker).

## Ordre de proposition, si le CEO autorise plus tard des créations

1. Canevas de certification PR / GO-NO-GO (COO) — documentation, pas une permission nouvelle.
2. Check-list pré-envoi LCAP/CASL (conformité) — avant toute reprise d'outreach.
3. Dossier de démo KlirProspect (jamais « booké » sans preuve).
4. Préparation campagne Klir IA (brouillons seulement).
5. Rapport stratégique hebdomadaire (mission C), une fois le CoS pourvu ou l'intérim écrit.
6. Alerte de quota / missions bloquées (continuité).

Jusque-là, on réutilise les quatre skills Klirline et les procédures `knowledge/procedures/`.
