// Pilote local uniquement. wrangler.jsonc pointe toujours src/worker.js.
// Les en-têtes x-actor, x-scopes, x-human et x-local-now n'existent pas sur le Worker publié.
import { CompanyState as ProductionState, hqDurableStore } from "../src/worker.js";
import { dispatchHq } from "../src/hq/dispatch.js";

export class CompanyState extends ProductionState {
  schemaProbe() {
    return this.ctx.storage.sql
      .exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .toArray()
      .map((row) => row.name);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const company = env.COMPANY.get(env.COMPANY.idFromName("klirline"));
    if (url.pathname === "/__schema") {
      return Response.json({ tables: await company.schemaProbe() });
    }
    const body = request.method === "GET" || request.method === "HEAD" ? {} : await request.json().catch(() => ({}));
    const nowHeader = request.headers.get("x-local-now");
    try {
      const result = await dispatchHq(hqDurableStore(company), {
        method: request.method,
        pathname: url.pathname,
        searchParams: url.searchParams,
        body,
        actorId: request.headers.get("x-actor") || "",
        scopes: (request.headers.get("x-scopes") || "").split(",").filter(Boolean),
        human: request.headers.get("x-human") === "1",
        ...(nowHeader ? { now: new Date(nowHeader) } : {}),
      });
      return Response.json(result.body, { status: result.status });
    } catch (error) {
      return Response.json({ error: error.message || "Erreur" }, { status: error.status || 500 });
    }
  },
};
