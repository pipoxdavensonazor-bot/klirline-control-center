// Tests Durable Object du lot 2 (Miniflare local, SQLite) : atomicité mission + commande,
// reprise après interruption. Aucun réseau, aucun secret.
// Usage : node scripts/hq-do-lot2.mjs [ID ...]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = new Set(process.argv.slice(2));
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "klirline-do-lot2-"));
const bundle = path.join(persist, "driver.mjs");
const built = spawnSync(path.join(root, "node_modules/esbuild/bin/esbuild"), [path.join(root, "scripts/hq-do-lot2-driver.mjs"), "--bundle", "--format=esm", "--platform=neutral", `--outfile=${bundle}`, "--external:cloudflare:workers", "--external:node:*"], { encoding: "utf8" });
if (built.status !== 0) throw new Error(built.stderr || built.stdout);

const mf = new Miniflare(convertV4MiniflareOptions({
  name: "klirline-do-lot2", rootPath: persist, scriptPath: bundle, modules: true, compatibilityDate: "2026-10-06", compatibilityFlags: ["nodejs_compat"],
  resourcePersistencePath: persist, durableObjects: { COMPANY: { className: "CompanyState", useSQLite: true } },
}));
await mf.ready;

const T0 = "2026-11-28T15:00:00.000Z";
const A = { actor: "agent-a", scopes: ["work"] };
const COO = { actor: "coo", scopes: ["work", "review"], human: true };
async function call(method, p, body, who = A, now = T0, org = "klirline") {
  const headers = { "content-type": "application/json", "x-actor": who.actor, "x-scopes": (who.scopes || []).join(","), "x-local-now": now, "x-org": org };
  if (who.human) headers["x-human"] = "1";
  const r = await mf.dispatchFetch(`http://local${p}`, { method, headers, body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const fault = (point, org) => call("GET", `/__fault?point=${point || ""}`, null, A, T0, org);
const sql = (text, org = "klirline") => call("POST", "/__sql", text, A, T0, org).then((r) => r.body);
function assert(condition, message) { if (!condition) throw new Error(message); }
const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });

async function readyMission() {
  const m = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" });
  assert(m.status === 201, `mission ${m.status}`);
  const mid = m.body.mission.id; const tid = m.body.mission.tasks[0].id;
  await call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" });
  return { mid, tid };
}
async function missionCommands(mid) {
  const rows = await sql(`SELECT body FROM hq_command WHERE json_extract(body, '$.missionId') = '${mid}'`);
  return rows.rows.map((row) => JSON.parse(row.body));
}

test("E2", "Interruption entre l'écriture de la commande et celle de la mission : rien n'est écrit (transaction), la reprise crée une seule commande", async () => {
  const { mid, tid } = await readyMission();
  await fault("mission-replace");
  const broken = await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {});
  await fault("");
  assert(broken.status >= 500, `démarrage pendant la panne : ${broken.status}`);
  const orphans = await missionCommands(mid);
  assert(orphans.length === 0, `commande orpheline après la panne : ${orphans.length}`);
  const mission = await call("GET", `/api/hq/missions/${mid}`);
  assert(!mission.body.mission.tasks[0].commandId && mission.body.mission.tasks[0].status !== "running", `mission modifiée malgré la panne : ${JSON.stringify(mission.body.mission.tasks[0])}`);
  const resumed = await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {});
  assert(resumed.status === 200 && resumed.body.started === true, `reprise : ${resumed.status} ${resumed.body.error || ""}`);
  assert((await missionCommands(mid)).length === 1, "la reprise crée plusieurs commandes");
});

test("E3", "Interruption pendant le dépôt d'un livrable : la commande reste dans son état précédent, la reprise avec le même jeton aboutit", async () => {
  const { mid, tid } = await readyMission();
  const st = await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {});
  const before = (await missionCommands(mid))[0];
  await fault("mission-replace");
  const broken = await call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Livrable interrompu." });
  await fault("");
  assert(broken.status >= 500, `dépôt pendant la panne : ${broken.status}`);
  const after = (await missionCommands(mid))[0];
  assert(after.status === before.status && after.status !== "done", `commande modifiée malgré la panne : ${before.status} → ${after.status}`);
  const resumed = await call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, attemptId: st.body.attemptId, claimToken: st.body.claimToken, body: "Livrable interrompu." });
  assert(resumed.status === 200 && resumed.body.mission.deliverables.length === 1, `reprise : ${resumed.status} ${resumed.body.error || ""}`);
});

test("J2", "Journal d'audit dans le Durable Object : écrit à chaque écriture, UPDATE et DELETE refusés par la base elle-même, cloisonné par organisation", async () => {
  await readyMission();
  const before = await sql("SELECT COUNT(*) AS n FROM hq_audit");
  assert(before.ok && before.rows[0].n >= 2, `journal absent ou vide : ${JSON.stringify(before)}`);
  const upd = await sql("UPDATE hq_audit SET body = '{}' WHERE seq = 1");
  const del = await sql("DELETE FROM hq_audit");
  const drop = await sql("DELETE FROM hq_audit WHERE seq = (SELECT MAX(seq) FROM hq_audit)");
  assert(!upd.ok && !del.ok && !drop.ok && /ajout seul/.test(upd.error + del.error), `modification acceptée : ${JSON.stringify([upd, del, drop])}`);
  const after = await sql("SELECT COUNT(*) AS n FROM hq_audit");
  assert(after.rows[0].n === before.rows[0].n, "le nombre d'entrées a changé");
  const human = await call("GET", "/api/hq/audit?limit=5", null, COO);
  assert(human.status === 200 && human.body.audit.length === 5 && human.body.audit.every((e) => e.orgId === "klirline"), `lecture humaine : ${human.status}`);
  const other = await call("GET", "/api/hq/audit", null, COO, T0, "org-b");
  assert(other.status === 200 && other.body.audit.length === 0, `journal de B : ${other.body.audit?.length}`);
});

let failed = 0;
try {
  for (const item of tests) {
    if (only.size && !only.has(item.id)) continue;
    try { await item.fn(); console.log(`PASS ${item.id} — ${item.name}`); } catch (error) { failed += 1; console.log(`FAIL ${item.id} — ${item.name}\n     ${error.message}`); }
  }
} finally {
  await mf.dispose();
  fs.rmSync(persist, { recursive: true, force: true });
}
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — Durable Object lot 2");
process.exit(failed ? 1 : 0);
