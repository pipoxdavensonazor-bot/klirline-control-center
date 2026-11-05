import { applyHqPatch, buildHqCommand, commandFilter, isHqId } from "./commands.js";
import { rosterView } from "./roster.js";

export async function dispatchHq(store, { method, pathname, searchParams, body, actorId }) {
  if (method === "GET" && pathname === "/api/hq/roster") {
    const commands = await store.list({});
    return { status: 200, body: { mode: "hq", roster: rosterView(commands) } };
  }
  if (method === "GET" && pathname === "/api/hq/commands") {
    const commands = await store.list(commandFilter(searchParams));
    return { status: 200, body: { mode: "hq", commands } };
  }
  if (method === "POST" && pathname === "/api/hq/command") {
    const command = buildHqCommand(body, actorId);
    await store.insert(command);
    return { status: 201, body: { mode: "hq", command } };
  }
  const match = pathname.match(/^\/api\/hq\/commands\/([^/]+)$/);
  if (!match) return { status: 404, body: { error: "Introuvable" } };
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return { status: 404, body: { error: "Commande introuvable" } };
  }
  if (!isHqId(id)) return { status: 404, body: { error: "Commande introuvable" } };
  const current = await store.get(id);
  if (!current) return { status: 404, body: { error: "Commande introuvable" } };
  if (method === "GET") return { status: 200, body: { mode: "hq", command: current } };
  if (method === "PATCH") {
    const command = applyHqPatch(current, body);
    await store.replace(command);
    return { status: 200, body: { mode: "hq", command } };
  }
  return { status: 404, body: { error: "Introuvable" } };
}
