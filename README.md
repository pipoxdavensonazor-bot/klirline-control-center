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
