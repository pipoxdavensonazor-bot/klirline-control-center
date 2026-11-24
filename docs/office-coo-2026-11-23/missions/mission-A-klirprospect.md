# Mission A — Développement commercial KlirProspect

- **Identifiant :** mission-A-klirprospect
- **Préparé par :** Office Klirline · Ops Klirline (COO), le 23 novembre 2026, soir (America/Toronto).
- **Nature :** plan de mission pilote. Aucun envoi, aucune publication, aucune fusion, aucun déploiement, aucun appel payant. Budget 0 $.
- **Règle d’objectif :** un objectif = un agent propriétaire + un critère mesurable + une échéance.

## Sources consultées (aucune donnée inventée)

Le chemin `/bot/workstream/klirprospect-commercial-pilot` est **absent** de cette box. Aucun dossier nommé « OKOK-1 » n’a été trouvé. Les fichiers existants correspondant au dossier de prospection « agences web Québec » ont été utilisés à la place :

| Fichier | Date / constat |
|---|---|
| `/workspace/sales-center/rapport-prospection-klirprospect-qc.md` et `prospects-klirprospect-qc.csv` | 22 nov. 2026 : 30 agences web vérifiées (sites vivants), 6 exclues. Aucun courriel envoyé ce jour-là. |
| `/workspace/klirprospect-pilote/lancement/` (suivi, relances, vague 1 et 2) | Invitations vague 1 envoyées par Philippe le 16 nov. |
| `/workspace/klirprospect-pilote/lancement/relances-1-2026-11-22.md` | Relances 1 rédigées le 22 nov. ; rien envoyé par l’agent. |
| `/workspace/klirprospect-pilote/rapports/rapport-S1-2026-11-23.md` | S1 (16–22 nov.), rédigé le 23 nov. à 9 h 20. |
| `/workspace/klirprospect-pilote/go-nogo/rapport-go-nogo-2026-11.md` | Audit GO/NO-GO, mises à jour jusqu’au 23 nov. à 0 h 44. |
| `/workspace/klirprospect-pilote/go-nogo/script-demo-15min.md` | Script de démo 15 min, fondé sur des fonctions vérifiées le 23 nov. |
| `/workspace/klirprospect-pilote/modeles/` (dont 03, 09, 10) | Modèles d’invitation, consentement, rapport hebdo pilote. |
| `/workspace/klirprospect-pilote/juridique/courriel-avocat-brouillon.md` | Brouillon de devis avocat, non envoyé. |
| `/workspace/klirprospect-pilote/neq/verification-registre-15-nov.md` | Guide de vérification NEQ ; **résultat non consigné**. |
| `/workspace/hq2/audit-independant-2026-11-23.md` | Audit HQ du 23 nov., 18 h–18 h 30. |

## Agent propriétaire

**KlirProspect** (agent existant sur la box, profil `4a1aba88-b927-4b54-a4b8-975c25c3d18e`), dans le rôle cible « agent commercial KlirProspect ».

Le poste « directeur commercial » (prioritaire) **n’a pas d’agent distinct existant**. Tant qu’il n’est pas pourvu, le COO (Office Klirline · Ops Klirline) assure la coordination et le contrôle, sans se substituer au propriétaire pour l’exécution. Philippe reste l’unique expéditeur et l’autorité d’approbation.

## Agents contributeurs

| Rôle / agent | Contribution | Limite |
|---|---|---|
| Office Klirline · Ops Klirline (COO) | Coordination, contrôle LCAP, consolidation du suivi, alerte au CEO | N’envoie rien, ne fusionne rien |
| Directeur commercial (poste non pourvu) | Qualification et priorisation, une fois le poste activé | — |
| Ingénieur QA / responsable sécurité (postes non pourvus) | Relecture du script de démo et des textes au regard des P1 restants | Pas de modification de production |
| Klirline AI | Aucun envoi ; éventuellement un appui de rédaction interne si demandé, sans citer de tarif non confirmé | Pas propriétaire |
| Codex (CTO) | Uniquement si un correctif produit est requis (branche / PR brouillon) | Pas de fusion ni déploiement sans autorisation distincte |

