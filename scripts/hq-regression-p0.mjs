// Tests de régression des défauts HQ P0/P1 (banc phase 5 du 23 nov. 2026 : I1, I2, T1, T3, T4, T5, T9, T12, E1).
// 100 % local et en mémoire (memoryHqStore + dispatchHq). Aucun réseau, aucun secret : valeurs factices.
// E1 dépend du Durable Object (fenêtre SQL de 200) : voir scripts/hq-do-regression-p0.mjs.
// Usage : node scripts/hq-regression-p0.mjs [ID ...]   (sans argument : tous les tests)
import { identityFromAccess } from "../src/access.js";
import { dispatchHq } from "../src/hq/dispatch.js";
import { authenticateMachine, identifyAccess, resolveServiceMachine } from "../src/hq/machine-auth.js";
import { memoryHqStore } from "../src/hq/memory-store.js";

const only = new Set(process.argv.slice(2));
const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const T0 = "2026-11-23T15:00:00.000Z";
const A = { actor: "agent-a", scopes: ["work"] };
const B = { actor: "agent-b", scopes: ["work"] };
const SVC = { actor: "service:hq-poll", scopes: undefined };
const EMPTY = { actor: "intrus", scopes: [] };
const COO_MACHINE = { actor: "coo", scopes: ["work", "review"], human: false };
const COO_HUMAN = { actor: "coo", scopes: ["work", "review"], human: true };

function harness() {
  const store = memoryHqStore();
  const call = async (method, pathname, body = {}, who = A, now = T0) => {
    try {
      return await dispatchHq(store, {
        method,
        pathname,
        searchParams: new URLSearchParams(pathname.split("?")[1] || ""),
        body,
        actorId: who.actor,
        scopes: who.scopes,
        human: who.human === true,
        now: new Date(now),
      });
    } catch (error) {
      return { status: error.status || 500, body: { error: error.message } };
    }
  };
  const cmd = async (text, who = A, extra = {}) => (await call("POST", "/api/hq/command", { text, ownerSlug: "sandbox-klirline", ...extra }, who)).body?.command?.id;
  const claim = (id, who = A, now = T0) => call("POST", `/api/hq/commands/${id}/claim`, {}, who, now);
  const patch = (id, body, who, now = T0) => call("PATCH", `/api/hq/commands/${id}`, body, who, now);
  const get = (id) => call("GET", `/api/hq/commands/${id}`, {}, A);
  const mission = async (who = A) => {
    const created = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, who);
    assert(created.status === 201, `mission ${created.status} ${created.body?.error || ""}`);
    const mid = created.body.mission.id;
    const tid = created.body.mission.tasks[0].id;
    await call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" }, who);
    return { mid, tid };
  };
  return { store, call, cmd, claim, patch, get, mission };
}

// ---------- I1 : jeton de service Access sans fiche machine ----------
test("I1", "Un jeton de service sans fiche HQ_MACHINE_IDENTITIES est refusé (plus de repli service:hq-poll sans portées)", async () => {
  const accounts = [{ email: "humain@example.test", role: "ceo", orgId: "klirline" }];
  let status = null;
  let identity = null;
  try {
    identity = identityFromAccess({ kind: "service", clientId: `${"0".repeat(32)}.access` }, accounts);
  } catch (error) {
    status = error.status;
  }
  assert(identity === null, `repli accepté : ${JSON.stringify(identity)}`);
  assert(status === 403, `statut ${status}, 403 attendu`);
  const human = identityFromAccess({ kind: "user", email: "humain@example.test" }, accounts);
  assert(human.actorId === "ceo" && human.service === false, "contrôle positif : le courriel humain ne choisit plus son rôle");
});

