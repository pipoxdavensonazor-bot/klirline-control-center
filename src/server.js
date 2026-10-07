import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { actionsFor, briefing, decide, execute, logCall } from "./engine.js";
import { DEPARTMENTS, agents, assertOrganization, skillDocument } from "./org/index.js";
import { COMPANY, PLATFORMS } from "./policy.js";
import { dataPath, loadState, resetState, saveState } from "./store.js";

assertOrganization();

const publicDir = dataPath("public");
const knowledgeDir = dataPath("knowledge");
const port = Number(process.env.PORT || 4173);

function playbooks() {
  return fs
    .readdirSync(knowledgeDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const id = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
      const title = raw.match(/^#\s+(.+)/)?.[1] ?? id;
      return { id, title };
    });
}

function readPlaybook(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const file = path.join(knowledgeDir, `${id}.md`);
  if (!file.startsWith(knowledgeDir)) return null;
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

function view(state, actorId) {
  return {
    company: COMPANY,
    generatedAt: new Date().toISOString(),
    actorId,
    departments: DEPARTMENTS,
    agents: agents.map((agent) => ({
      ...agent,
      skillDocument: skillDocument(agent),
      reportIds: agents.filter((item) => item.reportsTo === agent.id).map((item) => item.id),
    })),
    platformCatalog: PLATFORMS,
    platforms: state.platforms,
    tasks: state.tasks.map((task) => ({ ...task, actions: actionsFor(actorId, task) })),
    briefing: briefing(state),
    audit: state.audit.slice(0, 50),
    outbox: state.outbox,
    calls: state.calls,
    playbooks: playbooks(),
    demonstration: state.demonstration,
  };
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  const payload = Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("JSON illisible"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, company: COMPANY.legalName });
    }
    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      const actorId = url.searchParams.get("actor") || "ceo";
      if (!agents.some((agent) => agent.id === actorId)) {
        return send(res, 404, { error: "Rôle introuvable" });
      }
      return send(res, 200, view(loadState(), actorId));
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/playbooks/")) {
      const id = url.pathname.split("/").pop();
      const body = readPlaybook(id);
      if (!body) return send(res, 404, { error: "Playbook introuvable" });
      return send(res, 200, { id, body });
    }
    if (req.method === "POST" && url.pathname === "/api/decision") {
      const body = await readBody(req);
      const state = loadState();
      decide(state, body.taskId, body.actorId, body.decision, body.note);
      saveState(state);
      return send(res, 200, view(state, body.actorId));
    }
    if (req.method === "POST" && url.pathname === "/api/execute") {
      const body = await readBody(req);
      const state = loadState();
      execute(state, body.taskId, body.actorId);
      saveState(state);
      return send(res, 200, view(state, body.actorId));
    }
    if (req.method === "POST" && url.pathname === "/api/call") {
      const body = await readBody(req);
      const state = loadState();
      logCall(state, body.taskId, body.actorId, body.outcome, body.note);
      saveState(state);
      return send(res, 200, view(state, body.actorId));
    }
    if (req.method === "POST" && url.pathname === "/api/reset") {
      const body = await readBody(req);
      if (body.actorId !== "ceo") return send(res, 403, { error: "Seul le CEO recommence la journée de démonstration." });
      const state = resetState();
      return send(res, 200, view(state, "ceo"));
    }
    const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const file = path.normalize(path.join(publicDir, relative));
    if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return send(res, 404, { error: "Introuvable" });
    }
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    return send(res, 200, fs.readFileSync(file), types[path.extname(file)] || "application/octet-stream");
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || "Erreur" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Klirline Control Center http://127.0.0.1:${port}`);
});
