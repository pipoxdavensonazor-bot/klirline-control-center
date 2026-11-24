# Matrice des fonctionnalités HQ 2.0 — version publique

- Établie par Grok Bot (contrôle technique automatisé, lecture seule) le 23 nov. 2026 vers 21h15 heure de Toronto ; relevé de suivi à 21h35 : **aucun changement**.
- **Version publique caviardée** : le dépôt est public et plusieurs faiblesses de la production ne sont pas corrigées ; les détails techniques (références de code, scénarios, remarques) sont conservés hors dépôt.
- Production : `cursor/klirline-control-center` @ `45c701a` ; CI run 45208519133 success ; Workers Builds 3bc841a7 success.
- Travaux Codex depuis 45c701a / f3b0e2d : **aucun** (têtes annoncées introuvables, HTTP 422) → rien à certifier.
- Cette matrice n’est pas une approbation humaine indépendante.

| Groupe | Fonctionnalité | Préparé | Développé | Testé | Intégré | Déployé | Preuves |
|---|---|---|---|---|---|---|---|
| Registre | Registre des postes et départements | OUI | OUI | OUI | OUI | OUI | PR #5, 4f282fb, 45c701a, 45208519133, 3bc841a7 |
| Orchestrateur | Distribution (routage vers l'agent) | OUI | OUI | OUI | OUI | OUI | PR #5, 4f282fb, 45c701a, 45208519133, 3bc841a7 |
| Orchestrateur | Attribution (propriétaire, ownerSlug) | OUI | OUI | OUI | OUI | OUI | PR #5, 4f282fb, 45c701a, 45208519133, 3bc841a7 |
| Orchestrateur | Priorités | OUI | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| Orchestrateur | Baux (lease) de claim | OUI | OUI | OUI | OUI | OUI | PR #7, PR #9, 6ec7cce, d754179, 45c701a, 45208519133, 3bc841a7 |
| Orchestrateur | Heartbeat | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Orchestrateur | Reprise (commande ou mission orpheline) | OUI | PARTIEL | OUI (CI) | OUI | OUI | PR #7, 45c701a, 3bc841a7 |
| Orchestrateur | Anti-double exécution / idempotence | OUI | PARTIEL | Local seulement | OUI | OUI | PR #7, 45c701a, 3bc841a7 |
| Orchestrateur | File d'échecs (dead-letter, retries) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Orchestrateur | Arrêt d'urgence | — | PARTIEL | Local seulement | OUI | OUI | 45c701a, 3bc841a7 |
| Orchestrateur | Journal (audit trail) | OUI | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| Distributeur V2 | Identité distincte (office-distributor) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Distributeur V2 | Moindre privilège (portées) | OUI | NON | Local seulement | NON | NON | absent sur 45c701a (lecture GitHub) |
| Distributeur V2 | Briefs structurés | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Distributeur V2 | Preuves vérifiées (empreinte, liées à la tentative) | OUI | NON | Local seulement | NON | NON | absent sur 45c701a (lecture GitHub) |
| Distributeur V2 | Anti-injection | OUI | PARTIEL | Local seulement | OUI | OUI | 45c701a, 3bc841a7 |
| Distributeur V2 | Jetons hors conversation (hq-dispatch) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Distributeur V2 | Une machine ne peut pas approuver (A3 humain) | OUI | NON | Local seulement | NON | NON | absent sur 45c701a (lecture GitHub) |
| Adaptateurs | KlirProspect | OUI | OUI | OUI (CI) | OUI | OUI | 8cde9b0, 45c701a, 3bc841a7 |
| Adaptateurs | Klir IA | — | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| Adaptateurs | GitHub | OUI | NON | NON | Préparé | — | non vérifiable |
| Adaptateurs | KlirPay (lecture seule) | — | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| Adaptateurs | NORIA | — | PARTIEL | OUI (CI) | OUI | OUI | PR #2, 45c701a, 3bc841a7 |
| Adaptateurs | KlirBuild | — | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| Adaptateurs | KlirMarket | — | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| Adaptateurs | Kontak | — | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Adaptateurs | BWN (Black Wall News) | — | PARTIEL | OUI (CI) | OUI | OUI | 45c701a, 3bc841a7 |
| UI CEO | Hub Admin produits | — | OUI | OUI (CI) | OUI | OUI | PR #1, 45c701a, 67008ad, 7c6623e, 2e2360ca, 7028edd3, 3bc841a7 |
| UI CEO | Bureau HQ (cartes, statuts, missions) | — | OUI | OUI (CI) | OUI | OUI | PR #5, 4f282fb, 9c6c97b, 8c40f7a, d754179, 45c701a, 45208519133, 1f89100d, 28195af6, 68b3106e, 24b77c25, 3bc841a7 |
| Infra | CI GitHub Actions (tests + gitleaks) | — | OUI | OUI | OUI | OUI | PR #13, 45c701a, 45207740919, 45208519133, 3bc841a7 |
| Infra | Protection de branche (rulesets) | OUI | Renforcement en brouillon (hors dépôt) | — | — | — | non vérifiable |
| Correctifs audit | P0-1 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P0-2 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P0-3 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P0-4 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P0-5 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-1 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-2 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-3 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-4 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-5 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-6 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-7 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |
| Correctifs audit | P1-8 : correctif de sécurité/fiabilité (détail non publié) | OUI | NON | NON | NON | NON | absent sur 45c701a (lecture GitHub) |

Légende : « OUI (CI) » = couvert par la CI GitHub Actions ; « Local seulement » = vérifié uniquement par un harnais local ; « non vérifiable » = aucune preuve GitHub/Cloudflare.

## Fichiers de la PR #12 (brouillon)

| Fichier | Statut |
|---|---|
| `docs/hq2/architecture.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/audit-confidentialite.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/audit.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/distributeur-spec.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/distributeur-v2-spec.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/phase5-grokbot-audit.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/plan.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/phase5/compare.mjs` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/phase5/harness.mjs` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/phase5/resultats-45c701a.json` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/phase5/verify-bundle.sh` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/probe-node-service.mjs` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/probe-workerd.mjs` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/probes/resultats-d754179.json` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/reconciliation.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
| `docs/hq2/secret-access-rotation.md` | ajouté ; préparé (doc/outil) ; testé par la CI de la PR ; non intégré ; non déployé |