// ---------- I2 : une fiche machine ne porte jamais un rôle humain validateur ----------
test("I2", "Une fiche machine ne peut pas porter coo, ceo ou chief-of-staff", async () => {
  const cn = `${"a".repeat(32)}.access`;
  for (const actorId of ["coo", "ceo", "chief-of-staff"]) {
    const env = { HQ_MACHINE_IDENTITIES: JSON.stringify([{ id: "m1", actorId, orgId: "klirline", accessClientId: cn, token: "jeton-factice-i2", scopes: ["review"] }]) };
    assert(resolveServiceMachine(cn, env) === null, `resolveServiceMachine accepte ${actorId}`);
    assert(authenticateMachine("Bearer jeton-factice-i2", env) === null, `authenticateMachine accepte ${actorId}`);
    assert(identifyAccess({ kind: "service", commonName: cn }, env).status === 403, `identifyAccess accepte ${actorId}`);
  }
  const okEnv = { HQ_MACHINE_IDENTITIES: JSON.stringify([{ id: "m3", actorId: "machine-klirprospect", orgId: "klirline", accessClientId: cn, scopes: ["work"] }]) };
  const ok = resolveServiceMachine(cn, okEnv);
  assert(ok && ok.actorId === "machine-klirprospect" && ok.human === false && ok.scopes.join() === "work", "contrôle positif : une fiche machine ordinaire n'est plus résolue");
});

// ---------- T3 : approbation et clôture A3 par une machine ----------
async function missionInReview(h) {
  const m = await h.mission(A);
  const st = await h.call("POST", `/api/hq/missions/${m.mid}/tasks/${m.tid}/start`, {}, A);
  assert(st.status === 200 && st.body.claimToken, `démarrage ${st.status} ${st.body.error || ""}`);
  const dl = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Livrable de sonde, fictif." }, A);
  assert(dl.status === 200, `livrable légitime ${dl.status} ${dl.body.error || ""}`);
  const rv = await h.call("POST", `/api/hq/missions/${m.mid}/transition`, { status: "in_review" }, A);
  assert(rv.status === 200, `revue ${rv.status} ${rv.body.error || ""}`);
  return { ...m, st };
}
test("T3", "Une machine (human=false) n'approuve ni ne clôt une mission A3 ; un humain coo le peut", async () => {
  const h = harness();
  const m = await missionInReview(h);
  const ap = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve" }, { actor: "coo", scopes: ["review"], human: false });
  assert(ap.status === 403, `approbation machine ${ap.status} approvalValid=${ap.body.mission?.approvalValid}`);
  const human = await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve" }, { actor: "coo", scopes: ["review"], human: true });
  assert(human.status === 200 && human.body.mission.approvalValid === true, `contrôle positif humain ${human.status} ${human.body.error || ""}`);
  const close = await h.call("POST", `/api/hq/missions/${m.mid}/transition`, { status: "done", result: "Synthèse interne prête, aucune réservation." }, { actor: "coo", scopes: ["review"], human: false });
  assert(close.status === 403, `clôture machine ${close.status} statut=${close.body.mission?.status}`);
  const closeHuman = await h.call("POST", `/api/hq/missions/${m.mid}/transition`, { status: "done", result: "Synthèse interne prête, aucune réservation." }, { actor: "coo", scopes: ["review"], human: true });
  assert(closeHuman.status === 200 && closeHuman.body.mission.status === "done", `clôture humaine ${closeHuman.status} ${closeHuman.body.error || ""}`);
});

