// Banc d'isolation interorganisation (KCO-AUDIT-2026-11-28, point 7). 100 % local : vrai src/worker.js
// dans Miniflare (workerd + Durable Object SQLite), vrais JWT Access signés par une clé RSA générée
// à la volée, certificats servis localement. Aucun réseau, aucun secret : valeurs factices.
// Mesure : l'organisation B (humains et machines) ne lit, n'écrit et ne liste jamais les commandes,
// missions, livrables et approbations de l'organisation A, et inversement ; contrôles positifs inclus.
// Usage : node scripts/hq-isolation-local.mjs [--out resultat.json]
import { spawnSync } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outIndex = process.argv.indexOf("--out");
const outFile = outIndex > 0 ? process.argv[outIndex + 1] : null;
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "klirline-isolation-"));
const bundle = path.join(persist, "worker.mjs");
const bundled = spawnSync(path.join(root, "node_modules/esbuild/bin/esbuild"), [
  path.join(root, "src/worker.js"), "--bundle", "--format=esm", "--platform=neutral", `--outfile=${bundle}`,
  "--external:cloudflare:workers", "--external:node:*",
], { encoding: "utf8" });
if (bundled.status !== 0) throw new Error(bundled.stderr || bundled.stdout || "esbuild a échoué");

const team = "equipe.cloudflareaccess.com";
const aud = "aud-local-isolation";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "local-iso", alg: "RS256", use: "sig" };
const cid = (c) => `${c.repeat(32)}.access`;
const CLIENT = { execA: cid("a"), execB: cid("b"), reviewB: cid("c"), dupA: cid("d") };

function sign(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "local-iso" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${createSign("RSA-SHA256").update(data).sign(privateKey).toString("base64url")}`;
}
function token(extra) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ aud, iss: `https://${team}`, exp: now + 900, nbf: now - 10, iat: now, type: "app", ...extra });
}
const human = (email) => token({ email, sub: "11111111-1111-4111-8111-111111111111" });
const machine = (clientId) => token({ sub: "", common_name: clientId });
const WHO = {
  ceoA: human("ceo-a@example.test"), cooA: human("coo-a@example.test"), execA: machine(CLIENT.execA),
  ceoB: human("ceo-b@example.test"), cooB: human("coo-b@example.test"), execB: machine(CLIENT.execB), reviewB: machine(CLIENT.reviewB),
  dupA: machine(CLIENT.dupA),
};

