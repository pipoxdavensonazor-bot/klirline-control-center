import { DurableObject } from "cloudflare:workers";
import { accessSettings, bindIdentity, verifyAccessJwt } from "./access.js";
import { decide, execute, issueCommand, logCall } from "./engine.js";
import { COMPANY } from "./policy.js";
import { freshState } from "./fresh-state.js";
import { API_LIMITS, RATE_OBJECT_NAME, nextWindow, rateKey } from "./limits.js";
import { present } from "./present.js";
import { probeProductSites } from "./product-sites.js";
import { loadProspectSource } from "./prospect-feed.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extra } });
}

const keyCache = new Map();

async function accessKeys(teamDomain) {
  const cached = keyCache.get(teamDomain);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const error = new Error("Les certificats Cloudflare Access sont injoignables.");
    error.status = 503;
    throw error;
  }
  const body = await response.json();
  if (!Array.isArray(body.keys) || !body.keys.length) {
    const error = new Error("Les certificats Cloudflare Access sont vides.");
    error.status = 503;
    throw error;
  }
  keyCache.set(teamDomain, { at: Date.now(), keys: body.keys });
  return body.keys;
}

async function authenticate(request, env) {
  const settings = accessSettings(env);
  if (!settings.ready) {
    const error = new Error("Cloudflare Access n'est pas configuré. Aucun rôle du navigateur n'est accepté.");
    error.status = 503;
    throw error;
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    const error = new Error("Jeton Cloudflare Access manquant.");
    error.status = 401;
    throw error;
  }
  const { email } = await verifyAccessJwt(token, {
    teamDomain: settings.teamDomain,
    aud: settings.aud,
    keys: await accessKeys(settings.teamDomain),
    nowMs: Date.now(),
  });
  const account = settings.accounts.find((item) => item.email === email);
  if (!account) {
    const error = new Error("Ce compte n'est pas autorisé pour ce centre.");
    error.status = 403;
    throw error;
  }
  return bindIdentity(account);
}

async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > API_LIMITS.maxBodyBytes) {
    const error = new Error("Requête trop volumineuse.");
    error.status = 413;
    throw error;
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > API_LIMITS.maxBodyBytes) {
    const error = new Error("Requête trop volumineuse.");
    error.status = 413;
    throw error;
  }
  if (!bytes.byteLength) return {};
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    const error = new Error("JSON illisible");
    error.status = 400;
    throw error;
  }
}

export class CompanyState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS company (id TEXT PRIMARY KEY, body TEXT NOT NULL)",
    );
  }

  read() {
    const rows = this.ctx.storage.sql.exec("SELECT body FROM company WHERE id = 'main'").toArray();
    if (!rows.length) {
      const state = freshState();
      this.write(state);
      return state;
    }
    return JSON.parse(rows[0].body);
  }

  write(state) {
    this.ctx.storage.sql.exec(
      "INSERT INTO company (id, body) VALUES ('main', ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body",
      JSON.stringify(state),
    );
  }

  consume(key, now) {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS rate (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)",
    );
    this.ctx.storage.sql.exec("DELETE FROM rate WHERE window_start < ?", now - API_LIMITS.windowMs);
    const rows = this.ctx.storage.sql.exec("SELECT window_start, count FROM rate WHERE key = ?", key).toArray();
    const current = rows.length ? { windowStart: Number(rows[0].window_start), count: Number(rows[0].count) } : null;
    const next = nextWindow(current, now, API_LIMITS.windowMs);
    this.ctx.storage.sql.exec(
      "INSERT INTO rate (key, window_start, count) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count",
      key,
      next.windowStart,
      next.count,
    );
    if (next.count <= API_LIMITS.maxRequests) return { allowed: true, retryAfter: 0 };
    const retryAfter = Math.max(1, Math.ceil((next.windowStart + API_LIMITS.windowMs - now) / 1000));
    return { allowed: false, retryAfter };
  }

  apply(kind, payload) {
    try {
      if (kind === "reset") {
        if (payload.actorId !== "ceo") return { status: 403, error: "Seul le CEO recommence la journée de démonstration." };
        const state = freshState();
        this.write(state);
        return { state };
      }
      const state = this.read();
      if (kind === "decision") decide(state, payload.taskId, payload.actorId, payload.decision, payload.note);
      else if (kind === "execute") execute(state, payload.taskId, payload.actorId);
      else if (kind === "call") logCall(state, payload.taskId, payload.actorId, payload.outcome, payload.note);
      else if (kind === "command") issueCommand(state, payload.actorId, payload.text, payload.liveProspects);
      else return { status: 400, error: "Action inconnue" };
      this.write(state);
      return { state };
    } catch (error) {
      return { status: error.status || 500, error: error.message || "Erreur" };
    }
  }
}

async function playbookCatalog(request, env) {
  const response = await env.ASSETS.fetch(new URL("/playbooks.json", request.url));
  if (!response.ok) return [];
  return response.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (!url.pathname.startsWith("/api/")) {
        const asset = await env.ASSETS.fetch(request);
        const headers = new Headers(asset.headers);
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
        return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
      }

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const limiter = env.COMPANY.get(env.COMPANY.idFromName(RATE_OBJECT_NAME));
      const ipLimit = await limiter.consume(rateKey({ ip }), Date.now());
      if (!ipLimit.allowed) return json(429, { error: "Trop de requêtes." }, { "Retry-After": String(ipLimit.retryAfter) });

      if (url.pathname === "/api/health") return json(200, { ok: true, company: COMPANY.legalName, accessMode: "cloudflare-access" });
      if (request.method === "GET" && url.pathname === "/api/sites") return json(200, { sites: await probeProductSites() });

      if (url.pathname.startsWith("/api/playbooks/")) {
        const id = url.pathname.split("/").pop();
        if (!/^[a-z0-9-]+$/.test(id)) return json(404, { error: "Playbook introuvable" });
        const file = await env.ASSETS.fetch(new URL(`/knowledge/${id}.md`, request.url));
        if (!file.ok) return json(404, { error: "Playbook introuvable" });
        return json(200, { id, body: await file.text() });
      }

      const identity = await authenticate(request, env);
      const emailLimit = await limiter.consume(rateKey({ email: identity.email }), Date.now());
      if (!emailLimit.allowed) return json(429, { error: "Trop de requêtes." }, { "Retry-After": String(emailLimit.retryAfter) });

      const company = env.COMPANY.get(env.COMPANY.idFromName(identity.orgId));
      const catalog = await playbookCatalog(request, env);
      const prospectSource = await loadProspectSource(env);
      const viewOf = (state) => ({ ...present(state, identity.actorId, catalog, "cloudflare-access"), prospectSource });

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        return json(200, viewOf(await company.read()));
      }

      let kind = null;
      if (request.method === "POST" && url.pathname === "/api/decision") kind = "decision";
      if (request.method === "POST" && url.pathname === "/api/execute") kind = "execute";
      if (request.method === "POST" && url.pathname === "/api/call") kind = "call";
      if (request.method === "POST" && url.pathname === "/api/command") kind = "command";
      if (request.method === "POST" && url.pathname === "/api/reset") kind = "reset";
      if (!kind) return json(404, { error: "Introuvable" });

      const payload = await readJson(request);
      payload.actorId = identity.actorId;
      if (kind === "command") payload.liveProspects = prospectSource.prospects;
      const result = await company.apply(kind, payload);
      if (result.error) return json(result.status || 500, { error: result.error });
      return json(200, viewOf(result.state));
    } catch (error) {
      return json(error.status || 500, { error: error.message || "Erreur" });
    }
  },
};
