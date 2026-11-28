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
        method, pathname: pathname.split("?")[0], searchParams: new URLSearchParams(pathname.split("?")[1] || ""), body,
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

test("C1", "T11 : coût invalide, négatif, non fini ou fractionnaire refusé (400) ; dépassement du plafond refusé (409) ; rien n'est enregistré", async () => {
  const h = harness();
  const created = await h.call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, A);
  const mid = created.body.mission.id; const tid = created.body.mission.tasks[0].id;
  await h.call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" }, A);
  for (const bad of ["abc", "5", -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60, true, { v: 1 }]) {
    const r = await h.call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, { costCents: bad }, A);
    assert(r.status === 400, `coût ${String(bad)} : ${r.status} (attendu 400)`);
  }
  const over = await h.call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, { costCents: 1 }, A);
  assert(over.status === 409, `dépassement : ${over.status}`);
  const after = await h.call("GET", `/api/hq/missions/${mid}`, {}, A);
  assert(after.body.mission.cost.spentCents === 0 && after.body.mission.tasks[0].status !== "running", `état modifié : ${JSON.stringify(after.body.mission.cost)} ${after.body.mission.tasks[0].status}`);
  const ok = await h.call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, { costCents: 0 }, A);
  assert(ok.status === 200 && ok.body.started === true, `contrôle positif coût 0 : ${ok.status}`);
});

const B = { actor: "agent-b", scopes: ["work"] };
async function claimed(h, text = "Commande fictive lot 2") {
  const c = await h.call("POST", "/api/hq/command", { text, ownerSlug: "sandbox-klirline" }, A);
  const id = c.body.command.id;
  const cl = await h.call("POST", `/api/hq/commands/${id}/claim`, {}, A);
  return { id, attemptId: cl.body.command.claim.attemptId, claimToken: cl.body.claimToken, leaseUntil: cl.body.command.claim.leaseUntil };
}
test("D1", "T6 : seul le titulaire (attemptId + claimToken) prolonge le bail ; tiers, sans jeton, mauvais jeton, sans portée : refusés", async () => {
  const h = harness();
  const c = await claimed(h);
  const hb = (body, who, now) => h.call("POST", `/api/hq/commands/${c.id}/heartbeat`, body, who, { now });
  const noToken = await hb({ attemptId: c.attemptId }, B, "2026-11-28T15:10:00.000Z");
  const wrong = await hb({ attemptId: c.attemptId, claimToken: "jeton-faux" }, B, "2026-11-28T15:10:00.000Z");
  const noScope = await hb({ attemptId: c.attemptId, claimToken: c.claimToken }, { actor: "agent-a", scopes: [] }, "2026-11-28T15:10:00.000Z");
  const forged = await hb({ attemptId: c.attemptId, claimToken: c.claimToken, actorId: "ceo" }, A, "2026-11-28T15:10:00.000Z");
  assert(noToken.status === 409 && wrong.status === 409 && noScope.status === 403 && forged.status === 400, `refus attendus : ${noToken.status} ${wrong.status} ${noScope.status} ${forged.status}`);
  const same = await h.call("GET", `/api/hq/commands/${c.id}`);
  assert(same.body.command.claim.leaseUntil === c.leaseUntil, "le bail a bougé après un heartbeat refusé");
  const ok = await hb({ attemptId: c.attemptId, claimToken: c.claimToken }, A, "2026-11-28T15:20:00.000Z");
  assert(ok.status === 200 && ok.body.outcome === "extended" && ok.body.command.claim.leaseUntil === "2026-11-28T15:50:00.000Z", `contrôle positif : ${ok.status} ${JSON.stringify(ok.body.command?.claim)}`);
  const held = await h.call("POST", `/api/hq/commands/${c.id}/claim`, {}, B, { now: "2026-11-28T15:40:00.000Z" });
  assert(held.body.outcome === "held", `bail prolongé non respecté : ${held.body.outcome}`);
});
test("D2", "T7 : un heartbeat après expiration est refusé (409) ; la reprise passe par un claim et l'ancien jeton reste refusé", async () => {
  const h = harness();
  const c = await claimed(h);
  const hb = (body, now) => h.call("POST", `/api/hq/commands/${c.id}/heartbeat`, body, A, { now });
  const early = await hb({ attemptId: c.attemptId, claimToken: c.claimToken }, "2026-11-28T15:05:00.000Z");
  assert(early.status === 200, `heartbeat à +5 min : ${early.status}`);
  const late = await hb({ attemptId: c.attemptId, claimToken: c.claimToken }, "2026-11-28T16:00:00.000Z");
  assert(late.status === 409 && late.body.outcome === "expired", `heartbeat à +60 min : ${late.status} ${late.body.outcome}`);
  const re = await h.call("POST", `/api/hq/commands/${c.id}/claim`, {}, B, { now: "2026-11-28T16:00:01.000Z" });
  assert(re.body.outcome === "reclaimed", `reprise : ${re.body.outcome}`);
  const old = await hb({ attemptId: c.attemptId, claimToken: c.claimToken }, "2026-11-28T16:00:02.000Z");
  assert(old.status === 409, `ancien jeton après reprise : ${old.status}`);
  const done = await h.call("POST", "/api/hq/command", { text: "Commande close", ownerSlug: "sandbox-klirline" }, A);
  const pend = await h.call("POST", `/api/hq/commands/${done.body.command.id}/heartbeat`, { attemptId: "x", claimToken: "y" }, A);
  assert(pend.status === 409, `heartbeat sans bail : ${pend.status}`);
});

