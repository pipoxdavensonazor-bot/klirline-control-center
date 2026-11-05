import { buildHqCommand, commandFilter, isHqId, presentHqCommand } from "./commands.js";
import { CONNECTIONS } from "./connections.js";
import { visibleClient, visibleClients } from "./clients.js";
import { createMission, isMissionId, presentMission } from "./missions.js";
import { rosterView } from "./roster.js";
import { SKILL_REGISTRY } from "./skills.js";

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
  if (method === "GET" && pathname === "/api/hq/skills") {
    return { status: 200, body: { mode: "hq", skills: SKILL_REGISTRY } };
  }
  if (method === "POST" && pathname.startsWith("/api/hq/skills")) {
    return { status: 403, body: { error: "Une compétence ne s'active pas elle-même." } };
  }
  if (method === "GET" && pathname === "/api/hq/connections") {
    return { status: 200, body: { mode: "hq", connections: CONNECTIONS } };
  }
  if (method === "GET" && pathname === "/api/hq/clients") {
    return { status: 200, body: { mode: "hq", clients: visibleClients(actorId) } };
  }
  const clientMatch = pathname.match(/^\/api\/hq\/clients\/([^/]+)$/);
  if (clientMatch && method === "GET") {
    const client = visibleClient(actorId, clientMatch[1]);
    if (!client) return { status: 404, body: { error: "Dossier inaccessible" } };
    return { status: 200, body: { mode: "hq", client } };
  }
  if (method === "GET" && pathname === "/api/hq/missions") {
    const missions = await store.missionList();
    return { status: 200, body: { mode: "hq", missions: missions.map((mission) => presentMission(mission, actorId, options.now)) } };
  }
  if (method === "POST" && pathname === "/api/hq/missions") {
    const mission = createMission(body, actorId, options);
    await store.missionInsert(mission);
    return { status: 201, body: { mode: "hq", mission: presentMission(mission, actorId, options.now) } };
  }
  const missionStart = pathname.match(/^\/api\/hq\/missions\/([^/]+)\/tasks\/([^/]+)\/start$/);
  const missionAction = pathname.match(/^\/api\/hq\/missions\/([^/]+)\/(transition|deliverables|approval|actions)$/);
  const missionGet = pathname.match(/^\/api\/hq\/missions\/([^/]+)$/);
  if (missionStart || missionAction || missionGet) {
    const rawId = (missionStart || missionAction || missionGet)[1];
    const id = readId(rawId);
    if (!id || !isMissionId(id)) return { status: 404, body: { error: "Mission introuvable" } };
    if (missionGet && method === "GET") {
      const mission = await store.missionGet(id);
      if (!mission) return { status: 404, body: { error: "Mission introuvable" } };
      return { status: 200, body: { mode: "hq", mission: presentMission(mission, actorId, options.now) } };
    }
    if (method !== "POST" || missionGet) return { status: 404, body: { error: "Introuvable" } };
    const operation = missionStart ? "start" : { transition: "transition", deliverables: "deliver", approval: "decide", actions: "act" }[missionAction[2]];
    const input = missionStart ? { ...(body || {}), taskId: readId(missionStart[2]) } : (body || {});
    const result = await store.missionOperate(id, operation, input, actorId, options);
    return {
      status: result.httpStatus || 200,
      body: {
        mode: "hq",
        mission: presentMission(result.mission, actorId, options.now),
        started: result.started,
        reason: result.reason,
        ...(result.error ? { error: result.error } : {}),
      },
    };
  }
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
