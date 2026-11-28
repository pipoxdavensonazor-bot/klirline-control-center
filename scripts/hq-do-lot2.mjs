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

import { randomBytes } from "node:crypto";
const KEYS = { encryptionKey: randomBytes(32).toString("hex"), authKey: randomBytes(32).toString("hex") };
const CEO = { actorId: "ceo", orgId: "klirline", human: true };
const op = (pathname, input, org = "klirline") => mf.dispatchFetch(`http://local${pathname}`, { method: "POST", headers: { "content-type": "application/json", "x-org": org }, body: JSON.stringify(input) }).then(async (r) => ({ status: r.status, body: await r.json() }));
const dump = async (org) => {
  const out = {};
  for (const t of ["hq_command", "hq_mission"]) out[t] = (await sql(`SELECT * FROM ${t} ORDER BY id`, org)).rows;
  out.hq_audit = (await sql("SELECT seq, at, body FROM hq_audit ORDER BY seq", org)).rows;
  return out;
};

test("K1", "B2 : export chiffré (AES-256-GCM) avec manifeste authentifié (HMAC), restauration vérifiée dans un objet vide : données identiques, restauration journalisée", async () => {
  const { mid, tid } = await readyMission();
  await call("POST", `/api/hq/missions/${mid}/tasks/${tid}/start`, {});
  const source = await dump("klirline");
  const exp = await op("/__backup/export", { identity: CEO, reason: "Essai de sauvegarde locale du lot 2", keys: KEYS });
  assert(exp.status === 200 && exp.body.manifest.cipher === "AES-256-GCM" && exp.body.signature.length === 64, `export : ${exp.status} ${exp.body.error || ""}`);
  assert(!exp.body.ciphertext.includes("hq_command") && !JSON.stringify(exp.body).includes(mid), "le paquet exporté contient des données en clair");
  const res = await op("/__backup/restore", { identity: CEO, reason: "Essai de restauration locale du lot 2", bundle: exp.body, keys: KEYS }, "klirline-restauration");
  assert(res.status === 200 && res.body.restored.hq_command === source.hq_command.length, `restauration : ${res.status} ${res.body.error || ""}`);
  const target = await dump("klirline-restauration");
  assert(JSON.stringify(target.hq_command) === JSON.stringify(source.hq_command) && JSON.stringify(target.hq_mission) === JSON.stringify(source.hq_mission), "données restaurées différentes");
  assert(JSON.stringify(target.hq_audit.slice(0, source.hq_audit.length)) === JSON.stringify(source.hq_audit), "journal d'audit restauré différent");
  assert(JSON.parse(target.hq_audit.at(-1).body).action === "backup.restore", "restauration non journalisée");
  const read = await call("GET", `/api/hq/missions/${mid}`, null, A, T0, "klirline-restauration");
  assert(read.status === 200 && read.body.mission.id === mid, `lecture après restauration : ${read.status}`);
});

test("K2", "B2 : refus — machine, rôle non ceo, sans justification, mauvaise clé, manifeste ou chiffré altéré, autre organisation, objet cible non vide", async () => {
  await readyMission();
  const exp = await op("/__backup/export", { identity: CEO, reason: "Sauvegarde pour les tests de refus", keys: KEYS });
  const reason = "Restauration de test (refus attendu)";
  const cases = {
    machine: await op("/__backup/export", { identity: { actorId: "ceo", orgId: "klirline", human: false }, reason, keys: KEYS }),
    coo: await op("/__backup/export", { identity: { actorId: "coo", orgId: "klirline", human: true }, reason, keys: KEYS }),
    sansMotif: await op("/__backup/export", { identity: CEO, reason: "", keys: KEYS }),
    mauvaiseCle: await op("/__backup/restore", { identity: CEO, reason, bundle: exp.body, keys: { ...KEYS, encryptionKey: randomBytes(32).toString("hex") } }, "vide-1"),
    mauvaiseAuth: await op("/__backup/restore", { identity: CEO, reason, bundle: exp.body, keys: { ...KEYS, authKey: randomBytes(32).toString("hex") } }, "vide-2"),
    manifeste: await op("/__backup/restore", { identity: CEO, reason, bundle: { ...exp.body, manifest: { ...exp.body.manifest, exportedAt: "2020-01-01T00:00:00.000Z" } }, keys: KEYS }, "vide-3"),
    chiffre: await op("/__backup/restore", { identity: CEO, reason, bundle: { ...exp.body, ciphertext: `${exp.body.ciphertext[0] === "A" ? "B" : "A"}${exp.body.ciphertext.slice(1)}` }, keys: KEYS }, "vide-4"),
    autreOrg: await op("/__backup/restore", { identity: { ...CEO, orgId: "org-b" }, reason, bundle: exp.body, keys: KEYS }, "vide-5"),
    nonVide: await op("/__backup/restore", { identity: CEO, reason, bundle: exp.body, keys: KEYS }, "klirline"),
  };
  const bad = Object.entries(cases).filter(([, r]) => r.status < 400).map(([k, r]) => `${k}=${r.status}`);
  assert(!bad.length, `acceptés à tort : ${bad.join(", ")}`);
  const expected = { machine: /humain/, coo: /Rôle/, sansMotif: /Justification/, mauvaiseCle: /déchiffrement/, mauvaiseAuth: /non authentifié/, manifeste: /non authentifié/, chiffre: /altéré/, autreOrg: /autre organisation/, nonVide: /pas vide/ };
  const wrong = Object.entries(expected).filter(([k, re]) => !re.test(cases[k].body.error || "")).map(([k]) => `${k} « ${cases[k].body.error} »`);
  assert(!wrong.length, `motifs inattendus : ${wrong.join(" ; ")}`);
  for (const org of ["vide-1", "vide-2", "vide-3", "vide-4", "vide-5"]) {
    const n = (await sql("SELECT (SELECT COUNT(*) FROM hq_command) + (SELECT COUNT(*) FROM hq_mission) AS n", org)).rows?.[0]?.n ?? 0;
    assert(n === 0, `données écrites malgré le refus dans ${org}`);
  }
});

test("K3", "B1 : PITR réservé à un humain ceo avec justification ; disponibilité locale constatée", async () => {
  const machine = await op("/__pitr/bookmark", { identity: { actorId: "ops", orgId: "klirline", human: false }, reason: "Signet de test PITR", time: T0 });
  const restoreMachine = await op("/__pitr/restore", { identity: { actorId: "ceo", orgId: "klirline", human: false }, reason: "Restauration PITR de test", bookmark: "x" });
  assert(machine.status >= 400 && restoreMachine.status >= 400 && /humain/.test(machine.body.error) && /humain/.test(restoreMachine.body.error), `PITR machine : ${machine.status} ${restoreMachine.status}`);
  const human = await op("/__pitr/bookmark", { identity: CEO, reason: "Signet de test PITR", time: new Date().toISOString() });
  console.log(`     (constat) PITR local : ${human.status} ${human.body.bookmark ? "signet obtenu" : human.body.error}`);
  assert(human.status === 200 || /indisponible|not supported|not implement|does not implement point-in-time/i.test(human.body.error || ""), `PITR humain : ${human.status} ${human.body.error}`);
});

test("K4", "Aucune route d'administration : /api/hq/backup, /api/hq/restore, /api/hq/pitr introuvables pour tous", async () => {
  for (const p of ["/api/hq/backup", "/api/hq/restore", "/api/hq/pitr", "/api/hq/export"]) {
    for (const who of [A, COO]) {
      const r = await call("POST", p, {}, who);
      assert(r.status === 404, `${p} (${who.actor}) : ${r.status}`);
    }
  }
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
