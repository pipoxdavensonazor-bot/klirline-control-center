import { buildHqCommand, decideClaim, decideCompletion } from "./commands.js";
import { visibleClient } from "./clients.js";
import { connectionById } from "./connections.js";
import { fold, rosterAgent } from "./roster.js";

export const MISSION_STATUSES = ["qualify", "ready", "running", "blocked", "in_review", "rework", "done", "failed", "cancelled"];
const TERMINAL = new Set(["done", "failed", "cancelled"]);
const TRANSITIONS = {
  qualify: ["ready", "cancelled"],
  ready: ["running", "cancelled"],
  running: ["blocked", "in_review", "failed", "cancelled"],
  blocked: ["running", "failed", "cancelled"],
  in_review: ["done", "rework", "cancelled"],
  rework: ["running", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};
const EXTERNAL = new Set(["email", "sms", "social", "call", "payment", "trade"]);
const ELEVATION = ["role", "makeAdmin", "orgId", "permissions", "readers"];
const APPROVAL_MS = 7 * 24 * 60 * 60 * 1000;
const EVENT_LIMIT = 80;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function clock(options = {}) {
  return options.now instanceof Date ? options.now : new Date();
}

function rejectElevation(input) {
  if (!input || typeof input !== "object") return;
  for (const key of ELEVATION) {
    if (Object.hasOwn(input, key)) fail(400, "Ce champ ne change pas les droits.");
  }
}

export function contentHash(parts) {
  const text = parts.map((part) => String(part ?? "")).join("\n");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv-${(hash >>> 0).toString(16)}-${text.length}`;
}

export function missionContentHash(mission) {
  const deliverables = (mission.deliverables || [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}\n${item.body}`);
  return contentHash([mission.objective, mission.successCriterion, ...deliverables]);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pushEvent(mission, type, actorId, detail, at) {
  mission.events.push({ at, actorId: actorId || "", type, detail });
  if (mission.events.length > EVENT_LIMIT) mission.events.splice(0, mission.events.length - EVENT_LIMIT);
}

export function isMissionId(id) {
  return /^msn-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(id || ""));
}

function taskShell(key, title, ownerSlug, dependsOn) {
  const owner = rosterAgent(ownerSlug);
  if (!owner) fail(500, "Agent de tâche inconnu.");
  return {
    id: `tsk-${crypto.randomUUID()}`,
    key,
    title,
    ownerSlug,
    ownerName: owner.name,
    status: "todo",
    dependsOn,
    attempts: 0,
    maxAttempts: 3,
    commandId: null,
    claimToken: null,
    blockedReason: null,
  };
}

function campaignTasks() {
  const cadre = taskShell("cadre", "Cadrer la campagne KlirProspect", "office-klirline", []);
  const liste = taskShell("liste", "Préparer une liste fictive de prospects", "klirprospect", [cadre.id]);
  const messages = taskShell("messages", "Rédiger les messages et le support", "klirline-social", [liste.id]);
  const controle = taskShell("controle", "Contrôler les affirmations et les liens", "ops-klirline", [messages.id]);
  return [cadre, liste, messages, controle];
}

