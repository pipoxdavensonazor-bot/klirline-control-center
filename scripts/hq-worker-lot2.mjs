// Tests Worker du lot 2 (Miniflare local, JWT Access signés localement, valeurs factices).
// Usage : node scripts/hq-worker-lot2.mjs [ID ...]
import { spawnSync } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "klirline-worker-lot2-"));
const only = new Set(process.argv.slice(2));
const bundle = path.join(persist, "worker.mjs");
const bundled = spawnSync(path.join(root, "node_modules/esbuild/bin/esbuild"), [
  path.join(root, "src/worker.js"),
  "--bundle",
  "--format=esm",
  "--platform=neutral",
  `--outfile=${bundle}`,
  "--external:cloudflare:workers",
  "--external:node:*",
], { encoding: "utf8" });
if (bundled.status !== 0) {
  throw new Error(bundled.stderr || bundled.stdout || "esbuild a échoué");
}
const team = "equipe.cloudflareaccess.com";
const aud = "aud-local-worker";
const serviceName = `${"ab".repeat(16)}.access`;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "local-worker";
jwk.alg = "RS256";
jwk.use = "sig";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sign(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "local-worker" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const data = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(data).sign(privateKey).toString("base64url");
  return `${data}.${signature}`;
}

function token(extra) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ aud, iss: `https://${team}`, exp: now + 600, nbf: now - 10, iat: now, ...extra });
}

const executor = token({ type: "app", sub: "", common_name: serviceName });
const reviewer = token({ type: "app", sub: "", common_name: `${"cd".repeat(16)}.access` });
const approver = token({ email: "revue@example.com", type: "app", sub: "22222222-2222-4222-8222-222222222222" });
// Organisation B (fictive) : un humain ceo et une machine d'exécution.
const ceoB = token({ email: "ceo@org-b.example", type: "app", sub: "33333333-3333-4333-8333-333333333333" });
const executorB = token({ type: "app", sub: "", common_name: `${"ef".repeat(16)}.access` });
// Machine réservée au test de quota G1 (aucune autre requête ne l'utilise).
const quotaA = token({ type: "app", sub: "", common_name: `${"12".repeat(16)}.access` });

