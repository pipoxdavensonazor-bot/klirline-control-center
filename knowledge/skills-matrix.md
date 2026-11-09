# Matrice des compétences — 5 novembre 2026

Le tronc a avancé. `origin/cursor/klirline-control-center` est `491b55adc525b211baa5400bb63875ac5b512279` (5 novembre 2026, 13 h 27, heure de Toronto), « Accepter le JWT de service Access pour le poll du bureau (#11) ». Le dossier d'aperçu autorisé visait `8c40f7a`. La republication de ce commit n'est pas reprise. La PR #9 reste ouverte sur `8b6a7fcf0527f3efe1c3d6629590cae699b40b5c` et est en conflit avec ce tronc. Elle n'est pas fusionnée.

Aucun jeton `CLOUDFLARE_API_TOKEN` n'est présent. Le déploiement actif n'a pas été relu.

Les compétences sous `.cursor/skills/` aident l'assistant de développement. Elles ne sont pas exécutables par le moteur du bureau. Le plafond modèle reste 0 $ et les envois restent désactivés.

Catalogue épinglé : `sickn33/agentic-awesome-skills` `89e479f2ed4150e654ded6e67b2ccb61e71b9455`, licence MIT, Copyright (c) 2026 Antigravity User. Une seule copie, le dossier `skills/` du catalogue, pas les doublons des plugins.

## Produits

| Produit | Dépôt ouvert | Responsable de fiche | Compétences retenues | Exécution bureau |
| --- | --- | --- | --- | --- |
| Centre | oui, cette branche | ops-klirline | Workers, Zero Trust, pré-livraison, orchestration, évaluation, mémoire, communication interne | procédures seulement |
| KlirProspect | oui, `klir-prospect`, non modifié ici | klirprospect | qualité de liste, démonstration, brouillon commercial | procédures seulement |
| Klirline social | oui, `klirline-social-publisher`, non modifié | office-klirline | contenu social examiné, non installé | non |
| KlirBuild, KlirPay, KlirMarket, KlirSecure, NORIA, Black Wall News, Centia, Klir IA, sites | non | selon `knowledge/products.md` | procédures de garde, sans règle métier inventée | non |
| KlirLead | pas de panneau retenu | non précisé | aucune installation | non |
| KlirPromo | absent de la fiche | non précisé | aucune | non |

## Installées pour Cursor

Commit `89e479f2`. Chemins `.cursor/skills/<id>/`.

| Identifiant | Licence lue | Bureau |
| --- | --- | --- |
| cloudflare-workers-expert | MIT du catalogue | non exécutable |
| cloudflare-zero-trust | MIT du catalogue | non exécutable |
| pre-ship-gate | MIT, operating-kit | non exécutable |
| review-multi-agent-orchestration | MIT du catalogue | non exécutable |
| agent-evaluation | Apache-2.0 nommé dans l'en-tête | non exécutable |
| agent-memory-discipline | CC0-1.0 nommé dans l'en-tête | non exécutable |
| internal-comms | Apache-2.0, upstream anthropics/skills | non exécutable |

## Examinées, non copiées

`revops`, `sales-enablement`, `sales-automator`, `social-content`, `content-marketer`, `supabase`, `stripe-integration`, `marketplace-rbac-audit`, `threat-modeling-expert`, `backup-recovery`, `teach`. Même commit. Elles ne deviennent pas des dépendances de toutes les tâches. Les dépôts `marketingskills` `88c79f65` et `agency-agents` `b37b5bb3` restent des sources MIT non copiées. `anthropics/skills` `ca45fc496a3436251f191354091d557da31c15b5` n'a pas de licence unique à la racine ; les skills documents ne sont pas installés. `500-AI-Agents-Projects` `9beeb721c2af551bacaab827a76bddaecaa0ca5e`, MIT : idées de compte rendu et de brouillon reprises dans les procédures internes, sans CrewAI ni LangGraph.

## Procédures internes

`knowledge/procedures/`. Exemples vérifiés à la main : `knowledge/examples/lot-competences-2026-11-05.md`.
