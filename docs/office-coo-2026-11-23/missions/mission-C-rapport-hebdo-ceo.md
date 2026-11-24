# Mission C — Rapport stratégique hebdomadaire destiné au CEO

- **Identifiant :** mission-C-rapport-hebdo-ceo
- **Préparé par :** Office Klirline · Ops Klirline (COO), le 23 novembre 2026, soir (America/Toronto).
- **Nature :** préparation d’un gabarit et d’une procédure de remise. Le premier rapport S2 n’est pas rédigé ici (la semaine 23–29 nov. n’est pas close). Aucun envoi externe. Aucune routine n’est créée (proposition de texte seulement).
- **Règle d’objectif :** un objectif = un agent propriétaire + un critère mesurable + une échéance.

## Sources consultées

| Fichier | Usage |
|---|---|
| `/workspace/klirprospect-pilote/modeles/10-rapport-hebdomadaire.md` | Gabarit existant du pilote KlirProspect (S1–S4). À **réutiliser en section**, pas à remplacer. |
| `/workspace/klirprospect-pilote/rapports/rapport-S1-2026-11-23.md` | Exemple réel (S1, 16–22 nov., rédigé le 23 nov. à 9 h 20). |
| `/workspace/hq2/audit-independant-2026-11-23.md` | Faits HQ à faire figurer chaque semaine tant qu’ils restent ouverts. |
| `/workspace/hq2/coo-2026-11-23/rapport-certification.md` | Cadre de certification (avancées GitHub, tests, Codex, risques, décisions, verdict). Vérifié en-tête le 23 nov. vers 21 h 15. |
| `/workspace/hq2/klirline-control-center/knowledge/ceo-rules.md` et `operations.md` | Niveaux d’approbation ; le chef de cabinet ne reçoit que ce qui change la journée du CEO — le rapport hebdo, lui, est le panorama. |
| Missions A et B du même dossier | Indicateurs à reprendre, sans les inventer. |

## Agent propriétaire

**Office Klirline · Ops Klirline** (COO, profil `8d5f5562-675c-4f66-8057-c66d817f8cbc`), en **intérim** du poste « Chief of Staff » (prioritaire, **non pourvu** parmi les agents existants constatés sur la box).

Dès qu’un agent Chief of Staff est activé, la propriété de cette mission doit lui être transférée par décision du CEO, avec le même critère et la même cadence. Le COO reste relecteur.

Le rapport de Grokbot / COO est un contrôle technique automatisé : **il ne remplace pas une approbation humaine indépendante.**

## Agents contributeurs

Chaque propriétaire de mission ou de produit remet des faits sourcés au rédacteur, au plus tard le dimanche 18 h (America/Toronto) :

| Contributeur | Matière | Interdit |
|---|---|---|
| KlirProspect (mission A) | Suivi commercial, démos, blocages LCAP/prix (chiffres du CSV et des rapports, pas de contenu CRM nominatif dans le rapport CEO) | Inventer une activation ou un paiement |
| Klirline AI (mission B) | État du pack campagne, publications **effectivement** faites (URLs), points tarifaires | Annoncer une pub non publiée |
| Codex (CTO), quand un livrable existe | Liste de PR / branches / tests réels | Annoncer une archive non reçue comme vérifiée |
| Ingénieur QA / responsable sécurité (postes à pourvoir ; intérim COO pour le contrôle) | Reprises de tests, incidents, secrets (sans les révéler) | Auto-évaluer ses propres travaux si un jour l’évaluateur est aussi l’auteur — la revue COO ne suffit pas comme approbation humaine |
| KlirBuild, NORIA, Kontak, KlirMarket, Black wall news, BWN Rédaction, Klirline Social, YouTube Channel, Sandbox, All Question | Une ligne d’état seulement si un fait nouveau est **sourcé** cette semaine | Remplir pour « faire complet » |

## Objectif, critère de réussite et échéance

**Objectif :** remettre chaque semaine au CEO un rapport stratégique factuel, unique, permettant de décider (GO / NO-GO / GO limité, autorisations, blocages), sans envoi externe.

