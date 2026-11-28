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
      ]),
      ACCESS_SERVICE_CLIENT_IDS: `${serviceName},${"cd".repeat(16)}.access`,
      HQ_MACHINE_IDENTITIES: JSON.stringify([
        { id: "executor-klirprospect", accessClientId: serviceName, actorId: "machine-klirprospect", orgId: "klirline", scopes: ["work"] },
        // I2 : une fiche machine ne porte plus « coo » ; la revue machine garde un acteur non humain.
        { id: "reviewer-only", accessClientId: `${"cd".repeat(16)}.access`, actorId: "ops-review", orgId: "klirline", scopes: ["review"] },
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
    const r = await call(mf, "GET", "/api/hq/roster", undefined, executor);
    if (r.status === 429 && blockedAt == null) blockedAt = i;
    if (r.status !== 200 && r.status !== 429) throw new Error(`requête ${i} : ${r.status}`);
  }
  assert(blockedAt === 61, `machine A bloquée à la requête ${blockedAt} (attendu 61)`);
  const other = await call(mf, "GET", "/api/hq/roster", undefined, reviewer);
  assert(other.status === 200, `machine B (même IP) : ${other.status} — quota partagé`);
  const human = await call(mf, "GET", "/api/hq/roster", undefined, approver);
  assert(human.status === 200, `humain (même IP) : ${human.status}`);
});

let failed = 0;
const mf = await boot();
try {
  for (const item of tests) {
    if (only.size && !only.has(item.id)) continue;
    try { await item.fn(mf); console.log(`PASS ${item.id} — ${item.name}`); } catch (error) { failed += 1; console.log(`FAIL ${item.id} — ${item.name}\n     ${error.message}`); }
  }
} finally {
  await mf.dispose();
  fs.rmSync(persist, { recursive: true, force: true });
}
console.log(failed ? `ÉCHEC — ${failed} test(s) en échec` : "OK — Worker lot 2");
process.exit(failed ? 1 : 0);
