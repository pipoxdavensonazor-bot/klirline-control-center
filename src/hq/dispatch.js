import { buildHqCommand, commandFilter, isHqId, publicCommand, rejectImpersonation } from "./commands.js";
import { CONNECTIONS } from "./connections.js";
import { visibleClient, visibleClients } from "./clients.js";
import { canReadMission, createMission, isMissionId, presentMission } from "./missions.js";
import { rosterView } from "./roster.js";
import { SKILL_REGISTRY } from "./skills.js";

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

function allows(scopes, needed) {
  return Array.isArray(scopes) && scopes.includes(needed);
}

export async function dispatchHq(store, { method, pathname, searchParams, body, actorId, now, scopes, human }) {
  const clock = now instanceof Date ? now : new Date();
  if (method !== "GET" && body && typeof body === "object") {
    try {
      rejectImpersonation(body);
    } catch (error) {
      return { status: error.status || 400, body: { error: error.message } };
    }
  }
  if (method === "GET" && pathname === "/api/hq/skills") return { status: 200, body: { mode: "hq", skills: SKILL_REGISTRY } };
  if (method === "POST" && pathname.startsWith("/api/hq/skills")) return { status: 403, body: { error: "Une compétence ne s'active pas elle-même." } };
  if (method === "GET" && pathname === "/api/hq/connections") return { status: 200, body: { mode: "hq", connections: CONNECTIONS } };
  if (method === "GET" && pathname === "/api/hq/clients") return { status: 200, body: { mode: "hq", clients: visibleClients(actorId) } };
  const clientMatch = pathname.match(/^\/api\/hq\/clients\/([^/]+)$/);
  if (clientMatch && method === "GET") {
    const client = visibleClient(actorId, clientMatch[1]);
    if (!client) return { status: 404, body: { error: "Dossier inaccessible" } };
    return { status: 200, body: { mode: "hq", client } };
  }
  if (method === "GET" && pathname === "/api/hq/missions") {
    const missions = await store.missionList();
    const visible = missions.filter((mission) => canReadMission(mission, actorId, scopes));
    return { status: 200, body: { mode: "hq", missions: visible.map((mission) => presentMission(mission, actorId, clock)) } };
  }
  if (method === "POST" && pathname === "/api/hq/missions") {
    if (!allows(scopes, "work")) return { status: 403, body: { error: "Cette identité ne peut pas ouvrir une mission." } };
    const mission = createMission(body, actorId, { now: clock });
    await store.missionInsert(mission);
    return { status: 201, body: { mode: "hq", mission: presentMission(mission, actorId, clock) } };
  }
  const missionStart = pathname.match(/^\/api\/hq\/missions\/([^/]+)\/tasks\/([^/]+)\/start$/);
  const missionAction = pathname.match(/^\/api\/hq\/missions\/([^/]+)\/(transition|deliverables|approval|actions)$/);
  const missionOne = pathname.match(/^\/api\/hq\/missions\/([^/]+)$/);
  if (missionStart || missionAction || missionOne) {
    let rawId;
    try {
      rawId = decodeURIComponent((missionStart || missionAction || missionOne)[1]);
    } catch {
      return { status: 404, body: { error: "Mission introuvable" } };
    }
    if (!isMissionId(rawId)) return { status: 404, body: { error: "Mission introuvable" } };
    if (missionOne && method === "GET") {
      const mission = await store.missionGet(rawId);
      if (!mission || !canReadMission(mission, actorId, scopes)) return { status: 404, body: { error: "Mission introuvable" } };
      return { status: 200, body: { mode: "hq", mission: presentMission(mission, actorId, clock) } };
    }
    if (method !== "POST" || missionOne) return { status: 404, body: { error: "Introuvable" } };
    const operation = missionStart ? "start" : { transition: "transition", deliverables: "deliver", approval: "decide", actions: "act" }[missionAction[2]];
    const needed = operation === "decide" || (operation === "transition" && body?.status === "done") ? "review" : "work";
    if (!allows(scopes, needed)) return { status: 403, body: { error: "Cette identité n'a pas ce droit." } };
    let taskId = "";
    if (missionStart) {
      try {
        taskId = decodeURIComponent(missionStart[2]);
      } catch {
        return { status: 404, body: { error: "Tâche introuvable" } };
      }
    }
    const result = await store.missionOperate(rawId, operation, missionStart ? { ...(body || {}), taskId } : (body || {}), actorId, { now: clock, scopes, human });
    return {
      status: result.httpStatus || 200,
      body: {
        mode: "hq",
        mission: presentMission(result.mission, actorId, clock),
        started: result.started,
        reason: result.reason,
        ...(result.claimToken ? { claimToken: result.claimToken, attemptId: result.attemptId } : {}),
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
    if (Array.isArray(scopes) && !scopes.includes("work")) {
      return { status: 403, body: { error: "Cette identité ne peut pas prendre une commande." } };
    }
    try {
      rejectImpersonation(body);
    } catch (error) {
      return { status: error.status || 400, body: { error: error.message } };
    }
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
    try {
      rejectImpersonation(body);
    } catch (error) {
      return { status: error.status || 400, body: { error: error.message } };
    }
    return store.complete(match.id, body, { actorId, now: clock, scopes, human });
  }
  return { status: 404, body: { error: "Introuvable" } };
}
