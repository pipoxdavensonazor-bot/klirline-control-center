import { createHash } from "node:crypto";
import { buildHqCommand, credentialMatches, decideClaim, decideCompletion } from "./commands.js";
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
  const now = options.now instanceof Date ? options.now : options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(400, "Horloge illisible.");
  return now;
}

function rejectElevation(input) {
  if (!input || typeof input !== "object") return;
  for (const key of ELEVATION) {
    if (Object.hasOwn(input, key)) fail(400, "Ce champ ne change pas les droits.");
  }
}

// Empreintes de contenu (KCO-AUDIT-2026-11-28 point 6) : SHA-256 sur un encodage JSON non ambigu.
// node:crypto (nodejs_compat, déjà utilisé pour hashClaimToken) donne un résultat synchrone,
// identique à crypto.subtle.digest("SHA-256") (vérifié par scripts/hq-regression-p1.mjs) : la
// WebCrypto n'offre que digest() asynchrone, et un await dans CompanyState.hqMissionOperate
// ouvrirait une fenêtre entre la lecture et l'écriture de la mission.
export const CONTENT_HASH_PREFIX = "sha256-";
const LEGACY_PREFIX = "fnv-";

export function contentHash(parts) {
  const text = JSON.stringify(parts.map((part) => String(part ?? "")));
  return `${CONTENT_HASH_PREFIX}${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

// Ancienne empreinte FNV-1a 32 bits, gardée pour la LECTURE seulement : reconnaître et marquer
// « legacy » les approbations déjà enregistrées. Elle ne valide jamais rien.
export function legacyContentHash(parts) {
  const text = parts.map((part) => String(part ?? "")).join("\n");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${LEGACY_PREFIX}${(hash >>> 0).toString(16)}-${text.length}`;
}

export function hashAlgorithm(value) {
  const text = String(value || "");
  if (/^sha256-[0-9a-f]{64}$/.test(text)) return "sha256";
  if (text.startsWith(LEGACY_PREFIX)) return "fnv-legacy";
  return "unknown";
}

