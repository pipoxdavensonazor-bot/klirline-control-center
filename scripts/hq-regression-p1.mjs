// Tests de régression P1 « intégrité » (KCO-AUDIT-2026-11-28, point 6) : empreintes SHA-256 des
// approbations et des livrables, anciennes empreintes FNV lues comme « legacy » et jamais valides.
// 100 % local et en mémoire. Aucun réseau, aucun secret : valeurs factices.
// Usage : node scripts/hq-regression-p1.mjs [ID ...]   (sans argument : tous les tests)
import { dispatchHq } from "../src/hq/dispatch.js";
import { memoryHqStore } from "../src/hq/memory-store.js";
import { authenticateMachine, resolveServiceMachine } from "../src/hq/machine-auth.js";
import * as missions from "../src/hq/missions.js";

const { createMission, decideMission, missionContentHash, prepareExternalAction, presentMission, validApproval } = missions;
const only = new Set(process.argv.slice(2));
const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const NOW = new Date("2026-11-28T12:00:00.000Z");
// Deux objectifs de même longueur dont l'état FNV-1a 32 bits coïncide (trouvés par recherche
// d'anniversaire, ~80 000 essais) : tout suffixe commun garde la collision.
const COLLIDE = ["Objectif fictif 00z8j8", "Objectif fictif 01d562"];
const SHA256 = /^sha256-[0-9a-f]{64}$/;

function fnvLegacy(parts) {
  const text = parts.map((part) => String(part ?? "")).join("\n");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv-${(hash >>> 0).toString(16)}-${text.length}`;
}
const fnvMission = (mission) => fnvLegacy([mission.objective, mission.successCriterion,
  ...(mission.deliverables || []).slice().sort((a, b) => a.id.localeCompare(b.id)).map((item) => `${item.id}\n${item.body}`)]);

async function webSha256(text) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(bytes).toString("hex");
}

function approvedMission(objective = COLLIDE[0]) {
  const mission = createMission({ objective, successCriterion: "Critère fictif", ownerSlug: "office-klirline" }, "agent-a", { now: NOW });
  const approved = decideMission({ ...mission, status: "in_review" }, { decision: "approve" }, { actorId: "coo", human: true, now: NOW });
  return approved;
}

test("H1", "Une collision FNV 32 bits ne garde plus l'approbation après modification du contenu", async () => {
  assert(fnvLegacy([COLLIDE[0], "x"]) === fnvLegacy([COLLIDE[1], "x"]), "la paire de collision du test est fausse");
  const approved = approvedMission(COLLIDE[0]);
  assert(validApproval(approved, NOW), "contrôle positif : l'approbation doit valoir sur le contenu approuvé");
  const tampered = { ...approved, objective: COLLIDE[1] };
  assert(!validApproval(tampered, NOW), `contenu modifié, approbation toujours valide (empreinte ${approved.approvals[0].contentHash})`);
});

test("H2", "Les nouvelles approbations portent une empreinte SHA-256 identique à crypto.subtle.digest", async () => {
  const approved = approvedMission();
  const hash = approved.approvals[0].contentHash;
  assert(SHA256.test(hash), `empreinte d'approbation non SHA-256 : ${hash}`);
  const parts = [approved.objective, approved.successCriterion];
  assert(hash === `sha256-${await webSha256(JSON.stringify(parts))}`, "SHA-256 node:crypto ≠ WebCrypto");
  assert(missionContentHash(approved) === hash, "missionContentHash diverge");
});

test("H3", "Une approbation FNV (legacy) ne valide ni clôture ni action externe, et est marquée legacy à la lecture", async () => {
  const base = createMission({ objective: "Objectif fictif legacy", successCriterion: "Critère fictif", ownerSlug: "office-klirline" }, "agent-a", { now: NOW });
  const legacy = {
    ...base,
    status: "in_review",
    approvals: [{ id: "apr-legacy", decision: "approve", contentHash: fnvMission(base), approverId: "coo", note: "", at: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 86400000).toISOString(), invalidatedAt: null }],
  };
  assert(!validApproval(legacy, NOW), "une approbation FNV valide encore le dossier");
  const act = prepareExternalAction(legacy, { type: "email", body: "Brouillon fictif" }, { actorId: "coo", now: NOW });
  assert(act.httpStatus === 403 && act.error === "Approbation manquante.", `action externe : ${act.error}`);
  const shown = presentMission(legacy, "coo", NOW);
  assert(shown.approvalValid === false, "approvalValid vrai avec une approbation FNV");
  const view = shown.approvals?.[0] || {};
  assert(view.legacy === true && view.hashAlgorithm === "fnv-legacy" && view.validatesActions === false && view.legacyMatchesContent === true,
    `approbation FNV non marquée legacy : ${JSON.stringify({ legacy: view.legacy, hashAlgorithm: view.hashAlgorithm })}`);
});

