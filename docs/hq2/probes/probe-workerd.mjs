// Sondes HQ 2.0 phase 0 — exécutées sur workerd local (wrangler dev --local), sans Cloudflare distant.
// Usage : node probe-workerd.mjs <racine du dépôt à tester> <port>
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 8894);
const base = `http://127.0.0.1:${port}`;
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "hq2-probe-"));
const configPath = path.join(persist, "wrangler.jsonc");
fs.writeFileSync(configPath, JSON.stringify({
  name: "hq2-probe-local",
  main: path.join(root, "scripts/hq-do-driver.mjs"),
  compatibility_date: "2026-10-06",
  compatibility_flags: ["nodejs_compat"],
  durable_objects: { bindings: [{ name: "COMPANY", class_name: "CompanyState" }] },
  exports: { CompanyState: { type: "durable-object", storage: "sqlite" } },
}));

const child = spawn("npx", ["wrangler", "dev", "--config", configPath, "--persist-to", persist, "--port", String(port), "--ip", "127.0.0.1", "--local"], {
  cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
});
let log = "";
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout\n" + log.slice(-1500))), 90000);
  const on = (c) => { log += c; if (log.includes("Ready on")) { clearTimeout(timer); resolve(); } };
  child.stdout.on("data", on); child.stderr.on("data", on);
  child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`wrangler exit ${code}\n${log.slice(-1500)}`)); });
});

