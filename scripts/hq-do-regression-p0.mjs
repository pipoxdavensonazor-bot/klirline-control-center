// Tests de régression HQ sur Durable Object local (workerd, SQLite) : cas qui dépendent du stockage
// réel du Worker (atomicité des appels, fenêtre SQL de 200). 100 % local, aucun secret, aucun réseau
// hors 127.0.0.1. Port : HQ_DO_REG_PORT (défaut 8893).
// Usage : node scripts/hq-do-regression-p0.mjs [ID ...]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "klirline-do-reg-"));
const configPath = path.join(persist, "wrangler.jsonc");
const port = Number(process.env.HQ_DO_REG_PORT || 8893);
const base = `http://127.0.0.1:${port}`;
const only = new Set(process.argv.slice(2));
const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });

fs.writeFileSync(configPath, JSON.stringify({
  name: "klirline-do-regression",
  main: path.join(root, "scripts/hq-do-driver.mjs"),
  compatibility_date: "2026-10-06",
  compatibility_flags: ["nodejs_compat"],
  durable_objects: { bindings: [{ name: "COMPANY", class_name: "CompanyState" }] },
  exports: { CompanyState: { type: "durable-object", storage: "sqlite" } },
}, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function start() {
  const child = spawn("npx", ["wrangler", "dev", "--config", configPath, "--persist-to", persist, "--port", String(port), "--ip", "127.0.0.1", "--local"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  let log = "";
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`wrangler dev ne répond pas.\n${log.slice(-2000)}`)), 90000);
    const onData = (chunk) => {
      log += chunk.toString();
      if (log.includes("Ready on")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`wrangler dev s'est arrêté (${code}).\n${log.slice(-2000)}`));
    });
  });
  return { child, ready };
}

async function stop(child) {
  if (!child || child.exitCode != null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      resolve();
    }, 5000);
    child.on("exit", () => { clearTimeout(timer); resolve(); });
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); resolve(); }
  });
}

async function call(method, pathname, body, { actor = "agent-a", scopes = ["work"], human = false, now } = {}) {
  const headers = { "content-type": "application/json", "x-actor": actor, "x-scopes": scopes.join(",") };
  if (human) headers["x-human"] = "1";
  if (now) headers["x-local-now"] = now;
  const response = await fetch(`${base}${pathname}`, { method, headers, body: method === "GET" ? undefined : JSON.stringify(body || {}) });
  return { status: response.status, payload: await response.json().catch(() => ({})) };
}

// ---------- T5 : idempotence atomique dans le Durable Object ----------
test("T5", "Deux POST simultanés avec la même clé ne créent qu'une commande (Durable Object)", async () => {
  const body = { text: "T5 DO avec clé", ownerSlug: "sandbox-klirline", idempotencyKey: "cle-do-t5" };
  const results = await Promise.all(Array.from({ length: 5 }, () => call("POST", "/api/hq/command", body)));
  const ids = new Set(results.map((r) => r.payload.command?.id));
  assert(ids.size === 1 && !ids.has(undefined), `ids distincts : ${[...ids].join(" / ")} (${results.map((r) => r.status).join(",")})`);
  assert(results.filter((r) => r.status === 201).length === 1 && results.filter((r) => r.status === 200).length === 4, `statuts ${results.map((r) => r.status).join(",")}`);
  const conflict = await call("POST", "/api/hq/command", { ...body, text: "Autre texte" });
  assert(conflict.status === 409, `même clé, autre commande ${conflict.status}`);
});

// ---------- E1 : livrable légitime au-delà de la fenêtre de 200 commandes ----------
test("E1", "Une tâche dont la commande sort de la fenêtre de 200 reste livrable par sa tentative", async () => {
  const t0 = "2026-11-23T10:00:00.000Z";
  const created = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, { now: t0 });
  assert(created.status === 201, `mission ${created.status}`);
  const mid = created.payload.mission.id; const tid = created.payload.mission.tasks[0].id;
  await call("POST", `/api/hq/missions/${mid}/transition`, { status: "ready" }, { now: t0 });
  const st = await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {}, { now: t0 });
  assert(st.status === 200 && st.payload.claimToken, `démarrage ${st.status}`);
  for (let i = 0; i < 205; i += 1) {
    const filler = await call("POST", "/api/hq/command", { text: `Remplissage ${i}`, ownerSlug: "sandbox-klirline" }, { now: new Date(Date.parse("2026-11-23T10:05:00.000Z") + i * 1000).toISOString() });
    assert(filler.status === 201, `remplissage ${i} ${filler.status}`);
  }
  const listed = await call("GET", "/api/hq/commands", {}, { now: "2026-11-23T10:10:00.000Z" });
  assert(listed.payload.commands.length === 200 && !listed.payload.commands.some((c) => c.missionId === mid), "la commande de la tâche devrait être hors de la liste de 200 (condition du test)");
  const dl = await call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, attemptId: st.payload.attemptId, claimToken: st.payload.claimToken, body: "Livrable après 205 commandes." }, { now: "2026-11-23T10:20:00.000Z" });
  assert(dl.status === 200 && dl.payload.mission.deliverables.length === 1, `livrable ${dl.status} ${dl.payload.error || ""}`);
  const forged = await call("POST", `/api/hq/missions/${mid}/deliverables`, { taskId: tid, body: "Révision sans jeton." }, { actor: "agent-b", now: "2026-11-23T10:21:00.000Z" });
  assert(forged.status === 409, `révision sans jeton hors fenêtre ${forged.status}`);
});

let failed = 0;
let session = start();
try {
  await session.ready;
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
} finally {
  await stop(session.child);
  fs.rmSync(persist, { recursive: true, force: true });
}
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — régression HQ P0 (Durable Object local)");
process.exit(failed ? 1 : 0);
