import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = fs.mkdtempSync(path.join(os.tmpdir(), "klirline-do-"));
const configPath = path.join(persist, "wrangler.jsonc");
const port = 8791;
const base = `http://127.0.0.1:${port}`;

fs.writeFileSync(configPath, JSON.stringify({
  name: "klirline-do-local",
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
      if (log.includes("Ready on") || log.includes(`http://127.0.0.1:${port}`)) {
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
  return { child, ready, dump: () => log.slice(-2000) };
}

async function stop(child) {
  if (!child || child.exitCode != null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      resolve();
    }, 5000);
    child.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function call(method, pathname, body, { actor, scopes, human = false, now } = {}) {
  const headers = { "content-type": "application/json", "x-actor": actor, "x-scopes": scopes.join(",") };
  if (human) headers["x-human"] = "1";
  if (now) headers["x-local-now"] = now;
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function scenario() {
  const schema = await fetch(`${base}/__schema`).then((response) => response.json());
  assert(schema.tables.includes("hq_mission") && schema.tables.includes("hq_command"), `tables ${schema.tables.join(",")}`);

  const created = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, { actor: "machine-klirprospect", scopes: ["work"] });
  assert(created.status === 201, `création ${created.status} ${created.payload.error || ""}`);
  const missionId = created.payload.mission.id;
  const taskId = created.payload.mission.tasks[0].id;
  const ready = await call("POST", `/api/hq/missions/${missionId}/transition`, { status: "ready" }, { actor: "machine-klirprospect", scopes: ["work"] });
  assert(ready.status === 200 && ready.payload.mission.status === "ready", "passage prêt");

  const reviewerStart = await call("POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, { actor: "coo", scopes: ["review"] });
  assert(reviewerStart.status === 403, `la revue a pris la tâche ${reviewerStart.status}`);

  const t0 = "2026-11-05T15:00:00.000Z";
  const first = await call("POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
  assert(first.status === 200 && first.payload.started === true, `démarrage ${first.status} ${first.payload.error || first.payload.reason}`);
  const attemptId = first.payload.attemptId;
  const claimToken = first.payload.claimToken;
  assert(attemptId && claimToken, "tentative ou jeton absent");

  const second = await call("POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
  assert(second.payload.reason === "held" && second.payload.claimToken == null, "le second démarrage a reçu un jeton");

  const command = await call("POST", "/api/hq/command", { text: "Contrôler le bail local", ownerSlug: "ops-klirline" }, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
  assert(command.status === 201, "commande locale");
  const commandId = command.payload.command.id;
  const [left, right] = await Promise.all([
    call("POST", `/api/hq/commands/${commandId}/claim`, {}, { actor: "machine-klirprospect", scopes: ["work"], now: t0 }),
    call("POST", `/api/hq/commands/${commandId}/claim`, {}, { actor: "machine-klirprospect", scopes: ["work"], now: t0 }),
  ]);
  const outcomes = [left.payload.outcome, right.payload.outcome].sort();
  assert(left.status === 200 && right.status === 200 && outcomes.join() === "held,issued", `courses ${outcomes.join()}`);

  const stale = "2026-11-05T16:00:00.000Z";
  const running = await call("PATCH", `/api/hq/commands/${commandId}`, { status: "running", overrideReason: "Essai local : passage running forcé par un humain." }, { actor: "coo", scopes: ["review"], human: true, now: t0 });
  assert(running.status === 200 && running.payload.command.status === "running", `passage running ${running.status} ${running.payload.error || ""}`);
  const expired = await call("POST", `/api/hq/commands/${commandId}/claim`, {}, { actor: "machine-klirprospect", scopes: ["work"], now: stale });
  assert(expired.payload.outcome === "blocked" && expired.payload.command.status === "blocked", `expiration ${expired.payload.outcome}`);

  const reclaimed = await call("POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {}, { actor: "machine-klirprospect", scopes: ["work"], now: stale });
  assert(reclaimed.payload.reason === "reclaimed" && reclaimed.payload.attemptId && reclaimed.payload.attemptId !== attemptId, `reprise ${reclaimed.payload.reason || reclaimed.payload.error}`);
  const oldWrite = await call("POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    attemptId,
    claimToken,
    body: "Ancienne tentative qui ne doit pas remplacer la reprise.",
  }, { actor: "machine-klirprospect", scopes: ["work"], now: stale });
  assert(oldWrite.status === 409, `ancienne tentative acceptée ${oldWrite.status}`);

  const proof = "Synthèse locale Durable Object, trois fiches fictives, aucune démonstration réservée.";
  const delivered = await call("POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    attemptId: reclaimed.payload.attemptId,
    claimToken: reclaimed.payload.claimToken,
    body: proof,
  }, { actor: "machine-klirprospect", scopes: ["work"], now: stale });
  assert(delivered.status === 200 && delivered.payload.mission.deliverables.length === 1, `dépôt ${delivered.status} ${delivered.payload.error || ""}`);
  const commandDone = delivered.payload.mission.tasks.find((task) => task.id === taskId).commandId;
  const duplicate = await call("PATCH", `/api/hq/commands/${commandDone}`, {
    status: "done",
    attemptId: reclaimed.payload.attemptId,
    claimToken: reclaimed.payload.claimToken,
    proof,
  }, { actor: "machine-klirprospect", scopes: ["work"], now: stale });
  assert(duplicate.status === 200 && duplicate.payload.outcome === "duplicate", `doublon ${duplicate.status} ${duplicate.payload.outcome || duplicate.payload.error}`);
  const changed = await call("PATCH", `/api/hq/commands/${commandDone}`, {
    status: "done",
    attemptId: reclaimed.payload.attemptId,
    claimToken: reclaimed.payload.claimToken,
    proof: "Une autre preuve",
  }, { actor: "machine-klirprospect", scopes: ["work"], now: stale });
  assert(changed.status === 409, `preuve différente acceptée ${changed.status}`);

  const review = await call("POST", `/api/hq/missions/${missionId}/transition`, { status: "in_review" }, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
  assert(review.status === 200, `revue ${review.status} ${review.payload.error || ""}`);
  const selfApproval = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve" }, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
  assert(selfApproval.status === 403, "l'auteur s'est validé");
  // T3 (inversé) : une identité machine « coo » (human=false) ne valide jamais une mission A3.
  const machineApproval = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve", note: "Vu." }, { actor: "coo", scopes: ["review"], now: t0 });
  assert(machineApproval.status === 403, `une machine coo a validé ${machineApproval.status}`);
  const shown = await call("GET", `/api/hq/missions/${missionId}`, {}, { actor: "coo", scopes: ["review"], human: true, now: t0 });
  const approved = await call("POST", `/api/hq/missions/${missionId}/approval`, { decision: "approve", note: "Vu.", presentedHash: shown.payload.mission?.approvalRequest?.hash }, { actor: "coo", scopes: ["review"], human: true, now: t0 });
  assert(approved.status === 200 && approved.payload.mission.approvalValid === true, "validation humaine refusée");

  // T12 : sans la tentative terminée, une révision est refusée ; le titulaire la fait avec son jeton.
  const forgedRevision = await call("POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    body: "Révision sans jeton, refusée.",
  }, { actor: "machine-klirprospect", scopes: ["work"], now: "2026-11-05T15:05:00.000Z" });
  assert(forgedRevision.status === 409, `révision sans jeton acceptée ${forgedRevision.status}`);
  const revised = await call("POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    attemptId: reclaimed.payload.attemptId,
    claimToken: reclaimed.payload.claimToken,
    body: "Synthèse révisée, toujours sans démonstration réservée.",
  }, { actor: "machine-klirprospect", scopes: ["work"], now: "2026-11-05T15:05:00.000Z" });
  assert(revised.status === 200 && revised.payload.mission.status === "rework" && revised.payload.mission.approvalValid === false, "la modification a gardé l'approbation");

  const send = await call("POST", `/api/hq/missions/${missionId}/actions`, { type: "email", body: "Message qui ne doit pas partir.", idempotencyKey: "do-check-message-1" }, { actor: "machine-klirprospect", scopes: ["work"], now: t0 });
  assert(send.status === 403 && send.payload.mission.drafts.at(-1).sent === false, `envoi ${send.status}`);
  const hidden = await call("GET", "/api/hq/clients/cli-reserve", {}, { actor: "machine-klirprospect", scopes: ["work"] });
  assert(hidden.status === 404, `dossier réservé visible ${hidden.status}`);

  return { missionId, tables: schema.tables };
}

const preview = JSON.parse(fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
const binding = preview.previews?.durable_objects?.bindings?.[0];
assert(binding?.name === "COMPANY" && binding?.class_name === "CompanyState" && !binding.script_name && !binding.id, "le bloc previews réutilise un espace nommé");
assert(preview.preview_urls !== true, "preview_urls est activé");
assert(!JSON.stringify(preview.routes).includes("previews_enabled"), "la route de production ouvre les aperçus");

let session = start();
try {
  await session.ready;
  const first = await scenario();
  await stop(session.child);
  session = start();
  await session.ready;
  const again = await fetch(`${base}/__schema`).then((response) => response.json());
  const mission = await call("GET", `/api/hq/missions/${first.missionId}`, {}, { actor: "coo", scopes: ["review"] });
  assert(again.tables.includes("hq_mission"), "hq_mission disparaît au redémarrage");
  assert(mission.status === 200 && mission.payload.mission.id === first.missionId && mission.payload.mission.status === "rework", "la mission ne survit pas au redémarrage");
  const proof = {
    runtime: "local-workerd",
    remoteCloudflare: false,
    persist,
    tables: again.tables,
    missionId: first.missionId,
    status: mission.payload.mission.status,
    deliverables: mission.payload.mission.deliverables.length,
    draftSent: mission.payload.mission.drafts.at(-1).sent,
  };
  console.log(JSON.stringify(proof, null, 2));
  console.log("OK — Durable Object local, stockage conservé après redémarrage.");
} catch (error) {
  console.error(session.dump());
  throw error;
} finally {
  await stop(session.child);
}
