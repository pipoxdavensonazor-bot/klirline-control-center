// Tests de régression du lot 2 (KCO-2026-LOT-2). 100 % local et en mémoire (memoryHqStore +
// dispatchHq) ou fonctions pures. Aucun réseau, aucun secret : valeurs factices.
// Usage : node scripts/hq-regression-lot2.mjs [ID ...]   (sans argument : tous les tests)
import { createHash } from "node:crypto";
import { dispatchHq } from "../src/hq/dispatch.js";
import { memoryHqStore } from "../src/hq/memory-store.js";
import * as missions from "../src/hq/missions.js";

const only = new Set(process.argv.slice(2));
const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const T0 = "2026-11-28T15:00:00.000Z";
const A = { actor: "agent-a", scopes: ["work"] };
const COO = { actor: "coo", scopes: ["work", "review"], human: true };
const sha = (text) => createHash("sha256").update(text).digest("hex");

function harness(orgId = "org-a") {
  const store = memoryHqStore();
  const call = async (method, pathname, body = {}, who = A, extra = {}) => {
    try {
      return await dispatchHq(store, {
        method, pathname, searchParams: new URLSearchParams(pathname.split("?")[1] || ""), body,
        actorId: who.actor, scopes: who.scopes, human: who.human === true, now: new Date(extra.now || T0), orgId: extra.orgId ?? orgId,
      });
    } catch (error) {
      return { status: error.status || 500, body: { error: error.message } };
    }
  };
  return { store, call };
}

// Mission en revue avec un livrable légitime ; renvoie aussi la fiche présentée à l'humain.
async function inReview(h) {
  const created = await h.call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, A);
  assert(created.status === 201, `mission ${created.status}`);
  const mid = created.body.mission.id;
  const tid = created.body.mission.tasks[0].id;
  await h.call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" }, A);
  const st = await h.call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {}, A);
  const dl = await h.call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Livrable fictif du lot 2." }, A);
  assert(dl.status === 200, `livrable ${dl.status} ${dl.body.error || ""}`);
  const rv = await h.call("POST", `/api/hq/missions/${mid}/transition`, { status: "in_review" }, A);
  assert(rv.status === 200, `revue ${rv.status}`);
  const shown = await h.call("GET", `/api/hq/missions/${mid}`, {}, COO);
  return { mid, tid, st, shown: shown.body.mission };
}
async function approveClose(h, m) {
  const ap = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve", presentedHash: m.shown.approvalRequest?.hash }, COO);
  assert(ap.status === 200 && ap.body.mission.approvalValid === true, `approbation ${ap.status} ${ap.body.error || ""}`);
  return ap.body.mission;
}
test("A1", "L'approbation exige l'empreinte du contenu présenté ; une empreinte périmée est refusée", async () => {
  const h = harness();
  const m = await inReview(h);
  assert(m.shown.approvalRequest?.schema === "klirline.hq.approval/v2", `aucune demande d'approbation v2 présentée : ${JSON.stringify(m.shown.approvalRequest)}`);
  const none = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve" }, COO);
  assert(none.status === 400, `approbation sans empreinte présentée : ${none.status}`);
  const stale = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve", presentedHash: `sha256-${"0".repeat(64)}` }, COO);
  assert(stale.status === 409, `approbation sur une empreinte périmée : ${stale.status}`);
  await approveClose(h, m);
});

test("A2", "Schéma canonique v2 : sujet complet, ordre des clés indifférent, SHA-256 identique à WebCrypto", async () => {
  const h = harness();
  const m = await inReview(h);
  const request = m.shown.approvalRequest || {};
  const subject = JSON.parse(request.canonical || "{}");
  for (const key of ["schema", "orgId", "missionId", "scope", "mission", "deliverables", "action"]) assert(Object.hasOwn(subject, key), `champ ${key} absent du sujet`);
  assert(subject.orgId === "org-a" && subject.missionId === m.mid && subject.deliverables[0]?.version === 1 && /^sha256-/.test(subject.deliverables[0]?.contentHash || ""), "contexte incomplet");
  const web = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request.canonical))).toString("hex");
  assert(request.hash === `sha256-${web}`, "SHA-256 ≠ WebCrypto");
  const a = missions.canonicalJson({ b: 1, a: { d: "x", c: [2, 1] } });
  const b = missions.canonicalJson({ a: { c: [2, 1], d: "x" }, b: 1 });
  assert(a === b && a === '{"a":{"c":[2,1],"d":"x"},"b":1}', `sérialisation non canonique : ${a}`);
  let threw = false;
  try { missions.canonicalJson({ amount: 1.5 }); } catch { threw = true; }
  assert(threw, "un nombre non entier est accepté dans le sujet");
});