function missionParts(mission) {
  const deliverables = (mission.deliverables || [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}\n${item.body}`);
  return [mission.objective, mission.successCriterion, ...deliverables];
}

export function missionContentHash(mission) {
  return contentHash(missionParts(mission));
}

export function legacyMissionContentHash(mission) {
  return legacyContentHash(missionParts(mission));
}

export function deliverableHash(body) {
  return contentHash(["livrable", body]);
}

// ---------- Schéma canonique d'approbation v2 (KCO-2026-LOT-2 §2) ----------
// L'approbation porte sur un « sujet » complet : organisation, mission, livrables (id, tâche,
// version, empreinte), et, pour une action externe, type, destinataire, contenu exact, pièces
// jointes et leurs empreintes, paramètres, montant et devise. Le sujet est sérialisé de façon
// canonique (clés triées, chaînes NFC, nombres entiers finis seulement) puis haché en SHA-256.
export const APPROVAL_SCHEMA = "klirline.hq.approval/v2";

export function canonicalJson(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail(400, "Nombre non canonique (entier fini attendu).");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  fail(400, "Valeur non canonique.");
}

function deliverableVersions(mission) {
  const counters = new Map();
  return (mission.deliverables || []).map((item) => {
    const version = Number.isSafeInteger(item.version) ? item.version : (counters.get(item.taskId) || 0) + 1;
    counters.set(item.taskId, Math.max(counters.get(item.taskId) || 0, version));
    return { id: item.id, taskId: item.taskId || null, version, state: item.state || null, contentHash: deliverableHash(item.body) };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function actionSubject(draft) {
  if (!draft) return null;
  return {
    draftId: draft.id,
    type: draft.type,
    recipient: draft.recipient ?? null,
    content: draft.body ?? "",
    contentHash: contentHash(["action", draft.body ?? ""]),
    attachments: (draft.attachments || []).map((item) => ({ name: item.name, sha256: item.sha256 })),
    parameters: draft.parameters || {},
    amount: draft.amount ? { cents: draft.amount.cents, currency: draft.amount.currency } : null,
  };
}

export function approvalSubject(mission, context = {}) {
  return {
    schema: APPROVAL_SCHEMA,
    orgId: String(context.orgId ?? mission.orgId ?? ""),
    missionId: mission.id,
    scope: context.draft ? "external-action" : "mission-close",
    mission: { objective: mission.objective, successCriterion: mission.successCriterion, clientId: mission.clientId || null, template: mission.template || null },
    deliverables: deliverableVersions(mission),
    action: actionSubject(context.draft),
  };
}

export function approvalHash(subject) {
  return `${CONTENT_HASH_PREFIX}${createHash("sha256").update(canonicalJson(subject), "utf8").digest("hex")}`;
}

export function approvalRequest(mission, context = {}) {
  const subject = approvalSubject(mission, context);
  return { schema: APPROVAL_SCHEMA, scope: subject.scope, actionId: context.draft?.id || null, hash: approvalHash(subject), canonical: canonicalJson(subject) };
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
    orgId: options.orgId ?? null,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}

// T11 (lot 2) : un coût est un entier de cents sûr, fini et >= 0. Toute autre valeur (texte,
// négatif, NaN, Infinity, fraction) est refusée (400) au lieu d'être ignorée ; au-delà du
// plafond : 409. Le coût reste déclaré par l'appelant (aucun relevé de facturation local).
export function costCents(value) {
  if (value == null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail(400, "Coût illisible : entier de cents positif ou nul attendu.");
  return value;
}

export function recordCost(mission, cents) {
  const amount = costCents(cents);
  if (mission.cost.spentCents + amount > mission.cost.capCents) fail(409, "Plafond de dépense atteint.");
  mission.cost.spentCents += amount;
}

function openTasks(mission) {
  return mission.tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
}

export function validApproval(mission, now = new Date(), context = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const scope = context.draft ? "external-action" : "mission-close";
  const actionId = context.draft?.id || null;
  let hash = null;
  // Seule une approbation du schéma v2 vaut. Une approbation FNV (legacy) ou SHA-256 v1 (P1) ne
  // valide jamais une clôture ni une action externe ; une approbation de clôture ne vaut pas pour
  // une action, ni l'inverse ; l'empreinte est recalculée sur le contenu actuel et le contexte.
  return (mission.approvals || []).find((approval) => {
    if (approval.decision !== "approve" || approval.invalidatedAt) return false;
    if (approval.schema !== APPROVAL_SCHEMA || approval.scope !== scope || (approval.actionId || null) !== actionId) return false;
    if (!(Date.parse(approval.expiresAt) > nowMs)) return false;
    hash ||= approvalHash(approvalSubject(mission, context));
    return approval.contentHash === hash;
  }) || null;
}

// Lecture des approbations : algorithme affiché, anciennes empreintes marquées « legacy ».
export function presentApprovals(mission) {
  let legacyHash = null;
  return (mission.approvals || []).map((approval) => {
    const algorithm = hashAlgorithm(approval.contentHash);
    if (approval.schema === APPROVAL_SCHEMA) return { ...approval, hashAlgorithm: algorithm, legacy: false };
    if (algorithm !== "fnv-legacy") return { ...approval, hashAlgorithm: algorithm, schema: "v1", legacy: true, validatesActions: false };
    legacyHash ||= legacyMissionContentHash(mission);
    return {
      ...approval,
      hashAlgorithm: algorithm,
      legacy: true,
      legacyMatchesContent: approval.contentHash === legacyHash,
      validatesActions: false,
    };
  });
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
    // T3 (banc phase 5) : la clôture d'une mission A3 est une décision humaine (spec v2 §5).
    if (options.human !== true) fail(403, "Une machine ne clôt pas une mission : décision humaine requise.");
    if (openTasks(next).length) fail(409, "Des tâches restent ouvertes.");
    const result = String(input?.result || "").trim();
    if (result.length < 8) fail(400, "Indiquez le résultat du dossier.");
    if (claimsBookedDemos(result)) fail(400, "Ne comptez pas des démonstrations qui ne sont pas réservées.");
    if (!validApproval(next, now, { orgId: options.orgId })) fail(409, "La mission ne se clôt pas sans validation.");
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
  const declared = costCents(options.costCents);
  if (declared > 0) recordCost(mission, declared);
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
    // T12 (banc phase 5) : réviser un livrable livré (qui invalide l'approbation et renvoie la mission
    // en rework) est réservé au titulaire de la tentative terminée ou à un humain.
    const completed = { tokenHash: command.completedTokenHash, attemptId: command.completedAttemptId };
    if (options.human !== true && !credentialMatches(completed, input?.attemptId, input?.claimToken)) {
      fail(409, "Seul le titulaire de la tentative terminée ou un humain révise ce livrable.");
    }
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
      version: next.deliverables.filter((item) => item.taskId === target.id).length + 1,
      contentHash: deliverableHash(body),
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
  // T12 : un livrable est la preuve d'une tentative ; il exige toujours attemptId + claimToken,
  // y compris pour un humain (qui peut démarrer la tâche lui-même).
  const proved = decideCompletion(command, {
    status: "done",
    proof: body,
    result: input?.result || null,
    attemptId: input?.attemptId,
    claimToken: input?.claimToken,
  }, { ...options, human: false });
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
    version: next.deliverables.filter((item) => item.taskId === target.id).length + 1,
    contentHash: deliverableHash(body),
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
  const actionId = input?.actionId ? String(input.actionId) : null;
  const draft = actionId ? (mission.drafts || []).find((item) => item.id === actionId) : null;
  if (actionId && !draft) fail(404, "Action introuvable.");
  if (!actionId && mission.status !== "in_review") fail(409, "Le dossier n'est pas en validation.");
  if (actionId && TERMINAL.has(mission.status)) fail(409, "La mission est close.");
  const actor = String(options.actorId || "");
  // T3 (banc phase 5) : A3 réservé aux humains. Une identité machine (human !== true) ne valide
  // jamais, même si elle porte l'actorId du validateur.
  if (options.human !== true) fail(403, "Une machine ne valide pas une mission : décision humaine requise.");
  if (!actor || actor === mission.createdBy) fail(403, "L'auteur ne valide pas sa propre mission.");
  if (actor !== mission.validatorId && !(actor === "ceo" && mission.createdBy !== "ceo")) {
    fail(403, "Ce rôle ne valide pas cette mission.");
  }
  const decision = String(input?.decision || "");
  if (decision !== "approve" && decision !== "reject") fail(400, "Décision inconnue.");
  const now = clock(options);
  const iso = now.toISOString();
  const next = clone(mission);
  const nextDraft = actionId ? next.drafts.find((item) => item.id === actionId) : null;
  const request = approvalRequest(next, { orgId: options.orgId, draft: nextDraft });
  // L'approbateur valide l'empreinte du contenu qui lui a été présenté (approvalRequest.hash de la
  // lecture). Si le contenu a changé entre la lecture et la décision, l'approbation est refusée.
  if (decision === "approve") {
    const presented = String(input?.presentedHash || "");
    if (!presented) fail(400, "Indiquez l'empreinte du contenu présenté (presentedHash).");
    if (presented !== request.hash) fail(409, "Le contenu a changé depuis sa présentation : relisez-le avant d'approuver.");
  }
  for (const approval of next.approvals) {
    if (!approval.invalidatedAt && approval.decision === "approve" && (approval.actionId || null) === actionId) approval.invalidatedAt = iso;
  }
  next.approvals.push({
    id: `apr-${crypto.randomUUID()}`,
    decision,
    schema: APPROVAL_SCHEMA,
    scope: request.scope,
    actionId,
    orgId: String(options.orgId ?? mission.orgId ?? ""),
    contentHash: request.hash,
    approverId: actor,
    note: String(input?.note || "").trim().slice(0, 500),
    at: iso,
    expiresAt: new Date(now.getTime() + APPROVAL_MS).toISOString(),
    invalidatedAt: null,
  });
  if (decision === "reject" && !actionId) {
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
  const label = actionId ? (decision === "approve" ? "Action approuvée." : "Action refusée.") : decision === "approve" ? "Dossier approuvé." : "Dossier renvoyé.";
  pushEvent(next, decision, actor, label, iso);
  return next;
}

const ACTION_FIELDS = ["type", "recipient", "body", "attachments", "parameters", "amountCents", "currency"];

function normalizeAction(input) {
  const type = String(input?.type || "");
  if (!EXTERNAL.has(type)) fail(400, "Action externe inconnue.");
  const recipient = input?.recipient == null ? null : String(input.recipient).trim().slice(0, 320) || null;
  const body = String(input?.body || "").trim().slice(0, 2000);
  const rawAttachments = input?.attachments == null ? [] : input.attachments;
  if (!Array.isArray(rawAttachments) || rawAttachments.length > 10) fail(400, "Pièces jointes illisibles.");
  const attachments = rawAttachments.map((item) => {
    const name = String(item?.name || "").trim().slice(0, 200);
    if (!name) fail(400, "Pièce jointe sans nom.");
    const sha256 = item?.content != null
      ? createHash("sha256").update(String(item.content), "utf8").digest("hex")
      : String(item?.sha256 || "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256)) fail(400, "Empreinte SHA-256 de pièce jointe manquante.");
    return { name, sha256 };
  });
  const parameters = input?.parameters == null ? {} : input.parameters;
  if (typeof parameters !== "object" || Array.isArray(parameters) || Object.keys(parameters).length > 20) fail(400, "Paramètres illisibles.");
  for (const value of Object.values(parameters)) {
    if (!["string", "boolean"].includes(typeof value) && !Number.isSafeInteger(value)) fail(400, "Paramètre non canonique.");
  }
  let amount = null;
  if (input?.amountCents != null || input?.currency != null) {
    const cents = input?.amountCents;
    if (!Number.isSafeInteger(cents) || cents < 0) fail(400, "Montant illisible (entier de cents positif attendu).");
    const currency = String(input?.currency || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) fail(400, "Devise illisible (code ISO 4217 attendu).");
    amount = { cents, currency };
  }
  return { type, recipient, body, attachments, parameters, amount };
}

function sameAction(draft, action) {
  return canonicalJson({ ...actionSubject({ ...draft, id: "x" }) }) === canonicalJson({ ...actionSubject({ ...action, id: "x" }) });
}

export function prepareExternalAction(mission, input, options = {}) {
  if (!mission) fail(404, "Mission introuvable");
  rejectElevation(input);
  const now = clock(options);
  const iso = now.toISOString();
  const next = clone(mission);
  next.drafts ||= [];
  let draft;
  if (input?.draftId) {
    draft = next.drafts.find((item) => item.id === String(input.draftId));
    if (!draft) fail(404, "Action introuvable.");
    // Conflit de paramètres : une demande d'exécution ne peut pas modifier l'action approuvée.
    if (ACTION_FIELDS.some((key) => Object.hasOwn(input, key)) && !sameAction(draft, normalizeAction({ ...draftInput(draft), ...input }))) {
      fail(409, "Paramètres en conflit avec l'action présentée à l'approbation.");
    }
  } else {
    const action = normalizeAction(input);
    const key = input?.idempotencyKey == null ? null : String(input.idempotencyKey).trim();
    if (key != null && !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) fail(400, "Idempotency-Key illisible.");
    // Opération automatisée sensible : une machine doit fournir une clé d'idempotence.
    if (options.human !== true && !key) fail(400, "Une action externe automatisée exige une Idempotency-Key.");
    const existing = key ? next.drafts.find((item) => item.idempotencyKey === key) : null;
    if (existing) {
      if (!sameAction(existing, action)) fail(409, "Idempotency-Key déjà utilisée pour une autre action.");
      draft = existing;
    } else {
      draft = { id: `drf-${crypto.randomUUID()}`, ...action, sent: false, at: iso, createdBy: options.actorId || "", ...(key ? { idempotencyKey: key } : {}) };
      next.drafts.push(draft);
    }
  }
  const link = connectionById(draft.type === "email" || draft.type === "sms" ? "email" : draft.type === "call" ? "calendar" : "email");
  const approved = Boolean(validApproval(next, now, { orgId: options.orgId, draft }));
  const error = !approved
    ? "Approbation manquante."
    : link?.send === false || link?.status === "disabled" || link?.status === "absent"
      ? "Envoi désactivé. Le brouillon reste dans le dossier."
      : "Envoi désactivé. Le brouillon reste dans le dossier.";
  next.updatedAt = iso;
  pushEvent(next, "external_blocked", options.actorId, `${draft.type} : ${error}`, iso);
  return { mission: next, httpStatus: 403, error, draftId: draft.id, approvalValid: approved };
}

function draftInput(draft) {
  return {
    type: draft.type,
    recipient: draft.recipient,
    body: draft.body,
    attachments: draft.attachments,
    parameters: draft.parameters,
    ...(draft.amount ? { amountCents: draft.amount.cents, currency: draft.amount.currency } : {}),
  };
}

export function runMissionOperation(mission, commands, operation, input, options = {}) {
  if (operation === "transition") return { mission: transitionMission(mission, input, options), changed: true, httpStatus: 200 };
  if (operation === "start") return { ...startMissionTask(mission, commands, input?.taskId, { ...options, costCents: input?.costCents, input }), httpStatus: 200 };
  if (operation === "deliver") return { httpStatus: 200, changed: true, replaceCommand: true, ...addDeliverable(mission, commands, input, options) };
  if (operation === "decide") return { mission: decideMission(mission, input, options), changed: true, httpStatus: 200 };
  if (operation === "act") return { ...prepareExternalAction(mission, input, options), changed: true };
  fail(400, "Opération inconnue.");
}

export function canReadMission(mission, actorId, scopes) {
  if (!mission) return false;
  if (Array.isArray(scopes) && scopes.includes("review")) return true;
  return mission.createdBy === actorId || mission.validatorId === actorId;
}

export function presentMission(mission, actorId, now = new Date(), orgId) {
  if (!mission) return null;
  const context = { orgId };
  const approval = validApproval(mission, now, context);
  const client = mission.clientId ? visibleClient(actorId, mission.clientId) : null;
  return {
    ...mission,
    clientId: client ? mission.clientId : null,
    tasks: mission.tasks.map(({ claimToken, ...task }) => task),
    approvals: presentApprovals(mission),
    deliverables: (mission.deliverables || []).map((item) => ({
      ...item,
      hashAlgorithm: item.contentHash ? hashAlgorithm(item.contentHash) : "absent-legacy",
      contentHashMatches: item.contentHash ? item.contentHash === deliverableHash(item.body) : null,
    })),
    drafts: (mission.drafts || []).map((draft) => ({
      ...draft,
      approvalRequest: approvalRequest(mission, { ...context, draft }),
      approvalValid: Boolean(validApproval(mission, now, { ...context, draft })),
    })),
    approvalRequest: approvalRequest(mission, context),
    // T10 (lot 2) : contenus non fiables (données, jamais des instructions ni des autorisations).
    untrusted: ["objective", "successCriterion", "result", "deliverables[].body", "drafts[].body", "drafts[].recipient", "approvals[].note", "events[].detail"],
    approvalValid: Boolean(approval),
    approvalExpiresAt: approval?.expiresAt || null,
    outcomes: { demosPrepared: mission.deliverables?.length || 0, demosBooked: 0 },
    client,
  };
}
