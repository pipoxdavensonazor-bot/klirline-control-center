// Sonde Node : identité de service production sans fiche machine (scopes undefined, comme service:hq-poll dans src/worker.js).
const root = process.argv[2];
const { dispatchHq } = await import(`${root}/src/hq/dispatch.js`);
const { memoryHqStore } = await import(`${root}/src/hq/memory-store.js`);
const store = memoryHqStore();
const svc = { actorId: "service:hq-poll", scopes: undefined, human: false };
const now = new Date("2026-11-23T15:00:00.000Z");
const run = (method, pathname, body, who) => dispatchHq(store, { method, pathname, searchParams: new URLSearchParams(), body, now, ...who });
const created = await run("POST", "/api/hq/command", { text: "Sonde service", ownerSlug: "sandbox-klirline" }, svc);
const id = created.body.command.id;
const claim = await run("POST", `/api/hq/commands/${id}/claim`, {}, svc);
const cancel = await run("PATCH", `/api/hq/commands/${id}`, { status: "cancelled" }, svc);
const mission = await run("POST", "/api/hq/missions", { template: "klirprospect-synthese" }, svc);
console.log(JSON.stringify({ runtime: "node (dispatchHq + memoryHqStore)", create: created.status, claim: claim.body.outcome, cancel: cancel.status, missionCreate: mission.status }));
