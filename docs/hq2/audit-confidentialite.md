# HQ 2.0 — Audit de confidentialité du dépôt public (arbre et historique)

Rédigé le 23 novembre 2026 (heure de Toronto). Je n'ai rien retiré, rien réécrit et je n'ai pas changé la visibilité du dépôt. Décision t73u : le dépôt reste **public à titre provisoire**.

Base : le scan de la phase 0 (`audit.md` §6 : gitleaks 8.21.2 sur 43 commits et sur l'arbre, greps de motifs sur 47 commits et toutes les branches), complété par un relevé manuel. **Aucune valeur sensible n'est reproduite ici.**

## 1. Résultat global

- **Aucun secret exploitable** : pas de jeton, de clé d'API, de clé privée, de JWT ni de mot de passe, dans l'arbre comme dans l'historique. Aucun `.env`, `.dev.vars`, `data/` ni `.wrangler/` n'a jamais été commité.
- Ce qui est exposé : une donnée personnelle (courriel), des **identifiants d'infrastructure**, une **cartographie des accès d'administration** et la **conception interne** (procédures, contrôles, défauts connus).

## 2. Inventaire

| # | Élément | Où | Risque | Action proposée |
| --- | --- | --- | --- | --- |
| C1 | **Courriel personnel de Philippe** | Auteur de 10 commits de fusion (`f37b80d` à `d754179`, du 4 au 9 nov.) et 31 lignes `Co-authored-by` réparties dans 23 commits, dont des branches non fusionnées et `refs/pull/*` | **Moyen** : donnée personnelle, hameçonnage ciblé, corrélation avec les comptes | **Dans HEAD** : rien à retirer, il n'est dans aucun fichier. **Pour l'avenir** : activer « Keep my email address private » et « Block command line pushes that expose my email » sur GitHub, et fusionner avec l'adresse `noreply`. **Réécriture d'historique** : déconseillée, voir §3 |
| C2 | Nom réel de l'équipe Cloudflare Zero Trust | `knowledge/bureau-exploitation.md` l. 29 (depuis `bbb5a77`) | **Faible** : la redirection 302 publique de `centre.klirline.com` l'expose déjà | Dans HEAD : remplacer par `<équipe>` (PR de docs) |
| C3 | Identifiant interne du Worker | `knowledge/bureau-exploitation.md` l. 56 (`bbb5a77`, `d754179`). Gitleaks le signale à tort comme `generic-api-key` | **Faible** : il n'ouvre rien sans jeton d'API Cloudflare | Dans HEAD : remplacer par `<worker_id>` |
| C4 | Identifiants de builds Workers Builds | `knowledge/bureau-exploitation.md` | **Négligeable** | Rien |
| C5 | Référence du projet Supabase de KlirProspect | `src/prospect-feed.js` l. 1 (depuis `8cde9b0`) | **Faible** : c'est une URL de fonction, protégée par un bearer gardé hors du dépôt. Elle désigne une cible (le projet), et la fonction répond aujourd'hui 404 | Dans HEAD : la déplacer dans une variable d'environnement non secrète (`PROSPECT_FEED_URL`), ou retirer le flux obsolète (P12) |
| C6 | Carte des accès d'administration de 11 produits (URL `adminUrl` et mode d'accès `cf-access`, `public-login` ou `none`) | `src/product-sites.js` l. 4 à 14 | **Faible à moyen** : elle indique quelles interfaces d'administration existent et lesquelles ne sont **pas** derrière Access | Dans HEAD : garder la liste mais vérifier que chaque `adminUrl` est réellement protégée. Les entrées `public-login` et `none` sont à revoir avec Philippe |
| C7 | Conception de l'authentification (formes de `ACCESS_ACCOUNTS`, du JWT de service, de `HQ_MACHINE_IDENTITIES`, rôles qui ont `review`) | `README.md`, `src/access.js`, `src/hq/machine-auth.js`, `config/hq-machines.example.json` | **Faible** : la sécurité ne repose pas sur le secret du code. La signature, l'émetteur et l'audience restent vérifiés | Garder |
| C8 | **Défauts exploitables documentés** (P2 double jeton, P3/P3b annulation et réouverture, P5 approbation par une machine) | `docs/hq2/*.md` de la PR #12, **publics dès le push de la branche** | **Moyen** : c'est un mode d'emploi. L'exploitation exige toutefois une identité Access valide (compte autorisé ou jeton de service allowlisté) | Corriger P2, P3 et P5 en priorité (phase 2). Ne pas détailler davantage les attaques dans les docs publiques. Les décrire au niveau du comportement, sans charge utile |
| C9 | Procédures internes (13 fichiers) et règles CEO | `knowledge/procedures/*.md`, `knowledge/ceo-rules.md`, `security.md`, `finance.md` | **Faible à moyen** : elles révèlent le fonctionnement et les garde-fous, ce qui aide l'ingénierie sociale | Relire avec Philippe. Celles qui décrivent des contrôles financiers ou de sécurité peuvent aller dans un dépôt privé de connaissances |
| C10 | Seuils d'approbation internes (paiement, contrat, remise, publicité) | `src/policy.js` (`THRESHOLDS`) | **Faible** : ils montrent sous quel montant une action passe sans le CEO (dans la démonstration) | Garder pour l'instant (jeu de démonstration). Pour les seuils réels de HQ 2.0, mettre la configuration hors dépôt |
| C11 | Chemin du fichier de secret Access sur la box | Skill `pont-hq-centre-agents`, hors dépôt, et `docs/hq2/secret-access-rotation.md` (chemin seulement) | **Faible** : chemin sans valeur, déjà accessible à tout agent de la box | Garder. La valeur n'est jamais écrite |
| C12 | Données fictives (`@example.com`, `.example`, numéros en 555) | `src/seed.js`, `src/self-check.js`, `knowledge/` | **Aucun** | Rien |
| C13 | Dépendances npm : 4 vulnérabilités de gravité haute signalées au build | Journal Workers Builds (outillage `wrangler`) | **Faible** : outillage de build, pas le Worker | `npm audit` dans la CI |