test("D3", "T13 : à la lecture, un bail dispatched expiré est remis en file (pending) et un running expiré est bloqué ; l'ancien jeton est refusé", async () => {
  const h = harness();
  const d = await claimed(h, "Commande abandonnée");
  const r = await claimed(h, "Commande en cours abandonnée");
  await h.call("PATCH", `/api/hq/commands/${r.id}`, { status: "running", attemptId: r.attemptId, claimToken: r.claimToken }, A);
  const early = await h.call("GET", `/api/hq/commands/${d.id}`, {}, A, { now: "2026-11-28T15:10:00.000Z" });
  assert(early.body.command.status === "dispatched", `bail actif modifié : ${early.body.command.status}`);
  const poll = await h.call("GET", "/api/hq/commands?status=pending", {}, { actor: "service:hq-poll", scopes: ["work"] }, { now: "2026-11-28T18:00:00.000Z" });
  assert(poll.status === 200 && poll.body.commands.some((c) => c.id === d.id), `le poll ne revoit pas la commande abandonnée : ${poll.status} ${poll.body.error || ""}`);
  const one = await h.call("GET", `/api/hq/commands/${d.id}`, {}, A, { now: "2026-11-28T18:00:00.000Z" });
  const run = await h.call("GET", `/api/hq/commands/${r.id}`, {}, A, { now: "2026-11-28T18:00:00.000Z" });
  assert(one.body.command.status === "pending" && one.body.command.claim === null, `dispatched expiré : ${one.body.command.status}`);
  assert(run.body.command.status === "blocked", `running expiré : ${run.body.command.status}`);
  const old = await h.call("PATCH", `/api/hq/commands/${d.id}`, { status: "done", proof: "ancienne", attemptId: d.attemptId, claimToken: d.claimToken }, A, { now: "2026-11-28T18:00:01.000Z" });
  assert(old.status === 409, `ancien jeton après remise en file : ${old.status}`);
  const again = await h.call("POST", `/api/hq/commands/${d.id}/claim`, {}, B, { now: "2026-11-28T18:00:02.000Z" });
  assert(again.body.outcome === "issued", `nouvelle prise : ${again.body.outcome}`);
});

