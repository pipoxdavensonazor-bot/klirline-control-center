#!/usr/bin/env node
// Compare deux sorties du harnais phase 5 (base = production, cible = branche Codex) et produit
// une matrice des 14 attaques (+ E1, I1-I5) avec preuves et un verdict final.
// Usage : node compare.mjs <base.json> <cible.json> [--out comparaison.json] [--reception reception.json]
import fs from "node:fs";

const [basePath, targetPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const opt = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
if (!basePath || !targetPath) { console.error("usage : compare.mjs base.json cible.json [--out f] [--reception f]"); process.exit(2); }
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
const reception = opt("reception") && fs.existsSync(opt("reception")) ? JSON.parse(fs.readFileSync(opt("reception"), "utf8")) : null;

const ATTACKS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "T13", "T14"];
const EXTRA = ["E1", "I1", "I2", "I3", "I4", "I5"];
// Seuil de certification : « protégé » exigé, sauf ces tests dont une part relève du distributeur.
const PARTIAL_OK = new Set(["T10", "T13", "T14", "I5"]);
const RANK = { "vulnérable": 0, "non testable": 0, "partiel": 1, "protégé": 2 };

const byId = (out) => Object.fromEntries((out.results || []).map((r) => [r.id, r]));
const b = byId(base); const t = byId(target);
function evolution(vb, vt) {
  if (!vt) return "absent de la cible";
  if (vt === "non testable") return "non concluant";
  if (!vb) return "nouveau";
  if (RANK[vt] > RANK[vb]) return vt === "protégé" ? "corrigé" : "amélioré";
  if (RANK[vt] < RANK[vb]) return "régression";
  return vt === "protégé" ? "déjà protégé" : "non corrigé";
}
const rows = [...ATTACKS, ...EXTRA].map((id) => {
  const vb = b[id]?.verdict; const vt = t[id]?.verdict;
  const required = PARTIAL_OK.has(id) ? "partiel" : "protégé";
  const meets = vt ? RANK[vt] >= RANK[required] && vt !== "non testable" : false;
  return {
    id, nom: t[id]?.nom || b[id]?.nom,
    base: { sha: base.sha, verdict: vb ?? null, preuve: b[id]?.observe ?? null },
    cible: { sha: target.sha, verdict: vt ?? null, preuve: t[id]?.observe ?? null },
    evolution: evolution(vb, vt), seuil: required, seuilAtteint: meets,
  };
});
const blockers = [];
if (target.fatal) blockers.push(`harnais en erreur sur la cible : ${String(target.fatal).slice(0, 300)}`);
if (reception && reception.ok === false) blockers.push(`réception du bundle refusée : ${(reception.erreurs || []).join(" ; ")}`);
const regressions = rows.filter((r) => r.evolution === "régression").map((r) => r.id);
const unmet = rows.filter((r) => !r.seuilAtteint).map((r) => r.id);
const inconclusive = rows.filter((r) => r.evolution === "non concluant" || r.evolution === "absent de la cible").map((r) => r.id);
let verdict;
if (blockers.length) verdict = "NON TESTABLE";
else if (regressions.length || unmet.some((id) => ["T1", "T3", "T4", "T9", "T12", "I1", "I2"].includes(id))) verdict = "NO-GO";
else if (unmet.length) verdict = "NO-GO (seuils non atteints)";
else verdict = "GO TECHNIQUE (la fusion reste soumise à l'accord de Philippe et à la revue humaine)";

const out = {
  comparaison: "phase5-grokbot", genereLe: new Date().toISOString(), production: false,
  base: { sha: base.sha, executeLe: base.executeLe, harnais: base.version ?? 1 },
  cible: { sha: target.sha, executeLe: target.executeLe, harnais: target.version ?? 1 },
  reception: reception ? { ok: reception.ok, bundleSha256: reception.bundleSha256, tete: reception.tete, prerequis: reception.prerequis } : null,
  matrice: rows,
  synthese: { corriges: rows.filter((r) => r.evolution === "corrigé").map((r) => r.id), nonCorriges: rows.filter((r) => r.evolution === "non corrigé").map((r) => r.id), regressions, nonConcluants: inconclusive, seuilsNonAtteints: unmet, blocages: blockers },
  verdictFinal: verdict,
};
const text = JSON.stringify(out, null, 2);
if (opt("out")) fs.writeFileSync(opt("out"), text + "\n");
if (process.argv.includes("--table")) {
  for (const r of rows) process.stderr.write(`${r.id.padEnd(4)} ${String(r.base.verdict).padEnd(13)} -> ${String(r.cible.verdict).padEnd(13)} ${r.evolution}\n`);
  process.stderr.write(`VERDICT : ${verdict}\n`);
}
console.log(text);
