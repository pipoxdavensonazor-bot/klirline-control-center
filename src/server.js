import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { decide, execute, issueCommand, logCall } from "./engine.js";
import { dispatchHq } from "./hq/dispatch.js";
import { authenticateLocalHuman, authenticateMachine } from "./hq/machine-auth.js";
import { fileHqStore } from "./hq/file-store.js";
import { agents, assertOrganization } from "./org/index.js";
import { COMPANY } from "./policy.js";
import { present } from "./present.js";
import { probeProductSites } from "./product-sites.js";
import { dataPath, loadState, resetState, saveState } from "./store.js";
import { API_LIMITS, rateKey, take } from "./limits.js";

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
  return present(state, actorId, playbooks(), "demonstration");
}

function send(res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  const payload = Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...extra,
  });
  res.end(payload);
}

const hits = new Map();

function guard(req, url) {
  if (!url.pathname.startsWith("/api/")) return null;
  const decision = take(hits, rateKey({ ip: req.socket.remoteAddress || "local" }), Date.now());
  if (decision.allowed) return null;
  return { status: 429, body: { error: "Trop de requêtes." }, extra: { "Retry-After": String(decision.retryAfter) } };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > API_LIMITS.maxBodyBytes) {
        failed = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) {
        reject(Object.assign(new Error("Requête trop volumineuse."), { status: 413 }));
        return;
      }
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("JSON illisible"), { status: 400 }));
      }
    });
    req.on("error", (error) => {
      if (!failed) reject(error);
    });
  });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limited = guard(req, url);
    if (limited) return send(res, limited.status, limited.body, "application/json; charset=utf-8", limited.extra);
    try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, company: COMPANY.legalName, accessMode: "demonstration" });
    }
    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      const actorId = url.searchParams.get("actor") || "ceo";
      if (!agents.some((agent) => agent.id === actorId)) {
        return send(res, 404, { error: "Rôle introuvable" });
      }
      return send(res, 200, view(loadState(), actorId));
    }
    if (req.method === "GET" && url.pathname === "/api/sites") {
      return send(res, 200, { sites: await probeProductSites() });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/playbooks/")) {
      const id = url.pathname.split("/").pop();
      const body = readPlaybook(id);
      if (!body) return send(res, 404, { error: "Playbook introuvable" });
      return send(res, 200, { id, body });
    }
    if (url.pathname.startsWith("/api/hq/")) {
      const localHuman = authenticateLocalHuman(req.headers.authorization, process.env);
      const machine = localHuman || authenticateMachine(req.headers.authorization, process.env);
      if (!machine) {
        return send(res, 401, { error: "Identité machine manquante. Un rôle annoncé par le navigateur n'est pas accepté." });
      }
      const payload = req.method === "GET" ? {} : await readBody(req);
      const result = await dispatchHq(fileHqStore(), {
        method: req.method,
        pathname: url.pathname,
        searchParams: url.searchParams,
        body: payload,
        actorId: machine.actorId,
        machineId: machine.id,
        scopes: machine.scopes,
        human: Boolean(localHuman),
      });
      return send(res, result.status, result.body);
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
    if (req.method === "POST" && url.pathname === "/api/command") {
      const body = await readBody(req);
      const state = loadState();
      issueCommand(state, body.actorId, body.text);
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
