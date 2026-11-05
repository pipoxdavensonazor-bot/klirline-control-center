import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSynthesis, readPinnedProcedure, runExecutor } from "./hq-executor.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.HQ_EXEC_PORT || 4191);
const base = `http://127.0.0.1:${port}`;
const hqFile = path.join(os.tmpdir(), `klirline-hq-exec-${process.pid}.json`);
const missionFile = path.join(os.tmpdir(), `klirline-mission-exec-${process.pid}.json`);
const identities = [
  { id: "executor-klirprospect", token: "local-test-executor", actorId: "machine-klirprospect", scopes: ["work"] },
  { id: "reviewer-office", token: "local-test-reviewer", actorId: "coo", scopes: ["review"] },
  { id: "accountant-test", token: "local-test-accounting", actorId: "accounting", scopes: ["work"] },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(token, method, pathname, body) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

const procedure = readPinnedProcedure();
const synthesis = buildSynthesis(procedure);
assert(synthesis.executionKind === "deterministic-script" && synthesis.model === null && synthesis.costCents === 0, "la synthèse ne doit pas prétendre à un modèle");
assert(synthesis.body.includes("Besoins") && synthesis.body.includes("Informations manquantes") && synthesis.body.includes("Questions à poser") && synthesis.body.includes("Ordre du jour"), "la synthèse est incomplète");
assert(synthesis.body.includes("Aucune démonstration n'est réservée."), "la synthèse compte une réservation");

const child = spawn(process.execPath, ["src/server.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    HQ_COMMANDS_PATH: hqFile,
    HQ_MISSIONS_PATH: missionFile,
    HQ_MACHINE_IDENTITIES: JSON.stringify(identities),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const health = await fetch(`${base}/api/health`);
      if (health.ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (attempt === 39) throw new Error("Le serveur local ne répond pas.");
  }

  const anonymous = await fetch(`${base}/api/hq/missions`);
  assert(anonymous.status === 401, "une mission se lit sans identité");
  const browserRole = await fetch(`${base}/api/hq/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: "klirprospect-synthese", actorId: "ceo" }),
  });
  assert(browserRole.status === 401, "un rôle de navigateur ouvre une mission");

  const first = await runExecutor(base, "local-test-executor");
  const executorApproval = await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/approval`, { decision: "approve" });
  assert(executorApproval.status === 403, "l'exécuteur valide son propre dossier");
  const returned = await call("local-test-reviewer", "POST", `/api/hq/missions/${first.missionId}/approval`, { decision: "reject", note: "Préciser que les fiches sont fictives." });
  assert(returned.status === 200 && returned.payload.mission.status === "rework", "le réviseur ne peut pas renvoyer le dossier");
  const forged = await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/approval`, { decision: "approve", actorId: "ceo", validatorId: "coo" });
  assert(forged.status === 400, "un champ d'identité est accepté");
  const accountant = await call("local-test-accounting", "GET", "/api/hq/clients/cli-reserve");
  assert(accountant.status === 404, "un rôle non autorisé lit le dossier réservé");

  const restarted = await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/tasks/${returned.payload.mission.tasks[0].id}/start`, {});
  assert(restarted.status === 200 && restarted.payload.started === true && restarted.payload.attemptId !== first.attemptId, "la reprise ne crée pas une nouvelle tentative");
  const stale = await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/deliverables`, {
    taskId: returned.payload.mission.tasks[0].id,
    body: synthesis.body,
    result: synthesis.result,
    attemptId: first.attemptId,
    claimToken: "ancien-jeton-invalide",
  });
  assert(stale.status === 409, "l'ancienne tentative écrit encore");
  const delivered = await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/deliverables`, {
    taskId: returned.payload.mission.tasks[0].id,
    body: synthesis.body,
    result: synthesis.result,
    attemptId: restarted.payload.attemptId,
    claimToken: restarted.payload.claimToken,
  });
  assert(delivered.status === 200, "la tentative active ne dépose pas le livrable");
  await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/transition`, { status: "in_review" });
  const approved = await call("local-test-reviewer", "POST", `/api/hq/missions/${first.missionId}/approval`, { decision: "approve", note: "Synthèse interne acceptée." });
  assert(approved.status === 200 && approved.payload.mission.approvalValid === true, "le réviseur n'accepte pas le dossier");
  const closed = await call("local-test-reviewer", "POST", `/api/hq/missions/${first.missionId}/transition`, {
    status: "done",
    result: "Synthèse interne préparée. Aucune démonstration n'est réservée.",
  });
  assert(closed.status === 200 && closed.payload.mission.outcomes.demosBooked === 0 && closed.payload.mission.cost.spentCents === 0, "la clôture compte une réservation ou une dépense");
  const mail = await call("local-test-executor", "POST", `/api/hq/missions/${first.missionId}/actions`, { type: "email", body: "Invitation" });
  assert(mail.status === 403 && mail.payload.mission.drafts.every((draft) => draft.sent === false), "un courriel est parti");

  const proof = {
    executionKind: "deterministic-script",
    model: null,
    aiExecution: "blocked",
    aiReason: "Plafond de 0 $ et aucun modèle autorisé. Le script n'est pas une exécution d'IA.",
    missionId: closed.payload.mission.id,
    attemptId: restarted.payload.attemptId,
    previousAttemptId: first.attemptId,
    procedure: { id: procedure.id, version: procedure.version },
    costCents: closed.payload.mission.cost.spentCents,
    demosBooked: closed.payload.mission.outcomes.demosBooked,
    deliverable: closed.payload.mission.deliverables.at(-1),
    events: closed.payload.mission.events,
    reviewer: "coo",
    executor: "machine-klirprospect",
  };
  const proofPath = path.join(os.tmpdir(), `klirline-execution-proof-${process.pid}.json`);
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
  console.log(`OK — preuve ${proofPath}`);
} finally {
  child.kill();
  await new Promise((resolve) => {
    if (child.exitCode != null) return resolve();
    child.once("exit", () => resolve());
    setTimeout(resolve, 400);
  });
  fs.rmSync(hqFile, { force: true });
  fs.rmSync(missionFile, { force: true });
}