// ---------- T4 : annulation / interruption sans permission ----------
test("T4", "Annulation et interruption refusées sans portée ou hors titulaire ; titulaire et humain acceptés", async () => {
  const h = harness();
  const id1 = await h.cmd("T4 annulation"); const a1 = await h.claim(id1, A);
  assert(a1.body.outcome === "issued", "claim A");
  const c1 = await h.patch(id1, { status: "cancelled" }, EMPTY);
  assert(c1.status === 403, `annulation scopes=[] ${c1.status}`);
  const c2 = await h.patch(id1, { status: "cancelled" }, SVC);
  assert(c2.status === 403, `annulation sans portées (service:hq-poll) ${c2.status}`);
  const i1 = await h.call("POST", `/api/hq/commands/${id1}/interrupt`, { note: "sonde" }, EMPTY);
  assert(i1.status === 403, `interruption scopes=[] ${i1.status}`);
  const i2 = await h.call("POST", `/api/hq/commands/${id1}/interrupt`, { note: "sonde" }, SVC);
  assert(i2.status === 403, `interruption sans portées ${i2.status}`);
  const i3 = await h.call("POST", `/api/hq/commands/${id1}/interrupt`, { note: "sonde" }, B);
  assert(i3.status === 403, `interruption par un tiers work ${i3.status}`);
  const still = await h.get(id1);
  assert(still.body.command.status === "dispatched" && still.body.command.claim.holder === "agent-a", "la commande a changé");
  const iA = await h.call("POST", `/api/hq/commands/${id1}/interrupt`, { note: "arrêt demandé par le titulaire" }, A);
  assert(iA.status === 200, `contrôle positif : interruption par le titulaire ${iA.status}`);
  const iH = await h.call("POST", `/api/hq/commands/${id1}/interrupt`, { note: "arrêt humain" }, COO_HUMAN);
  assert(iH.status === 200, `contrôle positif : interruption humaine ${iH.status}`);
  const cA = await h.patch(id1, { status: "cancelled", attemptId: a1.body.command.claim.attemptId, claimToken: a1.body.claimToken }, A);
  assert(cA.status === 200 && cA.body.command.status === "cancelled", `contrôle positif : annulation par le titulaire ${cA.status} ${cA.body.error || ""}`);
  const svcPost = await h.call("POST", "/api/hq/command", { text: "création sans portée", ownerSlug: "sandbox-klirline" }, SVC);
  assert(svcPost.status === 403, `création sans portées ${svcPost.status}`);
  const id2 = await h.cmd("T4 claim sans portée");
  const svcClaim = await h.claim(id2, SVC);
  assert(svcClaim.status === 403, `claim sans portées ${svcClaim.status}`);
});

// ---------- T1 : reprise d'une commande sous bail sans jeton ----------
test("T1", "Sans le jeton de la tentative en cours, un tiers ne change pas une commande sous bail", async () => {
  const h = harness();
  const id = await h.cmd("T1 reprise"); const a = await h.claim(id, A);
  const cred = { attemptId: a.body.command.claim.attemptId, claimToken: a.body.claimToken };
  const done = await h.patch(id, { status: "done", proof: "faux" }, B);
  assert(done.status === 409, `PATCH done B sans jeton ${done.status}`);
  const reset = await h.patch(id, { status: "pending" }, B);
  assert(reset.status === 409, `PATCH pending B sans jeton ${reset.status}`);
  const run = await h.patch(id, { status: "running" }, B);
  assert(run.status === 409, `PATCH running B sans jeton ${run.status}`);
  const cancel = await h.patch(id, { status: "cancelled" }, B);
  assert(cancel.status === 409, `PATCH cancelled B sans jeton ${cancel.status}`);
  const bareA = await h.patch(id, { status: "pending" }, A);
  assert(bareA.status === 409, `PATCH pending A sans jeton ${bareA.status}`);
  const b = await h.claim(id, B);
  assert(b.body.outcome === "held" && !b.body.claimToken, `claim B ${b.status}/${b.body.outcome}`);
  const runA = await h.patch(id, { status: "running", ...cred }, A);
  assert(runA.status === 200 && runA.body.command.status === "running", `contrôle positif : running par le titulaire ${runA.status} ${runA.body.error || ""}`);
  const doneA = await h.patch(id, { status: "done", proof: "Preuve du titulaire", ...cred }, A);
  assert(doneA.status === 200 && doneA.body.command.status === "done", `contrôle positif : done par le titulaire ${doneA.status} ${doneA.body.error || ""}`);
  // Entrer en dispatched/running hors claim est refusé (sinon : running sans bail, cf. hq-33ebcef6).
  const id2 = await h.cmd("T1 running sans claim");
  const forced = await h.patch(id2, { status: "running" }, B);
  assert(forced.status === 409, `PATCH running sans claim ${forced.status}`);
  const forcedD = await h.patch(id2, { status: "dispatched" }, B);
  assert(forcedD.status === 409, `PATCH dispatched sans claim ${forcedD.status}`);
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
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — régression HQ P0");
process.exit(failed ? 1 : 0);