**Critère mesurable (premier cycle) :** le lundi 30 novembre 2026 à 9 h (America/Toronto), le fichier du rapport S2 (période du 23 au 29 novembre 2026 inclus) est déposé dans un dossier local convenu (proposition : `/workspace/hq2/coo-2026-11-23/rapports-hebdo/` ou, s’il existe déjà, à côté des rapports pilote) **et** son contenu est présenté à Philippe dans le fil Office. Chaque chiffre a une source ; à défaut, la mention est « non mesuré » avec la raison. Aucun secret, aucune clé, aucun nom de prospect inutile. Le verdict GO / NO-GO / GO limité est **motivé** et distinct d’une approbation humaine.

**Échéance proposée du premier livrable :** lundi 30 novembre 2026, 9 h (America/Toronto).

Cadence ensuite : chaque lundi à 9 h, pour la semaine civile précédente (lundi–dimanche, heure de Toronto). Les jalons déjà prévus du pilote KlirProspect restent : S3 le 7 déc., S4 / bilan J28 le 14 déc. 2026.

Le rapport S1 du pilote (23 nov., 9 h 20) existe déjà et ne doit pas être réécrit. Le rapport stratégique S2 **l’inclut par référence** et l’élargit au bureau (HQ, autres produits, missions A et B).

## Gabarit de rapport hebdomadaire CEO

Reprendre la structure ci-dessous. La section 4 reprend le modèle 10 du pilote KlirProspect (objectifs G1–G5, sans noms de prospects).

### En-tête type

- Titre : Rapport stratégique hebdomadaire — S__
- Semaine du ____ au ____ (America/Toronto)
- Rédigé le ____ à __ h __ (America/Toronto)
- Rédacteur : [propriétaire]  |  Relecture COO : [oui/non, heure]
- Mention obligatoire : « Ce rapport n’est pas une approbation humaine indépendante. »

### 0. Verdict de la semaine (5 lignes maximum)

- Verdict opérationnel : GO / GO limité / NO-GO, motivé, limité au périmètre de la semaine.
- Fait le plus important (sourcé).
- Principal blocage.
- Décision la plus urgente demandée au CEO.
- Coût de la semaine : _ $ (cible : 0 $). Si différent de 0, source et autorisation.

### 1. Décisions demandées au CEO

Tableau : n° | décision | urgence (P0/P1/P2) | conséquence si report | dossier source.

Ne lister que des décisions réellement nécessaires. Pas de « pour information » déguisé.

### 2. Avancées confirmées (GitHub, sites, HQ)

Tableau : avancée | preuve (PR, commit, build, GET, fichier) | état (préparé / développé / testé / intégré / déployé).

Ne pas confondre une PR brouillon avec un déploiement. Ne pas confondre un build réussi avec une version active non lue.

### 3. Tests et contrôle Codex

- Tests réussis / échoués (identifiant de run ou harnais, pas un souvenir).
- Travaux Codex : validés / refusés / non reçus. L’archive 5.1 n’est pas « auditée » tant qu’elle n’a pas été reçue et vérifiée selon le protocole.
- La CI verte ne prouve pas la sécurité (rappel de l’audit du 23 nov.).

### 4. Mission A — KlirProspect (sous-gabarit modèle 10)

Objectifs G1 à G5 (cibles J28 inchangées : 5 entreprises activées, 4 avec ≥ 10 prospects exploitables, 3 rendez-vous, 2 Starter payants, 0 incident grave non résolu).

Tant que les prix/paiement ne sont pas confirmés par le CEO : G4 reste à 0 et n’est pas un objectif d’exécution de la semaine.

État vague 1 / vague 2 / dossier 30 agences : envois seulement s’ils ont été faits par Philippe (dates).

Démos tenues, consentements, blocages LCAP / NEQ / avocat.

Fiabilité (incidents, support). Aucun nom de prospect dans cette section si le canal de remise n’est pas interne et contrôlé ; préférer des identifiants (C1–C5, Mxx).

### 5. Mission B — Campagne Klir IA

Pack : préparé / remis / approuvé / publié, par canal.