Agents existants **non sollicités** pour cette mission, afin d’éviter les chevauchements : Klirline Social, YouTube Channel, BWN Rédaction, Black wall news, KlirMarket, KlirBuild, NORIA, Kontak, Sandbox Klirline, All Question.

## Objectif, critère de réussite et échéance (un seul trio)

**Objectif :** rendre KlirProspect prêt à tenir des démonstrations supervisées auprès de petites agences web du Québec, sans prospection ni offre payante tant que les conditions du CEO ne sont pas remplies.

**Critère mesurable (préparation, d’ici l’échéance) :** un dossier d’étape unique est remis, qui contient **tous** les éléments suivants, et seulement des faits sourcés :

1. Suivi vague 1 à jour (`lancement/suivi-reponses.csv`) selon les confirmations d’envoi réellement fournies par Philippe (relances 1 : envoyées ou non ; dates).
2. Script de démo 15 min **révisé** pour tenir compte des fusions du 23 nov. (PR #83 et #84) : fonctions montrables vs interdites en démo, plus de consigne « si la PR #83 n’est pas fusionnée ».
3. Liste prioritaire d’agences web tirée du dossier du 22 nov. (30 fiches), avec le statut LCAP/CASL **tel qu’écrit dans le CSV**, sans nouvel envoi.
4. Compte rendu des blocages encore ouverts (prix/paiement, LCAP applicatif, NEQ, avocat, menus simulés).
5. Proposition de créneaux de démo (calendrier interne seulement), **sans les avoir envoyés**.

**Échéance proposée :** lundi 30 novembre 2026, 18 h (America/Toronto).

Les démos tenues, les nouvelles invitations et toute offre tarifaire sont des **objectifs conditionnels**, hors critère de succès de cette phase, tant que Philippe n’a pas tranché les décisions listées plus bas.

## Contexte factuel à respecter

### Deux listes distinctes (ne pas les fusionner)

**Vague 1 / vague 2 du pilote 28 jours** (`klirprospect-pilote/lancement/`) — invitations déjà autorisées le 14 nov., envoyées le 16 nov. par Philippe depuis `[courriel caviardé]` (12 h 47–12 h 48, America/Toronto) :

- prospect M02 : réponse « non » le 17 nov. à 9 h 17 ; Philippe a répondu à 9 h 35 ; statut `abandon` ; pas de désabonnement ; **aucune relance**.
- prospect M03, prospect M05, prospect M07, prospect M09 : statut `envoyee`, sans réponse au 23 nov. 9 h 20. Relances 1 rédigées le 22 nov. ; le rapport S1 indique qu’elles ont été **approuvées le 22 nov. à 23 h 59** et restent **en attente de confirmation d’envoi par Philippe**. Relance 2 prévue le 27 nov., seulement pour celles toujours sans réponse, et seulement après approbation.
- Vague 2 (prospect Q02, prospect Q01, prospect M04, prospect M08, prospect M10) : statut `a_inviter`. **Pas d’envoi sans décision de Philippe.**

Le suivi clients C1–C5 du pilote 28 jours reste vide au 23 nov. 9 h 20 : 0 entreprise activée, 0 démo, 0 consentement écrit, 0 Starter payant (objectifs G1–G4 du modèle 10).

**Dossier du 22 nov. — 30 agences web du Québec** (`/workspace/sales-center/`) : recherche documentaire publique seulement. Aucun envoi. Répartition : Laval 6, Montréal / Grand Montréal 18, Québec et région 6. 25 courriels professionnels publiés trouvés, 5 fiches avec formulaire seulement.

Classement du rapport (score = taille apparente et adéquation, **pas** un besoin confirmé). Top 10 : PW3 Design, Experts NetWeb, NEXUS AGENCE, Molveau Studio, Freelance Niko, Umani Web, WebMTL, Lumenia, SideMerge, AgenceNord. Une note d’Office antérieure citait un « top 5 » (Experts NetWeb, Molveau Studio, Freelance Niko, Umani Web, Lumenia) : ce n’est **pas** le classement intégral du rapport ; le rapport du 22 nov. fait foi.

### Offre, prix et paiement

Consigne en vigueur du CEO (23 nov.) : **tant que les prix et le paiement de KlirProspect ne sont pas confirmés, n’offrir que des démonstrations.** Ne pas présenter 19 $ CA/mois ni 200 crédits comme offre officielle confirmée par Philippe dans cette mission.

Faits techniques déjà consignés, à ne pas confondre avec une confirmation CEO :

- Le 22 nov., le site public disait encore que le pilote payant était fermé et que le prix restait à définir ; le guide `/guide` répondait 404 ; un texte AI Lounge du 15 nov. mentionnait 19 $ CA/mois et 200 crédits, **non repris alors sur le site** (`rapport-prospection-klirprospect-qc.md`).
- Le rapport GO/NO-GO du 23 nov. (0 h 30) constatait une offre contradictoire (P0-1) et un plafond navigateur de 10 recherches même pour Starter (P0-2). Verdict initial : **NO-GO pour vendre** avec le site tel qu’il était, GO conditionnel après fusion.
- Mises à jour du même rapport : PR #83 fusionnée (squash `679910b`, déployée vers 0 h 33) puis PR #84 (squash `03b08d3`, fusion approuvée par Philippe à 0 h 41, `build.json` Prod à 0 h 42). Les textes « pilote payant fermé » ont disparu des pages publiques ; `/guide` et `/tarifs` redirigent. Des restes P1 sont documentés (LCAP applicatif incomplet, menus simulés, etc.).
- En lecture Prod antérieure au rapport : facturation en `mode=live`, `checkout_enabled=true` depuis le 14 nov. ; offre `starter_month` à 1 900 ¢ ; **aucun client payant** au moment de cet audit (2 comptes gratuits ; un Starter live souscrit le 14 nov. puis revenu à Gratuit le 19 nov., « sans doute un test de Philippe, à confirmer »).

Ces faits techniques **ne lèvent pas** l’interdiction d’offrir un tarif tant que Philippe n’a pas confirmé explicitement prix et paiement pour l’usage commercial.

Les invitations du 16 nov. portaient un pilote de 4 semaines **sans frais** (objets des courriels). C’est cohérent avec « démos seulement ».

### LCAP / CASL

- Le rapport du 22 nov. précise : une adresse publiée, en lien avec le rôle, sans mention de refus, peut fonder un *consentement implicite possible*. Ce n’est **pas** une autorisation d’envoyer. Un formulaire seul = consentement à obtenir. Un examen juridique reste nécessaire avant tout premier envoi. Ce rapport n’est pas un avis juridique.
- Consigne CEO : **aucune prospection commerciale sans conformité LCAP vérifiée et approbation explicite de Philippe.**
- Dans le produit, après la PR #83 : pied LCAP/CASL dans les brouillons (identifiant, champ `[adresse postale]` à compléter, « Répondez STOP »). Il reste : (1) une mise en garde dans l’application sur la responsabilité du consentement ; (2) la liste `email_optouts` est vide et n’est pas branchée sur les brouillons (P1-2 du GO/NO-GO).
- Courriel avocat : brouillon prêt, **non envoyé**, en attente d’approbation. NEQ : guide rédigé ; **résultat de la recherche au Registraire non consigné** (S1 : « Avocat / NEQ toujours en suspens »).

### Démo : fonctions vérifiées vs interdites

Le script du 23 nov. n’autorise que des fonctions réellement vérifiées. Ne pas montrer en démo : Campaigns, Sales Copilot, Klir Web AI, Proposals, Intégrations, radar (fonctions simulées ou non vérifiées — P1-3, risque de représentation trompeuse). Le script doit être révisé : la consigne « si la PR #83 n’est pas encore fusionnée » est devenue caduque après les fusions du 23 nov. à 0 h 32 et 0 h 41.

## Étapes (toutes locales ou sous approbation CEO)

| # | Étape | Responsable | Livrable | Envoi / prod |
|---|---|---|---|---|
| A1 | Mettre à jour le suivi vague 1 dès que Philippe confirme l’envoi (ou le non-envoi) des 4 relances 1 | KlirProspect | `suivi-reponses.csv` + note datée | L’envoi, s’il a lieu, est fait **par Philippe seulement** |
| A2 | Réviser le script de démo 15 min (après les PR #83 et #84) et la liste des interdits | KlirProspect, relecture COO | Script révisé, copie locale datée | Aucun |
| A3 | Préparer (sans envoyer) la relance 2 du 27 nov. pour les entreprises toujours sans réponse, avec mention de désabonnement LCAP | KlirProspect | Brouillons, une entreprise à la fois | Envoi seulement après approbation individuelle |
| A4 | Tenir la liste des 30 agences : revérifier le jour d’un éventuel envoi futur (pages pouvant changer) ; ne pas envoyer | KlirProspect | Annotation du CSV ou note d’écarts | Interdit sans LCAP + approbation |
| A5 | Préparer le compte de démo (compte de Philippe, données fictives à l’écran) et 2 créneaux internes par jour ouvré, semaines du 24 nov. et du 1er déc. | KlirProspect | Calendrier interne proposé | Aucun envoi de créneau au prospect sans OK |
| A6 | Remettre le dossier d’étape du 30 nov. (critère de succès) | KlirProspect, consolidation COO | Rapport d’étape factuel | Remise au CEO dans le fil Office, pas d’envoi externe |
| A7 | Si une entreprise accepte une démo (réponse entrante déjà autorisée ou nouvel échange approuvé) : tenir la démo selon le script, faire signer le consentement (modèle 09) avant toute mesure d’usage | KlirProspect ; Philippe pour l’envoi du formulaire et la tenue si besoin | Suivi C1–C5 renseigné | Pas d’offre tarifaire tant que non confirmée |

Aucune étape ne crée de routine, d’agent ou de compétence nouvelle.

## Dépendances

### Techniques

- Site Prod KlirProspect (`klirprospect.klirline.ca`) et moteur de recherche : derniers faits au 23 nov. 0 h 44 (`build.json` = `03b08d3`). Cette mission n’a pas rejoué la recette Prod.
- Restes documentés à traiter **hors envoi** : P1-2 LCAP applicatif, P1-3 menus simulés, P1-5 langue (libellés anglais), P2-1 écart sur des liens de paiement (détail non publié), recette mot de passe non terminée (429 sur Test). Toute correction = branche / PR brouillon, **pas de fusion sans autorisation**.
- Hub HQ (`centre.klirline.com`) : faiblesses de sécurité et de fiabilité ouvertes (P0/P1, détails non publiés : dépôt public, correctifs non livrés). Cette mission **n’écrit pas** d’état HQ en production.
- Budget 0 $ : aucun appel de modèle payant, aucun paiement Stripe réel, aucune dépense d’immatriculation.

### Décisions CEO (bloquantes ou conditionnelles)

Voir la section « Points d’approbation CEO ». Tant qu’elles ne sont pas prises, les étapes A3 (envoi), A4 (envoi), A7 (si nouvel outbound) et toute mention de tarif restent arrêtées.

## Preuves attendues

- Fichiers de suivi datés (`suivi-reponses.csv`, rapport d’étape du 30 nov.).
- Script de démo révisé, avec date et liste des fonctions montrées / interdites.
- Copie des brouillons (relance 2, éventuels messages du dossier du 22 nov.) portant mention d’identification et de désabonnement, **non envoyés** tant que non approuvés.
- Aucune trace d’envoi initié par un agent (pas de brouillon de messagerie créé par l’agent, conformément à la pratique des relances du 22 nov.).
- Si une démo a lieu : date, identifiant d’entreprise, consentement écrit oui/non, fonctions effectivement montrées, incidents éventuels — sans coller de données CRM nominatives dans un canal non autorisé.

## Points d’approbation CEO — explicites, avant tout envoi ou publication

Aucun agent n’envoie de courriel, SMS, message de réseau social, formulaire de contact, ni ne publie quoi que ce soit.

1. **Confirmer si les 4 relances 1** (prospect M03, prospect M05, prospect M07, prospect M09) ont été envoyées par Philippe après le 22 nov. 23 h 59, avec dates, afin de mettre à jour le suivi. Si elles n’ont pas été envoyées : décider de les envoyer ou de les retirer, **une par une**, depuis `[courriel caviardé]`, dans le fil d’origine.
2. **Autoriser ou interdire la relance 2 du 27 nov.**, uniquement pour les entreprises encore sans réponse, textes relus le jour même (mention de refus sur le site ?).
3. **Vague 2 :** envoyer ou non ; le déclencheur autrefois proposé (« moins de 3 oui au 20 nov. ») est déjà dépassé (0 acceptation, 1 refus au 23 nov.) — une décision nouvelle est requise.
4. **Dossier des 30 agences du 22 nov. :** aucun premier envoi sans (a) confirmation que la base LCAP de chaque fiche a été revue, et (b) approbation individuelle du message. Un examen juridique demeure recommandé (brouillon avocat en attente).
5. **Confirmer ou non les prix et le parcours de paiement** (Starter et autres). Tant que ce n’est pas confirmé : démos seulement, aucun 19 $/mois ni 200 crédits présentés comme offre en vigueur dans un message sortant.
6. **NEQ** : consigner le résultat de la recherche au Registraire (à faire par Philippe ; les outils automatiques sont bloqués). Ne rien payer (397 $ ou 595,50 $) sans autorisation distincte.
7. **Courriel de devis à l’avocat** : approuver le destinataire et l’envoi, ou reporter.
8. Toute **fusion**, migration, désactivation de Payment Links live, ou écriture Stripe / production.
9. Toute **création de routine** de relance (une tentative prévue le 20 nov. n’a pas tourné, faute d’usage Grok Bot ce jour-là). Cette mission n’en crée aucune.

## Ce qui reste bloqué

| Blocage | Effet | Levée |
|---|---|---|
| Prix / paiement non confirmés par le CEO | Interdiction d’offrir un tarif ou d’ouvrir un parcours payant dans la conversation commerciale | Décision explicite de Philippe |
| Conformité LCAP non close (avis juridique non obtenu ; `email_optouts` non branchée ; adresse postale à compléter dans les pieds de brouillons produit) | Pas de nouvelle prospection outbound | Avis + approbation par fiche |
| Relances 1 : envoi non confirmé dans le suivi au 23 nov. 9 h 20 | Incertitude sur l’état réel des 4 fils | Confirmation de Philippe |
| Vague 2 et liste des 30 : pas d’autorisation d’envoi | Aucun contact nouveau | Décision CEO |
| NEQ non consigné ; devis avocat non envoyé | Risque juridique et d’immatriculation non tranché | Actions 6 et 7 ci-dessus |
| C1–C5 vides ; 0 démo tenue | Le pilote 28 jours n’a pas démarré du côté clients | Acceptation de démo + consentement |
| P1 produit restants (menus simulés, langue, recette mot de passe, écart sur des liens de paiement (détail non publié)) | Contraintes pour la démo et pour une éventuelle vente ultérieure | Correctifs + autorisations |
| HQ 2.0 en NO-GO autonomie (audit 23 nov.) | Pas d’orchestration automatique de cette mission via le distributeur | Voir `continuite-operationnelle.md` |
| Poste de directeur commercial non pourvu | Pas de supérieur commercial distinct | Activation du poste ou intérim assumé par le COO / le CEO |

## Interdits (rappel)

- Aucun envoi externe automatique.
- Aucune création de routine, d’agent ou de compétence.
- Aucune modification de production, GitHub, Cloudflare ou secrets.
- Aucun appel payant. Budget 0 $.
- Ne pas inventer de fonction, de besoin client, de consentement, de tarif confirmé, ni de résultat de test.
- Ne pas relancer prospect M02.
- Ne pas utiliser de courriels nominatifs non retenus dans les dossiers, ni d’adresses trouvées seulement dans un répertoire tiers.
- Ne pas prétendre avoir consulté le workstream `/bot/workstream/klirprospect-commercial-pilot` : il est absent de la box.
