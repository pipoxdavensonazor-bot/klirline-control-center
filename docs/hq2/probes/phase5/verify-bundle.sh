#!/usr/bin/env bash
# Réception et certification du bundle Codex (phase 5, Grok Bot).
# Tout est local : clone isolé, harnais workerd local, aucune écriture vers GitHub ni la production,
# aucun secret lu. Le clone principal n'est jamais modifié.
#
# Usage : verify-bundle.sh <fichier.bundle> [tête attendue (défaut 1ab1a24)]
# Variables : BASE_SHA (défaut 45c701a…), VERIFY_DIR (défaut /workspace/hq2/codex-verify),
#             OUT_DIR (défaut $VERIFY_DIR/sorties), PORT (défaut 8898), REPO_URL (clone public).
set -euo pipefail

BUNDLE="$(readlink -f "${1:?chemin du bundle requis}")"
EXPECTED_HEAD="${2:-1ab1a24}"
BASE_SHA="${BASE_SHA:-45c701abd8aebcae18a44e8980bfec35c15fd3a3}"
VERIFY_DIR="${VERIFY_DIR:-/workspace/hq2/codex-verify}"
OUT_DIR="${OUT_DIR:-$VERIFY_DIR/sorties}"
PORT="${PORT:-8898}"
REPO_URL="${REPO_URL:-https://github.com/pipoxdavensonazor-bot/klirline-control-center.git}"
HERE="$(cd "$(dirname "$0")" && pwd)"            # harnais de référence (PR #12), pas celui du bundle
BASELINE="$HERE/resultats-45c701a.json"
MAIN_CLONE="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || true)"

errors=()
fail() { errors+=("$1"); echo "ÉCHEC : $1" >&2; }
log() { printf '\n== %s\n' "$1"; }

