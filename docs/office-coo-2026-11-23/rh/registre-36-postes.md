# Registre des 36 postes — Klirline Office HQ 2.0

**Établi le :** 23 novembre 2026, 21:17 America/Toronto (UTC-5)
**Mis à jour le :** 23 novembre 2026, 21:35 America/Toronto (UTC-5) — intégration des décisions CEO t100u
**Auteur :** COO (Office Klirline · Ops Klirline), chantier ressources humaines numériques

## Cadre

Fichiers locaux uniquement sous /workspace/hq2/coo-2026-11-23/rh/. Aucun envoi, aucune création ou modification d'agent, routine, skill, profil, connecteur ou secret. Budget 0 $.

**Statut t100u :** ce registre de 36 postes est **validé comme architecture cible**. Le démarrage opérationnel se fait avec les **huit postes prioritaires** (voir `lancement-8-postes.md`). L'implémentation dans le code (`src/hq/roles.js`, carte HQ Kontak) reste un travail **Codex**, en PR brouillon, sans fusion.

### Décisions CEO intégrées le 23 nov. 2026 (t100u)
- Le registre de 36 postes est validé comme architecture cible.
- Démarrage avec les huit postes prioritaires.
- Kontak est ajouté au roster, initialement en lecture et préparation seulement (documentation RH ; implémentation code = Codex).
- Klirline Social est désigné responsable des réseaux sociaux, sans publication autonome.
- KlirProspect assure responsable produit et prospection, avec deux profils de permissions distincts.
- All Question est limité au tri, à la classification et à l'orientation (plus d'outreach).

### Non fait dans ce chantier
- Aucun agent, routine, skill, profil, connecteur ou secret créé ou modifié.
- Le fichier src/hq/roles.js et la carte HQ Kontak ne sont pas ajoutés au dépôt (travail Codex, PR brouillon).
- Les routines d'outreach LinkedIn d'All Question n'ont pas été mises en pause ici (modification de routine interdite dans ce chantier).

