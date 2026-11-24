# Chevauchements de responsabilités — Klirline Office

**Établi le :** 23 novembre 2026, 21:17 America/Toronto (UTC-5)  
**Mis à jour le :** 23 novembre 2026, 21:35 America/Toronto (UTC-5) — décisions CEO t100u  
**Auteur :** COO (Office Klirline · Ops Klirline)  
**Portée :** constat local, lecture seule. Aucun agent, routine, skill, profil ou secret n'a été modifié. Les items « résolus » le sont **sur le plan de l'organisation écrite** ; l'implémentation code ou la mise en pause de routines restent à faire par la voie autorisée.

## Méthode

Un chevauchement est retenu seulement s'il est visible dans au moins une source : profil d'agent, `src/hq/roster.js`, organigramme de démonstration `src/org`, usage/routines, ou transcript. Rien n'est inventé.

Statuts après t100u : **résolu** (décision écrite), **résolu partiellement**, **ouvert**.

## Top chevauchements (par gravité opérationnelle)

### 1. Un seul bot pour deux cartes HQ : Office et Ops — OUVERT

- **Faits :** le teammate s'appelle « Office Klirline · Ops Klirline » (`8d5f5562-675c-4f66-8057-c66d817f8cbc`). `HQ_ROSTER` expose pourtant deux cartes (`office-klirline`, `ops-klirline`).
- **t100u :** non tranché.
- **Recommandation maintenue :** ce bot reste le COO (carte Ops + coordination). La carte « Office / secrétariat » devrait, à terme, revenir au Chief of Staff ou à l'assistant administratif (All Question, triage seulement).
- **Décision CEO restante :** non bloquante pour le démarrage des 8 postes.

### 2. KlirProspect : produit et commercial sur le même agent — RÉSOLU (t100u)

- **Faits :** le même agent porte le produit et une partie du commercial. Usage : [indicateur interne non publié], [usage non publié].
- **Décision t100u :** KlirProspect assure les fonctions de responsable produit **et** de prospection, **avec des permissions distinctes pour chaque fonction**.
- **Application écrite :** deux profils documentés dans `registre-36-postes.md` / `.json` : `klirprospect-produit` et `klirprospect-prospection`. Le poste agent commercial est pourvu par cet agent. Aucun envoi n'est autorisé par ces profils tant que le CEO n'autorise pas un envoi nommé.
- **Reste technique (Codex / cloisonnement, pas ici) :** faire respecter ces profils côté accès, pas seulement sur le papier.

### 3. All Question : triage déclaré, outreach commercial réel — RÉSOLU sur le mandat (t100u), PAS encore sur les routines

- **Faits :** le profil dit triage ; le transcript du **21 nov. 2026** documente des relances LinkedIn KlirBuild. Voir `all-question-envois-21nov-lcap.md`.
- **Décision t100u :** All Question est limité au **tri, à la classification et à l'orientation**. Plus d'outreach.
- **Application écrite :** le poste d'assistant administratif lui est rattaché pour ce périmètre seulement.
- **Écart opérationnel urgent :** ce chantier n'a **pas** modifié les routines « Outreach LinkedIn Klirbuild » ni « Rappels LinkedIn Klirbuild samedi », car toute modification de routine est interdite ici. Ces routines peuvent encore partir (la tournée en semaine était vers 9 h America/Toronto ; la relance du samedi vers 10 h). La pause effective exige une action autorisée, distincte.
- **Décision / action restante :** urgente — voir le rapport de clôture.

### 4. Portefeuille « autres produits » et Kontak hors roster — RÉSOLU PARTIELLEMENT (t100u)

- **Faits :** un seul poste cible pour plusieurs exécutants. Kontak était actif et absent de `HQ_ROSTER`.
- **Décision t100u :** intégrer Kontak dans le roster, **initialement en lecture et préparation**.
- **Application écrite :** décision enregistrée dans le registre RH. La carte n'est **pas** ajoutée à `src/hq/roster.js` ici (Codex, PR brouillon).
- **Reste ouvert :** le coordinateur du portefeuille reste vacant ; KlirMarket et Klirline AI restent exécutants de leur produit. Élargir le mandat Kontak au-delà de la lecture/préparation exigerait une nouvelle décision.

