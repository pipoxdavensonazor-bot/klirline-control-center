# Klirline Inc. — centre de contrôle

MVP local de l'entreprise virtuelle. Philippe Azor reste le CEO. Chaque agent a un poste, un supérieur, des compétences et des playbooks utilisables sans réseau. Les suivis courriel et téléphone sont préparés par l'agent relance, validés par la directrice commerciale, puis consignés. Rien n'est envoyé, appelé, payé ou publié à l'extérieur.

## Lancer

```bash
node src/server.js
```

Puis ouvrir `http://127.0.0.1:4173`.

Le même centre est publié sur `https://centre.klirline.com`. L'état de la journée de démonstration est conservé dans un Durable Object Cloudflare. Les chiffres restent un jeu de démonstration : aucun courriel, appel ou paiement ne part.

Vérifier la chaîne sans interface :

```bash
node src/self-check.js
```

## Ce que le MVP fait

- 34 postes : le CEO et 33 agents, huit responsables produit compris.
- Rapport du jour : à approuver, à surveiller, urgent, opportunités, résultats.
- Niveaux : autonome, supérieur du groupe, CEO après recommandation.
- Gel sécurité indépendant. L'appel sans base enregistrée ne se débloque pas.
- Lecture des huit plateformes pour tous. Écriture limitée au poste.

Les chiffres financiers et le barème sont un jeu de démonstration, pas une comptabilité réelle.

## Architecture

Le navigateur parle à `/api/*`. En local, `src/server.js` garde l'état dans `data/state.json` et reste en mode démonstration : le menu choisit un rôle, il ne connecte personne. En ligne, `src/worker.js` ne lit pas ce rôle. Il vérifie le jeton Cloudflare Access, prend le rôle dans `ACCESS_ACCOUNTS`, et ouvre seulement l'objet durable de l'`orgId` de ce compte. Les deux appellent `src/engine.js`. Les chiffres restent un jeu, même après la connexion.

## Cloudflare Access

Aucune valeur n'est fournie dans le dépôt. Tant que `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` ou `ACCESS_ACCOUNTS` manque, les routes du dossier d'entreprise répondent `503` et ignorent le rôle du navigateur. La santé, les pages publiques et les playbooks ne portent pas cet état.

À configurer dans Cloudflare, avec les vraies valeurs du compte, puis à poser comme secrets du Worker `klirline-control-center` :

| Secret | Valeur |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | Nom d'équipe déjà existant, de la forme `<équipe>.cloudflareaccess.com`, sans `https://` |
| `ACCESS_AUD` | Balise d'audience (AUD) de l'application Access qui protège `centre.klirline.com` |
| `ACCESS_ACCOUNTS` | JSON des comptes réellement autorisés |
| `ACCESS_SERVICE_CLIENT_IDS` | Facultatif. CSV des Client ID publics (suffixe `.access`) autorisés à interroger le bureau. Jamais le Client Secret. |

Forme de `ACCESS_ACCOUNTS`, sans exemple réel :

```json
[{ "email": "<courriel du compte Access>", "role": "<id de poste existant>", "orgId": "<identifiant d'organisation>" }]
```