test("A3", "Clôture : chaque mutation pertinente (objectif, critère, livrable, version, client, organisation) invalide l'approbation", async () => {
  const mutations = {
    objectif: (raw) => { raw.objective += " (modifié)"; },
    critere: (raw) => { raw.successCriterion += " (modifié)"; },
    livrable: (raw) => { raw.deliverables[0].body += " modifié"; },
    version: (raw) => { raw.deliverables[0].version = 2; },
    client: (raw) => { raw.clientId = "cli-atelier-nord"; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const h = harness();
    const m = await inReview(h);
    const approved = await approveClose(h, m);
    const tampered = JSON.parse(JSON.stringify(approved));
    mutate(tampered);
    assert(missions.validApproval(approved, new Date(T0), { orgId: "org-a" }), `${name} : contrôle positif`);
    assert(!missions.validApproval(tampered, new Date(T0), { orgId: "org-a" }), `${name} : approbation toujours valide après mutation`);
  }
  const h = harness();
  const m = await inReview(h);
  const approved = await approveClose(h, m);
  assert(!missions.validApproval(approved, new Date(T0), { orgId: "org-b" }), "organisation : approbation de org-a valable dans org-b");
  const close = await h.call("POST", `/api/hq/missions/${m.mid}/transition`, { status: "done", result: "Synthèse interne prête, aucune réservation." }, COO, { orgId: "org-b" });
  assert(close.status === 409, `clôture dans un autre contexte organisationnel : ${close.status}`);
  const ok = await h.call("POST", `/api/hq/missions/${m.mid}/transition`, { status: "done", result: "Synthèse interne prête, aucune réservation." }, COO);
  assert(ok.status === 200, `contrôle positif de clôture : ${ok.status} ${ok.body.error || ""}`);
});

test("A4", "Action externe : l'approbation porte sur l'action exacte ; destinataire, montant, devise, type, contenu, pièce jointe, paramètre, organisation l'invalident", async () => {
  const h = harness();
  const m = await inReview(h);
  const proposal = { type: "email", recipient: "prospect@example.test", body: "Invitation fictive.", attachments: [{ name: "plaquette.pdf", sha256: sha("plaquette v1") }], parameters: { campagne: "demo", relance: 1 }, amountCents: 0, currency: "CAD", idempotencyKey: "action-lot2-0001" };
  const draftCall = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, proposal, A);
  assert(draftCall.status === 403 && draftCall.body.error === "Approbation manquante." && draftCall.body.draftId, `proposition : ${draftCall.status} ${draftCall.body.error}`);
  const draftId = draftCall.body.draftId;
  const shown = (await h.call("GET", `/api/hq/missions/${m.mid}`, {}, COO)).body.mission;
  const request = shown.drafts.find((item) => item.id === draftId)?.approvalRequest;
  assert(request?.scope === "external-action", "aucune demande d'approbation d'action présentée");
  const closeOnly = await approveClose(h, m);
  const notAction = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { draftId }, A);
  assert(notAction.body.error === "Approbation manquante." && closeOnly.approvalValid, "l'approbation de clôture autorise l'action externe");
  const ap = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve", actionId: draftId, presentedHash: request.hash }, COO);
  assert(ap.status === 200, `approbation de l'action : ${ap.status} ${ap.body.error || ""}`);
  const go = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { draftId }, A);
  assert(go.body.error?.startsWith("Envoi désactivé"), `contrôle positif : ${go.body.error}`);
  const conflict = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { draftId, recipient: "autre@example.test" }, A);
  assert(conflict.status === 409, `conflit de paramètres accepté : ${conflict.status}`);
  const approvedMission = await h.store.missionGet(m.mid);
  const mutations = {
    destinataire: (d) => { d.recipient = "autre@example.test"; },
    montant: (d) => { d.amount.cents = 100; },
    devise: (d) => { d.amount.currency = "USD"; },
    type: (d) => { d.type = "sms"; },
    contenu: (d) => { d.body = "Invitation fictive modifiée."; },
    piece_jointe: (d) => { d.attachments[0].sha256 = sha("plaquette v2"); },
    ajout_piece: (d) => { d.attachments.push({ name: "autre.pdf", sha256: sha("x") }); },
    parametre: (d) => { d.parameters.relance = 2; },
  };
  const draft0 = approvedMission.drafts.find((item) => item.id === draftId);
  assert(missions.validApproval(approvedMission, new Date(T0), { orgId: "org-a", draft: draft0 }), "contrôle positif de l'action");
  assert(!missions.validApproval(approvedMission, new Date(T0), { orgId: "org-b", draft: draft0 }), "organisation : approbation d'action valable dans org-b");
  for (const [name, mutate] of Object.entries(mutations)) {
    const copy = JSON.parse(JSON.stringify(approvedMission));
    const draft = copy.drafts.find((item) => item.id === draftId);
    mutate(draft);
    assert(!missions.validApproval(copy, new Date(T0), { orgId: "org-a", draft }), `${name} : approbation toujours valide après mutation`);
  }
});

