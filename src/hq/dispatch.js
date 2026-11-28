import { buildHqCommand, commandFilter, isHqId, normalizeIdempotencyKey, publicCommand, rejectImpersonation, sameIdempotentCommand } from "./commands.js";
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

// T4 (banc phase 5) : toute écriture sur une commande exige une portée explicite. Des portées
// absentes (undefined, ancien repli service:hq-poll) ou vides ne donnent aucun droit.
function writes(scopes) {
  return allows(scopes, "work") || allows(scopes, "review");
}

const NO_SCOPE = { status: 403, body: { error: "Cette identité n'a pas ce droit." } };

export async function dispatchHq(store, { method, pathname, searchParams, body, actorId, now, scopes, human, orgId }) {
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
    return { status: 200, body: { mode: "hq", missions: visible.map((mission) => presentMission(mission, actorId, clock, orgId)) } };
  }
  if (method === "POST" && pathname === "/api/hq/missions") {
    if (!allows(scopes, "work")) return { status: 403, body: { error: "Cette identité ne peut pas ouvrir une mission." } };
    const mission = createMission(body, actorId, { now: clock, orgId });
    await store.missionInsert(mission);
    return { status: 201, body: { mode: "hq", mission: presentMission(mission, actorId, clock, orgId) } };
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
      return { status: 200, body: { mode: "hq", mission: presentMission(mission, actorId, clock, orgId) } };
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
    const result = await store.missionOperate(rawId, operation, missionStart ? { ...(body || {}), taskId } : (body || {}), actorId, { now: clock, scopes, human, orgId });
    return {
      status: result.httpStatus || 200,
      body: {
        mode: "hq",
        mission: presentMission(result.mission, actorId, clock, orgId),
        started: result.started,
        reason: result.reason,
        ...(result.claimToken ? { claimToken: result.claimToken, attemptId: result.attemptId } : {}),
        ...(result.draftId ? { draftId: result.draftId } : {}),
        ...(result.error ? { error: result.error } : {}),
      },
    };
  }
  // T13 (lot 2) : toute lecture de commandes balaie d'abord les baux expirés (horloge de la requête).
  if (method === "GET" && pathname.startsWith("/api/hq/") && (pathname === "/api/hq/roster" || pathname.startsWith("/api/hq/commands")) && store.sweep) {
    await store.sweep(clock);
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
    if (!writes(scopes)) return NO_SCOPE;
    const idempotencyKey = normalizeIdempotencyKey(body?.idempotencyKey);
    const command = buildHqCommand(body, actorId, { now: clock });
    if (!idempotencyKey) {
      await store.insert(command);
      return { status: 201, body: { mode: "hq", command: present(command) } };
    }
    // T5 : vérification et insertion atomiques dans le dépôt (Durable Object : un seul appel synchrone).
    command.idempotencyKey = idempotencyKey;
    const stored = await store.insertIdempotent(command);
    if (stored.created) return { status: 201, body: { mode: "hq", outcome: "created", command: present(stored.command) } };
    if (!sameIdempotentCommand(stored.command, command)) {
      return { status: 409, body: { mode: "hq", outcome: "conflict", error: "Cette clé d'idempotence a déjà servi pour une autre commande." } };
    }
    return { status: 200, body: { mode: "hq", outcome: "duplicate", command: present(stored.command) } };
  }

  const claimRoute = commandId(pathname, "/claim");
  if (claimRoute) {
    if (claimRoute.error) return claimRoute.error;
    if (method !== "POST") return { status: 404, body: { error: "Introuvable" } };
    if (!allows(scopes, "work")) {
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

  // T6/T7 (lot 2) : POST /api/hq/commands/:id/heartbeat { attemptId, claimToken }.
  const heartbeatRoute = commandId(pathname, "/heartbeat");
  if (heartbeatRoute) {
    if (heartbeatRoute.error) return heartbeatRoute.error;
    if (method !== "POST") return { status: 404, body: { error: "Introuvable" } };
    if (!allows(scopes, "work")) return NO_SCOPE;
    return store.heartbeat(heartbeatRoute.id, body || {}, { actorId, now: clock });
  }

  const interruptRoute = commandId(pathname, "/interrupt");
  if (interruptRoute) {
    if (interruptRoute.error) return interruptRoute.error;
    if (method !== "POST") return { status: 404, body: { error: "Introuvable" } };
    if (!writes(scopes)) return NO_SCOPE;
    return store.interrupt(interruptRoute.id, {
      actorId,
      now: clock,
      scopes,
      human,
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
    if (!writes(scopes)) return NO_SCOPE;
    try {
      rejectImpersonation(body);
    } catch (error) {
      return { status: error.status || 400, body: { error: error.message } };
    }
    return store.complete(match.id, body, { actorId, now: clock, scopes, human });
  }
  return { status: 404, body: { error: "Introuvable" } };
}