export function createMission(input, actorId, options = {}) {
  rejectElevation(input);
  const now = clock(options).toISOString();
  const template = String(input?.template || "");
  const actor = String(actorId || "");
  if (!actor) fail(400, "Rôle manquant.");
  if (template && template !== "klirprospect-demos" && template !== "klirprospect-synthese") fail(400, "Modèle de mission inconnu.");
  const campaign = template === "klirprospect-demos";
  const synthese = template === "klirprospect-synthese";
  const objective = synthese
    ? "Analyser trois fiches fictives et préparer une synthèse pour une démonstration de KlirProspect."
    : campaign
      ? "Préparer une campagne pour obtenir cinq démonstrations de KlirProspect."
      : String(input?.objective || input?.title || "").trim();
  if (objective.length < 8) fail(400, "Écrivez l'objectif.");
  if (objective.length > 500) fail(400, "L'objectif est trop long.");
  const ownerSlug = campaign || synthese ? "klirprospect" : String(input?.ownerSlug || "office-klirline");
  if (!rosterAgent(ownerSlug)) fail(400, "Agent inconnu.");
  const clientId = campaign ? "cli-atelier-nord" : input?.clientId || null;
  if (clientId && !visibleClient(actor, clientId)) fail(403, "Dossier client inaccessible.");
  return {
    id: `msn-${crypto.randomUUID()}`,
    template: campaign || synthese ? template : null,
    title: synthese ? "Synthèse KlirProspect — trois fiches fictives" : campaign ? "Campagne KlirProspect — cinq démonstrations" : objective.slice(0, 120),
    objective,
    request: synthese
      ? "Analyser trois fiches fictives et préparer une synthèse pour une démonstration de KlirProspect."
      : campaign
        ? "Préparer une campagne pour obtenir cinq démonstrations de KlirProspect."
        : objective,
    ownerSlug,
    clientId,
    product: campaign || synthese ? "klirprospect" : String(input?.product || ""),
    priority: "haute",
    dueAt: null,
    successCriterion: synthese
      ? "Synthèse interne : besoins, manques, questions et ordre du jour. Aucune démonstration réservée, aucun contact."
      : campaign
        ? "Dossier traçable : liste fictive, messages, contrôle des liens, validation. Aucune démonstration réelle n'est comptée."
        : String(input?.successCriterion || "").trim(),
    status: "qualify",
    tasks: synthese ? [taskShell("synthese", "Analyser trois fiches fictives et préparer la synthèse", "klirprospect", [])] : campaign ? campaignTasks() : [],
    deliverables: [],
    drafts: [],
    approvals: [],
    events: [{ at: now, actorId: actor, type: "create", detail: synthese ? "Synthèse de fiches fictives ouverte." : campaign ? "Campagne de démonstration ouverte." : "Mission ouverte." }],
    outcomes: { demosPrepared: 0, demosBooked: 0 },
    cost: { spentCents: 0, capCents: 0 },
    validatorId: "coo",
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}

export function recordCost(mission, cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount) || amount < 0) fail(400, "Dépense illisible.");
  if (mission.cost.spentCents + amount > mission.cost.capCents) fail(409, "Plafond de dépense atteint.");
  mission.cost.spentCents += amount;
}

function openTasks(mission) {
  return mission.tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
}

export function validApproval(mission, now = new Date()) {
  const hash = missionContentHash(mission);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  return (mission.approvals || []).find((approval) => (
    approval.decision === "approve"
    && !approval.invalidatedAt
    && approval.contentHash === hash
    && Date.parse(approval.expiresAt) > nowMs
  )) || null;
}

export function transitionMission(mission, input, options = {}) {
  if (!mission) fail(404, "Mission introuvable");
  rejectElevation(input);
  const status = String(input?.status || "").trim();
  if (!MISSION_STATUSES.includes(status)) fail(400, "Statut de mission inconnu.");
  if (!TRANSITIONS[mission.status].includes(status)) fail(409, "Transition refusée.");
  const actor = String(options.actorId || "");
  const now = clock(options);
  const iso = now.toISOString();
  const next = clone(mission);
  if (status === "cancelled" && !["ceo", "coo", mission.createdBy, mission.validatorId].includes(actor)) {
    fail(403, "Ce rôle ne peut pas annuler la mission.");
  }
  if (status === "ready") {
    if (!next.successCriterion) fail(400, "Le critère de succès manque.");
    if (!next.tasks.length) fail(400, "La mission n'a pas de tâche.");
  }
  if (status === "in_review" && openTasks(next).length) fail(409, "Des tâches restent ouvertes.");
  if (status === "done") {
    if (openTasks(next).length) fail(409, "Des tâches restent ouvertes.");
    const result = String(input?.result || "").trim();
    if (result.length < 8) fail(400, "Indiquez le résultat du dossier.");
    if (claimsBookedDemos(result)) fail(400, "Ne comptez pas des démonstrations qui ne sont pas réservées.");
    if (!validApproval(next, now)) fail(409, "La mission ne se clôt pas sans validation.");
    next.result = result;
    next.outcomes = { demosPrepared: next.deliverables.length, demosBooked: 0 };
  }
  next.status = status;
  next.updatedAt = iso;
  pushEvent(next, "transition", actor, `${mission.status} → ${status}`, iso);
  return next;
}