test("A5", "Action externe automatisée : Idempotency-Key obligatoire ; même clé + autre action = conflit ; machine n'approuve pas", async () => {
  const h = harness();
  const m = await inReview(h);
  const noKey = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { type: "email", recipient: "a@example.test", body: "Sans clé." }, A);
  assert(noKey.status === 400, `machine sans Idempotency-Key : ${noKey.status} ${noKey.body.error || ""}`);
  const first = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { type: "email", recipient: "a@example.test", body: "Avec clé.", idempotencyKey: "action-lot2-0002" }, A);
  const again = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { type: "email", recipient: "a@example.test", body: "Avec clé.", idempotencyKey: "action-lot2-0002" }, A);
  assert(first.body.draftId && again.body.draftId === first.body.draftId && again.body.mission.drafts.length === 1, "la même clé crée un second brouillon");
  const other = await h.call("POST", `/api/hq/missions/${m.mid}/actions`, { type: "email", recipient: "b@example.test", body: "Avec clé.", idempotencyKey: "action-lot2-0002" }, A);
  assert(other.status === 409, `même clé, autre destinataire : ${other.status}`);
  const shown = (await h.call("GET", `/api/hq/missions/${m.mid}`, {}, COO)).body.mission;
  const req = shown.drafts[0].approvalRequest;
  const machine = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve", actionId: first.body.draftId, presentedHash: req.hash }, { actor: "coo", scopes: ["review"], human: false });
  assert(machine.status === 403, `machine approuve une action : ${machine.status}`);
});

test("A6", "Anciennes approbations (FNV et SHA-256 v1) : conservées, marquées legacy, ne valident rien", async () => {
  const h = harness();
  const m = await inReview(h);
  const raw = await h.store.missionGet(m.mid);
  const v1 = { id: "apr-v1", decision: "approve", contentHash: missions.missionContentHash(raw), approverId: "coo", note: "", at: T0, expiresAt: "2026-12-30T00:00:00.000Z", invalidatedAt: null };
  const withV1 = { ...raw, approvals: [v1] };
  assert(!missions.validApproval(withV1, new Date(T0), { orgId: "org-a" }), "une approbation SHA-256 v1 (sans schéma) valide encore la clôture");
  const shown = missions.presentMission(withV1, "coo", new Date(T0), "org-a");
  assert(shown.approvals[0].legacy === true && shown.approvals[0].validatesActions === false, "approbation v1 non marquée legacy");
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
if (only.size && ![...only].every((id) => tests.some((item) => item.id === id))) {
  console.log(`FAIL test inconnu : ${[...only].filter((id) => !tests.some((item) => item.id === id)).join(",")}`);
  failed += 1;
}
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — régression HQ lot 2");
process.exit(failed ? 1 : 0);