Ce qui n'a **pas** été trouvé : ID de compte Cloudflare, AUD Access réel, Client ID réel, clés Stripe, Supabase ou GitHub, données de clients réels.

## 3. Retrait dans HEAD ou réécriture d'historique

| Approche | Effet | Coût et risque | Approbation |
| --- | --- | --- | --- |
| **Retrait dans HEAD** (C2, C3, C5, C6) par une PR de docs ou de config | Les nouvelles lectures ne voient plus la valeur | L'historique et les clones existants la gardent. Sans risque pour la production si la PR ne touche que les docs. Si elle touche `src/`, c'est un merge en production, donc une approbation | **Approbation Philippe requise** pour le merge |
| **Réécriture d'historique** (`git filter-repo` sur le courriel, C2 et C3) | Nettoie les commits sur GitHub | **Exige un force-push** sur `cursor/klirline-control-center` (production) et sur toutes les branches. Cela casse les SHA cités partout (`d754179`, les builds, les PR, la mémoire), invalide les PR ouvertes et brouille la traçabilité Workers Builds. **Les `refs/pull/*` ne peuvent pas être réécrites par le propriétaire** : il faut demander à GitHub Support de purger les vues en cache. Les clones et forks existants gardent les données | **Approbation explicite de Philippe requise**, opération par opération (force-push). **Déconseillée** : aucun secret n'est en cause, et le seul élément personnel (C1) se traite mieux par les réglages de confidentialité du courriel |

Recommandation : **retrait dans HEAD de C2, C3, C5 et C6, pas de réécriture.** Si un vrai secret apparaissait un jour, la règle serait la **rotation immédiate du secret**, avant toute réécriture d'historique.

## 4. Passage en privé : évaluation

| Critère | Public (décision provisoire t73u) | Privé |
| --- | --- | --- |
| Protection de branche et rulesets | **Gratuits** | Payants sur un compte personnel (GitHub Pro) |
| Exposition (C1 à C10) | Elle continue | Elle s'arrête pour les nouvelles lectures. Ce qui a déjà été vu ou cloné reste |
| Workers Builds | Fonctionne | Fonctionne si l'app `cloudflare-workers-and-pages` a accès au dépôt (à vérifier) |
| Codex | Lecture anonyme possible | Il faut l'app ChatGPT/Codex installée sur ce dépôt |
| Cursor et connecteur | Fonctionnent | Fonctionnent (propriétaire) |
| Clones anonymes (box, scripts) | Fonctionnent | Il faut une authentification |
| Coût | 0 $ | Environ 4 $ US par mois pour GitHub Pro, **si** on garde le ruleset |

**Évaluation** : rester public est acceptable **à court terme**, à trois conditions :
1. retrait de C2, C3, C5 et C6 dans HEAD ;
2. correction rapide de P2, P3 et P5, rendus publics par C8 ;
3. ruleset actif dès que la CI existe.

Le passage en privé se justifiera quand HEAD contiendra de la configuration métier réelle (seuils, procédures, clients). Il faudra alors prévoir le coût de GitHub Pro **avant** de basculer, pour ne pas perdre la protection de branche. Aucun changement de visibilité ne sera fait sans l'**approbation de Philippe**.