export function claimsBookedDemos(text) {
  const folded = fold(text);
  if (!folded.includes("demonstration")) return false;
  if ((/aucune|pas de|\b0\b|zero/.test(folded)) && /reserv|obtenu|confirme/.test(folded)) return false;
  return /reserv|obtenu|confirme|booked/.test(folded);
}

export function startMissionTask(mission, commands, taskId, options = {}) {
  if (!mission) fail(404, "Mission introuvable");
  rejectElevation(options.input);
  if (TERMINAL.has(mission.status)) fail(409, "La mission est close.");
  const source = mission.tasks.find((task) => task.id === taskId);
  if (!source) fail(404, "Tâche introuvable");
  if (!["ready", "running", "rework", "blocked"].includes(mission.status)) fail(409, "La mission n'est pas prête à démarrer.");
  if (Number(options.costCents) > 0) recordCost(mission, options.costCents);
  const unmet = (source.dependsOn || []).filter((id) => mission.tasks.find((task) => task.id === id)?.status !== "done");
  if (unmet.length) fail(409, "Une tâche précédente n'est pas terminée.");
  const now = clock(options);
  const existing = source.commandId ? commands.find((command) => command.id === source.commandId) : null;
  if (source.status === "done" || existing?.status === "done") {
    return { mission, command: existing || null, started: false, reason: "already_done", changed: false };
  }
  const leaseUntil = Date.parse(existing?.claim?.leaseUntil || "");
  if (existing && existing.status === "dispatched" && !Number.isNaN(leaseUntil) && leaseUntil > now.getTime()) {
    const held = decideClaim(existing, { actorId: options.actorId, now });
    return { mission, command: held.command || existing, started: false, reason: "held", changed: false };
  }
  if (source.attempts >= source.maxAttempts) {
    const blocked = clone(mission);
    const task = blocked.tasks.find((item) => item.id === taskId);
    task.status = "blocked";
    task.blockedReason = "Nombre de tentatives atteint.";
    blocked.status = "blocked";
    blocked.updatedAt = now.toISOString();
    pushEvent(blocked, "blocked", options.actorId, task.blockedReason, blocked.updatedAt);
    return { mission: blocked, command: existing || null, started: false, reason: "attempt_limit", changed: true };
  }
  let command = existing;
  let insertCommand = false;
  if (!command || ["done", "failed", "cancelled", "blocked"].includes(command.status)) {
    command = buildHqCommand({ text: source.title, ownerSlug: source.ownerSlug, priority: mission.priority === "haute" ? "haute" : "normale" }, options.actorId, { now });
    command.missionId = mission.id;
    command.taskId = source.id;
    insertCommand = true;
  }
  const decision = decideClaim(command, { actorId: options.actorId, now });
  if (decision.body.outcome !== "issued" && decision.body.outcome !== "reclaimed") {
    const error = new Error(decision.body.error || "La tâche ne peut pas être prise.");
    error.status = decision.http || 409;
    throw error;
  }
  const next = clone(mission);
  const task = next.tasks.find((item) => item.id === taskId);
  task.attempts += 1;
  task.commandId = decision.command.id;
  task.attemptId = decision.command.claim.attemptId;
  task.status = "running";
  task.blockedReason = null;
  if (["qualify", "ready", "rework", "blocked"].includes(next.status)) next.status = "running";
  next.updatedAt = now.toISOString();
  pushEvent(next, decision.body.outcome === "reclaimed" ? "reclaim" : "start", options.actorId, `${task.title} · tentative ${task.attemptId}`, next.updatedAt);
  return {
    mission: next,
    command: decision.command,
    insertCommand,
    replaceCommand: !insertCommand,
    started: true,
    reason: decision.body.outcome,
    changed: true,
    claimToken: decision.body.claimToken,
    attemptId: decision.command.claim.attemptId,
  };
}

