import { buildHqCommand, commandFilter, isHqId, presentHqCommand } from "./commands.js";
import { rosterView } from "./roster.js";

function readId(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function show(command, options, revealClaim = false) {
  const view = presentHqCommand(command, options);
  if (!revealClaim) view.claimToken = null;
  return view;
}

export async function dispatchHq(store, { method, pathname, searchParams, body, actorId, now, leaseMs }) {
  const options = {};
  if (now instanceof Date) options.now = now;
  if (Number(leaseMs) > 0) options.leaseMs = Number(leaseMs);
  if (method === "GET" && pathname === "/api/hq/roster") {
    const commands = await store.list({});
    return { status: 200, body: { mode: "hq", roster: rosterView(commands) } };
  }
  if (method === "GET" && pathname === "/api/hq/commands") {
    const commands = await store.list(commandFilter(searchParams));
    return { status: 200, body: { mode: "hq", commands: commands.map((command) => show(command, options)) } };
  }
  if (method === "POST" && pathname === "/api/hq/command") {
    const command = buildHqCommand(body, actorId, options);
    await store.insert(command);
    return { status: 201, body: { mode: "hq", command: show(command, options) } };
  }
  const claimMatch = pathname.match(/^\/api\/hq\/commands\/([^/]+)\/claim$/);
  if (claimMatch) {
    if (method !== "POST") return { status: 404, body: { error: "Introuvable" } };
    const id = readId(claimMatch[1]);
    if (!id || !isHqId(id)) return { status: 404, body: { error: "Commande introuvable" } };
    const outcome = await store.claim(id, body, actorId, options);
    const revealClaim = outcome.reason === "claimed" || outcome.reason === "reclaimed" || outcome.reason === "replay";
    return {
      status: outcome.httpStatus,
      body: {
        mode: "hq",
        command: show(outcome.command, options, revealClaim),
        started: outcome.started,
        reason: outcome.reason,
        ...(outcome.error ? { error: outcome.error } : {}),
      },
    };
  }
  const match = pathname.match(/^\/api\/hq\/commands\/([^/]+)$/);
  if (!match) return { status: 404, body: { error: "Introuvable" } };
  const id = readId(match[1]);
  if (!id || !isHqId(id)) return { status: 404, body: { error: "Commande introuvable" } };
  if (method === "GET") {
    const current = await store.get(id);
    if (!current) return { status: 404, body: { error: "Commande introuvable" } };
    return { status: 200, body: { mode: "hq", command: show(current, options) } };
  }
  if (method === "PATCH") {
    const command = await store.patch(id, body, actorId, options);
    return { status: 200, body: { mode: "hq", command: show(command, options) } };
  }
  return { status: 404, body: { error: "Introuvable" } };
}
