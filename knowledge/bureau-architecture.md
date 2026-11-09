# Bureau numérique — architecture retenue

État lu dans le dépôt le 5 novembre 2026. Rien ici n'a été déployé.

## Ce qui existe vraiment

| Capacité | État |
| --- | --- |
| Interface du centre (`public/`, `src/server.js`, `src/worker.js`) | Opérationnelle en local. En ligne, le Worker Cloudflare sert `centre.klirline.com`. |
| 34 postes de démonstration (`src/org/`, `POST /api/command`) | Opérationnels comme simulation. Aucun message ne part. |
| Bureau HQ, 15 cartes (`src/hq/roster.js`, `/api/hq/*`) | Opérationnel pour enregistrer, réclamer et clore une commande. |
| Authentification humaine | En ligne : Cloudflare Access, jeton `Cf-Access-Jwt-Assertion`, rôle pris dans `ACCESS_ACCOUNTS`. En local : le menu annonce un rôle, il ne connecte personne. |
| Authentification des agents | Absente. Le Worker n'appelle aucun agent. |
| Exécution d'un agent | Absente. `executable` est faux sur chaque carte. |
| KlirProspect | Lecture possible seulement si `PROSPECTS_READ_TOKEN` est posé hors du dépôt. Pas d'écriture. |
| Messagerie, calendrier, GitHub, envoi social | Absents. Les canaux d'envoi répondent `403`. |
| Retour headless Access | Le SSO humain protège `/api/*` hors santé, sites et playbooks. Un jeton de service machine n'est pas configuré. |

Le rapport qui annonçait 14 cartes ne correspond pas au code : `HQ_ROSTER` contient 15 identifiants. Office et Ops sont deux cartes. Les deux cartes de trading sont dans la liste et hors du premier parcours.

Une carte, un statut ou une dernière commande ne prouvent pas qu'un agent a travaillé. La seule activité réelle affichée est la date d'une commande réellement écrite.

## Choix

Compléter l'orchestration déjà dans le Worker. Ne pas connecter Paperclip. Ne pas migrer.

Paperclip (dépôt `paperclipai/paperclip`, licence MIT, README lu le 5 novembre 2026) est un serveur Node distinct, avec sa propre interface, PostgreSQL embarqué, et des agents réveillés par heartbeat. Le développement demande Node 24.11+, pnpm 9.15+, et souvent un binaire Rust ou Docker. Le faire tourner à côté du centre créerait un second gestionnaire de tâches, un second hébergement et une seconde frontière d'identité. Le Worker ne peut pas garder une requête ouverte pendant qu'un agent travaille longtemps.

Principes retenus, sans le produit : un objectif, un propriétaire, un plafond de dépense, une validation distincte de l'auteur, un bail au lieu d'une boucle, un journal, des compétences non chargées dans chaque agent.

Le coût de ce choix : les agents ne s'exécutent pas encore. Le coût évité : un second système à exploiter avant d'avoir un moteur branché.

## Séparation

- Organisation : 34 postes pour la journée de démonstration ; 15 cartes HQ pour le bureau réel, avec supérieur, rôle et compétences consultatives.
- Travail : une mission (`/api/hq/missions`) possède des tâches, des livrables et une validation. Les commandes HQ restent l'état technique d'une prise en charge.
- Exécution : absente. Démarrer une tâche crée une commande et la réclame. Personne n'est appelé.
- Contrôle : transitions refusées côté serveur, plafond à 0 $, trois tentatives, bail de 15 minutes, auteur ≠ validateur.
- Connaissances : `knowledge/` pour les procédures internes. Le registre `/api/hq/skills` pointe des sources externes sans les copier et sans les activer.

KlirProspect reste la source des fiches réelles. Les dossiers `cli-atelier-nord` et `cli-reserve` sont fictifs et servent à l'isolation.

## Premier parcours

`POST /api/hq/missions` avec `{ "template": "klirprospect-demos" }` ouvre la campagne « cinq démonstrations de KlirProspect ». Les livrables sont des textes déposés à la main. Le résultat attendu est un dossier préparé. `demosBooked` reste 0. Un texte qui compte des démonstrations réservées est refusé.

## Access

Le SSO humain n'est pas retiré. Aucune route nouvelle n'est publique. Un futur jeton de service devra être distinct du compte de Philippe et ne pas donner les droits du CEO à tous les agents. Ce dépôt ne crée pas cette policy.