URLs de publication seulement si elles existent.

Paiements Klir IA : toujours « en configuration » ou confirmés ouverts (date de constat).

Aucune métrique de performance inventée.

### 6. Autres produits et agents (faits nouveaux seulement)

Une ligne par produit ou agent s’il y a un fait sourcé ; sinon « aucun fait nouveau cette semaine ».

Ne pas remplir pour donner l’illusion d’une activité.

### 7. Continuité et HQ

- Commandes HQ : nombre, statuts, orphelins (ex. hq-33ebcef6 tant qu’elle reste running sans claim).
- Missions HQ visibles (dernier GET connu, date).
- Quotas épuisés (Grok Bot ou autre), agents indisponibles, missions bloquées au-delà des seuils (voir continuite-operationnelle.md).
- Tentatives d’exécution multiple détectées.
- Coûts déclarés vs coûts réels : rappeler que le coût HQ est déclaré par l’appelant (P2-1) et n’est pas une mesure fidèle.

### 8. Performances des agents

Seulement des indicateurs mesurables (livrables datés, commandes, PR si attribuables).

Si l’attribution GitHub reste confondue sur un seul compte, l’écrire (« non mesurable »).

### 9. Risques résiduels

P0 / P1 encore ouverts, avec référence à l’audit ou à un test rejoué. Pas de fermeture de risque sans constat contraire.

### 10. Budget

Cible 0 $. Toute dépense : montant, autorisation, pièce. En l’absence d’autorisation : 0 $ ou « non mesuré » si un système externe a pu facturer hors de notre vue — ne pas affirmer 0 $ d’exploitation globale sans source.

### Sources de la semaine

Liste des fichiers, GET, runs. Heure America/Toronto.

## Étapes du premier cycle (23–30 nov.)

| # | Étape | Quand | Responsable |
|---|---|---|---|
| C1 | Ouvrir le fichier S2 à partir de ce gabarit (copie locale, pas encore de contenu de semaine close) | Dès approbation du gabarit par le CEO, ou à défaut dès le 28 nov. | Propriétaire |
| C2 | Collecter les notes des contributeurs | Dimanche 29 nov., 18 h au plus tard | Contributeurs → propriétaire |
| C3 | Rédiger uniquement avec des sources ; trous = « non mesuré » | Dimanche soir / lundi avant 9 h | Propriétaire |
| C4 | Relecture COO (si le rédacteur est déjà le COO, le mentionner : pas de seconde relecture automatique) | Avant 9 h le 30 nov. | COO |
| C5 | Remise dans le fil Office + fichier local | 30 nov., 9 h | Propriétaire |
| C6 | Aucun envoi e-mail, message externe, ou publication | — | Interdit sauf ordre distinct de Philippe, avec destinataire et texte |

## Dépendances

### Techniques

- Accès en **lecture** aux fichiers locaux cités et, le cas échéant, aux GET HQ déjà autorisés. Ne pas attaquer un chemin Access/JWT en production. Si un GET roster échoue (exemple déjà constaté le 23 nov. à 21 h 16 : HTTP 403, Cloudflare 1010, consigne « do not retry » sur cette signature), **ne pas réessayer** ; écrire « non mesuré » et la raison.
- Le rapport rappelle, sans détail technique, que les limites connues de l’API HQ (P1) restent ouvertes quand il cite ces chiffres.
- Quota Grok Bot : le 20 nov., une vérification de relances n’a pas tourné, faute d’usage disponible. Si le quota est épuisé le lundi matin, remettre dès que possible le même jour et alerter le CEO ; ne pas acheter de quota.

### Décisions CEO

1. Approuver ce gabarit et le propriétaire (COO en intérim Chief of Staff, ou nommer le Chief of Staff).
2. Approuver le lieu de dépôt et le canal de remise (fil Office uniquement, sauf instruction contraire).
3. Décider **plus tard**, et séparément, si une routine doit être créée (proposition ci-dessous). **Ne pas la créer** tant que ce n’est pas demandé explicitement.
4. Toute diffusion hors du fil Office (e-mail, partenaires, publication).