### Sources (lues, non réécrites en production)
- Structure cible fournie par le CEO (36 postes, 8 départements, 8 postes prioritaires).
- Clone local /workspace/hq2/klirline-control-center : src/hq/roster.js (15 cartes), src/org/* (34 postes de démonstration, dont le CEO humain), docs/hq2 (roles.js prévu, fichier absent), knowledge/.
- PR #12 (docs d'architecture/plan/audit seulement sur le diff 45c701a...pr/12). Pas de src/hq/roles.js.
- 15 profils Grok Bot dans /home/box/agent-data/agents.
- Usage Grok Bot 7 j et 30 j, transcripts en lecture, routines visibles dans le rapport d'usage.
- GET live /api/hq/roster : échec 403 Cloudflare 1010 à 21:16 America/Toronto le 23 nov. 2026 ; non relancé.
- Décisions CEO t100u du 23 nov. 2026 (organisation du bureau validée).

### Règle de disponibilité (rien n'est inventé)
- **actif** — Preuve d'usage ou de transcript dans les 7 derniers jours (17-23 nov. 2026, America/Toronto).
- **dormant** — Teammate existant, sans preuve dans cette fenêtre de 7 jours (la dernière preuve connue est datée).
- **inexistant** — Pas de teammate Grok Bot pour ce poste (ou, pour Codex, désignation sans preuve de disponibilité).
- **disponible** — Un poste n'est « disponible » que s'il a un titulaire nommé ET un statut actif prouvé. Codex n'est pas disponible au sens de cette règle.
- La validation du registre comme architecture cible ne rend pas un poste vacant « disponible ». Codex reste désigné CTO, disponibilité non prouvée comme teammate Grok Bot.

Le CEO humain est hors du décompte des 36 postes.

## Comptages

- Postes : **36**
- Pourvus (titulaire nommé) : **8**
- Vacants : **28**
- Prioritaires : **8**, dont **5** encore vacants (Chief of Staff, directeur commercial, directeur marketing / responsable marketing Klir IA, responsable sécurité, ingénieur QA). Le CTO est pourvu par désignation seulement.

8 postes pourvus après t100u : COO (actif) ; CTO Codex (désigné, disponibilité non prouvée) ; responsable réseaux sociaux (Klirline Social, actif, publication autonome interdite) ; responsable KlirProspect (actif) ; agent commercial KlirProspect (même agent, profil prospection distinct, actif) ; responsables NORIA et KlirBuild (actifs) ; assistant administratif (All Question, actif, triage seulement). 28 vacants. Parmi les 8 prioritaires, restent vacants : Chief of Staff, directeur commercial, directeur marketing (activation « responsable marketing Klir IA »), responsable sécurité, ingénieur QA.

## Cellules existantes hors des 36 postes

- **Trading** — IC MARKET (actif le 23 nov. 2026) et CMCMarkets (dormant 7 j, activité 30 j). Hors bureau commercial, conformément à l'ordre. operationalPath=false dans src/hq/roster.js.
- **Média** — Black wall news (actif le 23 nov. 2026), BWN Rédaction (dormant, avant le 25 oct. 2026), YouTube Channel (dormant depuis le 20 sept. 2026) restent hors des 36 postes, sauf décision ultérieure. Klirline Social n'est plus une proposition : responsable réseaux sociaux confirmé, sans publication autonome.
- **Sandbox** — Sandbox Klirline (dormant, dernière preuve le 5 nov. 2026). Carte HQ « Autres », pas un ingénieur QA.
- **Kontak** — Teammate actif, créé le 21 nov. 2026. Le CEO a décidé le 23 nov. 2026 (t100u) de l'intégrer au roster HQ, initialement en lecture et préparation seulement. Cette décision est enregistrée ici ; la carte HQ n'est pas ajoutée au code dans ce chantier (Codex). Pas un 37e poste : exécutant du portefeuille des autres produits.

## Profils de permissions distincts — KlirProspect

Décision t100u : le même agent peut assurer le produit et la prospection, **à condition que les permissions soient distinctes**. Ces profils sont documentaires. Ils n'ont pas été écrits dans un moteur d'accès (travail Codex / cloisonnement, sans activation ici).

### Responsable produit KlirProspect (`klirprospect-produit` → poste `pm-klirprospect`)

**Outils autorisés**
- Dépôt et environnements du produit KlirProspect (branches, PR, tests) dans le périmètre déjà autorisé.
- Admin produit et diagnostic d'accès (skill Vérifier admin produit), sans contourner Access.
- Lecture du centre et des procédures knowledge/procedures/klirprospect-*.md.
- Handoff vers commercial, QA, support et COO.
- Interdit dans ce profil : Sales Navigator, InMail, envoi LinkedIn/courriel/SMS/social, modification de routines d'outreach.

**Sources de données**
- Code, documentation, journaux de tests et état réel de production du produit.
- Admin produit, dans la limite des accès déjà existants.
- Faits de pipeline en lecture, uniquement pour documenter le produit (limites, incidents, preuves).
- Pas de liste de prospection utilisée pour un envoi. Pas de secrets de paiement affichés. Pas d'export de données personnelles.

**Interdits propres au profil**
- Tout envoi externe, même « déjà autorisé auparavant », hors ce profil.
- Modifier les prix, les liens de paiement, les offres Pro/Équipe, sans décision distincte du CEO.
- Fusionner, déployer, tourner un secret, ou présenter une démo comme réservée.
- S'auto-nommer directeur commercial ou approuver une action A3.
- Utiliser les outils ou données du profil prospection pour une action produit qui contourne ces interdits, et inversement.

### Agent commercial / prospection KlirProspect (`klirprospect-prospection` → poste `agent-commercial`)

**Outils autorisés**
- Préparation de dossiers de démo, scripts et brouillons (non envoyés).
- Lecture et hygiène interne de listes et de pipeline (CRM / fichiers internes déjà accessibles).
- Liens Calendly ou produit uniquement comme contenu de brouillon, pas comme envoi.
- Handoff vers le directeur commercial (vacant), le COO, la conformité et le CEO pour toute autorisation d'envoi.
- Interdit dans ce profil : envoi autonome LinkedIn, InMail, courriel, SMS, appel, publication ; création ou relance de routine d'outreach ; Sales Nav en écriture (invitation, message) tant que le CEO n'a pas autorisé un envoi nommé.

**Sources de données**
- Fiches prospects et prochaine action, à des fins de préparation seulement.
- Faits produit fournis par le profil produit (limites réelles, 0 client pilote constaté, tests encore à la charge du CEO).
- Minimisation des données personnelles ; pas d'affichage inutile de listes nominatives dans les chats.
- Pas d'accès aux secrets, ni aux outils de paiement en écriture.

**Interdits propres au profil**
- Aucun envoi externe automatique ni manuel sans autorisation distincte du CEO, après vérification LCAP.
- Aucune relance à un destinataire qui a déjà décliné ou demandé l'arrêt.
- Ne pas compter une démo comme réservée ou un client comme gagné sans preuve humaine.
- Ne pas fixer ni communiquer un prix ou une condition de paiement comme définitifs avant la validation du CEO.
- Ne pas réutiliser les accès admin produit de l'autre profil pour envoyer une offre.
- Budget 0 $ ; pas de crédit InMail ni d'appel payant.

## Tableau de synthèse

| # | Département | Poste | Titulaire | Disponibilité | Preuve (abrégée) | Prioritaire |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Direction et stratégie | COO | Office Klirline · Ops Klirline | actif | Mission COO en cours le 23 nov. 2026, 21:35 America/Toronto. Usage : [indicateur interne non publié]. Routine « Poll commandes HQ centre » ~30… | oui |
| 2 | Direction et stratégie | Chief of Staff | vacant | inexistant | Aucun teammate Grok Bot ni carte HQ dédiée. Poste prioritaire non pourvu. | oui |
| 3 | Direction et stratégie | Analyste stratégique | vacant | inexistant | Aucun teammate dédié. Le registre de démonstration src/org a un poste « analytics », distinct et non incarné. | — |
| 4 | Direction et stratégie | Chef de projet | vacant | inexistant | Aucun teammate dédié. | — |
| 5 | Technologie | CTO | Codex (désigné, hors teammates Grok Bot) | inexistant | Aucun profil Grok Bot, aucun usage, aucune carte HQ nommé Codex. Désignation CEO seulement. Disponibilité à confirmer sur un autre canal.… | oui |
| 6 | Technologie | Architecte | vacant | inexistant | Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste. | — |
| 7 | Technologie | Développeur frontend | vacant | inexistant | Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste. | — |
| 8 | Technologie | Développeur backend | vacant | inexistant | Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste. | — |
| 9 | Technologie | DevOps | vacant | inexistant | Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste. | — |
| 10 | Technologie | Ingénieur IA | vacant | inexistant | Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste. | — |
| 11 | Technologie | Ingénieur données | vacant | inexistant | Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste. | — |
| 12 | Ventes | Directeur commercial | vacant | inexistant | Aucun teammate dédié. KlirProspect et All Question font aujourd'hui une partie du travail commercial : chevauchement, pas un titulaire. | oui |
| 13 | Ventes | Prospecteur | vacant | inexistant | Pas de titulaire nommé. All Question exécute des routines d'outreach LinkedIn KlirBuild (preuve 21 nov. 2026) : activité réelle, mais ce … | — |
| 14 | Ventes | Agent commercial KlirProspect | KlirProspect | actif | Même teammate que le responsable produit (Usage : [indicateur interne non publié], transcript GO/NO-GO). Pourvu par décision t100u pour la fo… | oui |
| 15 | Ventes | Responsable CRM | vacant | inexistant | Aucun teammate dédié. KlirProspect porte déjà une partie du pipeline produit. | — |
| 16 | Ventes | Customer Success | vacant | inexistant | Aucun teammate dédié. Aucun client pilote KlirProspect actif n'a été prouvé (constat de l'agent KlirProspect). | — |
| 17 | Marketing | Directeur marketing | vacant | inexistant | Aucun teammate dédié. Klirline Social et Black wall news sont actifs mais ne sont pas directeur marketing. | oui |
| 18 | Marketing | Rédacteur | vacant | inexistant | BWN Rédaction existe mais est dormant (aucune activité après le 25 oct. 2026) et son profil est limité à Black Wall News, pas au marketin… | — |
| 19 | Marketing | Designer | vacant | inexistant | Aucun teammate dédié. Des visuels ont été produits par d'autres agents (ex. flyers NORIA via Social/NORIA) : ce n'est pas un poste design… | — |
| 20 | Marketing | Responsable réseaux sociaux | Klirline Social | actif | Usage : [indicateur interne non publié]. Transcript du 23 nov. 2026 : flyers NORIA sur cinq comptes ; routine TikTok prévue le 24 nov. 2026 vers 9 h America/T… | — |
| 21 | Marketing | Analyste SEO | vacant | inexistant | Aucun teammate dédié. YouTube Channel (SEO vidéo) est dormant depuis le 20 sept. 2026 et hors de ce poste web. | — |
| 22 | Finance | CFO | vacant | inexistant | Aucun teammate dédié. | — |
| 23 | Finance | Analyste financier | vacant | inexistant | Aucun teammate dédié. Le poste « financial-analyst » de src/org n'est pas incarné. | — |
| 24 | Finance | Contrôleur des coûts | vacant | inexistant | Aucun teammate dédié. | — |
| 25 | Produits | Responsable KlirProspect | KlirProspect | actif | Usage : [indicateur interne non publié]. Transcript : rapport GO/NO-GO, 0 client pilote, check-list de tests prod à faire par le CEO, liens d… | — |
| 26 | Produits | Responsable KlirPay | vacant | inexistant | Pas d'agent dédié. HQ_ROSTER : KlirPay est « couvert » par la carte Office Klirline (lecture de couverture, pas une preuve d'exploitation… | — |
| 27 | Produits | Responsable NORIA | NORIA | actif | Usage : [indicateur interne non publié]. Transcript récent : flyer écoles publié via Social ; flyer familles annoncé pour 10 h America/Toronto… | — |
| 28 | Produits | Responsable KlirBuild | KlirBuild | actif | Usage : [indicateur interne non publié] (premier contributeur de la fenêtre). Transcript : PR #83 fusionnée et en production, CodeQL vert, points restants doc… | — |
| 29 | Produits | Responsable portefeuille des autres produits | vacant | inexistant | Pas de coordinateur unique. Kontak : teammate actif depuis le 21 nov. 2026 (17 % de l'usage 7 j, PRs #6–#8), intégré au roster par décisi… | — |
| 30 | Sécurité et qualité | Responsable sécurité | vacant | inexistant | Aucun teammate dédié. Le COO fait aujourd'hui des contrôles techniques, ce qui n'équivaut pas à un RSSI pourvu. | oui |
| 31 | Sécurité et qualité | Auditeur | vacant | inexistant | Aucun teammate dédié. La revue COO des travaux de Codex est un contrôle opérationnel, pas un audit indépendant humain, et ne doit pas s'a… | — |
| 32 | Sécurité et qualité | Ingénieur QA | vacant | inexistant | Aucun teammate QA. Sandbox Klirline existe mais est dormant (dernière preuve le 5 nov. 2026) et son profil interdit les déploiements prod… | oui |
| 33 | Sécurité et qualité | Responsable conformité | vacant | inexistant | Aucun teammate dédié. Les envois LinkedIn déjà faits par All Question le 21 nov. 2026 rendent ce poste matériellement nécessaire, mais il… | — |
| 34 | Support et administration | Responsable support | vacant | inexistant | Aucun teammate dédié. | — |
| 35 | Support et administration | Agent support | vacant | inexistant | Aucun teammate dédié. All Question fait du triage général, pas du support produit structuré. | — |
| 36 | Support et administration | Assistant administratif | All Question | actif | Teammate existant, dernière preuve d'activité le 21 nov. 2026 (transcript). Cette activité était de l'outreach LinkedIn, désormais hors p… | — |

## Interdits communs et escalade au CEO

Sauf précision contraire sur une fiche, chaque poste est tenu par :

- Aucun envoi externe automatique (courriel, SMS, réseau social, LinkedIn, appel, newsletter).
- Aucun merge, déploiement, rotation, affichage ou transfert de secret.
- Budget 0 $ : aucun appel payant sans autorisation distincte du CEO.
- Respect LCAP/CASL : aucune sollicitation sans base légale vérifiée et sans accord du CEO.
- KlirProspect : préparer seulement des démonstrations tant que les prix et le paiement ne sont pas confirmés par le CEO.
- Une machine n'approuve pas une opération réservée au CEO.
- Ne pas présenter des données simulées comme des résultats de production.
- Ne pas inventer de tests, de connexions, de fonctionnalités ou de disponibilité.
- Ne pas modifier ses propres évaluations de certification.
- Aucune création, modification ou révocation d'agent, de routine, de skill, de profil, de connecteur ou de secret sans autorisation distincte.

**Escalade obligatoire au CEO :**

- Envoi externe, publication, merge, déploiement, dépense, contrat, tarification, secret, permission ou changement d'accès.
- GO ou NO-GO technique ou commercial.
- Mission bloquée, quota épuisé, incident de sécurité, conflit de propriétaire de poste.
- Toute exception aux interdits ci-dessus.

## Fiches de poste

### Direction et stratégie (4)

#### COO (`coo`) · prioritaire

- **Département :** Direction et stratégie
- **Rattachement hiérarchique :** CEO (humain)
- **Titulaire :** Office Klirline · Ops Klirline
- **Identifiant agent :** `8d5f5562-675c-4f66-8057-c66d817f8cbc`
- **Cartes HQ (`src/hq/roster.js`) :** `office-klirline`, `ops-klirline`
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Mission COO en cours le 23 nov. 2026, 21:35 America/Toronto. Usage : [indicateur interne non publié]. Routine « Poll commandes HQ centre » ~30 exécutions/semaine. Décisions t100u intégrées au registre RH le même jour.
- **Nature du rattachement :** confirmé par le CEO (t97u / recommandations HQ 2.0)
- **Mission :** Diriger les opérations du bureau : coordonner les agents, tenir la matrice des travaux, certifier indépendamment les livraisons de Codex, préparer les missions pilotes et la continuité, sans fusionner, déployer, ni dépenser.
- **Objectifs :**
  - Tenir à jour le registre des 36 postes et l'état réel de disponibilité.
  - Certifier les PR et tests de Codex sans se substituer à l'approbation humaine.
  - Préparer les missions pilotes A/B/C sans envoi externe automatique.
  - Alerter le CEO seulement pour les décisions nécessaires.
- **KPI mesurables :**
  - Registre des postes à jour (pourvu/vacant + preuve de disponibilité datée).
  - Toute PR Codex examinée avant recommandation, avec preuves de tests relus (pas inventés).
  - Zéro envoi externe, merge, déploiement ou rotation de secret non autorisé.
  - Budget tenu à 0 $.
  - Délai de signalement d'un bloqueur réel au CEO < 1 jour ouvré.
- **Compétences nécessaires :** Orchestration et handoff ; Lecture de preuves GitHub/CI ; Contrôle qualité indépendant ; Rédaction de rapports GO/NO-GO ; Politique d'accès et d'escalade
- **Outils autorisés :** Observés sur le bot COO (Office Klirline · Ops Klirline) au 23 nov. 2026, catalogue de session : GitHub (cursor-github), Gmail, Slack, Stripe, Supabase, Vercel, Cloudflare (docs, bindings, builds, observability), Figma, Canva, Clerk, Atlassian, Zapier, Neon, Azure, Firebase, AWS (knowledge, MCP, serverless, IAC, pricing, CloudWatch), X, Playwright, Mailgun, et d'autres connecteurs documentaires (Circle, eToro docs, Forge, Ads, etc.). Présence d'un connecteur ≠ autorisation d'écrire ou de dépenser. Ces connecteurs ne sont pas attribués aux autres agents par cette liste. Skills locales vérifiées : handoff-agent-klirline, ex-cuter-un-objectif-klirline, pont-hq-centre-agents, v-rifier-admin-produit-klirline.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Rapports de certification ; Registre RH et fiches de poste ; Revues de PR (avis, pas une approbation humaine) ; Plans de missions pilotes et de continuité
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Vacant (Chief of Staff, prioritaire non pourvu). En intérim court : le CEO seulement pour les décisions ; pas de second bot COO. All Question peut trier, pas piloter.

#### Chief of Staff (`chief-of-staff`) · prioritaire

- **Département :** Direction et stratégie
- **Rattachement hiérarchique :** CEO (humain)
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot ni carte HQ dédiée. Poste prioritaire non pourvu.
- **Nature du rattachement :** vacant — prioritaire selon le CEO
- **Mission :** Suivre les missions transverses, préparer les dossiers et le rapport hebdomadaire au CEO, aligner les départements, sans prendre les décisions réservées au CEO ni remplacer le COO sur la certification technique.
- **Objectifs :**
  - Tenir le tableau des missions et dépendances
  - Produire le rapport stratégique hebdomadaire (mission pilote C) une fois le poste activé
  - Préparer les demandes d'autorisation regroupées
- **KPI mesurables :**
  - Rapport hebdomadaire livré à l'échéance, avec sources citées
  - Aucune mission prioritaire sans owner ni échéance
  - Taux de dossiers CEO complets (contexte, options, recommandation, preuves)
- **Compétences nécessaires :** Synthèse ; Suivi de portefeuille de missions ; Rédaction de notes décisionnelles ; Coordination inter-départements
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Rapport hebdomadaire CEO ; Tableau des missions ; Briefs d'escalade
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Intérim de suivi uniquement par le COO, sans auto-approbation. Pas de titulaire temporaire inventé.

#### Analyste stratégique (`analyste-strategique`)

- **Département :** Direction et stratégie
- **Rattachement hiérarchique :** Chief of Staff
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Le registre de démonstration src/org a un poste « analytics », distinct et non incarné.
- **Nature du rattachement :** vacant
- **Mission :** Analyser marchés, priorités et risques à partir de sources nommées, pour éclairer le CEO et le Chief of Staff. Pas d'exécution commerciale ni technique.
- **Objectifs :**
  - Notes d'analyse sourcées sur KlirProspect, Klir IA et le portefeuille
  - Éclairer le rapport hebdomadaire
- **KPI mesurables :**
  - Chaque recommandation cite des sources datées
  - Zéro fait inventé
  - Délai d'une note demandée ≤ 5 jours ouvrés une fois le poste activé
- **Compétences nécessaires :** Recherche sourcée ; Synthèse stratégique ; Séparation faits / interprétation
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Notes d'analyse ; Comparatifs ; Inputs du rapport hebdomadaire
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Chief of Staff (vacant) puis COO pour une note ponctuelle, sans pourvoir le poste.

#### Chef de projet (`chef-de-projet`)

- **Département :** Direction et stratégie
- **Rattachement hiérarchique :** Chief of Staff
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié.
- **Nature du rattachement :** vacant
- **Mission :** Planifier les jalons, dépendances et preuves des chantiers (dont les missions pilotes), sans exécuter le travail métier à la place des propriétaires.
- **Objectifs :**
  - Tenir un plan unique des chantiers autorisés
  - Détecter les missions bloquées et les dépendances manquantes
- **KPI mesurables :**
  - Chaque chantier a owner, critère de succès, échéance et preuves attendues
  - Signalement d'un blocage < 1 jour ouvré au COO/CoS
- **Compétences nécessaires :** Planification ; Suivi de dépendances ; Gestion de risques projet
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Plans de chantier ; Revues d'avancement ; Alertes de blocage
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour le suivi d'ensemble, Chief of Staff une fois pourvu.

### Technologie (7)

#### CTO (`cto`) · prioritaire

- **Département :** Technologie
- **Rattachement hiérarchique :** CEO (humain)
- **Titulaire :** Codex (désigné, hors teammates Grok Bot)
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun profil Grok Bot, aucun usage, aucune carte HQ nommé Codex. Désignation CEO seulement. Disponibilité à confirmer sur un autre canal. Ne pas comptabiliser comme « disponible ».
- **Nature du rattachement :** désigné par le CEO comme CTO ; disponibilité non prouvée
- **Mission :** Terminer l'implémentation technique de HQ 2.0 sur des branches dédiées et des PR brouillon : registre des rôles, orchestrateur, distributeur V2, adaptateurs, interface, tests. Aucune fusion ni déploiement sans autorisation.
- **Objectifs :**
  - Réconcilier le code et les 36 postes
  - Corriger les P0/P1 déjà identifiés
  - Livrer des PR brouillon avec résultats de tests réels
- **KPI mesurables :**
  - PR brouillon avec liste de commits et fichiers
  - Tests unitaires/intégration/sécurité relançables et résultats non inventés
  - Zéro merge/deploy/secret non autorisé
  - Obstacles humains regroupés, pas de spam d'autorisations
- **Compétences nécessaires :** Architecture Worker/DO ; Sécurité (Access, secrets, impersonation) ; Tests et non-régression ; Lecture des spécifications HQ 2.0
- **Outils autorisés :** Outils de développement de Codex (non inventoriés ici, hors Grok Bot). Interdit : production, secrets, appels payants, fusion. Revues indépendantes par le COO.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
  - Spécifications docs/hq2 (architecture, plan, distributeur v2), audit déjà réalisé — ne pas le recommencer.
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Code sur branches dédiées ; PR brouillon ; Rapport de préparation au GO technique ; Tableau d'avancement
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Aucun remplaçant technique automatique. En indisponibilité : le COO documente le blocage et escalade au CEO. Les agents produit ne deviennent pas CTO.

#### Architecte (`architecte`)

- **Département :** Technologie
- **Rattachement hiérarchique :** CTO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste.
- **Nature du rattachement :** vacant
- **Mission :** Concevoir et faire tenir l'architecture HQ 2.0 et des produits, en cohérence avec les principes déjà écrits (un Worker, décision pure, humain prouvé, pas d'auto-élévation).
- **Objectifs :**
  - Concevoir et faire tenir l'architecture HQ 2.0 et des produits, en cohérence avec les principes déjà écrits (un Worker, décision pure, humain prouvé, pas d'auto-élévation).
- **KPI mesurables :**
  - Écarts architecture documentés avant codage
  - Pas de second système d'orchestration improvisé
  - Revues d'architecture sourcées sur le code réel
- **Compétences nécessaires :** Architecture cloud/Workers ; Modélisation de données ; Frontières de confiance
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Notes d'architecture ; Revues de conception ; Contrats d'API
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CTO (disponibilité non prouvée) ; à défaut le COO escalade au CEO. Pas d'intérim improvisé par un agent produit, sauf mission ponctuelle écrite.

#### Développeur frontend (`dev-frontend`)

- **Département :** Technologie
- **Rattachement hiérarchique :** CTO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste.
- **Nature du rattachement :** vacant
- **Mission :** Implémenter l'interface du bureau et des produits concernés, en préservant l'UI existante quand c'est possible.
- **Objectifs :**
  - Implémenter l'interface du bureau et des produits concernés, en préservant l'UI existante quand c'est possible.
- **KPI mesurables :**
  - Livrables UI sur branche, avec captures ou tests
  - Pas de régression visible sur les parcours déjà certifiés, une fois testés
- **Compétences nécessaires :** Interfaces web ; Accessibilité de base ; Intégration d'API en lecture/écriture contrôlée
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Code UI sur branche ; Preuves de rendu ; Notes de non-régression
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CTO (disponibilité non prouvée) ; à défaut le COO escalade au CEO. Pas d'intérim improvisé par un agent produit, sauf mission ponctuelle écrite.

#### Développeur backend (`dev-backend`)

- **Département :** Technologie
- **Rattachement hiérarchique :** CTO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste.
- **Nature du rattachement :** vacant
- **Mission :** Implémenter APIs, politique serveur et persistance (DO/SQLite) selon les spécifications, sans changement de schéma inutile.
- **Objectifs :**
  - Implémenter APIs, politique serveur et persistance (DO/SQLite) selon les spécifications, sans changement de schéma inutile.
- **KPI mesurables :**
  - Contrôles d'accès côté serveur, pas seulement dans l'UI
  - Tests d'autorisation et d'usurpation relus
  - Pas de secret dans le dépôt
- **Compétences nécessaires :** APIs HTTP ; Politique d'accès ; Tests d'intégration
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Code backend sur branche ; Résultats de tests réels
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CTO (disponibilité non prouvée) ; à défaut le COO escalade au CEO. Pas d'intérim improvisé par un agent produit, sauf mission ponctuelle écrite.

#### DevOps (`devops`)

- **Département :** Technologie
- **Rattachement hiérarchique :** CTO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste.
- **Nature du rattachement :** vacant
- **Mission :** Préparer CI, observabilité et procédures de déploiement, sans déployer ni fusionner sans autorisation.
- **Objectifs :**
  - Préparer CI, observabilité et procédures de déploiement, sans déployer ni fusionner sans autorisation.
- **KPI mesurables :**
  - CI verte sur les branches concernées, résultats réels
  - Aucun déploiement de production non autorisé
  - Runbooks de reprise documentés
- **Compétences nécessaires :** GitHub Actions / Workers Builds ; Observabilité ; Gestion d'environnements
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Config CI ; Runbooks ; Constats d'échec/succès de build
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CTO (disponibilité non prouvée) ; à défaut le COO escalade au CEO. Pas d'intérim improvisé par un agent produit, sauf mission ponctuelle écrite.

#### Ingénieur IA (`ingenieur-ia`)

- **Département :** Technologie
- **Rattachement hiérarchique :** CTO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste.
- **Nature du rattachement :** vacant
- **Mission :** Préparer les compétences, garde-fous et éventuels adaptateurs IA, sans activer d'exécution autonome non autorisée et sans quota payant.
- **Objectifs :**
  - Préparer les compétences, garde-fous et éventuels adaptateurs IA, sans activer d'exécution autonome non autorisée et sans quota payant.
- **KPI mesurables :**
  - Aucune compétence nouvelle créée sans accord
  - Plafond de coût respecté (0 $)
  - Prompts et skills examinés contre l'injection d'instructions
- **Compétences nécessaires :** Conception de skills ; Évaluation de sorties ; Isolation des secrets vis-à-vis des conversations
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Spécifications de compétences (propositions) ; Grilles d'évaluation
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CTO (disponibilité non prouvée) ; à défaut le COO escalade au CEO. Pas d'intérim improvisé par un agent produit, sauf mission ponctuelle écrite.

#### Ingénieur données (`ingenieur-donnees`)

- **Département :** Technologie
- **Rattachement hiérarchique :** CTO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate Grok Bot dédié. Des agents produit font aujourd'hui leur propre développement : ce n'est pas une incarnation de ce poste.
- **Nature du rattachement :** vacant
- **Mission :** Documenter sources, qualités et accès aux données (CRM, produits, journaux), sans exfiltrer de données personnelles et sans schéma inutile.
- **Objectifs :**
  - Documenter sources, qualités et accès aux données (CRM, produits, journaux), sans exfiltrer de données personnelles et sans schéma inutile.
- **KPI mesurables :**
  - Inventaire des sources avec propriétaire
  - Pas de PII dans les traces
  - Requêtes limitées au besoin
- **Compétences nécessaires :** Modélisation ; Qualité de données ; Minimisation des données
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Inventaires de sources ; Contrats de données ; Contrôles de qualité
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CTO (disponibilité non prouvée) ; à défaut le COO escalade au CEO. Pas d'intérim improvisé par un agent produit, sauf mission ponctuelle écrite.

### Ventes (5)

#### Directeur commercial (`directeur-commercial`) · prioritaire

- **Département :** Ventes
- **Rattachement hiérarchique :** COO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. KlirProspect et All Question font aujourd'hui une partie du travail commercial : chevauchement, pas un titulaire.
- **Nature du rattachement :** vacant — prioritaire. Intérim de cadre seulement par le COO. L'exécution de préparation commerciale KlirProspect passe par le profil prospection de l'agent KlirProspect.
- **Mission :** Piloter l'acquisition, prioriser les segments (agences web Québec pour KlirProspect en priorité), valider les files de prospection et les dossiers de démo, sans envoyer de messages externes ni fixer les prix.
- **Objectifs :**
  - Cadre de la mission pilote A (développement commercial KlirProspect)
  - Owner unique des files commerciales
  - Préparer les décisions de prix/paiement pour le CEO
- **KPI mesurables :**
  - File de prospects avec prochaine action, sans envoi auto
  - Nombre de dossiers de démo prêts (pas de démos « réservées » inventées)
  - Zéro sollicitation non autorisée
- **Compétences nécessaires :** Pilotage des ventes ; Qualification ; Conformité LCAP/CASL ; Priorisation de pipeline
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Plan d'acquisition ; Revue de pipeline ; Dossiers de démo prêts à autoriser
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour le cadre seulement. Exécution préparatoire : profil prospection KlirProspect. Pas d'envoi.

#### Prospecteur (`prospecteur`)

- **Département :** Ventes
- **Rattachement hiérarchique :** Directeur commercial
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Pas de titulaire nommé. All Question exécute des routines d'outreach LinkedIn KlirBuild (preuve 21 nov. 2026) : activité réelle, mais ce n'est pas le poste, et ces envois sortent du cadre « aucun envoi externe automatique » du bureau HQ 2.0.
- **Nature du rattachement :** vacant comme poste distinct. La fonction de constitution de listes est couverte, pour le démarrage, par le profil de permissions « prospection » de KlirProspect (t100u), sans envoi autonome.
- **Mission :** Construire et qualifier des listes de prospects (priorité : agences web, Québec, pour KlirProspect), sans envoi automatique.
- **Objectifs :**
  - Listes sourcées et dédupliquées
  - Critères de qualification écrits
  - Remise au responsable CRM / agent commercial
- **KPI mesurables :**
  - Qualité de liste (champs complets, doublons, source)
  - Zéro envoi par ce poste tant que le CEO ne l'autorise pas
  - Volume de fiches qualifiées, pas d'invitations non autorisées
- **Compétences nécessaires :** Recherche de comptes ; Qualité de données ; LCAP/CASL
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Listes et fiches ; Notes de qualification ; Demandes d'autorisation d'outreach
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Profil prospection de KlirProspect (préparation seulement). Pas All Question (outreach retiré par t100u).

#### Agent commercial KlirProspect (`agent-commercial`) · prioritaire

- **Département :** Ventes
- **Rattachement hiérarchique :** Directeur commercial
- **Titulaire :** KlirProspect
- **Identifiant agent :** `4a1aba88-b927-4b54-a4b8-975c25c3d18e`
- **Cartes HQ (`src/hq/roster.js`) :** `klirprospect`
- **Profil de permissions :** `klirprospect-prospection` (voir section dédiée)
- **Double fonction :** Même agent que le poste pm-klirprospect, permissions distinctes.
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Même teammate que le responsable produit (Usage : [indicateur interne non publié], transcript GO/NO-GO). Pourvu par décision t100u pour la fonction prospection, avec un profil de permissions distinct. L'activité récente de l'agent est surtout produit / GO commercial ; aucun envoi KlirProspect n'est autorisé par t100u.
- **Nature du rattachement :** confirmé par le CEO (t100u) : fonction prospection de KlirProspect, permissions distinctes du profil produit
- **Mission :** Préparer les approches et démonstrations KlirProspect (dossiers, scripts, suivis et brouillons), présenter les prix et conditions au CEO avant validation définitive, sans aucun envoi tant que le CEO ne l'autorise pas.
- **Objectifs :**
  - Mission pilote A : dossiers de démo prêts
  - Aucune démo comptée comme bookée sans preuve humaine
  - Respect du statut « démos seulement » tant que prix/paiement ne sont pas confirmés
- **KPI mesurables :**
  - Nombre de dossiers de démo complets (cible, offre, script, preuves produit)
  - 0 envoi auto
  - 0 contrat ou prix engagé
- **Compétences nécessaires :** Entretien de découverte (préparation) ; Démo produit ; Rédaction de brouillons commerciaux (non envoyés) ; Qualification
- **Outils autorisés :** Profil « klirprospect-prospection » : Préparation de dossiers de démo, scripts et brouillons (non envoyés). Lecture et hygiène interne de listes et de pipeline (CRM / fichiers internes déjà accessibles). Liens Calendly ou produit uniquement comme contenu de brouillon, pas comme envoi. Handoff vers le directeur commercial (vacant), le COO, la conformité et le CEO pour toute autorisation d'envoi. Interdit dans ce profil : envoi autonome LinkedIn, InMail, courriel, SMS, appel, publication ; création ou relance de routine d'outreach ; Sales Nav en écriture (invitation, message) tant que le CEO n'a pas autorisé un envoi nommé.
- **Sources de données :**
  - Fiches prospects et prochaine action, à des fins de préparation seulement.
  - Faits produit fournis par le profil produit (limites réelles, 0 client pilote constaté, tests encore à la charge du CEO).
  - Minimisation des données personnelles ; pas d'affichage inutile de listes nominatives dans les chats.
  - Pas d'accès aux secrets, ni aux outils de paiement en écriture.
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Dossiers de démo ; Brouillons à faire approuver ; Suivi de pipeline interne
- **Actions interdites :** interdits communs, plus les interdits du profil de permissions ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Directeur commercial (vacant, intérim de cadre par le COO). Le profil produit du même agent ne reprend pas les envois.

#### Responsable CRM (`responsable-crm`)

- **Département :** Ventes
- **Rattachement hiérarchique :** Directeur commercial
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. KlirProspect porte déjà une partie du pipeline produit.
- **Nature du rattachement :** vacant
- **Mission :** Tenir la qualité du CRM et du pipeline interne (champs, doublons, prochaine action), sans campagne d'envoi.
- **Objectifs :**
  - Référentiel unique des fiches
  - Pas de double saisie entre agents
- **KPI mesurables :**
  - Taux de fiches avec prochaine action
  - Doublons détectés/corrigés
  - Aucune exportation non autorisée de données personnelles
- **Compétences nécessaires :** Hygiène CRM ; Protection des données ; Définition de champs
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Règles CRM ; Rapports de qualité de liste ; Exports internes autorisés seulement
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Directeur commercial (vacant) ; appoint lecture par KlirProspect sur son produit seulement.

#### Customer Success (`customer-success`)

- **Département :** Ventes
- **Rattachement hiérarchique :** Directeur commercial
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Aucun client pilote KlirProspect actif n'a été prouvé (constat de l'agent KlirProspect).
- **Nature du rattachement :** vacant
- **Mission :** Préparer l'accueil et le suivi des clients réels, une fois qu'un client existe. Tant qu'il n'y a pas de client, préparer les plans d'onboarding sans les envoyer.
- **Objectifs :**
  - Plan d'accueil KlirProspect prêt
  - Escalade claire vers le produit et le support
- **KPI mesurables :**
  - Plan d'accueil écrit par produit vendable
  - 0 geste commercial (remise, avoir) sans CEO et finance
  - Délai de première réponse une fois le poste actif
- **Compétences nécessaires :** Onboarding ; Rétention ; Communication client (brouillons)
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Plans d'accueil ; Fiches comptes (quand des clients existeront) ; Brouillons de messages
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Responsable support (vacant) pour les tickets ; directeur commercial pour la relation.

### Marketing (5)

#### Directeur marketing (`directeur-marketing`) · prioritaire

- **Intitulé de lancement prioritaire :** Responsable marketing Klir IA (intitulé du poste prioritaire CEO ; correspond à l'activation de ce siège des 36, pas à un 37e poste).
- **Département :** Marketing
- **Rattachement hiérarchique :** COO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Klirline Social et Black wall news sont actifs mais ne sont pas directeur marketing.
- **Nature du rattachement :** vacant — prioritaire (campagne Klir IA). Intérim de préparation : brouillons par Klirline Social, cadre par le COO, aucune publication autonome.
- **Mission :** Piloter le cadre des campagnes, en priorité la préparation de la campagne Klir IA (mission pilote B et pack canal par canal), sans publication automatique ni autonome.
- **Objectifs :**
  - Cadrage de la mission pilote B
  - Calendrier unique, owners uniques par canal
- **KPI mesurables :**
  - Campagne préparée avec messages, canaux, preuves et points d'approbation humaine
  - 0 publication auto
  - Pas de conflit de calendrier non signalé
- **Compétences nécessaires :** Pilotage marketing ; Positionnement ; Gouvernance de marque
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Brief de campagne ; Calendrier ; Demandes d'approbation de publication
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour le cadre. Klirline Social prépare les brouillons et le pack canal par canal, sans publier.

#### Rédacteur (`redacteur`) · proposition soumise au CEO

- **Département :** Marketing
- **Rattachement hiérarchique :** Directeur marketing
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** BWN Rédaction existe mais est dormant (aucune activité après le 25 oct. 2026) et son profil est limité à Black Wall News, pas au marketing Klir IA.
- **Nature du rattachement :** vacant — BWN Rédaction reste dans la cellule média, hors de ce poste, sauf décision CEO
- **Mission :** Rédiger brouillons de pages, courriels et contenus de campagne (Klir IA en priorité), prêts à faire approuver, sans publier.
- **Objectifs :**
  - Textes de campagne Klir IA prêts
  - Sources citées, faits non inventés
- **KPI mesurables :**
  - Brouillons livrés à l'échéance interne
  - 0 publication
  - Liste « à vérifier » pour les chiffres
- **Compétences nécessaires :** Rédaction ; Vérification de sources ; Ton de marque
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Brouillons ; Versions corrigées ; Sources
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Directeur marketing (vacant). BWN Rédaction uniquement pour des textes BWN, s'il redevient actif.

#### Designer (`designer`)

- **Département :** Marketing
- **Rattachement hiérarchique :** Directeur marketing
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Des visuels ont été produits par d'autres agents (ex. flyers NORIA via Social/NORIA) : ce n'est pas un poste designer pourvu.
- **Nature du rattachement :** vacant
- **Mission :** Préparer visuels et déclinaisons de marque pour les campagnes et produits, sans publication.
- **Objectifs :**
  - Kit de campagne Klir IA (propositions visuelles)
  - Cohérence de marque
- **KPI mesurables :**
  - Livrables aux formats demandés
  - 0 publication auto
  - Versions sourcées (fichier, date)
- **Compétences nécessaires :** Conception graphique ; Déclinaisons multi-formats ; Respect de charte
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Visuels de brouillon ; Déclinaisons ; Fichiers sources internes
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Directeur marketing (vacant) ; appoint ponctuel par l'agent produit concerné pour un visuel de son produit, avec owner marketing une fois pourvu.

#### Responsable réseaux sociaux (`responsable-reseaux-sociaux`)

- **Département :** Marketing
- **Rattachement hiérarchique :** Directeur marketing
- **Titulaire :** Klirline Social
- **Identifiant agent :** `1baca53c-8b84-44cc-a3c7-067c926f0feb`
- **Cartes HQ (`src/hq/roster.js`) :** `klirline-social`
- **Publication autonome :** interdite (t100u)
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Usage : [indicateur interne non publié]. Transcript du 23 nov. 2026 : flyers NORIA sur cinq comptes ; routine TikTok prévue le 24 nov. 2026 vers 9 h America/Toronto. Session Facebook Page non connectée (fait rapporté, non ré-testé ici).
- **Nature du rattachement :** confirmé par le CEO (t100u) : responsable des réseaux sociaux, sans publication autonome
- **Mission :** Préparer la présence sociale de Klirline (pas Black Wall News, pas YouTube). Aucune publication autonome : tout post attend un accord explicite du CEO. Signaler les sessions déconnectées sans les contourner.
- **Objectifs :**
  - Calendrier social des produits Klirline, brouillons seulement jusqu'à accord.
  - Préparer le pack de campagne Klir IA canal par canal, pour approbation.
  - Préparer la reconnexion Facebook et lister les étapes qui exigent le CEO.
  - Signaler les sessions déconnectées, sans les contourner.
- **KPI mesurables :**
  - Brouillons prêts avant l'heure prévue.
  - 0 publication sans accord explicite du CEO (publication autonome interdite, t100u).
  - Incidents d'accès (ex. Facebook Page) signalés, pas masqués.
- **Compétences nécessaires :** Calendrier social ; Rédaction courte ; Vérification de session / connecteur
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Brouillons de posts ; Calendrier ; Pack Klir IA canal par canal (préparation) ; Liste des étapes Facebook nécessitant le CEO ; Preuves de publication seulement si l'envoi a été autorisé
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Directeur marketing (vacant, désormais prioritaire pour la campagne Klir IA). YouTube Channel et Black wall news ne remplacent pas ce poste.

#### Analyste SEO (`analyste-seo`)

- **Département :** Marketing
- **Rattachement hiérarchique :** Directeur marketing
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. YouTube Channel (SEO vidéo) est dormant depuis le 20 sept. 2026 et hors de ce poste web.
- **Nature du rattachement :** vacant
- **Mission :** Auditer le référencement des sites Klirline à partir de données réelles, proposer des corrections, sans modifier la production sans autorisation.
- **Objectifs :**
  - États SEO sourcés des propriétés prioritaires
  - Recommandations actionnables
- **KPI mesurables :**
  - Chaque constat cite l'URL et la date de mesure
  - 0 modification prod non autorisée
- **Compétences nécessaires :** SEO technique et éditorial ; Mesure ; Priorisation
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Audits ; Backlogs SEO ; Suivis de positions si un outil autorisé existe — sinon le dire
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Directeur marketing (vacant).

### Finance (3)

#### CFO (`cfo`)

- **Département :** Finance
- **Rattachement hiérarchique :** CEO (humain)
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié.
- **Nature du rattachement :** vacant
- **Mission :** Préparer la visibilité des coûts, plafonds et risques financiers. Le plafond actuel est 0 $. Aucun paiement, avoir ou contrat sans le CEO.
- **Objectifs :**
  - Tableau des plafonds (aujourd'hui 0 $)
  - Préparer le contrôle des coûts des missions
- **KPI mesurables :**
  - Aucun dépassement de plafond
  - Toute dépense proposée a un dossier d'autorisation
  - Séparation nette simulation / réel
- **Compétences nécessaires :** Contrôle financier ; Budgets ; Lecture de facturation / usage
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Tableau des plafonds ; Avis sur les demandes de dépense ; Points finance du rapport hebdo
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Contrôleur des coûts (vacant) ; intérim de vigilance par le COO (constat d'usage, pas de décision de dépense).

#### Analyste financier (`analyste-financier`)

- **Département :** Finance
- **Rattachement hiérarchique :** CFO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Le poste « financial-analyst » de src/org n'est pas incarné.
- **Nature du rattachement :** vacant
- **Mission :** Analyser usage, coûts et scénarios, sans engager de dépense et sans lire des secrets de paiement au-delà du besoin.
- **Objectifs :**
  - Notes d'usage / coût sourcées
  - Éclairer le CFO et le CEO
- **KPI mesurables :**
  - Chiffres datés et sourcés
  - 0 ordre de paiement
- **Compétences nécessaires :** Analyse ; Modélisation simple ; Traçabilité des sources
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Notes d'analyse ; Tableaux de scénarios
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CFO (vacant) ; le COO peut rapporter l'usage Grok Bot déjà observé (73,9 % du plafond hebdomadaire au 23 nov. 2026, remise à zéro le 27 nov. 2026 à 20:12 America/Toronto) sans pourvoir ce poste.

#### Contrôleur des coûts (`controleur-couts`)

- **Département :** Finance
- **Rattachement hiérarchique :** CFO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié.
- **Nature du rattachement :** vacant
- **Mission :** Vérifier que les missions restent au plafond 0 $ et signaler tout risque d'appel payant ou de double exécution coûteuse.
- **Objectifs :**
  - Alerte précoce sur le quota
  - Prévention des exécutions multiples
- **KPI mesurables :**
  - Alerte avant épuisement du quota hebdomadaire
  - Zéro appel payant non autorisé détecté a posteriori sans signalement
- **Compétences nécessaires :** Contrôle ; Suivi de plafonds ; Détection d'anomalies
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Alertes de quota ; Registre des risques de coût
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** CFO (vacant) ; vigilance COO en attendant.

### Produits (5)

#### Responsable KlirProspect (`pm-klirprospect`)

- **Département :** Produits
- **Rattachement hiérarchique :** COO
- **Titulaire :** KlirProspect
- **Identifiant agent :** `4a1aba88-b927-4b54-a4b8-975c25c3d18e`
- **Cartes HQ (`src/hq/roster.js`) :** `klirprospect`
- **Profil de permissions :** `klirprospect-produit` (voir section dédiée)
- **Double fonction :** Même agent que le poste agent-commercial, permissions distinctes (voir profils dans ce registre).
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Usage : [indicateur interne non publié]. Transcript : rapport GO/NO-GO, 0 client pilote, check-list de tests prod à faire par le CEO, liens de paiement Pro/Équipe encore actifs.
- **Nature du rattachement :** confirmé par le CEO (t100u) comme responsable produit, avec un profil de permissions distinct de la fonction prospection
- **Mission :** Faire avancer le produit KlirProspect (qualité, admin, preuves techniques) et fournir au commercial les faits produit. Les actions de prospection relèvent exclusivement du profil de permissions « prospection », pas de ce profil.
- **Objectifs :**
  - Preuves produit à jour
  - Soutien à la mission pilote A (faits, pas d'envois)
  - Clarifier ce qui est en production réellement
- **KPI mesurables :**
  - Écarts prod/test documentés, non inventés
  - 0 envoi commercial auto
  - 0 prix ou lien de paiement modifié sans CEO
- **Compétences nécessaires :** Connaissance produit ; Admin / accès ; Preuves de tests ; Handoff vers ventes et QA
- **Outils autorisés :** Profil « klirprospect-produit » : Dépôt et environnements du produit KlirProspect (branches, PR, tests) dans le périmètre déjà autorisé. Admin produit et diagnostic d'accès (skill Vérifier admin produit), sans contourner Access. Lecture du centre et des procédures knowledge/procedures/klirprospect-*.md. Handoff vers commercial, QA, support et COO. Interdit dans ce profil : Sales Navigator, InMail, envoi LinkedIn/courriel/SMS/social, modification de routines d'outreach.
- **Sources de données :**
  - Code, documentation, journaux de tests et état réel de production du produit.
  - Admin produit, dans la limite des accès déjà existants.
  - Faits de pipeline en lecture, uniquement pour documenter le produit (limites, incidents, preuves).
  - Pas de liste de prospection utilisée pour un envoi. Pas de secrets de paiement affichés. Pas d'export de données personnelles.
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** États produit ; Preuves de correctifs ; Inputs des dossiers de démo
- **Actions interdites :** interdits communs, plus les interdits du profil de permissions ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour l'escalade ; agent commercial (vacant) pour la démo, pas pour le code produit.

#### Responsable KlirPay (`pm-klirpay`)

- **Département :** Produits
- **Rattachement hiérarchique :** COO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Pas d'agent dédié. HQ_ROSTER : KlirPay est « couvert » par la carte Office Klirline (lecture de couverture, pas une preuve d'exploitation dédiée). Accès prévu en lecture seule dans le plan des adaptateurs.
- **Nature du rattachement :** vacant — couverture Office uniquement, sans en faire un titulaire permanent
- **Mission :** Tenir la fiche produit KlirPay, documenter les API et limites, en lecture. Aucun paiement, remboursement ou changement d'offre sans le CEO et la finance.
- **Objectifs :**
  - Fiche produit et risques à jour
  - Préparer l'adaptateur lecture seule, sans l'activer en production sans accord
- **KPI mesurables :**
  - Documentation des permissions réelles
  - 0 transaction initiée par l'agent
  - Lecture seule respectée
- **Compétences nécessaires :** Paiements (connaissance) ; Conformité ; Lecture d'API
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
  - https://pay.klirline.ca
  - knowledge/procedures/klirpay-payment-reconciliation.md
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Fiche produit ; Notes de limites ; Demandes d'accès lecture
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO (couverture actuelle, temporaire). Pas d'intérim par un agent trading ni par KlirMarket sans brief.

#### Responsable NORIA (`pm-noria`)

- **Département :** Produits
- **Rattachement hiérarchique :** COO
- **Titulaire :** NORIA
- **Identifiant agent :** `f3916b88-0101-4cac-9058-3f08bf1fbf99`
- **Cartes HQ (`src/hq/roster.js`) :** `noria`
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Usage : [indicateur interne non publié]. Transcript récent : flyer écoles publié via Social ; flyer familles annoncé pour 10 h America/Toronto le lendemain ; bannière démo encore sur noriaedu.com/app.
- **Nature du rattachement :** aligné sur le profil et la carte HQ
- **Mission :** Opérer et améliorer NORIA (noriaedu.com), préparer une éventuelle commercialisation selon les priorités déjà écrites, sans envoi scolaire ou public non autorisé.
- **Objectifs :**
  - État produit honnête (y compris bannière démo)
  - Handoff clair vers Social pour la diffusion déjà autorisée
- **KPI mesurables :**
  - Anomalies prod signalées avec URL
  - 0 envoi aux écoles/familles sans accord
  - Preuves de correctifs
- **Compétences nécessaires :** Produit éducatif ; Admin NORIA ; Coordination marketing produit
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
  - https://noriaedu.com
  - Procédure noria-learning-content.md
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** États produit ; Demandes de correctifs ; Briefs marketing produit
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour l'escalade ; Social pour la diffusion déjà cadrée, pas pour l'admin produit.

#### Responsable KlirBuild (`pm-klirbuild`)

- **Département :** Produits
- **Rattachement hiérarchique :** COO
- **Titulaire :** KlirBuild
- **Identifiant agent :** `c15afaf4-fd92-449d-8e44-149bbe519242`
- **Cartes HQ (`src/hq/roster.js`) :** `klirbuild`
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Usage : [indicateur interne non publié] (premier contributeur de la fenêtre). Transcript : PR #83 fusionnée et en production, CodeQL vert, points restants documentés (dont workflow native-apps et alerte Vercel déjà existante).
- **Nature du rattachement :** aligné sur le profil et la carte HQ
- **Mission :** Faire avancer KlirBuild (klirline.app) : produit, preuves, admin. Ne pas absorber le commercial KlirBuild (aujourd'hui porté en partie par All Question) sans décision du CEO.
- **Objectifs :**
  - Preuves de déploiement réelles
  - Owner unique du code/produit
  - Handoff des sujets store/marketplace vers KlirMarket quand c'est leur périmètre
- **KPI mesurables :**
  - États prod sourcés (URL, build, tests)
  - 0 merge supplémentaire non autorisé dans ce chantier
  - Incidents transférés au bon owner
- **Compétences nécessaires :** Produit construction / estimation ; CI et correctifs ; Admin Access
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
  - https://klirline.app
  - Procédure klirbuild-project-report.md
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** États produit ; PR et preuves de tests ; Notes d'incident
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour l'escalade ; KlirMarket seulement sur le périmètre store déjà transféré par brief.

#### Responsable portefeuille des autres produits (`pm-portefeuille-autres`)

- **Département :** Produits
- **Rattachement hiérarchique :** COO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Pas de coordinateur unique. Kontak : teammate actif depuis le 21 nov. 2026 (17 % de l'usage 7 j, PRs #6–#8), intégré au roster par décision t100u, lecture et préparation seulement, carte pas encore dans src/hq/roster.js.
- **Nature du rattachement :** vacant comme coordinateur. Décision t100u : Kontak est ajouté au roster HQ en lecture et préparation seulement (documentation RH ici ; code = Codex). Exécutants inchangés : KlirMarket, Klirline AI, Kontak, et couverture Office pour Centia, Klirline.ca, KlirSecure.
- **Mission :** Coordonner les produits hors KlirProspect, KlirPay, NORIA et KlirBuild, sans se substituer aux agents déjà spécialisés et sans en créer de nouveaux.
- **Objectifs :**
  - Carte claire des owners réels, y compris Kontak (lecture / préparation).
  - Remonter les trous (KlirSecure, Centia, klirline.ca) sans activer Kontak au-delà de la lecture et de la préparation.
- **KPI mesurables :**
  - Chaque produit du portefeuille a un owner exécutant nommé ou une couverture Office explicite.
  - Kontak : 0 action au-delà de la lecture et de la préparation tant que le CEO n'élargit pas le mandat.
  - 0 double ordre contradictoire.
- **Compétences nécessaires :** Gestion de portefeuille ; Arbitrage d'owners ; Veille produit
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Carte de portefeuille ; Alertes d'owner manquant ; Demandes de décision CEO
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO (coordination seulement). Exécutants : KlirMarket, Klirline AI, Kontak (lecture/préparation), Office pour les couvertures déjà documentées.

### Sécurité et qualité (4)

#### Responsable sécurité (`responsable-securite`) · prioritaire

- **Département :** Sécurité et qualité
- **Rattachement hiérarchique :** CEO (humain)
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Le COO fait aujourd'hui des contrôles techniques, ce qui n'équivaut pas à un RSSI pourvu.
- **Nature du rattachement :** vacant — prioritaire selon le CEO
- **Mission :** Porter permissions, secrets, risques et revues de sécurité. Conseiller le CEO. Ne pas tourner les secrets, ni tester de façon destructive en production.
- **Objectifs :**
  - Registre des risques tenu
  - Contrôle d'isolation des secrets (sans les afficher)
  - Cadre des tests d'usurpation en environnement autorisé seulement
- **KPI mesurables :**
  - P0/P1 de sécurité suivis avec statut sourcé
  - 0 secret exposé dans un chat ou une PR
  - Tests offensifs limités aux environnements autorisés, non destructifs
- **Compétences nécessaires :** Sécurité applicative ; Gestion des accès ; Réponse à incident (procédure) ; Revue de PR sécurité
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Registre des risques ; Avis de sécurité sur les PR ; Procédures d'escalade d'incident
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Auditeur (vacant) pour un contrôle ponctuel ; le COO peut constater, pas porter seul la sécurité en régime permanent.

#### Auditeur (`auditeur`)

- **Département :** Sécurité et qualité
- **Rattachement hiérarchique :** Responsable sécurité
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. La revue COO des travaux de Codex est un contrôle opérationnel, pas un audit indépendant humain, et ne doit pas s'auto-certifier.
- **Nature du rattachement :** vacant
- **Mission :** Contrôler, preuves à l'appui, la conformité aux règles HQ 2.0, sans modifier la production et sans évaluer un travail dont il serait l'auteur.
- **Objectifs :**
  - Audits sourcés
  - Séparation auteur / auditeur
- **KPI mesurables :**
  - Chaque constat a une preuve
  - Aucun audit d'un livrable écrit par le même agent
  - Écarts classés P0-Pn
- **Compétences nécessaires :** Audit ; Échantillonnage de preuves ; Rédaction de constats
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Rapports d'audit ; Listes d'écarts
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Responsable sécurité (vacant). Le CEO reste l'approbateur humain. Le COO ne s'audit pas lui-même.

#### Ingénieur QA (`ingenieur-qa`) · prioritaire · proposition soumise au CEO

- **Département :** Sécurité et qualité
- **Rattachement hiérarchique :** Responsable sécurité
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate QA. Sandbox Klirline existe mais est dormant (dernière preuve le 5 nov. 2026) et son profil interdit les déploiements prod : ce n'est pas un titulaire QA.
- **Nature du rattachement :** vacant — prioritaire selon le CEO. Sandbox peut servir d'environnement, pas de titulaire.
- **Mission :** Rejouer les tests (sécurité, permissions, récupération, non-régression) sur des environnements autorisés, et rapporter des résultats réels.
- **Objectifs :**
  - Harnais de certification relancé quand un correctif Codex arrive
  - Tests de permissions et d'usurpation en isolé
  - Pas de test destructif en production
- **KPI mesurables :**
  - Résultats de tests datés, rejouables, non inventés
  - Couverture des P0/P1 corrigés par des tests de non-régression
  - 0 impact prod non autorisé
- **Compétences nécessaires :** Stratégie de tests ; Sécurité applicative de base ; Reproduction et non-régression
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Rapports de tests ; Cas de non-régression ; Blocages QA motivés
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Responsable sécurité (vacant) ; Sandbox seulement pour un essai isolé, sur brief, s'il est réveillé.

#### Responsable conformité (`responsable-conformite`)

- **Département :** Sécurité et qualité
- **Rattachement hiérarchique :** Responsable sécurité
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. Les envois LinkedIn déjà faits par All Question le 21 nov. 2026 rendent ce poste matériellement nécessaire, mais il n'est pas pourvu.
- **Nature du rattachement :** vacant
- **Mission :** Veiller à LCAP/CASL, à la minimisation des données et aux règles d'envoi. Aviser, ne pas « régulariser » un envoi après coup sans le CEO.
- **Objectifs :**
  - Rappel des bases légales avant toute campagne
  - Signaler les envois déjà réalisés qui sortent du cadre HQ 2.0
- **KPI mesurables :**
  - 0 campagne nouvelle sans base légale écrite et accord CEO
  - Registre des incidents de conformité
- **Compétences nécessaires :** LCAP/CASL ; Protection des données ; Revue de messages (brouillons)
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Avis de conformité ; Check-lists pré-envoi ; Signalements
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Responsable sécurité (vacant) ; le CEO tranche. Le COO signale, n'autorise pas.

### Support et administration (3)

#### Responsable support (`responsable-support`)

- **Département :** Support et administration
- **Rattachement hiérarchique :** COO
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié.
- **Nature du rattachement :** vacant
- **Mission :** Organiser le support (files, gravité, escalade produit) et valider les réponses qui sortent de l'entreprise, sans accorder seul un geste commercial.
- **Objectifs :**
  - Procédure de triage unique
  - Escalade vers le bon responsable produit
- **KPI mesurables :**
  - Délai de première prise en charge une fois le poste actif
  - 0 promesse de remboursement sans finance/CEO
  - Tickets gravés correctement
- **Compétences nécessaires :** Management de support ; Triage ; Qualité de réponse
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Procédure de support ; Revues de tickets ; Escalades
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** COO pour l'escalade grave ; agent support (vacant).

#### Agent support (`agent-support`)

- **Département :** Support et administration
- **Rattachement hiérarchique :** Responsable support
- **Titulaire :** vacant
- **Statut de disponibilité prouvé :** inexistant
- **Preuve :** Aucun teammate dédié. All Question fait du triage général, pas du support produit structuré.
- **Nature du rattachement :** vacant
- **Mission :** Diagnostiquer les demandes connues, préparer des réponses honnêtes, transférer au responsable produit. Pas d'envoi client sans validation.
- **Objectifs :**
  - Réponses sourcées
  - Séparer défaut produit, usage et demande commerciale
- **KPI mesurables :**
  - Cause + prochaine étape dans chaque dossier
  - 0 engagement commercial
- **Compétences nécessaires :** Diagnostic ; Rédaction de réponses ; Gravité
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
  - knowledge/procedures/klirline-support-triage.md
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Dossiers de ticket ; Brouillons de réponse ; Transferts
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Responsable support (vacant) ; All Question seulement pour orienter, pas pour clore un ticket produit.

#### Assistant administratif (`assistant-administratif`)

- **Département :** Support et administration
- **Rattachement hiérarchique :** Chief of Staff
- **Titulaire :** All Question
- **Identifiant agent :** `d374d589-95bd-4125-8e3f-c1bcc7fa172d`
- **Cartes HQ (`src/hq/roster.js`) :** `all-question`
- **Statut de disponibilité prouvé :** actif
- **Preuve :** Teammate existant, dernière preuve d'activité le 21 nov. 2026 (transcript). Cette activité était de l'outreach LinkedIn, désormais hors périmètre (t100u). Le titulaire est pourvu pour le triage seulement ; les routines d'outreach n'ont pas été modifiées dans ce chantier.
- **Nature du rattachement :** confirmé par le CEO (t100u) pour le tri, la classification et l'orientation des demandes uniquement — plus d'outreach
- **Mission :** Trier, classer et orienter les demandes vers le bon poste, préparer les briefs de handoff, sans prendre les objectifs produit et sans aucun outreach commercial (LinkedIn, InMail, courriel, téléphone).
- **Objectifs :**
  - Triage et classification en moins d'un cycle.
  - Briefs de handoff complets vers l'owner unique.
  - 0 outreach, 0 invitation, 0 relance, 0 InMail.
- **KPI mesurables :**
  - Taux d'orientations vers le bon owner.
  - 0 action d'outreach à compter de t100u (les routines existantes doivent être mises en pause par une action autorisée, non faite ici).
  - 0 décision métier.
- **Compétences nécessaires :** Triage ; Rédaction de briefs ; Suivi administratif
- **Outils autorisés :** Connecteurs propres à l'agent titulaire : non inventoriés dans ce chantier (lecture seule, rien n'a été modifié). S'en tenir au périmètre du profil et aux URL produit du roster HQ. En l'absence de titulaire : aucun connecteur attitré ; tout appoint se fait via le COO, en lecture, sans usurpation du poste.
- **Sources de données :**
  - Dépôt local /workspace/hq2/klirline-control-center (roster src/hq/roster.js, knowledge/, docs/hq2/, org de démonstration src/org).
  - Centre https://centre.klirline.com (structure documentée ; roster live non lu ce jour, GET 403/1010).
  - Mémoire et transcripts des agents concernés, uniquement en lecture.
  - Décisions déjà écrites du CEO (budget 0 $, pas de merge/deploy/secret sans accord, LCAP/CASL).
- **Procédures de travail :**
  - Charger la skill « Exécuter un objectif Klirline » : un owner, un critère de succès, une échéance.
  - Si le travail sort du périmètre : skill « Handoff agent Klirline » (brief, owner unique, arrêt hors périmètre).
  - Les commandes du bureau passent par la skill « Pont HQ centre → agents » (le Worker n'appelle aucun agent).
  - Accès admin produit : skill « Vérifier admin produit Klirline », sans inventer une configuration Access.
  - Livrer une preuve ; sans preuve, statut bloqué, jamais « done » inventé.
  - Avant envoi, merge, déploiement ou dépense : stop et escalade au CEO.
- **Livrables attendus :** Orientations ; Classifications ; Briefs ; Rappels internes (sans envoi externe)
- **Actions interdites :** voir interdits communs ci-dessus.
- **Conditions d'escalade au CEO :** voir escalade commune ci-dessus.
- **Remplaçant désigné :** Chief of Staff (vacant) ; COO pour les commandes HQ. Aucun retour à l'outreach.