test("B1", "Hors bail : un tiers « work » non auteur ne modifie pas une commande pending/blocked ; l'auteur, la revue et l'humain le peuvent", async () => {
  const h = harness();
  const c = await h.call("POST", "/api/hq/command", { text: "Commande hors bail", ownerSlug: "sandbox-klirline" }, A);
  const id = c.body.command.id;
  const third = await h.call("PATCH", `/api/hq/commands/${id}`, { status: "cancelled", agentNote: "annulée par un tiers" }, B);
  const thirdBlock = await h.call("PATCH", `/api/hq/commands/${id}`, { status: "blocked", agentNote: "bloquée par un tiers" }, B);
  assert(third.status === 403 && thirdBlock.status === 403, `tiers hors bail : ${third.status} ${thirdBlock.status}`);
  const author = await h.call("PATCH", `/api/hq/commands/${id}`, { status: "blocked", agentNote: "Bloquée par l'auteur." }, A);
  assert(author.status === 200 && author.body.command.status === "blocked", `auteur : ${author.status}`);
  const reviewer = await h.call("PATCH", `/api/hq/commands/${id}`, { status: "pending", agentNote: "Remise en file par la revue." }, { actor: "ops-review", scopes: ["review"] });
  assert(reviewer.status === 200, `revue : ${reviewer.status} ${reviewer.body.error || ""}`);
  const after = await h.call("GET", `/api/hq/commands/${id}`);
  assert(after.body.command.status === "pending", `état final ${after.body.command.status}`);
});
test("B2", "Dérogation humaine : justification obligatoire (overrideReason) et tracée ; sans elle, refus et aucun changement", async () => {
  const h = harness();
  const c = await claimed(h, "Commande sous bail, dérogation");
  const bare = await h.call("PATCH", `/api/hq/commands/${c.id}`, { status: "done", proof: "Clôture humaine" }, COO);
  const short = await h.call("PATCH", `/api/hq/commands/${c.id}`, { status: "done", proof: "Clôture humaine", overrideReason: "court" }, COO);
  assert(bare.status === 400 && short.status === 400, `sans justification : ${bare.status} ${short.status}`);
  const still = await h.call("GET", `/api/hq/commands/${c.id}`, {}, A, { now: "2026-11-28T15:01:00.000Z" });
  assert(still.body.command.status === "dispatched", `changement malgré le refus : ${still.body.command.status}`);
  const ok = await h.call("PATCH", `/api/hq/commands/${c.id}`, { status: "done", proof: "Clôture humaine", overrideReason: "Agent injoignable, livrable vérifié à la main." }, COO);
  assert(ok.status === 200 && ok.body.command.status === "done", `avec justification : ${ok.status} ${ok.body.error || ""}`);
  const o = ok.body.command.overrides?.at(-1);
  assert(o && o.actorId === "coo" && o.from === "dispatched" && o.to === "done" && o.reason.startsWith("Agent injoignable"), `trace : ${JSON.stringify(ok.body.command.overrides)}`);
  const reopen = await h.call("PATCH", `/api/hq/commands/${c.id}`, { status: "pending" }, COO);
  assert(reopen.status === 400, `réouverture sans justification : ${reopen.status}`);
  const holder = await claimed(h, "Titulaire sans dérogation");
  const own = await h.call("PATCH", `/api/hq/commands/${holder.id}`, { status: "done", proof: "Fait", attemptId: holder.attemptId, claimToken: holder.claimToken }, A);
  assert(own.status === 200 && !own.body.command.overrides, `titulaire : ${own.status} ${JSON.stringify(own.body.command?.overrides)}`);
});

test("I1", "Contrôle avant déploiement : identités ambiguës (Client ID ou jeton partagé, id en double), rôle humain, portées, organisation : refus, sans afficher de secret", async () => {
  let check;
  try { ({ checkIdentityConfig: check } = await import("../src/hq/identity-check.js")); } catch (error) { throw new Error(`contrôle absent : ${error.message}`); }
  const cid = `${"a1".repeat(16)}.access`;
  // Valeurs factices construites à l'exécution (pas de littéral qui ressemble à une clé).
  const fakeShared = ["jeton", "factice", "partage"].join("-");
  const fakeOther = ["autre", "jeton", "factice"].join("-");
  const bad = check({
    ACCESS_SERVICE_CLIENT_IDS: cid,
    HQ_MACHINE_IDENTITIES: JSON.stringify([
      { id: "m-a", actorId: "machine-a", orgId: "org-a", accessClientId: cid, scopes: ["work"] },
      { id: "m-b", actorId: "machine-b", orgId: "org-b", accessClientId: cid, scopes: ["work"] },
      { id: "m-c", actorId: "machine-c", orgId: "org-a", token: fakeShared, scopes: ["work"] },
      { id: "m-c", actorId: "coo", orgId: "org-b", token: fakeShared, scopes: ["admin"] },
      { id: "m-e", actorId: "machine-e", orgId: "Org Invalide", token: fakeOther, scopes: ["review"] },
    ]),
  });
  const text = JSON.stringify(bad);
  assert(!bad.ok && /plusieurs fiches \(m-a, m-b\)/.test(text) && /Jeton .* partagé/.test(text) && /en double/.test(text) && /rôle humain/.test(text) && /portées/.test(text) && /organisation invalide/.test(text), `erreurs attendues absentes : ${text}`);
  assert(!text.includes(cid) && !text.includes(fakeShared) && !text.includes(fakeOther), "une valeur secrète est affichée");
  const good = check({
    ACCESS_SERVICE_CLIENT_IDS: `${cid},${"b2".repeat(16)}.access`,
    HQ_MACHINE_IDENTITIES: JSON.stringify([
      { id: "m-a", actorId: "machine-a", orgId: "org-a", accessClientId: cid, scopes: ["work"] },
      { id: "m-b", actorId: "machine-b", orgId: "org-b", accessClientId: `${"b2".repeat(16)}.access`, scopes: ["review"] },
    ]),
    ACCESS_ACCOUNTS: JSON.stringify([{ email: "ceo@example.test", role: "ceo", orgId: "org-a" }]),
  });
  assert(good.ok && good.errors.length === 0, `configuration saine refusée : ${JSON.stringify(good)}`);
});

