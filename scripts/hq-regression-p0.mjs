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
  const forcedS = await h.patch(id2, { status: " running " }, B);
  assert(forcedS.status === 409, `PATCH « running » avec espaces sans claim ${forcedS.status}`);
  const forcedD = await h.patch(id2, { status: "dispatched" }, B);
  assert(forcedD.status === 409, `PATCH dispatched sans claim ${forcedD.status}`);
});

// ---------- T9 : réouverture d'une commande terminale ----------
test("T9", "Une commande terminée ne se rouvre que par un humain ; l'empreinte du jeton n'est jamais exposée", async () => {
  const h = harness();
  const id = await h.cmd("T9 terminale"); const a = await h.claim(id, A);
  const cred = { attemptId: a.body.command.claim.attemptId, claimToken: a.body.claimToken };
  const done = await h.patch(id, { status: "done", proof: "fini", ...cred }, A);
  assert(done.status === 200, `done ${done.status}`);
  const shown = JSON.stringify([done.body, (await h.get(id)).body, (await h.call("GET", "/api/hq/commands", {}, A)).body]);
  assert(!shown.includes("completedTokenHash") && !shown.includes("tokenHash"), "l'empreinte du jeton de la tentative terminée est exposée");
  for (const [who, label] of [[SVC, "service:hq-poll"], [B, "tiers work"], [{ ...COO_MACHINE }, "machine review"]]) {
    const reopen = await h.patch(id, { status: "pending" }, who);
    assert(reopen.status >= 400, `réouverture par ${label} ${reopen.status}`);
  }
  const reopenA = await h.patch(id, { status: "pending", ...cred }, A);
  assert(reopenA.status === 409, `réouverture par l'ancien titulaire ${reopenA.status}`);
  const c2 = await h.claim(id, B);
  assert(c2.status === 409 && !c2.body.claimToken, `claim après tentative de réouverture ${c2.status}/${c2.body.outcome}`);
  const dup = await h.patch(id, { status: "done", proof: "fini", ...cred }, A);
  assert(dup.status === 200 && dup.body.outcome === "duplicate", `contrôle positif : renvoi identique ${dup.status}/${dup.body.outcome}`);
  for (const terminal of ["failed", "cancelled"]) {
    const idT = await h.cmd(`T9 ${terminal}`); const aT = await h.claim(idT, A);
    const closeT = await h.patch(idT, { status: terminal, agentNote: "clos", attemptId: aT.body.command.claim.attemptId, claimToken: aT.body.claimToken }, A);
    assert(closeT.status === 200, `${terminal} ${closeT.status} ${closeT.body.error || ""}`);
    const reopenT = await h.patch(idT, { status: "pending" }, B);
    assert(reopenT.status === 409, `réouverture ${terminal} par un tiers ${reopenT.status}`);
  }
  const human = await h.patch(id, { status: "pending", agentNote: "Réouverture décidée par Philippe." }, COO_HUMAN);
  assert(human.status === 200 && human.body.command.status === "pending", `contrôle positif : réouverture humaine ${human.status} ${human.body.error || ""}`);
});

