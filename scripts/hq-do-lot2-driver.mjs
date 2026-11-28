// Pilote local uniquement (lot 2). wrangler.jsonc pointe toujours src/worker.js.
// Les en-têtes x-actor, x-scopes, x-human, x-local-now et la route /__fault n'existent pas sur le
// Worker publié. /__fault injecte une panne dans le Durable Object pour tester l'atomicité.
import { CompanyState as ProductionState, hqDurableStore } from "../src/worker.js";
import { dispatchHq } from "../src/hq/dispatch.js";

export class CompanyState extends ProductionState {
  setFault(point) {
    this.fault = point || null;
    return this.fault;
  }

  hqMissionReplace(mission) {
    if (this.fault === "mission-replace") throw new Error("Panne simulée après l'écriture de la commande.");
    return super.hqMissionReplace(mission);
  }

  auditProbe(sql) {
    try {
      return { ok: true, rows: this.ctx.storage.sql.exec(sql).toArray() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const company = env.COMPANY.get(env.COMPANY.idFromName(request.headers.get("x-org") || "klirline"));
    if (url.pathname === "/__fault") return Response.json({ fault: await company.setFault(url.searchParams.get("point")) });
    if (url.pathname === "/__sql") return Response.json(await company.auditProbe(await request.text()));
    if (url.pathname.startsWith("/__backup/") || url.pathname.startsWith("/__pitr/")) {
      const input = await request.json();
      try {
        const op = { "/__backup/export": () => company.hqBackupExport(input.identity, input.reason, input.keys),
          "/__backup/restore": () => company.hqBackupRestore(input.identity, input.reason, input.bundle, input.keys),
          "/__pitr/bookmark": () => company.hqPitrBookmark(input.identity, input.reason, input.time),
          "/__pitr/restore": () => company.hqPitrRestore(input.identity, input.reason, input.bookmark) }[url.pathname];
        return Response.json(await op());
      } catch (error) {
        return Response.json({ error: error.message }, { status: error.status || 500 });
      }
    }
    const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
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
        orgId: request.headers.get("x-org") || "klirline",
        ...(nowHeader ? { now: new Date(nowHeader) } : {}),
      });
      return Response.json(result.body, { status: result.status });
    } catch (error) {
      return Response.json({ error: error.message || "Erreur" }, { status: error.status || 500 });
    }
  },
};