test("J1", "Journal d'audit : chaque écriture (acceptée ou refusée) est tracée avec acteur, organisation, mission, commande, tentative, autorisation, résultat, empreinte, coût ; aucun secret ; lecture humaine seulement ; aucune route d'écriture", async () => {
  const h = harness();
  const c = await claimed(h, "Commande auditée");
  await h.call("PATCH", `/api/hq/commands/${c.id}`, { status: "done", proof: "Preuve auditée.", attemptId: c.attemptId, claimToken: c.claimToken }, A);
  await h.call("PATCH", `/api/hq/commands/${c.id}`, { status: "pending" }, B);
  const m = await inReview(h);
  await h.call("POST", `/api/hq/missions/${m.mid}/approval`, { decision: "approve", presentedHash: m.shown.approvalRequest.hash }, COO);
  const machine = await h.call("GET", "/api/hq/audit", {}, A);
  assert(machine.status === 403, `lecture machine : ${machine.status}`);
  const log = await h.call("GET", "/api/hq/audit?limit=500", {}, COO);
  assert(log.status === 200 && Array.isArray(log.body.audit), `lecture humaine : ${log.status}`);
  const entries = log.body.audit;
  const done = entries.find((e) => e.commandId === c.id && e.result.outcome === "completed");
  assert(done && done.actorId === "agent-a" && done.orgId === "org-a" && done.attemptId === c.attemptId && /^sha256-/.test(done.contentHash) && done.authorization.scopes.includes("work"), `entrée de clôture : ${JSON.stringify(done)}`);
  assert(entries.some((e) => e.commandId === c.id && e.actorId === "agent-b" && e.result.status >= 400), "tentative refusée non tracée");
  const ap = entries.find((e) => e.missionId === m.mid && e.action.endsWith("/approval"));
  assert(ap && ap.authorization.human === true && ap.authorization.approval === m.shown.approvalRequest.hash && ap.result.status === 200, `entrée d'approbation : ${JSON.stringify(ap)}`);
  assert(entries.some((e) => e.missionId === m.mid && e.action.endsWith("/start") && e.costCents === null), "démarrage non tracé");
  const all = JSON.stringify(entries);
  assert(!all.includes(c.claimToken) && !all.includes(m.st.body.claimToken) && !all.includes("Preuve auditée."), "un secret ou un contenu en clair figure au journal");
  for (const [method, path] of [["POST", "/api/hq/audit"], ["PATCH", "/api/hq/audit"], ["DELETE", "/api/hq/audit"], ["POST", "/api/hq/audit/1"]]) {
    const r = await h.call(method, path, { body: "x" }, COO);
    assert(r.status === 405, `${method} ${path} : ${r.status}`);
  }
});

test("I2", "L'exemple config/hq-machines.example.json passe le contrôle avant déploiement une fois ses Client ID (factices) remplis : aucune machine « coo »", async () => {
  const fs = await import("node:fs");
  const { checkIdentityConfig } = await import("../src/hq/identity-check.js");
  const example = JSON.parse(fs.readFileSync(new URL("../config/hq-machines.example.json", import.meta.url), "utf8"));
  const filled = example.map((item, index) => ({ ...item, accessClientId: `${["ab", "cd", "ef", "12"][index % 4].repeat(16)}.access`, token: undefined }));
  const result = checkIdentityConfig({ HQ_MACHINE_IDENTITIES: JSON.stringify(filled), ACCESS_SERVICE_CLIENT_IDS: filled.map((item) => item.accessClientId).join(",") });
  assert(result.ok, `exemple refusé : ${result.errors.join(" | ")}`);
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