function options() {
  const converted = convertV4MiniflareOptions({
    name: "klirline-control-center",
    rootPath: persist,
    scriptPath: bundle,
    modules: true,
    compatibilityDate: "2026-10-06",
    compatibilityFlags: ["nodejs_compat"],
    resourcePersistencePath: persist,
    durableObjects: {
      COMPANY: { className: "CompanyState", useSQLite: true },
    },
    bindings: {
      ACCESS_TEAM_DOMAIN: team,
      ACCESS_AUD: aud,
      ACCESS_ACCOUNTS: JSON.stringify([
        { email: "revue@example.com", role: "coo", orgId: "klirline" },
        { email: "ceo@org-b.example", role: "ceo", orgId: "org-b" },
      ]),
      ACCESS_SERVICE_CLIENT_IDS: `${serviceName},${"cd".repeat(16)}.access,${"ef".repeat(16)}.access,${"12".repeat(16)}.access`,
      HQ_MACHINE_IDENTITIES: JSON.stringify([
        { id: "executor-klirprospect", accessClientId: serviceName, actorId: "machine-klirprospect", orgId: "klirline", scopes: ["work"] },
        // I2 : une fiche machine ne porte plus « coo » ; la revue machine garde un acteur non humain.
        { id: "reviewer-only", accessClientId: `${"cd".repeat(16)}.access`, actorId: "ops-review", orgId: "klirline", scopes: ["review"] },
        { id: "quota-a", accessClientId: `${"12".repeat(16)}.access`, actorId: "machine-quota-a", orgId: "klirline", scopes: ["work"] },
        { id: "executor-org-b", accessClientId: `${"ef".repeat(16)}.access`, actorId: "machine-org-b", orgId: "org-b", scopes: ["work"] },
      ]),
    },
    // Ce remplacement n'existe que dans ce script. wrangler.jsonc et src/worker.js
    // vont chercher les certificats sur https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs.
    outboundService: (request) => {
      const url = new URL(request.url);
      if (url.hostname === team && url.pathname === "/cdn-cgi/access/certs") {
        return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Hors du test local." }), { status: 404 });
    },
  });
  converted.unsafeInspectDurableObjects = true;
  return converted;
}

async function boot() {
  const mf = new Miniflare(options());
  await mf.ready;
  return mf;
}

async function call(mf, method, pathname, body, assertion, ip = "198.51.100.7") {
  const response = await mf.dispatchFetch(`http://centre.klirline.com${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      "cf-access-jwt-assertion": assertion,
      "cf-connecting-ip": ip,
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 300) };
  }
  return { status: response.status, payload };
}

async function tables(mf) {
  const storage = await mf.unsafeGetDurableObjectStorage("klirline-control-center", "CompanyState", { name: "klirline" });
  const rows = await storage.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  return rows.map((row) => row.name);
}

const tests = [];
const test = (id, name, fn) => tests.push({ id, name, fn });

test("G1", "I5 : quota par identité ; deux machines derrière la même IP ne partagent pas leurs 60 requêtes/min", async (mf) => {
  let blockedAt = null;
  for (let i = 1; i <= 61; i += 1) {
    const r = await call(mf, "GET", "/api/hq/roster", undefined, quotaA);
    if (r.status === 429 && blockedAt == null) blockedAt = i;
    if (r.status !== 200 && r.status !== 429) throw new Error(`requête ${i} : ${r.status}`);
  }
  assert(blockedAt === 61, `machine A bloquée à la requête ${blockedAt} (attendu 61)`);
  const other = await call(mf, "GET", "/api/hq/roster", undefined, reviewer);
  assert(other.status === 200, `machine B (même IP) : ${other.status} — quota partagé`);
  const human = await call(mf, "GET", "/api/hq/roster", undefined, approver);
  assert(human.status === 200, `humain (même IP) : ${human.status}`);
});

test("H1", "Catalogue client par organisation : l'organisation B ne liste ni ne lit les dossiers de démonstration de Klirline", async (mf) => {
  const listB = await call(mf, "GET", "/api/hq/clients", undefined, ceoB, "203.0.113.20");
  const oneB = await call(mf, "GET", "/api/hq/clients/cli-atelier-nord", undefined, ceoB, "203.0.113.20");
  const reserveB = await call(mf, "GET", "/api/hq/clients/cli-reserve", undefined, ceoB, "203.0.113.20");
  assert(listB.status === 200 && listB.payload.clients.length === 0, `catalogue vu par B : ${listB.payload.clients?.map((c) => c.id)}`);
  assert(oneB.status === 404 && reserveB.status === 404, `lecture directe par B : ${oneB.status} ${reserveB.status}`);
  const listA = await call(mf, "GET", "/api/hq/clients", undefined, approver, "203.0.113.21");
  assert(listA.status === 200 && listA.payload.clients.some((c) => c.id === "cli-atelier-nord"), "contrôle positif : Klirline ne voit plus son catalogue");
});

test("H2", "Une mission de l'organisation B ne peut pas viser un dossier client de Klirline (campagne ou clientId explicite)", async (mf) => {
  // ceo de B figure parmi les lecteurs du dossier de démonstration : seul le cloisonnement par
  // organisation peut le refuser.
  const campaign = await call(mf, "POST", "/api/hq/missions", { template: "klirprospect-demos" }, ceoB, "203.0.113.22");
  const explicit = await call(mf, "POST", "/api/hq/missions", { objective: "Mission fictive de l'organisation B", successCriterion: "Critère fictif", clientId: "cli-atelier-nord" }, ceoB, "203.0.113.22");
  assert(campaign.status === 403 && explicit.status === 403, `B vise un dossier de Klirline : campagne=${campaign.status} explicite=${explicit.status}`);
  const plain = await call(mf, "POST", "/api/hq/missions", { objective: "Mission fictive de l'organisation B", successCriterion: "Critère fictif" }, executorB, "203.0.113.22");
  assert(plain.status === 201 && plain.payload.mission.client === null, `contrôle positif B : ${plain.status} ${plain.payload.error || ""}`);
});

test("H3", "Nouveaux chemins du lot 2 cloisonnés : heartbeat, approbation v2 et action d'une autre organisation introuvables (404)", async (mf) => {
  const cmd = await call(mf, "POST", "/api/hq/command", { text: "Commande fictive Klirline", ownerSlug: "sandbox-klirline" }, executor, "203.0.113.23");
  const id = cmd.payload.command.id;
  const cl = await call(mf, "POST", `/api/hq/commands/${id}/claim`, {}, executor, "203.0.113.23");
  const cred = { attemptId: cl.payload.command.claim.attemptId, claimToken: cl.payload.claimToken };
  const hbB = await call(mf, "POST", `/api/hq/commands/${id}/heartbeat`, cred, executorB, "203.0.113.24");
  assert(hbB.status === 404, `heartbeat inter-organisation : ${hbB.status}`);
  const hbA = await call(mf, "POST", `/api/hq/commands/${id}/heartbeat`, cred, executor, "203.0.113.23");
  assert(hbA.status === 200, `contrôle positif heartbeat : ${hbA.status} ${hbA.payload.error || ""}`);
  const m = await call(mf, "POST", "/api/hq/missions", { template: "klirprospect-synthese" }, executor, "203.0.113.23");
  const mid = m.payload.mission.id;
  const shownA = await call(mf, "GET", `/api/hq/missions/${mid}`, undefined, approver, "203.0.113.25");
  const apB = await call(mf, "POST", `/api/hq/missions/${mid}/approval`, { decision: "approve", presentedHash: shownA.payload.mission.approvalRequest.hash }, ceoB, "203.0.113.24");
  const actB = await call(mf, "POST", `/api/hq/missions/${mid}/actions`, { type: "email", body: "Fictif", idempotencyKey: "org-b-action-0001" }, executorB, "203.0.113.24");
  assert(apB.status === 404 && actB.status === 404, `approbation/action inter-organisation : ${apB.status} ${actB.status}`);
  assert(JSON.parse(shownA.payload.mission.approvalRequest.canonical).orgId === "klirline", "le sujet canonique ne porte pas l'organisation");
});

let failed = 0;
const mf = await boot();
try {
  // G1 épuise le quota de la machine d'exécution : exécuté en dernier.
  for (const item of [...tests.filter((t) => t.id !== "G1"), ...tests.filter((t) => t.id === "G1")]) {
    if (only.size && !only.has(item.id)) continue;
    try { await item.fn(mf); console.log(`PASS ${item.id} — ${item.name}`); } catch (error) { failed += 1; console.log(`FAIL ${item.id} — ${item.name}\n     ${error.message}`); }
  }
} finally {
  await mf.dispose();
  fs.rmSync(persist, { recursive: true, force: true });
}
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — Worker lot 2");
process.exit(failed ? 1 : 0);
