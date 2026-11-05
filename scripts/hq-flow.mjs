import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.HQ_FLOW_PORT || 4188);
const hqFile = path.join(os.tmpdir(), `klirline-hq-${process.pid}.json`);
const missionFile = path.join(os.tmpdir(), `klirline-missions-${process.pid}.json`);
const stateFile = path.join(root, "data", "state.json");
const stateBackup = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
const base = `http://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, pathname, body) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function waitForHealth(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode != null) throw new Error("Le serveur local s'est arrêté.");
    try {
      const health = await request("GET", "/api/health");
      if (health.status === 200 && health.payload.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Le serveur local ne répond pas.");
}

const child = spawn(process.execPath, ["src/server.js"], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HQ_COMMANDS_PATH: hqFile, HQ_MISSIONS_PATH: missionFile },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForHealth(child);

  const created = await request("POST", "/api/hq/command", { text: "rédiger l'article Black Wall News", priority: "haute" });
  assert(created.status === 201, `création ${created.status}`);
  assert(created.payload.command.status === "pending", "la commande ne naît pas pending");
  assert(created.payload.command.ownerSlug === "bwn-redaction", "mauvais agent");
  const id = created.payload.command.id;

  const pending = await request("GET", "/api/hq/commands?status=pending");
  assert(pending.status === 200, "liste pending");
  assert(pending.payload.commands.some((command) => command.id === id), "la commande n'est pas dans pending");

  const token = "poll-flow-token";
  const claim = await request("POST", `/api/hq/commands/${id}/claim`, { claimedBy: "office-klirline", claimToken: token });
  assert(claim.status === 200 && claim.payload.started === true && claim.payload.reason === "claimed" && claim.payload.command.status === "running", "le claim ne démarre pas");

  const pendingAfter = await request("GET", "/api/hq/commands?status=pending");
  assert(!pendingAfter.payload.commands.some((command) => command.id === id), "le claim laisse la commande dans pending");

  const rival = await request("POST", `/api/hq/commands/${id}/claim`, { claimedBy: "autre-poll", claimToken: "autre-flow-token" });
  assert(rival.status === 200 && rival.payload.started === false && rival.payload.reason === "already_active" && rival.payload.command.claimToken === null, "le second claim relance");
  assert(rival.payload.command.updatedAt === claim.payload.command.updatedAt, "le second claim réécrit la commande");

  const replay = await request("POST", `/api/hq/commands/${id}/claim`, { claimedBy: "office-klirline", claimToken: token });
  assert(replay.status === 200 && replay.payload.started === false && replay.payload.reason === "replay" && replay.payload.command.claimToken === token, "le replay ne répond pas");
  assert(replay.payload.command.updatedAt === claim.payload.command.updatedAt, "le replay réécrit la commande");

  const bare = await request("PATCH", `/api/hq/commands/${id}`, { status: "done" });
  assert(bare.status === 400, `done sans preuve a répondu ${bare.status}`);
  const stillRunning = await request("GET", `/api/hq/commands/${id}`);
  assert(stillRunning.payload.command.status === "running", "le refus de preuve a changé le statut");

  const patched = await request("PATCH", `/api/hq/commands/${id}`, { status: "done", result: "Article prêt", proof: "Brouillon déposé", agentNote: "BWN Rédaction" });
  assert(patched.status === 200 && patched.payload.command.status === "done" && patched.payload.command.proof === "Brouillon déposé", "PATCH done a échoué");

  const again = await request("GET", `/api/hq/commands/${id}`);
  assert(again.payload.command.status === "done" && again.payload.command.result === "Article prêt" && again.payload.command.proof === "Brouillon déposé", "la lecture ne montre pas done");

  const late = await request("POST", `/api/hq/commands/${id}/claim`, { claimToken: token });
  assert(late.status === 409 && late.payload.started === false && late.payload.command.status === "done", "un claim après done a été accepté");

  const roster = await request("GET", "/api/hq/roster");
  assert(roster.payload.roster.length >= 14, "roster trop court");
  assert(roster.payload.roster.find((agent) => agent.id === "bwn-redaction").lastCommand.status === "done", "la carte ne suit pas le statut");

  const demo = await request("POST", "/api/command", { actorId: "ceo", text: "trouver 10 prospects" });
  assert(demo.status === 200 && demo.payload.tasks.some((task) => task.origin === "command"), "la commande de démonstration est cassée");

  const bootstrap = await request("GET", "/api/bootstrap?actor=ceo");
  assert(bootstrap.payload.adminHub === true && bootstrap.payload.platforms.length === 8, "le hub Plateformes ne répond plus");

  const page = await fetch(`${base}/app.js`, { signal: AbortSignal.timeout(5000) });
  const source = await page.text();
  assert(source.includes("Bureau") && source.includes("Plateformes") && source.includes("Admin produits"), "l'interface a perdu le bureau ou les plateformes");
  assert(source.includes("<strong>Preuve.</strong>") && source.includes("awaiting_validation") && source.includes("Échoué"), "l'interface n'affiche plus la preuve ou les statuts");
  assert(source.includes("Missions") && source.includes("Non exécutable") && source.includes("Envoi désactivé"), "l'interface perd les missions ou présente un agent comme exécutable");

  const campaign = await request("POST", "/api/hq/missions", { template: "klirprospect-demos", actorId: "sales-director" });
  assert(campaign.status === 201 && campaign.payload.mission.outcomes.demosBooked === 0 && campaign.payload.mission.tasks.length === 4, "la campagne de démonstration ne s'ouvre pas");
  const hidden = await request("GET", "/api/hq/clients?actor=accounting");
  assert(hidden.status === 200 && hidden.payload.clients.length === 0, "un rôle hors liste lit un dossier");
  const denied = await request("POST", "/api/hq/skills/klir-coordination/enable", { actorId: "ceo" });
  assert(denied.status === 403, "une compétence s'active toute seule");
  const unsent = await request("POST", `/api/hq/missions/${campaign.payload.mission.id}/actions`, { type: "email", body: "Invitation", actorId: "sales-director" });
  assert(unsent.status === 403 && unsent.payload.mission.drafts[0].sent === false, "un courriel part sans approbation");

  console.log(`OK — commande ${id} : claim idempotent, done sans preuve refusé, preuve visible. Démonstration et hub intacts.`);
} finally {
  child.kill();
  await new Promise((resolve) => {
    if (child.exitCode != null) return resolve();
    child.once("exit", () => resolve());
    setTimeout(resolve, 500);
  });
  fs.rmSync(hqFile, { force: true });
  fs.rmSync(missionFile, { force: true });
  if (stateBackup) fs.writeFileSync(stateFile, stateBackup);
  else fs.rmSync(stateFile, { force: true });
}