async function call(method, p, body, { actor, scopes = [], human = false, now } = {}) {
  const headers = { "content-type": "application/json", "x-actor": actor, "x-scopes": scopes.join(",") };
  if (human) headers["x-human"] = "1";
  if (now) headers["x-local-now"] = now;
  const r = await fetch(base + p, { method, headers, body: method === "GET" ? undefined : JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const A = { actor: "agent-a", scopes: ["work"] };
const B = { actor: "agent-b", scopes: ["work"] };
const NOSCOPE = { actor: "service:hq-poll", scopes: [] };
const T0 = "2026-11-23T15:00:00.000Z";
const results = [];
const record = (id, label, defect, evidence) => results.push({ id, label, defectPresent: defect, evidence });

try {
  // P1 — 10 claims concurrents sur la même commande.
  const c1 = await call("POST", "/api/hq/command", { text: "Sonde P1", ownerSlug: "sandbox-klirline" }, { ...A, now: T0 });
  const claims = await Promise.all(Array.from({ length: 10 }, () => call("POST", `/api/hq/commands/${c1.body.command.id}/claim`, {}, { ...A, now: T0 })));
  const issued = claims.filter((r) => r.body.outcome === "issued").length;
  record("P1", "10 claims concurrents", issued !== 1, `issued=${issued}, held=${claims.filter((r) => r.body.outcome === "held").length}`);

  // P2 — PATCH sans jeton par un autre agent (remise en pending) puis second claim.
  const c2 = await call("POST", "/api/hq/command", { text: "Sonde P2", ownerSlug: "sandbox-klirline" }, { ...A, now: T0 });
  const id2 = c2.body.command.id;
  const a2 = await call("POST", `/api/hq/commands/${id2}/claim`, {}, { ...A, now: T0 });
  const reset = await call("PATCH", `/api/hq/commands/${id2}`, { status: "pending" }, { ...B, now: T0 });
  const b2 = await call("POST", `/api/hq/commands/${id2}/claim`, {}, { ...B, now: T0 });
  record("P2", "PATCH status=pending sans jeton par un autre agent, puis re-claim", reset.status === 200 && b2.body.outcome === "issued",
    `claim A=${a2.body.outcome}; PATCH B=${reset.status}; claim B=${b2.body.outcome} (deux jetons valides émis pendant le bail de A)`);

  // P3 — annulation par une identité sans portée.
  const c3 = await call("POST", "/api/hq/command", { text: "Sonde P3", ownerSlug: "sandbox-klirline" }, { ...A, now: T0 });
  await call("POST", `/api/hq/commands/${c3.body.command.id}/claim`, {}, { ...A, now: T0 });
  const cancel = await call("PATCH", `/api/hq/commands/${c3.body.command.id}`, { status: "cancelled" }, { ...NOSCOPE, now: T0 });
  record("P3", "PATCH status=cancelled par identité scopes=[]", cancel.status === 200, `HTTP ${cancel.status}, statut=${cancel.body.command?.status}`);

  // P3b — sortir d'un état terminal (cancelled → pending).
  const revive = await call("PATCH", `/api/hq/commands/${c3.body.command.id}`, { status: "pending" }, { ...NOSCOPE, now: T0 });
  record("P3b", "cancelled → pending (état terminal réversible)", revive.status === 200, `HTTP ${revive.status}, statut=${revive.body.command?.status}`);

  // P4 — création de commande et interruption sans portée work.
  const c4 = await call("POST", "/api/hq/command", { text: "Sonde P4", ownerSlug: "sandbox-klirline" }, { ...NOSCOPE, now: T0 });
  const c4b = await call("POST", "/api/hq/command", { text: "Sonde P4b", ownerSlug: "sandbox-klirline" }, { ...A, now: T0 });
  await call("POST", `/api/hq/commands/${c4b.body.command.id}/claim`, {}, { ...A, now: T0 });
  const intr = await call("POST", `/api/hq/commands/${c4b.body.command.id}/interrupt`, { note: "sonde" }, { ...NOSCOPE, now: T0 });
  record("P4", "POST command et interrupt avec scopes=[]", c4.status === 201 || intr.status === 200, `POST command=${c4.status}; interrupt=${intr.status} (statut après=${intr.body.command?.status})`);

  // P5 — approbation de mission par une machine « coo » (human=false).
  const m = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, A);
  const mid = m.body.mission.id; const tid = m.body.mission.tasks[0].id;
  await call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" }, A);
  const st = await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {}, { ...A, now: T0 });
  await call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Livrable de sonde, fictif." }, { ...A, now: T0 });
  await call("POST", `/api/hq/missions/${mid}/transition`, { status: "in_review" }, { ...A, now: T0 });
  const appr = await call("POST", `/api/hq/missions/${mid}/approval`, { decision: "approve" }, { actor: "coo", scopes: ["review"], human: false, now: T0 });
  record("P5", "approbation par machine actorId=coo, scopes=[review], human=false", appr.status === 200 && appr.body.mission?.approvalValid === true, `HTTP ${appr.status}, approvalValid=${appr.body.mission?.approvalValid}`);

  // P6 — heartbeat.
  const hb = await call("POST", `/api/hq/commands/${c1.body.command.id}/heartbeat`, {}, { ...A, now: T0 });
  record("P6", "route heartbeat", hb.status === 404, `HTTP ${hb.status}`);

  // P7 — expiration sans alarme : 2 h après, la commande P1 reste dispatched tant que personne ne re-claim.
  const later = await call("GET", `/api/hq/commands/${c1.body.command.id}`, {}, { ...A, now: "2026-11-23T17:00:00.000Z" });
  record("P7", "bail expiré sans réveil (pas d'alarme)", later.body.command?.status === "dispatched", `statut 2 h après = ${later.body.command?.status}, leaseUntil=${later.body.command?.claim?.leaseUntil}`);

  // P8 — idempotence de création.
  const d1 = await call("POST", "/api/hq/command", { text: "Sonde P8 doublon", ownerSlug: "sandbox-klirline" }, { ...A, now: T0 });
  const d2 = await call("POST", "/api/hq/command", { text: "Sonde P8 doublon", ownerSlug: "sandbox-klirline" }, { ...A, now: T0 });
  record("P8", "double POST identique", d1.body.command.id !== d2.body.command.id, `ids distincts=${d1.body.command.id !== d2.body.command.id}`);

  // P9 — troncature : mission dont la commande sort de la fenêtre des 200.
  const m9 = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, A);
  const mid9 = m9.body.mission.id; const tid9 = m9.body.mission.tasks[0].id;
  await call("POST", `/api/hq/missions/${mid9}/transition`, { status: "ready" }, A);
  const st9 = await call("POST", `/api/hq/missions/${mid9}/tasks/${tid9}/start`, {}, { ...A, now: "2026-11-23T10:00:00.000Z" });
  for (let i = 0; i < 205; i += 1) {
    await call("POST", "/api/hq/command", { text: `Remplissage ${i}`, ownerSlug: "sandbox-klirline" }, { ...A, now: new Date(Date.parse("2026-11-23T18:00:00.000Z") + i * 1000).toISOString() });
  }
  const dl9 = await call("POST", `/api/hq/missions/${mid9}/deliverables`, { taskId: tid9, attemptId: st9.body.attemptId, claimToken: st9.body.claimToken, body: "Livrable après 205 commandes." }, { ...A, now: "2026-11-23T19:00:00.000Z" });
  record("P9", "livrable d'une tâche dont la commande est hors des 200 plus récentes", dl9.status !== 200, `HTTP ${dl9.status} ${dl9.body.error || ""}`);

  console.log(JSON.stringify({ runtime: "local-workerd (wrangler dev --local)", root, results }, null, 2));
} finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
}