export function addDeliverable(mission, commands, input, options = {}) {
  if (!mission) fail(404, "Mission introuvable");
  rejectElevation(input);
  if (TERMINAL.has(mission.status)) fail(409, "La mission est close.");
  const task = mission.tasks.find((item) => item.id === input?.taskId);
  if (!task) fail(404, "Tâche introuvable");
  if (!["running", "done"].includes(task.status) || !task.commandId) fail(409, "La tâche n'est pas prise en charge.");
  const body = String(input?.body || "").trim();
  if (body.length < 8) fail(400, "Le livrable est trop court.");
  if (body.length > 4000) fail(400, "Le livrable est trop long.");
  const command = commands.find((item) => item.id === task.commandId);
  if (!command) fail(409, "La commande de la tâche est introuvable.");
  if (command.status === "done") {
    const now = clock(options).toISOString();
    const next = clone(mission);
    const target = next.tasks.find((item) => item.id === task.id);
    target.status = "todo";
    target.commandId = null;
    next.status = "rework";
    next.deliverables.push({
      id: `liv-${crypto.randomUUID()}`,
      taskId: target.id,
      body,
      source: "demonstration",
      state: "revision",
      executionKind: input?.executionKind || "manual",
      createdAt: now,
      createdBy: options.actorId || "",
    });
    for (const approval of next.approvals) {
      if (!approval.invalidatedAt) approval.invalidatedAt = now;
    }
    next.updatedAt = now;
    pushEvent(next, "revision", options.actorId, "Livrable modifié. L'approbation précédente ne vaut plus.", now);
    return { mission: next, command, changed: true, replaceCommand: false };
  }
  const proved = decideCompletion(command, {
    status: "done",
    proof: body,
    result: input?.result || null,
    attemptId: input?.attemptId,
    claimToken: input?.claimToken,
  }, options);
  if (proved.http >= 400) fail(proved.http, proved.body.error || "Livrable refusé.");
  if (!proved.persist) return { mission, command, changed: false, replaceCommand: false };
  const now = clock(options).toISOString();
  const next = clone(mission);
  const target = next.tasks.find((item) => item.id === task.id);
  target.status = "done";
  if (next.status === "in_review") next.status = "rework";
  next.deliverables.push({
    id: `liv-${crypto.randomUUID()}`,
    taskId: target.id,
    body,
    source: "demonstration",
    state: "proposal",
    executionKind: input?.executionKind || "deterministic-script",
    createdAt: now,
    createdBy: options.actorId || "",
  });
  for (const approval of next.approvals) {
    if (!approval.invalidatedAt) approval.invalidatedAt = now;
  }
  next.outcomes = { demosPrepared: next.deliverables.length, demosBooked: 0 };
  next.updatedAt = now;
  pushEvent(next, "deliverable", options.actorId, target.title, now);
  return { mission: next, command: proved.command, replaceCommand: true };
}

