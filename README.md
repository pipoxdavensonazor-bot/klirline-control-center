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

Le navigateur parle à `/api/*`. En local, `src/server.js` garde l'état dans `data/state.json`. En ligne, `src/worker.js` garde le même état dans un Durable Object. Les deux appellent `src/engine.js`. Le menu d'identité est un choix de démonstration : le serveur vérifie que le rôle annoncé a le droit d'agir sur le dossier, il ne vérifie pas qui est la personne.

## Limites connues

- Mode démonstration. Le menu ne connecte personne. N'importe qui peut annoncer un rôle, y compris celui du CEO, sur le centre public.
- Une action « consignée » est une simulation. Aucun courriel, appel, paiement ou publication ne part.
- Les revenus, dépenses et factures sont un jeu. Ce n'est pas la comptabilité de Klirline Inc.
- Le score d'un prospect mesure la qualité de la fiche. Le potentiel en dollars n'existe que lorsqu'un montant de proposition est déjà écrit sur la fiche. Aucune probabilité n'est inventée.
- « Page joignable » veut dire que la page d'accueil a répondu. Seuls KlirBuild (`/api/health`) et Klir IA (`/api/skills`, nombre seulement) ont une lecture plus précise.
- KlirMarket et Klirline OS n'ont pas d'adresse publique dans ce centre.
- Il n'y a pas d'isolation entre visiteurs : le centre public partage une seule journée de démonstration.

## Plus tard

Authentification réelle, lecture des dossiers commerciaux, envoi, appel, paiement, publication. Ces branchements attendent une décision et un accès limité à Philippe Azor.