`role` doit être un poste déjà défini, par exemple `ceo`. `orgId` est un slug (`klirline` pour l'organisation actuelle). Deux `orgId` distincts n'ouvrent pas le même objet durable. Le nom `api-rate` est réservé au compteur de requêtes.

Un JWT humain porte un courriel. Il est inchangé : le rôle vient de `ACCESS_ACCOUNTS`. Un JWT de jeton de service n'a pas de courriel. Cloudflare y met le Client ID dans `common_name` (suffixe `.access`, sujet vide, `type` `app`). Le Worker l'accepte seulement si ce Client ID est dans `ACCESS_SERVICE_CLIENT_IDS`. L'identité est alors la machine `service:hq-poll`, sur l'unique `orgId` de `ACCESS_ACCOUNTS`, et seulement pour `/api/hq/*`. Elle ne signe pas, ne recommence pas la journée, et n'ouvre pas le dossier de démonstration. Un Client ID absent de la liste, ou plusieurs `orgId` dans `ACCESS_ACCOUNTS`, répond `401`. Ce n'est pas un contournement d'Access : la signature, l'émetteur et l'audience restent vérifiés.

`ACCESS_SERVICE_CLIENT_IDS` ne contient pas de secret. Ne pas y mettre le Client Secret (il n'a pas le suffixe `.access` et serait ignoré). Ne pas l'écrire dans git. Le Client ID public déjà utilisé par le poll Office commence par `9e6fc590` et finit par `.access` : coller l'identifiant complet.

Après merge : poser `ACCESS_SERVICE_CLIENT_IDS` au Client ID public complet (`9e6fc590….access`), puis redéployer. Sans cette variable, les personnes continuent de passer par le courriel et le poll reste refusé. Une variable de Worker équivaut au secret ci-dessous. Ne pas y mettre le Client Secret.

```bash
npx wrangler secret put ACCESS_SERVICE_CLIENT_IDS
```

Étapes, à faire par l'opérateur :

1. Dans Cloudflare Zero Trust, créer une application Access auto-hébergée pour `centre.klirline.com` et une politique qui n'admet que les personnes voulues.
2. Copier le domaine d'équipe et la balise AUD de cette application.
3. Poser les secrets des comptes, par exemple `npx wrangler secret put ACCESS_TEAM_DOMAIN`. Ne pas les écrire dans git.
4. Pour le poll Office, poser `ACCESS_SERVICE_CLIENT_IDS` avec le Client ID public complet, puis redéployer. Ne pas y mettre le Client Secret.
5. Déployer seulement après cette configuration. Ce dépôt ne déploie pas et ne crée pas l'application Access.

## Limites des routes

Chaque route `/api/*` compte dans une fenêtre de 60 secondes et de 60 requêtes. La clé est l'adresse de connexion, puis le courriel vérifié pour les routes du dossier. Le poll machine compte à part, sous `service:hq-poll`. Le rôle et l'`orgId` n'entrent pas dans la clé. Un corps de plus de 32 Ko répond `413`. Un JSON illisible répond `400`. Un dépassement répond `429` avec `Retry-After`.

## Limites connues

- Le serveur local est une démonstration. Le menu ne connecte personne.
- Le worker publié ne change qu'au prochain déploiement. Avant les secrets Access, il refusera les routes du dossier.
- Une action « consignée » est une simulation. Aucun courriel, appel, paiement ou publication ne part.
- Les revenus, les dépenses, les factures ouvertes et les montants de propositions sont des colonnes distinctes d'un jeu. Aucune probabilité n'est inventée. Une proposition n'est pas un revenu.
- La charge des tâches compte les dossiers ouverts et gelés. Elle ne dit pas si un agent ou un serveur est disponible.
- « Page joignable » veut dire que la page d'accueil a répondu. Seuls KlirBuild (`/api/health`) et Klir IA (`/api/skills`, nombre seulement) ont une lecture plus précise. Black Wall News est sondé comme les autres sites.
- L'écran Plateformes contient un hub Admin produits, réservé au CEO. Neuf panneaux sont derrière Cloudflare Access et gardent leur lien : Klirline OS, KlirBuild, KlirPay, KlirMarket, KlirSecure, Centia, Klir IA, Black Wall News, NORIA (`https://noriaedu.com/app#admin`). KlirProspect reste en connexion publique (`https://klirprospect.klirline.ca/#/login`), pas derrière Access. KlirLead n'a pas de panneau. Le centre lui-même n'a pas de second lien. Le champ `access` (`public-login`, `cf-access`, `cf-challenge`, `none`) prépare l'affichage. Aucune application Access supplémentaire n'est créée ici.
- Klirline OS est lu sur https://klirline.ca, page d'accueil seulement. KlirMarket est lu sur https://klirline.com, page d'accueil seulement.
- Le compteur de requêtes vit dans l'objet `api-rate`. Il ne suit pas un changement de rôle ou d'organisation. Une autre adresse de connexion a sa propre fenêtre.

## Bureau réel

L'onglet Bureau enregistre des commandes hors du jeu des 34 postes. `POST /api/command` reste la démonstration. Le détail pour Office Klirline est dans `knowledge/hq-bureau.md`.

Office lit la file, distribue vers l'agent Grok nommé par `grokAgentName`, puis renvoie le statut. Le Worker n'appelle aucun agent. Un claim sur la même commande ne lance qu'une exécution : le second appel, pendant le bail, ne reçoit pas le jeton. Clore (`done`) exige un résultat, une preuve ou une note. Le détail est dans `knowledge/hq-bureau.md`.

Dans l'onglet Bureau, les cartes En cours et Bloqué envoient le même PATCH depuis le navigateur déjà authentifié. La colonne Fait affiche la preuve. Aucun jeton de service n'est ajouté.

Le jeton Cloudflare Access est obligatoire en ligne, comme pour les autres routes `/api` du dossier. L'exemple omet le vrai jeton.

```bash
curl -sS "https://centre.klirline.com/api/hq/commands?status=pending" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>"

curl -sS -X PATCH "https://centre.klirline.com/api/hq/commands/<id>" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"status":"done","result":"Fait","agentNote":"Office Klirline"}'
```

Vérifier le parcours en local : `node scripts/hq-flow.mjs`.

## Plus tard

Lecture des dossiers commerciaux, envoi, appel, paiement, publication. Ces branchements attendent un accès déjà limité aux comptes autorisés.