export function decideMission(mission, input, options = {}) {
  if (!mission) fail(404, "Mission introuvable");
  rejectElevation(input);
  if (mission.status !== "in_review") fail(409, "Le dossier n'est pas en validation.");
  const actor = String(options.actorId || "");
  if (!actor || actor === mission.createdBy) fail(403, "L'auteur ne valide pas sa propre mission.");
  if (actor !== mission.validatorId && !(actor === "ceo" && mission.createdBy !== "ceo")) {
    fail(403, "Ce rôle ne valide pas cette mission.");
  }
  const decision = String(input?.decision || "");
  if (decision !== "approve" && decision !== "reject") fail(400, "Décision inconnue.");
  const now = clock(options);
  const iso = now.toISOString();
  const next = clone(mission);
  for (const approval of next.approvals) {
    if (!approval.invalidatedAt && approval.decision === "approve") approval.invalidatedAt = iso;
  }
  next.approvals.push({
    id: `apr-${crypto.randomUUID()}`,
    decision,
    contentHash: missionContentHash(next),
    approverId: actor,
    note: String(input?.note || "").trim().slice(0, 500),
    at: iso,
    expiresAt: new Date(now.getTime() + APPROVAL_MS).toISOString(),
    invalidatedAt: null,
  });
  if (decision === "reject") {
    next.status = "rework";
    for (const task of next.tasks) {
      if (task.status === "done") {
        task.status = "todo";
        task.commandId = null;
        task.claimToken = null;
      }
    }
  }
  next.updatedAt = iso;
  pushEvent(next, decision, actor, decision === "approve" ? "Dossier approuvé." : "Dossier renvoyé.", iso);
  return next;
}

export function prepareExternalAction(mission, input, options = {}) {
  if (!mission) fail(404, "Mission introuvable");
  rejectElevation(input);
  const type = String(input?.type || "");
  if (!EXTERNAL.has(type)) fail(400, "Action externe inconnue.");
  const link = connectionById(type === "email" || type === "sms" ? "email" : type === "call" ? "calendar" : "email");
  const now = clock(options);
  const iso = now.toISOString();
  const next = clone(mission);
  const body = String(input?.body || "").trim().slice(0, 2000);
  next.drafts.push({ id: `drf-${crypto.randomUUID()}`, type, body, sent: false, at: iso });
  const approved = Boolean(validApproval(next, now));
  const error = !approved
    ? "Approbation manquante."
    : link?.send === false || link?.status === "disabled" || link?.status === "absent"
      ? "Envoi désactivé. Le brouillon reste dans le dossier."
      : "Envoi désactivé. Le brouillon reste dans le dossier.";
  next.updatedAt = iso;
  pushEvent(next, "external_blocked", options.actorId, `${type} : ${error}`, iso);
  return { mission: next, httpStatus: 403, error };
}

export function runMissionOperation(mission, commands, operation, input, options = {}) {
  if (operation === "transition") return { mission: transitionMission(mission, input, options), changed: true, httpStatus: 200 };
  if (operation === "start") return { ...startMissionTask(mission, commands, input?.taskId, { ...options, costCents: input?.costCents, input }), httpStatus: 200 };
  if (operation === "deliver") return { ...addDeliverable(mission, commands, input, options), changed: true, replaceCommand: true, httpStatus: 200 };
  if (operation === "decide") return { mission: decideMission(mission, input, options), changed: true, httpStatus: 200 };
  if (operation === "act") return { ...prepareExternalAction(mission, input, options), changed: true };
  fail(400, "Opération inconnue.");
}

export function canReadMission(mission, actorId, scopes) {
  if (!mission) return false;
  if (Array.isArray(scopes) && scopes.includes("review")) return true;
  return mission.createdBy === actorId || mission.validatorId === actorId;
}

export function presentMission(mission, actorId, now = new Date()) {
  if (!mission) return null;
  const approval = validApproval(mission, now);
  const client = mission.clientId ? visibleClient(actorId, mission.clientId) : null;
  return {
    ...mission,
    clientId: client ? mission.clientId : null,
    tasks: mission.tasks.map(({ claimToken, ...task }) => task),
    approvalValid: Boolean(approval),
    approvalExpiresAt: approval?.expiresAt || null,
    outcomes: { demosPrepared: mission.deliverables?.length || 0, demosBooked: 0 },
    client,
  };
}