// ---------- T12 : livrable ou preuve falsifiés ----------
test("T12", "Livrable et preuve liés à la tentative : ni machine review, ni tiers, ni humain sans jeton ne déposent", async () => {
  const h = harness();
  const m = await h.mission(A);
  const st = await h.call("POST", `/api/hq/missions/${m.mid}/tasks/${m.tid}/start`, {}, A);
  const intruder = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, body: "Livrable inventé par B sans jeton." }, B);
  assert(intruder.status >= 400, `B sans jeton ${intruder.status}`);
  const coo = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, body: "Livrable déposé par une machine coo sans jeton." }, COO_MACHINE);
  assert(coo.status >= 400, `machine coo/review sans jeton ${coo.status}`);
  const humanNoToken = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, body: "Livrable humain sans tentative." }, COO_HUMAN);
  assert(humanNoToken.status >= 400, `humain sans jeton ${humanNoToken.status}`);
  const legit = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Livrable légitime de A." }, A);
  assert(legit.status === 200 && legit.body.mission.deliverables.length === 1, `contrôle positif : livrable légitime ${legit.status} ${legit.body.error || ""}`);
  const over = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, body: "Trois démonstrations réservées et confirmées." }, B);
  assert(over.status >= 400, `B sans jeton après livraison ${over.status} état=${over.body.mission?.status}`);
  const overCoo = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, body: "Révision par machine review." }, COO_MACHINE);
  assert(overCoo.status >= 400, `machine review après livraison ${overCoo.status}`);
  const unchanged = await h.call("GET", `/api/hq/missions/${m.mid}`, {}, A);
  assert(unchanged.body.mission.status === "running" && unchanged.body.mission.deliverables.length === 1, `mission modifiée : ${unchanged.body.mission.status}/${unchanged.body.mission.deliverables.length}`);
  const revision = await h.call("POST", `/api/hq/missions/${m.mid}/deliverables`, { taskId: m.tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Révision par le titulaire de la tentative terminée." }, A);
  assert(revision.status === 200 && revision.body.mission.status === "rework", `contrôle positif : révision par le titulaire ${revision.status} ${revision.body.error || ""}`);
  // Preuve de commande : la portée review ne remplace plus le jeton, même hors bail.
  const id = await h.cmd("T12 preuve");
  const fakePending = await h.patch(id, { status: "done", proof: "Preuve inventée" }, COO_MACHINE);
  assert(fakePending.status === 409, `PATCH done hors bail par machine review ${fakePending.status}`);
  await h.claim(id, A);
  const fake = await h.patch(id, { status: "done", proof: "Preuve inventée" }, COO_MACHINE);
  assert(fake.status === 409, `PATCH done sous bail par machine review ${fake.status}`);
  const humanClose = await h.patch(id, { status: "done", proof: "Clôture décidée par un humain." }, COO_HUMAN);
  assert(humanClose.status === 200, `contrôle positif : clôture humaine ${humanClose.status} ${humanClose.body.error || ""}`);
});

// ---------- T5 : création de commandes en doublon ----------
test("T5", "Idempotency-Key : la même clé du même auteur renvoie la même commande (y compris en simultané)", async () => {
  const h = harness();
  const body = { text: "T5 avec clé", ownerSlug: "sandbox-klirline", idempotencyKey: "cle-t5" };
  const [r1, r2] = await Promise.all([h.call("POST", "/api/hq/command", body, A), h.call("POST", "/api/hq/command", body, A)]);
  const ids = [r1.body.command?.id, r2.body.command?.id];
  assert(ids[0] && ids[0] === ids[1], `ids distincts en simultané : ${ids.join(" / ")} (${r1.status},${r2.status})`);
  assert([r1.status, r2.status].sort().join() === "200,201", `statuts ${r1.status},${r2.status} (201 puis 200 attendus)`);
  const again = await h.call("POST", "/api/hq/command", body, A);
  assert(again.status === 200 && again.body.outcome === "duplicate" && again.body.command.id === ids[0], `renvoi ${again.status}/${again.body.outcome}`);
  const list = await h.call("GET", "/api/hq/commands", {}, A);
  assert(list.body.commands.filter((c) => c.text === "T5 avec clé").length === 1, "plus d'une commande enregistrée");
  const conflict = await h.call("POST", "/api/hq/command", { ...body, text: "Autre texte, même clé" }, A);
  assert(conflict.status === 409, `même clé, autre commande ${conflict.status}`);
  const other = await h.call("POST", "/api/hq/command", body, B);
  assert(other.status === 201 && other.body.command.id !== ids[0], `la clé d'un autre auteur ne doit pas collisionner ${other.status}`);
  const bad = await h.call("POST", "/api/hq/command", { ...body, idempotencyKey: "clé avec espaces" }, A);
  assert(bad.status === 400, `clé illisible ${bad.status}`);
  const noKey = await Promise.all([h.cmd("T5 sans clé"), h.cmd("T5 sans clé")]);
  assert(noKey[0] && noKey[1] && noKey[0] !== noKey[1], "sans clé, deux POST restent deux commandes (comportement documenté)");
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
