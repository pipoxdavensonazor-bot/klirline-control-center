import { applyHqPatch, buildHqCommand, commandFilter, isHqId, publicCommand } from "./commands.js";
import { rosterView } from "./roster.js";

function present(command) {
  return publicCommand(command);
}

function commandId(pathname, suffix) {
  const match = pathname.match(new RegExp(`^/api/hq/commands/([^/]+)${suffix}$`));
  if (!match) return null;
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return { error: { status: 404, body: { error: "Commande introuvable" } } };
  }
  if (!isHqId(id)) return { error: { status: 404, body: { error: "Commande introuvable" } } };
  return { id };
}

export async function dispatchHq(store, { method, pathname, searchParams, body, actorId, now }) {
  const clock = now instanceof Date ? now : new Date();
  if (method === "GET" && pathname === "/api/hq/roster") {
    const commands = await store.list({});
    return { status: 200, body: { mode: "hq", roster: rosterView(commands) } };
  }
  if (method === "GET" && pathname === "/api/hq/commands") {
    const commands = await store.list(commandFilter(searchParams));
    return { status: 200, body: { mode: "hq", commands: commands.map(present) } };
  }
  if (method === "POST" && pathname === "/api/hq/command") {
    const command = buildHqCommand(body, actorId, { now: clock });
    await store.insert(command);
    return { status: 201, body: { mode: "hq", command: present(command) } };
  }

  const claimRoute = commandId(pathname, "/claim");
  if (claimRoute) {
    if (claimRoute.error) return claimRoute.error;
    if (method !== "POST") return { status: 404, body: { error: "Introuvable" } };
    return store.claim(claimRoute.id, {
      actorId,
      now: clock,
      note: body?.note ?? body?.agentNote,
    });
  }

  const interruptRoute = commandId(pathname, "/interrupt");
  if (interruptRoute) {
    if (interruptRoute.error) return interruptRoute.error;
    if (method !== "POST") return { status: 404, body: { error: "Introuvable" } };
    return store.interrupt(interruptRoute.id, {
      actorId,
      now: clock,
      note: body?.note ?? body?.agentNote,
    });
  }

  const match = commandId(pathname, "");
  if (!match) return { status: 404, body: { error: "Introuvable" } };
  if (match.error) return match.error;
  const current = await store.get(match.id);
  if (!current) return { status: 404, body: { error: "Commande introuvable" } };
  if (method === "GET") return { status: 200, body: { mode: "hq", command: present(current) } };
  if (method === "PATCH") {
    const command = applyHqPatch(current, body, { now: clock });
    await store.replace(command);
    return { status: 200, body: { mode: "hq", command: present(command) } };
  }
  return { status: 404, body: { error: "Introuvable" } };
}
