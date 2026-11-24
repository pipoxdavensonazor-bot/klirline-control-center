# Procédures inter-départements — Klirline Office

**Établi le :** 23 novembre 2026, 21:17 America/Toronto (UTC-5)  
**Auteur :** COO  
**Portée :** procédures écrites seulement. Aucun envoi à un agent, aucune routine créée ou modifiée, aucun PATCH HQ.

## Skills Klirline lues (fichiers)

Chemins lus le 23 nov. 2026, America/Toronto :

| Skill | Fichier | Verdict dans ce chantier |
| --- | --- | --- |
| Handoff agent Klirline | `/home/box/agent-data/workflows/handoff-agent-klirline/SKILL.md` | **Adaptée et vérifiée comme procédure** (texte cohérent, critère de succès clair). Non exécutée ici (aucun SendToAgent). |
| Exécuter un objectif Klirline | `/home/box/agent-data/workflows/ex-cuter-un-objectif-klirline/SKILL.md` | **Adaptée et vérifiée comme procédure**. Référence encore la carte bureau / objectifs O1–O5 en mémoire partagée, pas le registre 36 postes : à aligner plus tard, sans modifier la skill aujourd'hui. |
| Pont HQ centre → agents | `/home/box/agent-data/workflows/pont-hq-centre-agents/SKILL.md` | **Adaptée**, partiellement vérifiée. La routine « Poll commandes HQ centre » (~30 exécutions/semaine sur l'usage 30 j du COO) montre que le pont est déjà utilisé. En revanche, le `GET /api/hq/roster` tenté depuis cette box le 23 nov. 2026 à 21:16 America/Toronto a renvoyé **403 Cloudflare 1010** ; non relancé. Aucun claim/PATCH dans ce chantier. |
| Vérifier admin produit Klirline | `/home/box/agent-data/workflows/v-rifier-admin-produit-klirline/SKILL.md` | **Adaptée et vérifiée comme procédure de diagnostic**. Aucun panneau admin n'a été ouvert ici. |

Ces skills sont réutilisables. Elles ne créent pas à elles seules les 36 postes, le distributeur V2, ni une exécution autonome.

## Principes de handoff

1. **Un objectif, un owner, un critère de succès, une échéance** (skill « Exécuter un objectif »).
2. **Un seul propriétaire** à la fois. Les autres aident seulement après brief (skill « Handoff »).
3. Le brief contient : contexte, déjà fait, reste à faire, fichiers/URLs, bloqueurs, id de commande HQ s'il y en a une, règle de write-back (`done` seulement avec preuve).
4. L'agent qui n'est pas orchestrateur remet le brief au COO ou au CEO ; il n'invente pas un accès à un chat.
5. Après handoff, on n'exécute plus hors périmètre, sauf demande explicite du CEO.
6. **Aucun envoi externe, merge, déploiement, rotation de secret ou dépense** sans autorisation distincte du CEO.
7. Le Worker du centre n'appelle aucun agent. Les commandes se tirent (poll) puis se réécrivent (skill « Pont HQ »).
8. `/api/command` (sans `hq`) est la démo des 34 postes : ne pas s'en servir pour le bureau réel.

## Chaînes de relais (par paire de départements)

### Direction (CoS / chef de projet / analyste) ↔ tous

- Le Chief of Staff (vacant) tiendra le tableau des missions. En intérim, le COO suit, sans s'auto-approuver.
- Une demande CEO arrive au COO ou au CoS, est normalisée, puis assignée à un poste (pourvu) ou signalée « vacant / bloqué ».
- Le rapport hebdomadaire (mission pilote C) : analyste (inputs) → CoS (synthèse) → CEO. Tant que CoS et analyste sont vacants, le COO peut **préparer** le canevas, pas le présenter comme un rapport de CoS.

### COO ↔ CTO (Codex)

- Codex livre sur branches et PR brouillon.
- Le COO relit les preuves (tests, diffs, conformité HQ 2.0) et émet un avis. **Cet avis n'est pas une approbation humaine.**
- QA (vacant) devrait rejouer les tests ; en attendant, le COO dit ce qu'il a réellement relancé et ce qu'il n'a pas relancé.
- Merge et déploiement : CEO seulement.

### Ventes ↔ Produit (mission pilote A, KlirProspect)

1. Directeur commercial (vacant) cadre le segment et la file.
2. Prospecteur (vacant) prépare les listes, **sans envoi**.
3. Responsable KlirProspect fournit les faits produit (limites, essais, ce qui est vraiment en ligne).
4. Agent commercial prépare les dossiers de démo et les brouillons.
5. Conformité (vacante) et CEO autorisent tout envoi.
6. Customer Success n'intervient qu'avec un client réel (aucun n'est prouvé à ce jour).
- Tant que directeur et agent commercial sont vacants : pas de campagne. KlirProspect peut préparer des dossiers produit, pas s'auto-autoriser un envoi.

### Marketing ↔ Produit (mission pilote B, Klir IA)

1. Directeur marketing (vacant) cadre la campagne.
2. Responsable produit Klirline AI (agent dormant sur 7 j) fournit les faits produit, sans publier.
3. Rédacteur et designer (vacants) préparent textes et visuels.
4. Responsable réseaux sociaux (Klirline Social, actif, rattachement à confirmer) prépare le calendrier et les brouillons de posts.
5. Publication : CEO. Social signale les sessions manquantes (Facebook Page déjà rapportée déconnectée) au lieu de contourner.
- YouTube et BWN ne sont pas les canaux par défaut de cette campagne, sauf brief écrit.

### Marketing / média (cellule hors 36)

- Textes BWN : BWN Rédaction, si réveillée ; à défaut Black wall news, qui assume aujourd'hui les deux rôles (à noter, pas à officialiser silencieusement).
- Publication BWN : Black wall news, après les règles déjà posées par le CEO sur X/Facebook/LinkedIn.
- Social n'édite pas la ligne éditoriale BWN. BWN ne gère pas les comptes @klirlineofficial, sauf partenariat explicitement cadré.

### Technologie ↔ Produit

- Correctif dans le dépôt d'un produit : owner = responsable de ce produit.
- Un autre agent peut proposer une branche / PR **non fusionnée**, après handoff (exemple déjà observé : KlirMarket aide KlirBuild sur une alerte store, PR #81 non fusionnée).
- Standards, CI transverse, HQ 2.0 : CTO. DevOps (vacant) prépare, ne déploie pas.

### Sécurité / QA / conformité ↔ tous

- Toute PR sensible : avis sécurité (poste vacant → constat COO, approbation CEO).
- Tests d'usurpation et de récupération : ingénieur QA, environnements autorisés seulement, non destructifs, pas de production comme cible d'attaque.
- Avant un envoi : responsable conformité (vacant) + CEO. Le COO n'invente pas une base LCAP.

### Finance ↔ tous

- Plafond 0 $ tant que le CEO n'en décide autrement.
- Contrôleur des coûts (vacant) : en intérim, le COO signale le quota (73,9 % du plafond hebdomadaire Grok Bot au 23 nov. 2026 ; remise à zéro le **27 nov. 2026 à 20:12 America/Toronto**).
- Aucun paiement, avoir, lien tarifaire ou contrat sans le CEO (y compris les liens de paiement KlirProspect encore actifs, déjà signalés par l'agent produit).

### Support ↔ Produit

- Ticket : agent support (vacant) diagnostique, responsable produit corrige, responsable support valide un éventuel message sortant.
- Accès admin : skill « Vérifier admin produit ». Échec Access ≠ échec applicatif.
- All Question oriente, ne clôt pas un incident produit.

### Trading (hors bureau commercial)

- Aucun handoff des missions A/B/C vers IC MARKET ou CMCMarkets.
- Un sujet trading reste dans la division Trading, escalade directe au CEO si besoin (déjà le `reportsTo` du roster).

## Commandes HQ (pont)

Ordre attendu, déjà décrit par la skill et `knowledge/hq-bureau.md` : `pending`/`queued` → `dispatched` → `running` → `done` (avec preuve) ou `blocked`/`failed`. `cancelled` et les reprises hors bail sont des actes cadrés ; **aucune modification de commande de production dans ce chantier**.

Si le poll ou le roster API est inaccessible depuis une box (cas 403/1010 aujourd'hui), on le déclare, on n'invente pas l'état live, et on n'essaie pas de contourner Access.

## Modèle de brief (à copier)

```
De : <poste ou agent>
Vers : <poste ou agent owner>
Objectif (une phrase) :
Critère de succès mesurable :
Échéance (fuseau America/Toronto) :
Déjà fait (preuves, chemins, URLs) :
Reste à faire :
Interdits applicables :
Commande HQ (id) si existante :
Write-back attendu : done + preuve, ou blocked + raison
```
