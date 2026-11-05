import { spawnSync } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "klirline-worker-"));
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
      HQ_MACHINE_IDENTITIES: JSON.stringify([
        { id: "executor-klirprospect", accessClientId: serviceName, actorId: "machine-klirprospect", orgId: "klirline", scopes: ["work"] },
        { id: "reviewer-only", accessClientId: `${"cd".repeat(16)}.access`, actorId: "coo", orgId: "klirline", scopes: ["review"] },
      ]),
    },
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

async function call(mf, method, pathname, body, assertion) {
  const response = await mf.dispatchFetch(`http://centre.klirline.com${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      "cf-access-jwt-assertion": assertion,
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

let mf = await boot();
try {
  const bare = await call(mf, "GET", "/api/hq/missions", undefined, "");
  assert(bare.status === 401, `sans jeton : ${bare.status} ${JSON.stringify(bare.payload).slice(0, 500)}`);

  const created = await call(mf, "POST", "/api/hq/missions", { template: "klirprospect-synthese" }, executor);
  assert(created.status === 201, `création ${created.status} ${created.payload.error || JSON.stringify(created.payload).slice(0, 240)}`);
  const missionId = created.payload.mission.id;
  const taskId = created.payload.mission.tasks[0].id;
  const before = await tables(mf);
  assert(before.includes("hq_mission") && before.includes("hq_command"), `tables ${before.join(",")}`);

  await call(mf, "POST", `/api/hq/missions/${missionId}/transition`, { status: "ready" }, executor);
  const denied = await call(mf, "POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, reviewer);
  assert(denied.status === 403, `revue autorisée à prendre ${denied.status} ${denied.payload.error || ""}`);

  const started = await call(mf, "POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, executor);
  assert(started.status === 200 && started.payload.started === true && started.payload.attemptId, `démarrage ${started.status} ${started.payload.error || started.payload.reason || ""}`);
  const held = await call(mf, "POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, executor);
  assert(held.payload.reason === "held" && held.payload.claimToken == null, `seconde prise ${held.payload.reason || held.payload.error}`);

  const command = await call(mf, "POST", "/api/hq/command", { text: "Contrôler le bail du Worker local", ownerSlug: "ops-klirline" }, executor);
  assert(command.status === 201, `commande ${command.status} ${command.payload.error || ""}`);
  const commandId = command.payload.command.id;
  const [left, right] = await Promise.all([
    call(mf, "POST", `/api/hq/commands/${commandId}/claim`, {}, executor),
    call(mf, "POST", `/api/hq/commands/${commandId}/claim`, {}, executor),
  ]);
  const outcomes = [left.payload.outcome, right.payload.outcome].sort().join();
  assert(left.status === 200 && right.status === 200 && outcomes === "held,issued", `courses ${outcomes}`);

  const stale = await call(mf, "POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    attemptId: "00000000-0000-4000-8000-000000000000",
    claimToken: started.payload.claimToken,
    body: "Ancienne tentative qui ne doit pas s'écrire.",
  }, executor);
  assert(stale.status === 409, `ancienne tentative ${stale.status} ${stale.payload.error || ""}`);

  const proof = "Synthèse du Worker local. Trois fiches fictives. Aucune démonstration réservée.";
  const delivered = await call(mf, "POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    attemptId: started.payload.attemptId,
    claimToken: started.payload.claimToken,
    body: proof,
  }, executor);
  assert(delivered.status === 200 && delivered.payload.mission.deliverables.length === 1, `dépôt ${delivered.status} ${delivered.payload.error || ""}`);
  const review = await call(mf, "POST", `/api/hq/missions/${missionId}/transition`, { status: "in_review" }, executor);
  assert(review.status === 200, `passage en revue ${review.status} ${review.payload.error || ""}`);
  const selfApproval = await call(mf, "POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve" }, executor);
  assert(selfApproval.status === 403, `l'exécuteur s'est validé ${selfApproval.status}`);
  const approved = await call(mf, "POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve", note: "Vu en local." }, approver);
  assert(approved.status === 200 && approved.payload.mission.approvalValid === true, `validation ${approved.status} ${approved.payload.error || ""}`);
  const send = await call(mf, "POST", `/api/hq/missions/${missionId}/actions`, { type: "email", body: "Ce message ne part pas." }, executor);
  assert(send.status === 403 && send.payload.mission.drafts.at(-1).sent === false, `envoi ${send.status} ${send.payload.error || ""}`);

  await mf.dispose();
  mf = await boot();
  const after = await tables(mf);
  const reloaded = await call(mf, "GET", `/api/hq/missions/${missionId}`, undefined, approver);
  assert(after.includes("hq_mission"), "hq_mission absente après redémarrage");
  assert(reloaded.status === 200 && reloaded.payload.mission.id === missionId && reloaded.payload.mission.approvalValid === true, `relecture ${reloaded.status} ${reloaded.payload.error || reloaded.payload.mission?.status || ""}`);
  const hidden = await call(mf, "GET", "/api/hq/clients/cli-reserve", undefined, executor);
  assert(hidden.status === 404, `dossier réservé ${hidden.status}`);
  console.log(JSON.stringify({
    entry: "src/worker.js",
    runtime: "miniflare-workerd-local",
    remoteCloudflare: false,
    persist,
    tables: after,
    missionId,
    status: reloaded.payload.mission.status,
    deliverables: reloaded.payload.mission.deliverables.length,
    approvalValid: reloaded.payload.mission.approvalValid,
    draftSent: reloaded.payload.mission.drafts.at(-1).sent,
    concurrentClaims: outcomes,
    oldAttempt: stale.status,
  }, null, 2));
  console.log("OK — Worker src/worker.js, Durable Object local, stockage conservé.");
} finally {
  await mf.dispose();
}
