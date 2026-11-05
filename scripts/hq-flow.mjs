import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.HQ_FLOW_PORT || 4188);
const hqFile = path.join(os.tmpdir(), `klirline-hq-${process.pid}.json`);
const stateFile = path.join(root, "data", "state.json");
const stateBackup = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
const base = `http://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const machineToken = "local-test-executor";
const machineIdentities = JSON.stringify([
  { id: "executor-test", token: machineToken, actorId: "machine-klirprospect", scopes: ["work", "review"] },
]);

async function request(method, pathname, body) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${machineToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
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
  env: { ...process.env, PORT: String(port), HQ_COMMANDS_PATH: hqFile, HQ_MACHINE_IDENTITIES: machineIdentities },
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

  const firstClaim = await request("POST", `/api/hq/commands/${id}/claim`, {});
  assert(firstClaim.status === 200 && firstClaim.payload.outcome === "issued" && firstClaim.payload.command.status === "dispatched", "le premier claim ne transmet pas");
  assert(typeof firstClaim.payload.claimToken === "string" && firstClaim.payload.claimToken.length >= 32, "le premier claim ne remet pas de bail");
  assert(!JSON.stringify(firstClaim.payload.command).includes(firstClaim.payload.claimToken), "le bail est recopié dans la commande");

  const secondClaim = await request("POST", `/api/hq/commands/${id}/claim`, {});
  assert(secondClaim.status === 200 && secondClaim.payload.outcome === "held" && secondClaim.payload.command.status === "dispatched", "le second claim redistribue");
  assert(secondClaim.payload.claimToken === undefined && !JSON.stringify(secondClaim.payload).includes(firstClaim.payload.claimToken), "le second claim renvoie le bail");
  assert(secondClaim.payload.command.updatedAt === firstClaim.payload.command.updatedAt, "le second claim réécrit la date");

  const attempt = { attemptId: firstClaim.payload.command.claim.attemptId, claimToken: firstClaim.payload.claimToken };
  const bare = await request("PATCH", `/api/hq/commands/${id}`, { status: "done" });
  assert(bare.status === 409, `clore sans tentative a répondu ${bare.status}`);
  const blank = await request("PATCH", `/api/hq/commands/${id}`, { status: "done", ...attempt, result: " ", proof: "", agentNote: "" });
  assert(blank.status === 400, "une preuve vide est acceptée");
  const stillOpen = await request("GET", `/api/hq/commands/${id}`);
  assert(stillOpen.payload.command.status === "dispatched" && !JSON.stringify(stillOpen.payload).includes(firstClaim.payload.claimToken), "le refus de clôture a changé la commande");

  const patched = await request("PATCH", `/api/hq/commands/${id}`, { status: "done", ...attempt, result: "Article prêt", agentNote: "BWN Rédaction", proof: "Brouillon déposé au bureau" });
  assert(patched.status === 200 && patched.payload.command.status === "done" && patched.payload.command.proof === "Brouillon déposé au bureau", "PATCH done a échoué");

  const again = await request("GET", `/api/hq/commands/${id}`);
  assert(again.payload.command.status === "done" && again.payload.command.result === "Article prêt" && again.payload.command.proof === "Brouillon déposé au bureau", "la lecture ne montre pas done");

  const roster = await request("GET", "/api/hq/roster");
  assert(roster.payload.roster.length >= 14, "roster trop court");
  assert(roster.payload.roster.find((agent) => agent.id === "bwn-redaction").lastCommand.status === "done", "la carte ne suit pas le statut");

  const demo = await request("POST", "/api/command", { actorId: "ceo", text: "trouver 10 prospects" });
  assert(demo.status === 200 && demo.payload.tasks.some((task) => task.origin === "command"), "la commande de démonstration est cassée");

  const bootstrap = await request("GET", "/api/bootstrap?actor=ceo");
  assert(bootstrap.payload.adminHub === true && bootstrap.payload.platforms.length === 8, "le hub Plateformes ne répond plus");

  const page = await fetch(`${base}/app.js`, { signal: AbortSignal.timeout(5000) });
  const source = await page.text();
  assert(source.includes("Bureau") && source.includes("Plateformes") && source.includes("Admin produits") && source.includes("Preuve."), "l'interface a perdu le bureau, les plateformes ou la preuve");

  console.log(`OK — commande ${id} : pending → done. Démonstration et hub intacts.`);
} finally {
  child.kill();
  await new Promise((resolve) => {
    if (child.exitCode != null) return resolve();
    child.once("exit", () => resolve());
    setTimeout(resolve, 500);
  });
  fs.rmSync(hqFile, { force: true });
  if (stateBackup) fs.writeFileSync(stateFile, stateBackup);
  else fs.rmSync(stateFile, { force: true });
}