[ -f "$BUNDLE" ] || { echo "bundle introuvable : $BUNDLE" >&2; exit 2; }
case "$(readlink -f "$VERIFY_DIR")" in
  "$MAIN_CLONE"|"$MAIN_CLONE"/*) echo "VERIFY_DIR ne doit pas être dans le clone principal" >&2; exit 2;;
esac

log "1. Empreinte du fichier"
BUNDLE_SHA256="$(sha256sum "$BUNDLE" | cut -d' ' -f1)"
echo "sha256  $BUNDLE_SHA256  $(stat -c %s "$BUNDLE") octets"

log "2. Clone isolé ($VERIFY_DIR)"
if [ ! -d "$VERIFY_DIR/.git" ]; then
  git clone --quiet --no-checkout "$REPO_URL" "$VERIFY_DIR"
else
  git -C "$VERIFY_DIR" fetch --quiet origin
fi
git -C "$VERIFY_DIR" cat-file -e "${BASE_SHA}^{commit}" || fail "base $BASE_SHA absente du clone"
mkdir -p "$OUT_DIR"

log "3. git bundle verify / list-heads"
VERIFY_OUT="$(git -C "$VERIFY_DIR" bundle verify "$BUNDLE" 2>&1)" && VERIFY_OK=true || VERIFY_OK=false
echo "$VERIFY_OUT"
$VERIFY_OK || fail "git bundle verify a échoué"
HEADS="$(git -C "$VERIFY_DIR" bundle list-heads "$BUNDLE")"
echo "$HEADS"
# Prérequis : lignes « -<sha> » de l'en-tête texte du bundle.
PREREQS="$(LC_ALL=C sed -n '2,/^$/p' "$BUNDLE" | LC_ALL=C grep -a '^-' | cut -c2-41 || true)"
echo "prérequis : ${PREREQS:-aucun (bundle complet)}"

log "4. Contrôle du prérequis et de la tête"
if [ -n "$PREREQS" ]; then
  [ "$(echo "$PREREQS" | sort -u)" = "$BASE_SHA" ] || fail "prérequis attendu $BASE_SHA, trouvé : $(echo $PREREQS)"
fi
HEAD_SHA="$(echo "$HEADS" | awk '{print $1}' | grep -E "^${EXPECTED_HEAD}" | sort -u || true)"
[ "$(echo "$HEAD_SHA" | grep -c . || true)" = "1" ] || fail "tête $EXPECTED_HEAD absente ou ambiguë dans le bundle"
if $VERIFY_OK; then
  git -C "$VERIFY_DIR" fetch --quiet "$BUNDLE" "+refs/*:refs/codex-bundle/*"
fi
if [ -n "${HEAD_SHA:-}" ] && git -C "$VERIFY_DIR" cat-file -e "${HEAD_SHA}^{commit}" 2>/dev/null; then
  git -C "$VERIFY_DIR" merge-base --is-ancestor "$BASE_SHA" "$HEAD_SHA" || fail "$HEAD_SHA ne descend pas de $BASE_SHA"
else
  fail "tête non importée"; HEAD_SHA=""
fi

COMMITS="[]"; FILES="[]"
if [ -n "$HEAD_SHA" ]; then
  log "5. Commits et fichiers ($BASE_SHA..$HEAD_SHA)"
  git -C "$VERIFY_DIR" log --format='%h %an %ad %s' --date=iso-strict "$BASE_SHA..$HEAD_SHA"
  git -C "$VERIFY_DIR" diff --stat "$BASE_SHA" "$HEAD_SHA" | tail -n 40
  COMMITS="$(git -C "$VERIFY_DIR" log --format='%H%x09%s' "$BASE_SHA..$HEAD_SHA" | python3 -c 'import sys,json;print(json.dumps([dict(zip(("sha","sujet"),l.rstrip("\n").split("\t",1))) for l in sys.stdin]))')"
  FILES="$(git -C "$VERIFY_DIR" diff --name-status "$BASE_SHA" "$HEAD_SHA" | python3 -c 'import sys,json;print(json.dumps([dict(zip(("statut","fichier"),l.rstrip("\n").split("\t",1))) for l in sys.stdin]))')"
  if command -v gitleaks >/dev/null || [ -x "$HOME/bin/gitleaks" ]; then
    GL="$(command -v gitleaks || echo "$HOME/bin/gitleaks")"
    log "5b. Scan de secrets sur les nouveaux commits"
    if "$GL" git --log-opts="$BASE_SHA..$HEAD_SHA" --redact --exit-code 1 "$VERIFY_DIR" >"$OUT_DIR/gitleaks.txt" 2>&1; then GITLEAKS="aucune fuite"; else GITLEAKS="FUITES SIGNALÉES (voir gitleaks.txt, valeurs masquées)"; fail "gitleaks signale des fuites"; fi
    echo "$GITLEAKS"
  else GITLEAKS="non exécuté (gitleaks absent)"; fi
fi

SHORT="${HEAD_SHA:0:7}"
R_ERRORS="$(printf '%s\n' "${errors[@]:-}")" R_COMMITS="$COMMITS" R_FILES="$FILES" R_PREREQS="$PREREQS" \
R_BUNDLE="$BUNDLE" R_SHA256="$BUNDLE_SHA256" R_EXPECTED="$EXPECTED_HEAD" R_HEAD="$HEAD_SHA" R_BASE="$BASE_SHA" \
R_VERIFY="$VERIFY_OK" R_GITLEAKS="${GITLEAKS:-non exécuté}" python3 - "$OUT_DIR/reception-${SHORT:-inconnu}.json" <<'PY'
import json, os, sys
e = os.environ
errs = [x for x in e["R_ERRORS"].splitlines() if x.strip()]
json.dump({"bundle": e["R_BUNDLE"], "bundleSha256": e["R_SHA256"], "teteAttendue": e["R_EXPECTED"], "tete": e["R_HEAD"] or None,
  "prerequis": e["R_PREREQS"].split(), "base": e["R_BASE"], "bundleVerify": e["R_VERIFY"] == "true",
  "commits": json.loads(e["R_COMMITS"]), "fichiers": json.loads(e["R_FILES"]), "gitleaks": e["R_GITLEAKS"],
  "ok": not errs, "erreurs": errs}, open(sys.argv[1], "w"), ensure_ascii=False, indent=2)
PY
echo "réception : $OUT_DIR/reception-${SHORT:-inconnu}.json"
if [ "${#errors[@]}" -gt 0 ]; then echo "Réception refusée, harnais non lancé." >&2; exit 1; fi

log "6. Tests du dépôt sur la tête (worktree temporaire)"
WT="$(mktemp -d /tmp/codex-tests-XXXX)"
git -C "$VERIFY_DIR" worktree add --detach --quiet "$WT" "$HEAD_SHA"
( cd "$WT" && npm ci --no-audit --no-fund --silent >/dev/null 2>&1 \
  && for s in src/self-check.js scripts/hq-flow.mjs scripts/hq-execution-check.mjs; do
       [ -f "$s" ] || { echo "$s absent"; continue; }
       if node "$s" >"$OUT_DIR/test-$(basename "$s").log" 2>&1; then echo "OK   $s"; else echo "ÉCHEC $s (voir test-$(basename "$s").log)"; fi
     done
  # hq-do-check fixe le port 8791 (occupé sur la box) : copie locale avec un autre port, dépôt non modifié.
  if [ -f scripts/hq-do-check.mjs ]; then
    sed "s/const port = 8791;/const port = $((PORT + 1));/" scripts/hq-do-check.mjs > scripts/.hq-do-check-port.mjs
    if node scripts/.hq-do-check-port.mjs >"$OUT_DIR/test-hq-do-check.log" 2>&1; then echo "OK   scripts/hq-do-check.mjs (port $((PORT + 1)))"; else echo "ÉCHEC scripts/hq-do-check.mjs (voir test-hq-do-check.log)"; fi
  fi ) || echo "npm ci a échoué"
git -C "$VERIFY_DIR" worktree remove --force "$WT"

log "7. Harnais phase 5 sur $HEAD_SHA"
RESULT="$OUT_DIR/resultats-${SHORT}.json"
node "$HERE/harness.mjs" --ref "$HEAD_SHA" --repo "$VERIFY_DIR" --port "$PORT" --out "$RESULT" >/dev/null || echo "harnais : code non nul (voir champ fatal)"

log "8. Comparaison avec la production"
node "$HERE/compare.mjs" "$BASELINE" "$RESULT" --reception "$OUT_DIR/reception-${SHORT}.json" --out "$OUT_DIR/comparaison-45c701a-${SHORT}.json" \
  --table >/dev/null
echo "sorties : $OUT_DIR"
