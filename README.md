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

Aucune valeur n'est fournie dans le dépôt. Tant que les trois secrets manquent, les routes du dossier d'entreprise répondent `503` et ignorent le rôle du navigateur. La santé, les pages publiques et les playbooks ne portent pas cet état.

À configurer dans Cloudflare, avec les vraies valeurs du compte, puis à poser comme secrets du Worker `klirline-control-center` :

| Secret | Valeur |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | Nom d'équipe déjà existant, de la forme `<équipe>.cloudflareaccess.com`, sans `https://` |
| `ACCESS_AUD` | Balise d'audience (AUD) de l'application Access qui protège `centre.klirline.com` |
| `ACCESS_ACCOUNTS` | JSON des comptes réellement autorisés |

Forme de `ACCESS_ACCOUNTS`, sans exemple réel :

```json
[{ "email": "<courriel du compte Access>", "role": "<id de poste existant>", "orgId": "<identifiant d'organisation>" }]
```

`role` doit être un poste déjà défini, par exemple `ceo`. `orgId` est un slug (`klirline` pour l'organisation actuelle). Deux `orgId` distincts n'ouvrent pas le même objet durable. Le nom `api-rate` est réservé au compteur de requêtes.

Étapes, à faire par l'opérateur :

1. Dans Cloudflare Zero Trust, créer une application Access auto-hébergée pour `centre.klirline.com` et une politique qui n'admet que les personnes voulues.
2. Copier le domaine d'équipe et la balise AUD de cette application.
3. Poser les trois secrets, par exemple `npx wrangler secret put ACCESS_TEAM_DOMAIN`. Ne pas les écrire dans git.
4. Déployer seulement après cette configuration. Ce dépôt ne déploie pas et ne crée pas l'application Access.

## Limites des routes

Chaque route `/api/*` compte dans une fenêtre de 60 secondes et de 60 requêtes. La clé est l'adresse de connexion, puis le courriel vérifié pour les routes du dossier. Le rôle et l'`orgId` n'entrent pas dans la clé. Un corps de plus de 32 Ko répond `413`. Un JSON illisible répond `400`. Un dépassement répond `429` avec `Retry-After`.

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

## Plus tard

Lecture des dossiers commerciaux, envoi, appel, paiement, publication. Ces branchements attendent un accès déjà limité aux comptes autorisés.