## Preuves attendues

- Fichier markdown du rapport S2, horodaté, gabarit respecté.
- Présentation dans le fil Office le 30 nov. à 9 h (ou heure réelle de remise, déclarée).
- Liste des sources. Champs vides explicitement « non mesuré ».

## Points d’approbation CEO — avant tout envoi ou publication

- La remise dans le fil Office à Philippe n’est pas un « envoi externe ». Tout autre canal (courriel, réseau, site, partenaire) exige une approbation distincte, avec destinataire et texte.
- Aucune routine n’est créée sans ordre explicite.
- Aucun chiffre de performance d’agent ou de campagne n’est publié à l’extérieur.

## Ce qui reste bloqué

| Blocage | Effet | Levée |
|---|---|---|
| Chief of Staff non pourvu | Intérim COO ; pas de séparation rédacteur / relecteur | Nomination |
| Semaine 23–29 nov. non close au moment de ce plan | Le S2 ne peut pas encore être rempli honnêtement | Attendre le 29 nov. 18 h |
| Identités GitHub non séparées | Performance par agent « non mesurable » sur les PR | Décision de séparation des identités (hors cette mission) |
| Roster HQ non lu le 23 nov. (403 / 1010) | Disponibilité « live » du bureau non mesurée par cette voie | Lecture ultérieure avec un moyen autorisé, sans réessayer la signature bannie |
| Archive Codex 5.1 non reçue | Section Codex = « non reçu », pas « refusé » ni « validé » | Réception selon le protocole |
| Proposition de routine non autorisée | Pas d’exécution automatique le lundi | Ordre distinct de Philippe |

## Proposition de routine (texte seulement — non créée)

Cette section est une **proposition**. Aucune routine, aucun automatisme, aucun agent n’a été créé.

- **Nom proposé :** Rapport stratégique hebdomadaire CEO
- **Propriétaire :** Office Klirline · Ops Klirline (intérim Chief of Staff), jusqu’à transfert
- **Cadence :** chaque lundi à 9 h 00, fuseau America/Toronto
- **Fenêtre de collecte :** du lundi précédent 0 h 00 au dimanche 23 h 59 (America/Toronto) ; contributions attendues avant le dimanche 18 h
- **Déclencheur :** rappel interne au propriétaire. Pas de création automatique de commande HQ. Pas d’e-mail automatique.
- **Actions autorisées à la routine, si elle était un jour créée :** rassembler les chemins de fichiers déjà locaux, ouvrir le gabarit, rappeler au propriétaire de rédiger, éventuellement déposer un canevas vide daté dans le dossier local.
- **Actions interdites à la routine :** envoyer un courriel ou un message externe ; publier ; fusionner ; déployer ; écrire un état de commande HQ ; dépenser ; relancer une mission pilote ; inventer des chiffres en cas de source manquante ; relancer un GET déjà refusé (1010 / « do not retry ») ; afficher un secret.
- **Si le quota Grok Bot (ou autre) est épuisé :** ne pas acheter de capacité ; inscrire l’incident dans le rapport suivant ; avertir Philippe dans le fil Office dès que l’usage reprend, ou par le canal d’alerte prévu dans `continuite-operationnelle.md`.
- **Si le propriétaire est indisponible :** suppléance COO si le propriétaire a été transféré au Chief of Staff ; si le COO est lui-même le propriétaire et est indisponible, alerter le CEO (le rapport glisse, il n’est pas rédigé par un agent non qualifié).
- **Création :** uniquement après ordre explicite de Philippe, portant sur ce texte (ou une version qu’il aura corrigée). Jusque-là, le lundi 30 nov. est assuré **manuellement**.

## Interdits

- Ne pas rédiger le S2 avant la fin de la période (pas de faits anticipés).
- Ne pas créer la routine.
- Aucun envoi externe automatique.
- Ne pas présenter des données simulées comme des résultats de production.
- Ne pas permettre à un agent de modifier sa propre évaluation définitive.
- Ne pas exposer de clés, jetons ou données personnelles dans le rapport.
