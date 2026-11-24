# Procédure de contrôle d'une PR ou branche Codex (reproductible, locale)

Grok Bot, 2026-11-23. Elle s'applique à **toute nouvelle PR, branche ou tête Codex** apparue depuis `45c701a` (production) ou `f3b0e2d` (PR #12), et aussi à un bundle reçu hors GitHub (voir `/workspace/hq2/protocole-reception-codex-5.1.md`).
- **Contrôle technique automatisé.** Il ne remplace **pas** l'approbation humaine indépendante (2e compte GitHub de Philippe, `github-brouillons/etapes-revue-humaine.md`).
- **Local uniquement :** aucun push, commentaire, review, label ni fusion ; aucune écriture en production ; budget 0 $.
- Aucune valeur de secret dans les sorties.

## 0. Détection (lecture GitHub)

```bash
R=pipoxdavensonazor-bot/klirline-control-center
H=(-sS -H "Authorization: Bearer $JETON_LECTURE_GH" -H "Accept: application/vnd.github+json")   # jeton jamais affiché
curl "${H[@]}" "https://api.github.com/repos/$R/pulls?state=all&per_page=100" > pulls.json
curl "${H[@]}" "https://api.github.com/repos/$R/branches?per_page=100" > branches.json
git ls-remote https://github.com/$R.git > refs.txt
```

- **Nouveau** = une PR créée après le 2026-11-23 15:44Z, ou une branche absente de la liste de référence (`raw-github/branches.json`, 15 branches), ou une tête différente.
- Têtes Codex annoncées à rechercher : `1ab1a24`, `d52f17b`, `371deb0`, `eddbf4a`, avec `GET /repos/$R/commits/<sha>` (200 = présente, 422 = absente).
- **Si rien n'est nouveau : verdict « rien à certifier »**, avec la liste des PR et des branches en preuve.

## 1. Clone isolé

```bash
CIBLE=<sha complet de la tête>; W=/workspace/hq2/codex-verify/$CIBLE
git clone -q https://github.com/$R.git "$W" && cd "$W"
git fetch -q origin "+refs/pull/*/head:refs/remotes/pr/*"   # lecture seule
git checkout -q --detach "$CIBLE"
git merge-base --is-ancestor 45c701abd8aebcae18a44e8980bfec35c15fd3a3 "$CIBLE" || echo "REFUS : base ≠ 45c701a"
```

Aucun `remote set-url`, aucune identité git pour pousser. Le clone est jetable.

## 2. Périmètre et hygiène du diff

| # | Contrôle | Commande | Critère de refus |
|---|---|---|---|
| 2.1 | Liste des commits | `git log --format='%h %an %ad %s' 45c701a..$CIBLE` | Une tête différente de celle annoncée par Codex |
| 2.2 | Fichiers touchés | `git diff --stat 45c701a..$CIBLE` | Modification de `docs/hq2/probes/phase5/*` (le harnais de référence), de `.github/workflows/*` sans justification, ou de `.gitleaksignore` |
| 2.3 | Secrets | `gitleaks git --log-opts="45c701a..$CIBLE" --redact --exit-code 1 .` | Toute fuite |
| 2.4 | Dépendances | `git diff 45c701a..$CIBLE -- package.json package-lock.json` ; `npm audit --omit=dev` | Nouvelle dépendance d'exécution non justifiée, ou vulnérabilité « high » d'exécution |
| 2.5 | Tests affaiblis | `git diff 45c701a..$CIBLE -- scripts/ src/self-check.js \| grep -E '^-.*check\(\|^-.*assert'` | Assertion supprimée ou inversée sans raison. **Exception attendue** : l'inversion documentée d'un test existant liée au correctif P0-3 (détail non publié) |

## 3. Tests du dépôt (4), 3 fois

```bash
npm ci --no-audit --no-fund
for i in 1 2 3; do
  node src/self-check.js && node scripts/hq-flow.mjs && node scripts/hq-execution-check.mjs \
  && sed 's/8791/8899/g' scripts/hq-do-check.mjs > /tmp/hq-do-check-8899.mjs && node /tmp/hq-do-check-8899.mjs \
  || echo "ÉCHEC tour $i"
done
```

Refus si un seul tour échoue. Un résultat instable est traité comme un échec.

## 4. Harnais de sécurité de référence (I1–I5, T1–T14, E1), 3 fois

Le harnais est **celui de PR #12 (f3b0e2d)**, jamais celui du code contrôlé.

```bash
REF=/workspace/hq2/klirline-control-center/docs/hq2/probes/phase5
for i in 1 2 3; do node $REF/harness.mjs --ref $CIBLE --repo "$W" --port 8897 --out /workspace/hq2/codex-verify/h-$CIBLE-$i.json; done
for i in 1 2 3; do node $REF/compare.mjs $REF/resultats-45c701a.json /workspace/hq2/codex-verify/h-$CIBLE-$i.json --table; done
```

- **Stabilité :** 0 écart de verdict entre les 3 exécutions. Sinon, le résultat est « non testable » et la PR est refusée.
- **Verdict de `compare.mjs`** :
  - NON TESTABLE s'il y a un bloquant ;
  - **NO-GO** s'il y a une régression (protégé vers vulnérable), ou si l'un de T1, T3, T4, T9, T12, I1, I2 n'est pas protégé ;
  - GO TECHNIQUE sinon.

## 5. Contrôles ciblés (local simulé, identités simulées)

Version publique : la liste détaillée des scénarios d'attaque est conservée hors dépôt, car les faiblesses visées ne sont pas encore corrigées en production. Catégories contrôlées, toutes en local (clone isolé, `wrangler dev` / Miniflare), jamais contre la production :

- 5.1 permissions et portées des identités machine ;
- 5.2 usurpation d'identité ;
- 5.3 approbation humaine obligatoire (une machine ne peut pas approuver) ;
- 5.4 preuves de livraison vérifiées ;
- 5.5 heartbeat ;
- 5.6 reprise des commandes orphelines ;
- 5.7 idempotence et concurrence ;
- 5.8 volume et pagination ;
- 5.9 journal d'audit (auteur de chaque transition) ;
- 5.10 isolation des secrets (aucune valeur dans le dépôt) ;
- 5.11 conformité à la spécification.

Chaque contrôle a un attendu « refus et aucun changement d'état » ou « une seule tentative active ». Tout écart = REFUSÉ.

## 6. Verdict (un seul, motivé)

- **VALIDÉ (contrôle technique)** si toutes les conditions sont réunies :
  - §2 sans refus ;
  - §3 : 3/3 tours OK ;
  - §4 : 3 exécutions stables et GO TECHNIQUE ;
  - §5 : tous les contrôles des P0 concernés atteignent l'attendu.

  La fusion reste soumise à l'approbation humaine indépendante et à la décision de Philippe.
- **REFUSÉ** sinon, en citant le contrôle en échec, la preuve (fichier JSON, ligne, commande) et le correctif attendu.
- **RIEN À CERTIFIER** si aucune PR, branche ni tête nouvelle n'existe.

Le rapport est consigné dans `/workspace/hq2/coo-2026-11-23/controles/<sha>.md` (local). Il n'est **pas** publié sur GitHub sans autorisation.

## 7. Nettoyage

`rm -rf /workspace/hq2/codex-verify/<sha>` après archivage des JSON. Vérifier qu'aucun processus wrangler local ne reste actif (`pkill -f "wrangler dev"`, limité aux processus lancés par ce contrôle).
