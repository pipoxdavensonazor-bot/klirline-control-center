import { DurableObject } from "cloudflare:workers";
import { decide, execute, logCall } from "./engine.js";
import { agents } from "./org/index.js";
import { COMPANY } from "./policy.js";
import { freshState } from "./fresh-state.js";
import { present } from "./present.js";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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
      if (url.pathname === "/api/health") return json(200, { ok: true, company: COMPANY.legalName });

      if (url.pathname.startsWith("/api/playbooks/")) {
        const id = url.pathname.split("/").pop();
        if (!/^[a-z0-9-]+$/.test(id)) return json(404, { error: "Playbook introuvable" });
        const file = await env.ASSETS.fetch(new URL(`/knowledge/${id}.md`, request.url));
        if (!file.ok) return json(404, { error: "Playbook introuvable" });
        return json(200, { id, body: await file.text() });
      }

      if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

      const company = env.COMPANY.get(env.COMPANY.idFromName("klirline"));
      const catalog = await playbookCatalog(request, env);

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const actorId = url.searchParams.get("actor") || "ceo";
        if (!agents.some((agent) => agent.id === actorId)) return json(404, { error: "Rôle introuvable" });
        const state = await company.read();
        return json(200, present(state, actorId, catalog));
      }

      const payload = request.method === "POST" ? await request.json().catch(() => ({})) : {};
      let kind = null;
      if (request.method === "POST" && url.pathname === "/api/decision") kind = "decision";
      if (request.method === "POST" && url.pathname === "/api/execute") kind = "execute";
      if (request.method === "POST" && url.pathname === "/api/call") kind = "call";
      if (request.method === "POST" && url.pathname === "/api/reset") kind = "reset";
      if (!kind) return json(404, { error: "Introuvable" });

      const result = await company.apply(kind, payload);
      if (result.error) return json(result.status || 500, { error: result.error });
      const actorId = kind === "reset" ? "ceo" : payload.actorId;
      return json(200, present(result.state, actorId, catalog));
    } catch (error) {
      return json(error.status || 500, { error: error.message || "Erreur" });
    }
  },
};