async function boot() {
  const converted = convertV4MiniflareOptions({
    name: "klirline-control-center", rootPath: persist, scriptPath: bundle, modules: true,
    compatibilityDate: "2026-10-06", compatibilityFlags: ["nodejs_compat"], resourcePersistencePath: persist,
    durableObjects: { COMPANY: { className: "CompanyState", useSQLite: true } },
    bindings: {
      ACCESS_TEAM_DOMAIN: team,
      ACCESS_AUD: aud,
      ACCESS_ACCOUNTS: JSON.stringify([
        { email: "ceo-a@example.test", role: "ceo", orgId: "org-a" },
        { email: "coo-a@example.test", role: "coo", orgId: "org-a" },
        { email: "ceo-b@example.test", role: "ceo", orgId: "org-b" },
        { email: "coo-b@example.test", role: "coo", orgId: "org-b" },
      ]),
      ACCESS_SERVICE_CLIENT_IDS: Object.values(CLIENT).join(","),
      HQ_MACHINE_IDENTITIES: JSON.stringify([
        { id: "exec-a", accessClientId: CLIENT.execA, actorId: "machine-a", orgId: "org-a", scopes: ["work"] },
        { id: "exec-b", accessClientId: CLIENT.execB, actorId: "machine-b", orgId: "org-b", scopes: ["work"] },
        { id: "review-b", accessClientId: CLIENT.reviewB, actorId: "ops-review", orgId: "org-b", scopes: ["work", "review"] },
        // Fiche ambiguë : le même Client ID déclaré dans deux organisations (erreur de configuration).
        { id: "dup-b", accessClientId: CLIENT.dupA, actorId: "machine-dup", orgId: "org-b", scopes: ["work"] },
        { id: "dup-a", accessClientId: CLIENT.dupA, actorId: "machine-dup", orgId: "org-a", scopes: ["work"] },
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
  const mf = new Miniflare(converted);
  await mf.ready;
  return mf;
}

const results = [];
let mf;
async function call(method, pathname, body, assertion, headers = {}) {
  const response = await mf.dispatchFetch(`http://localhost${pathname}`, {
    method,
    headers: { "content-type": "application/json", "cf-access-jwt-assertion": assertion, ...headers },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 200) }; }
  return { status: response.status, payload, text };
}
function record(id, family, description, ok, observed, positive = false, shared = false) {
  const verdict = ok ? (positive ? "contrôle positif OK" : "isolé") : positive ? "contrôle positif ÉCHOUÉ" : shared ? "COMMUN (documenté)" : "FUITE";
  results.push({ id, family, description, verdict, observed });
}
async function rows(org, sql) {
  const storage = await mf.unsafeGetDurableObjectStorage("klirline-control-center", "CompanyState", { name: org });
  try { return await storage.exec(sql); } catch (error) { return { error: error.message }; }
}

mf = await boot();
try {
  // ---- Données de l'organisation A (fictives) ----
  const cmdA = await call("POST", "/api/hq/command", { text: "Commande fictive org-a SECRET-A-CMD", ownerSlug: "ops-klirline", idempotencyKey: "cle-commune-1" }, WHO.execA);
  const idA = cmdA.payload.command?.id;
  record("P1", "contrôle", "A crée une commande", cmdA.status === 201 && Boolean(idA), cmdA.status, true);
  const misA = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, WHO.execA);
  const midA = misA.payload.mission?.id;
  const tidA = misA.payload.mission?.tasks?.[0]?.id;
  await call("POST", `/api/hq/missions/${midA}/transition`, { status: "ready" }, WHO.execA);
  const stA = await call("POST", `/api/hq/missions/${midA}/tasks/${tidA}/start`, {}, WHO.execA);
  const dlA = await call("POST", `/api/hq/missions/${midA}/deliverables`, { taskId: tidA, attemptId: stA.payload.attemptId, claimToken: stA.payload.claimToken, body: "Livrable fictif org-a SECRET-A-LIV" }, WHO.execA);
  await call("POST", `/api/hq/missions/${midA}/transition`, { status: "in_review" }, WHO.execA);
  const apA = await call("POST", `/api/hq/missions/${midA}/approval`, { decision: "approve", note: "Approbation fictive SECRET-A-APR" }, WHO.cooA);
  record("P2", "contrôle", "A crée mission, livrable et approbation", Boolean(midA) && dlA.status === 200 && apA.status === 200 && apA.payload.mission?.approvalValid === true, `${misA.status}/${dlA.status}/${apA.status}`, true);
  const cmdA2 = await call("POST", "/api/hq/command", { text: "Commande fictive org-a à interrompre", ownerSlug: "ops-klirline" }, WHO.execA);
  const idA2 = cmdA2.payload.command?.id;
  const claimA2 = await call("POST", `/api/hq/commands/${idA2}/claim`, {}, WHO.execA);

  // ---- B tente de lire ----
  for (const [who, label] of [[WHO.ceoB, "humain ceo B"], [WHO.cooB, "humain coo B"], [WHO.execB, "machine work B"], [WHO.reviewB, "machine review B"]]) {
    const one = await call("GET", `/api/hq/commands/${idA}`, undefined, who);
    record(`R-cmd-${label}`, "commandes", `${label} lit la commande de A par identifiant`, one.status === 404 && !one.text.includes("SECRET-A"), one.status);
    const list = await call("GET", "/api/hq/commands", undefined, who);
    record(`L-cmd-${label}`, "commandes", `${label} liste les commandes`, list.status === 200 && !list.text.includes(idA) && !list.text.includes("SECRET-A"), `${list.status}, ${list.payload.commands?.length ?? "?"} commande(s)`);
    const mis = await call("GET", `/api/hq/missions/${midA}`, undefined, who);
    record(`R-mis-${label}`, "missions/livrables/approbations", `${label} lit la mission de A (livrable et approbation inclus)`, mis.status === 404 && !mis.text.includes("SECRET-A"), mis.status);
    const ml = await call("GET", "/api/hq/missions", undefined, who);
    record(`L-mis-${label}`, "missions/livrables/approbations", `${label} liste les missions`, ml.status === 200 && !ml.text.includes(midA) && !ml.text.includes("SECRET-A"), `${ml.status}, ${ml.payload.missions?.length ?? "?"} mission(s)`);
    const roster = await call("GET", "/api/hq/roster", undefined, who);
    record(`L-roster-${label}`, "commandes", `${label} lit le tableau des agents (compteurs de commandes)`, !roster.text.includes(idA) && !roster.text.includes("SECRET-A"), roster.status);
  }
  // ---- B tente d'écrire ----
  const writes = [
    ["W-patch", "commandes", "machine B change le statut de la commande de A", () => call("PATCH", `/api/hq/commands/${idA}`, { status: "cancelled" }, WHO.execB)],
    ["W-patch-h", "commandes", "humain ceo B force le statut de la commande de A", () => call("PATCH", `/api/hq/commands/${idA}`, { status: "cancelled" }, WHO.ceoB)],
    ["W-claim", "commandes", "machine B prend la commande de A", () => call("POST", `/api/hq/commands/${idA}/claim`, {}, WHO.execB)],
    ["W-int", "commandes", "machine review B interrompt la commande sous bail de A", () => call("POST", `/api/hq/commands/${idA2}/interrupt`, { reason: "intrusion" }, WHO.reviewB)],
    ["W-int-h", "commandes", "humain ceo B interrompt la commande sous bail de A", () => call("POST", `/api/hq/commands/${idA2}/interrupt`, { reason: "intrusion" }, WHO.ceoB)],
    ["W-done", "commandes", "machine B termine la commande de A avec le bail volé", () => call("PATCH", `/api/hq/commands/${idA2}`, { status: "done", attemptId: claimA2.payload.attemptId, claimToken: claimA2.payload.claimToken, result: "volé" }, WHO.execB)],
    ["W-trans", "missions/livrables/approbations", "humain coo B change le statut de la mission de A", () => call("POST", `/api/hq/missions/${midA}/transition`, { status: "cancelled" }, WHO.cooB)],
    ["W-deliv", "missions/livrables/approbations", "machine B dépose un livrable sur la mission de A", () => call("POST", `/api/hq/missions/${midA}/deliverables`, { taskId: tidA, attemptId: stA.payload.attemptId, claimToken: stA.payload.claimToken, body: "Livrable intrus de B" }, WHO.execB)],
    ["W-appr", "missions/livrables/approbations", "humain coo B approuve (rejette) la mission de A", () => call("POST", `/api/hq/missions/${midA}/approval`, { decision: "reject" }, WHO.cooB)],
    ["W-act", "missions/livrables/approbations", "humain ceo B prépare une action externe sur la mission de A", () => call("POST", `/api/hq/missions/${midA}/actions`, { type: "email", body: "intrus" }, WHO.ceoB)],
    ["W-start", "missions/livrables/approbations", "machine B démarre une tâche de la mission de A", () => call("POST", `/api/hq/missions/${midA}/tasks/${tidA}/start`, {}, WHO.execB)],
  ];
  for (const [id, family, description, run] of writes) {
    const response = await run();
    record(id, family, description, response.status === 404, `${response.status} ${response.payload.error || ""}`.trim());
  }
  // ---- Injections ----
  const inj = await call("POST", "/api/hq/command", { text: "Commande B qui vise org-a", ownerSlug: "ops-klirline", orgId: "org-a" }, WHO.execB);
  record("I-body", "injection", "machine B met orgId=org-a dans le corps", inj.status === 400, `${inj.status} ${inj.payload.error || ""}`);
  const hdr = await call("POST", "/api/hq/command", { text: "Commande B avec en-têtes forgés MARQUE-B-HDR", ownerSlug: "ops-klirline" }, WHO.execB, { "x-org": "org-a", "cf-access-authenticated-user-email": "ceo-a@example.test", "x-actor": "ceo" });
  const hdrInA = await call("GET", "/api/hq/commands", undefined, WHO.execA);
  record("I-hdr", "injection", "machine B ajoute x-org / cf-access-authenticated-user-email / x-actor de A", hdr.status === 201 && !hdrInA.text.includes("MARQUE-B-HDR"), `B=${hdr.status} ; vu par A=${hdrInA.text.includes("MARQUE-B-HDR")}`);
  const idem = await call("POST", "/api/hq/command", { text: "Commande fictive org-b même clé", ownerSlug: "ops-klirline", idempotencyKey: "cle-commune-1" }, WHO.execB);
  record("I-idem", "injection", "machine B réutilise la clé d'idempotence de A", idem.status === 201 && idem.payload.command?.id !== idA && !idem.text.includes("SECRET-A"), `${idem.status} ${idem.payload.command?.id === idA ? "commande de A renvoyée" : "commande propre à B"}`);
  const noJwt = await call("GET", `/api/hq/commands/${idA}`, undefined, "");
  record("I-nojwt", "injection", "requête sans JWT", noJwt.status === 401, noJwt.status);
  // ---- Fiche machine ambiguë ----
  const dup = await call("POST", "/api/hq/command", { text: "Commande de la fiche ambiguë MARQUE-DUP", ownerSlug: "ops-klirline" }, WHO.dupA);
  const dupInB = await rows("org-b", "SELECT COUNT(*) AS n FROM hq_command WHERE body LIKE '%MARQUE-DUP%'");
  const dupInA = await rows("org-a", "SELECT COUNT(*) AS n FROM hq_command WHERE body LIKE '%MARQUE-DUP%'");
  record("C-dup", "configuration", "un même Client ID déclaré dans org-a et org-b est refusé (pas d'organisation choisie au hasard de l'ordre)", dup.status === 401 || dup.status === 403,
    `${dup.status} ; écrit dans org-b=${dupInB?.[0]?.n ?? dupInB?.error} org-a=${dupInA?.[0]?.n ?? dupInA?.error}`);
  // ---- Contrôles positifs : A voit toujours ses objets intacts ----
  const backA = await call("GET", `/api/hq/missions/${midA}`, undefined, WHO.cooA);
  const backCmd = await call("GET", `/api/hq/commands/${idA}`, undefined, WHO.execA);
  const backCmd2 = await call("GET", `/api/hq/commands/${idA2}`, undefined, WHO.execA);
  record("P3", "contrôle", "A relit sa mission : approbation toujours valide, 1 livrable, statut in_review", backA.status === 200 && backA.payload.mission.approvalValid === true && backA.payload.mission.deliverables.length === 1 && backA.payload.mission.status === "in_review", `${backA.status} ${backA.payload.mission?.status} approvalValid=${backA.payload.mission?.approvalValid}`, true);
  record("P4", "contrôle", "A relit ses commandes : statuts inchangés", backCmd.payload.command?.status === "pending" && backCmd2.payload.command?.status === "dispatched", `${backCmd.payload.command?.status}/${backCmd2.payload.command?.status}`, true);
  // ---- Stockage : chaque Durable Object ne contient que son organisation ----
  const leakB = await rows("org-b", `SELECT (SELECT COUNT(*) FROM hq_command WHERE body LIKE '%SECRET-A%' OR id IN ('${idA}','${idA2}')) AS c, (SELECT COUNT(*) FROM hq_mission WHERE body LIKE '%SECRET-A%' OR id = '${midA}') AS m`);
  const ownA = await rows("org-a", `SELECT (SELECT COUNT(*) FROM hq_command) AS c, (SELECT COUNT(*) FROM hq_mission) AS m`);
  record("S-b", "stockage", "le Durable Object org-b ne contient aucune ligne de A", leakB?.[0]?.c === 0 && leakB?.[0]?.m === 0, JSON.stringify(leakB));
  record("S-a", "stockage", "le Durable Object org-a contient les objets de A", ownA?.[0]?.c >= 2 && ownA?.[0]?.m === 1, JSON.stringify(ownA), true);
  // ---- Données communes à toutes les organisations (par conception du code) ----
  const clientsB = await call("GET", "/api/hq/clients", undefined, WHO.ceoB);
  record("G-clients", "donnée commune", "humain ceo B lit le catalogue client de démonstration (codé en dur, commun à toutes les organisations)", !(clientsB.payload.clients || []).length, `${clientsB.status}, ${(clientsB.payload.clients || []).length} dossier(s) : ${(clientsB.payload.clients || []).map((c) => c.id).join(",")}`, false, true);
} finally {
  await mf.dispose();
  fs.rmSync(persist, { recursive: true, force: true });
}

const leaks = results.filter((item) => item.verdict === "FUITE");
const positivesKo = results.filter((item) => item.verdict === "contrôle positif ÉCHOUÉ");
const summary = { total: results.length, isoles: results.filter((item) => item.verdict === "isolé").length, fuites: leaks.length, communsDocumentes: results.filter((item) => item.verdict.startsWith("COMMUN")).length, controlesPositifs: results.filter((item) => item.verdict.startsWith("contrôle positif")).length, controlesPositifsEchoues: positivesKo.length };
for (const item of results) console.log(`${item.verdict.padEnd(22)} ${item.id.padEnd(26)} ${item.description} — ${item.observed}`);
console.log(JSON.stringify(summary));
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ runtime: "miniflare-workerd-local", remoteCloudflare: false, summary, results }, null, 2));
process.exit(leaks.length || positivesKo.length ? 1 : 0);