test("H4", "Chaque livrable déposé porte une empreinte SHA-256 de son contenu, vérifiable à la lecture", async () => {
  const store = memoryHqStore();
  const call = (method, pathname, body, who) => dispatchHq(store, { method, pathname, searchParams: new URLSearchParams(), body, actorId: who.actor, scopes: who.scopes, human: who.human === true, now: NOW });
  const A = { actor: "agent-a", scopes: ["work"] };
  const created = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, A);
  const mid = created.body.mission.id;
  const tid = created.body.mission.tasks[0].id;
  await call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" }, A);
  const st = await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {}, A);
  const body = "Livrable fictif pour l'empreinte.";
  const dl = await call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body }, A);
  assert(dl.status === 200, `dépôt ${dl.status} ${dl.body.error || ""}`);
  const item = dl.body.mission.deliverables[0];
  assert(SHA256.test(String(item.contentHash || "")), `livrable sans empreinte SHA-256 : ${item.contentHash}`);
  assert(item.contentHash === `sha256-${await webSha256(JSON.stringify(["livrable", body]))}`, "empreinte du livrable ≠ WebCrypto");
  assert(item.contentHashMatches === true && item.hashAlgorithm === "sha256", "vérification de lecture absente");
});

test("H5", "Une ancienne approbation FNV reste lisible (aucune perte de donnée) et une nouvelle approbation humaine la remplace", async () => {
  const base = createMission({ objective: "Objectif fictif reprise", successCriterion: "Critère fictif", ownerSlug: "office-klirline" }, "agent-a", { now: NOW });
  const legacy = { ...base, status: "in_review", approvals: [{ id: "apr-old", decision: "approve", contentHash: fnvMission(base), approverId: "coo", note: "", at: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 86400000).toISOString(), invalidatedAt: null }] };
  const renewed = decideMission(legacy, { decision: "approve" }, { actorId: "coo", human: true, now: NOW });
  assert(renewed.approvals.length === 2 && renewed.approvals[0].id === "apr-old", "l'ancienne approbation est perdue");
  assert(validApproval(renewed, NOW)?.id === renewed.approvals[1].id, "la nouvelle approbation SHA-256 ne vaut pas");
  assert(SHA256.test(renewed.approvals[1].contentHash), "nouvelle approbation non SHA-256");
});

test("O1", "Un même Client ID (ou jeton) déclaré par deux fiches de deux organisations est refusé", async () => {
  const clientId = `${"e".repeat(32)}.access`;
  const env = { HQ_MACHINE_IDENTITIES: JSON.stringify([
    { id: "dup-b", accessClientId: clientId, actorId: "machine-dup", orgId: "org-b", scopes: ["work"] },
    { id: "dup-a", accessClientId: clientId, actorId: "machine-dup", orgId: "org-a", scopes: ["work"] },
    { id: "tok-b", token: "jeton-factice-dup", actorId: "machine-tok", orgId: "org-b", scopes: ["work"] },
    { id: "tok-a", token: "jeton-factice-dup", actorId: "machine-tok", orgId: "org-a", scopes: ["work"] },
    { id: "seule", accessClientId: `${"f".repeat(32)}.access`, actorId: "machine-seule", orgId: "org-a", scopes: ["work"] },
  ]) };
  const dup = resolveServiceMachine(clientId, env);
  assert(dup === null, `fiche ambiguë acceptée, organisation choisie : ${dup?.orgId}`);
  const tok = authenticateMachine("Bearer jeton-factice-dup", env);
  assert(tok === null, `jeton ambigu accepté : ${tok?.id}`);
  assert(resolveServiceMachine(`${"f".repeat(32)}.access`, env)?.orgId === "org-a", "contrôle positif : une fiche unique doit passer");
});

let failed = 0;
for (const item of tests) {
  if (only.size && !only.has(item.id)) continue;
  try {
    await item.fn();
    console.log(`PASS ${item.id} — ${item.name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${item.id} — ${item.name}\n     ${error.message}`);
  }
}
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — régression HQ P1 intégrité");
process.exit(failed ? 1 : 0);