### 5. KlirBuild et KlirMarket sur un même dépôt / store — OUVERT

- **Faits :** handoff déjà observé (PR Klirbuild #81 par KlirMarket, non fusionnée ; PR #83 par KlirBuild, fusionnée).
- **t100u :** non tranché.
- **Recommandation maintenue :** KlirBuild = klirline.app / construction ; KlirMarket = store / marketplace ; tout correctif dans le dépôt de l'autre passe par un handoff écrit, sans fusion par l'aidant.
- **Décision CEO restante :** non bloquante (les profils sont déjà cohérents).

### 6. Cellule média vs marketing des 36 postes — RÉSOLU PARTIELLEMENT (t100u)

- **Faits :** Black wall news actif ; BWN Rédaction et YouTube dormants ; Social actif.
- **Décision t100u :** Klirline Social est **responsable des réseaux sociaux, sans publication autonome**.
- **Reste ouvert :** rattachement formel de Black wall news, BWN Rédaction et YouTube (cellule média hors 36, ou portefeuille). Non bloquant pour le lancement des 8 postes. Social ne reprend pas la ligne éditoriale BWN ni YouTube par défaut.

### 7. Développement : agents produit vs département Technologie — OUVERT

- **Faits :** les 7 postes techno n'ont pas de teammate Grok, sauf la désignation Codex. Les agents produit développent déjà leurs dépôts.
- **t100u :** Codex poursuit l'implémentation technique ; le COO certifie. Pas de pourvoi des sièges dev/DevOps.
- **Recommandation maintenue :** CTO pour HQ 2.0 et les standards ; chaque responsable produit reste owner de son dépôt.
- **Décision CEO restante :** non bloquante.

### 8. Certification et sécurité portées par le COO par défaut — OUVERT (intérim accepté pour le démarrage)

- **Faits :** responsable sécurité, auditeur, ingénieur QA et conformité toujours vacants. Le COO ne s'auto-audite pas et n'approuve pas à la place du CEO.
- **t100u :** démarrer avec les 8 postes prioritaires, dont sécurité et QA (toujours vacants). Lots 0 et 1 de cloisonnement à **préparer**, rotations effectives soumises au CEO.
- **Intérim :** le COO constate et prépare ; le CEO approuve. Sandbox n'est pas le QA.

### 9. Trading vs bureau, et interférence de comptes — DÉJÀ TRANCHÉ (ordre antérieur, inchangé)

- IC MARKET et CMCMarkets restent hors bureau commercial et hors missions pilotes A/B/C.
- Le mismatch MT5 signalé le 23 nov. 2026 à 14:51 America/Toronto reste un point d'exploitation trading, hors registre des 36.

### 10. Deux organigrammes dans le dépôt, plus la cible 36 — RÉSOLU sur la cible (t100u)

- **Décision t100u :** le registre de 36 postes est l'**architecture cible**.
- **Application :** `src/org` (34 postes de démonstration, `/api/command`) reste isolé. L'implémentation de `src/hq/roles.js` est un travail Codex, en PR brouillon, sans fusion ici.
- **Reste :** le fichier `roles.js` n'existe toujours pas dans le clone.

## Autres chevauchements secondaires

| Sujet | Statut | Constat / décision |
| --- | --- | --- |
| Couvertures Office (Centia, Klirline.ca, KlirSecure, KlirPay) | Ouvert, non bloquant | Couverture COO temporaire ; KlirPay = poste vacant |
| Social et NORIA (flyers) | Ouvert, frontière déjà claire | NORIA = produit ; Social = diffusion, désormais sans publication autonome |
| YouTube vs Social | Confirmé par le rattachement Social | YouTube Channel seulement, même dormant |
| Routines outreach All Question encore actives | **Écart** après t100u | Mandat retiré ; routines non pausées dans ce chantier |

## Ce qui n'est pas un chevauchement

- Un handoff ponctuel avec brief : procédure prévue.
- La démo `src/org` : pas des titulaires réels.
- Codex construit, COO certifie, CEO décide — séparation demandée, à condition que personne n'approuve à la place du CEO.
