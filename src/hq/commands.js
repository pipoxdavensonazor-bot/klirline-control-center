import { DIVISIONS, fold, rosterAgent, routeCommand } from "./roster.js";

export const HQ_STATUSES = ["pending", "queued", "dispatched", "running", "awaiting_validation", "blocked", "done", "failed", "cancelled"];
export const HQ_LIST_LIMIT = 200;
// Une exécution running reste seule active pendant ce bail. Au-delà, un claim peut la reprendre.
export const HQ_RUNNING_LEASE_MS = 15 * 60 * 1000;

const PRIORITIES = {
  basse: "basse",
  low: "basse",
  normale: "normale",
  normal: "normale",
  haute: "haute",
  high: "haute",
};

const TERMINAL = new Set(["done", "failed", "cancelled"]);
const CLAIMABLE = new Set(["pending", "queued", "dispatched"]);
const HELD = new Set(["blocked", "awaiting_validation"]);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function newHqId() {
  return `hq-${crypto.randomUUID()}`;
}

export function isHqId(id) {
  return /^hq-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(id || ""));
}

export function normalizePriority(value) {
  if (value == null || String(value).trim() === "") return "normale";
  const priority = PRIORITIES[fold(value).trim()];
  if (!priority) fail(400, "Priorité inconnue.");
  return priority;
}

function cleanNote(value, tooLong) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > 4000) fail(400, tooLong);
  return text;
}

function cleanActor(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > 120) fail(400, "L'identifiant de claim est trop long.");
  if (!/^[\p{L}\p{N} .@_'+:-]+$/u.test(text)) fail(400, "L'identifiant de claim est invalide.");
  return text;
}

function normalizeClaimToken(value) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(text)) fail(400, "Jeton de claim invalide.");
  return text;
}

function clock(options = {}) {
  return options.now instanceof Date ? options.now : new Date();
}

function leaseLength(options = {}) {
  const value = Number(options.leaseMs);
  return Number.isFinite(value) && value > 0 ? value : HQ_RUNNING_LEASE_MS;
}

export function hasHqProof(command) {
  return [command?.result, command?.proof, command?.agentNote].some((value) => typeof value === "string" && value.trim().length > 0);
}

export function isLeaseExpired(command, now = new Date(), leaseMs = HQ_RUNNING_LEASE_MS) {
  if (!command || command.status !== "running") return false;
  const start = Date.parse(command.claimedAt || "");
  if (!Number.isFinite(start)) return true;
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  return nowMs >= start + leaseMs;
}

export function presentHqCommand(command, options = {}) {
  if (!command) return command;
  const now = clock(options);
  return {
    ...command,
    proof: command.proof ?? null,
    claimedBy: command.claimedBy ?? null,
    claimToken: command.claimToken ?? null,
    claimedAt: command.claimedAt ?? null,
    leaseUntil: command.leaseUntil ?? null,
    activityNote: command.activityNote ?? null,
    leaseExpired: isLeaseExpired(command, now, leaseLength(options)),
  };
}

function blankClaim(command) {
  return {
    proof: command.proof ?? null,
    claimedBy: command.claimedBy ?? null,
    claimToken: command.claimToken ?? null,
    claimedAt: command.claimedAt ?? null,
    leaseUntil: command.leaseUntil ?? null,
    activityNote: command.activityNote ?? null,
  };
}

export function buildHqCommand(input, actorId, options = {}) {
  const text = String(input?.text ?? "").trim();
  if (text.length < 3) fail(400, "Écrivez la commande.");
  if (text.length > 2000) fail(400, "La commande est trop longue.");
  const priority = normalizePriority(input?.priority);
  const requested = String(input?.ownerSlug ?? "").trim();
  let agent;
  let routedBy;
  if (requested) {
    agent = rosterAgent(requested);
    if (!agent) fail(400, "Agent inconnu.");
    routedBy = "explicit";
  } else {
    const routed = routeCommand(text);
    agent = routed.agent;
    routedBy = routed.routedBy;
  }
  const now = clock(options).toISOString();
  return {
    id: options.id || newHqId(),
    text,
    ownerSlug: agent.id,
    ownerName: agent.name,
    division: agent.division,
    grokAgentName: agent.grokAgentName,
    productUrl: agent.productUrl,
    priority,
    status: "pending",
    result: null,
    agentNote: null,
    proof: null,
    claimedBy: null,
    claimToken: null,
    claimedAt: null,
    leaseUntil: null,
    activityNote: null,
    routedBy,
    createdBy: String(actorId || ""),
    createdAt: now,
    updatedAt: now,
  };
}

function keepClaim(next, command) {
  next.claimedBy = command.claimedBy ?? null;
  next.claimToken = command.claimToken ?? null;
  next.claimedAt = command.claimedAt ?? null;
  next.leaseUntil = command.leaseUntil ?? null;
}

function applyRunningLease(command, next, input, options, iso) {
  const token = normalizeClaimToken(input?.claimToken);
  if (command.status === "running" && token && token === command.claimToken) {
    next.claimedAt = iso;
    next.leaseUntil = new Date(Date.parse(iso) + leaseLength(options)).toISOString();
    return;
  }
  if (command.status === "running") {
    keepClaim(next, command);
    return;
  }
  const claimedBy = cleanActor(input?.claimedBy) || cleanActor(options.actorId) || "bureau";
  next.claimedBy = claimedBy;
  next.claimToken = token || crypto.randomUUID();
  next.claimedAt = iso;
  next.leaseUntil = new Date(Date.parse(iso) + leaseLength(options)).toISOString();
  if (!next.activityNote) next.activityNote = `Prise en charge par ${claimedBy}.`;
}

export function applyHqPatch(command, input, options = {}) {
  if (!command) fail(404, "Commande introuvable");
  const status = String(input?.status ?? "").trim();
  if (!HQ_STATUSES.includes(status)) fail(400, "Statut inconnu.");
  if (TERMINAL.has(command.status) && status !== command.status) fail(409, "La commande est close.");
  const iso = clock(options).toISOString();
  const next = {
    ...command,
    ...blankClaim(command),
    status,
    updatedAt: iso,
  };
  if (Object.hasOwn(input || {}, "result")) next.result = cleanNote(input.result, "Le résultat est trop long.");
  if (Object.hasOwn(input || {}, "agentNote")) next.agentNote = cleanNote(input.agentNote, "La note est trop longue.");
  if (Object.hasOwn(input || {}, "proof")) next.proof = cleanNote(input.proof, "La preuve est trop longue.");
  if (status === "running") applyRunningLease(command, next, input, options, iso);
  if (status === "done" && !hasHqProof(next)) {
    fail(400, "Une preuve est obligatoire pour clore la commande (result, proof ou agentNote).");
  }
  return next;
}

function idleClaim(command, reason, httpStatus, error) {
  return { command, changed: false, started: false, reason, httpStatus, error };
}

export function claimHqCommand(command, input = {}, options = {}) {
  if (!command) fail(404, "Commande introuvable");
  const payload = input && typeof input === "object" ? input : {};
  const now = clock(options);
  const lease = leaseLength(options);
  const requested = normalizeClaimToken(payload.claimToken);
  const claimedBy = cleanActor(payload.claimedBy) || cleanActor(options.actorId) || "bureau";
  if (TERMINAL.has(command.status)) return idleClaim(command, "terminal", 409, "La commande est close.");
  if (HELD.has(command.status)) return idleClaim(command, "not_claimable", 409, "La commande n'est pas prenable dans cet état.");
  if (command.status === "running" && !isLeaseExpired(command, now, lease)) {
    if (requested && requested === command.claimToken) return idleClaim(command, "replay", 200);
    return idleClaim(command, "already_active", 200);
  }
  if (command.status !== "running" && !CLAIMABLE.has(command.status)) {
    return idleClaim(command, "not_claimable", 409, "La commande n'est pas prenable dans cet état.");
  }
  const stale = command.status === "running";
  const iso = now.toISOString();
  const next = {
    ...command,
    ...blankClaim(command),
    status: "running",
    claimedBy,
    claimToken: requested || crypto.randomUUID(),
    claimedAt: iso,
    updatedAt: iso,
    leaseUntil: new Date(now.getTime() + lease).toISOString(),
    activityNote: stale
      ? `Interruption : claim de ${command.claimedBy || "inconnu"} depuis ${command.claimedAt || "date inconnue"}, bail expiré. Reprise par ${claimedBy}.`
      : `Prise en charge par ${claimedBy}.`,
  };
  return { command: next, changed: true, started: true, reason: stale ? "reclaimed" : "claimed", httpStatus: 200 };
}

export function commandFilter(searchParams) {
  const status = searchParams.get("status") || "";
  const ownerSlug = searchParams.get("ownerSlug") || "";
  const division = searchParams.get("division") || "";
  if (status && !HQ_STATUSES.includes(status)) fail(400, "Statut inconnu.");
  if (ownerSlug && !rosterAgent(ownerSlug)) fail(400, "Agent inconnu.");
  if (division && !DIVISIONS.includes(division)) fail(400, "Division inconnue.");
  return { status, ownerSlug, division };
}

export function matchesFilter(command, filter = {}) {
  if (filter.status && command.status !== filter.status) return false;
  if (filter.ownerSlug && command.ownerSlug !== filter.ownerSlug) return false;
  if (filter.division && command.division !== filter.division) return false;
  return true;
}

export function sortCommands(commands) {
  return commands
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, HQ_LIST_LIMIT);
}
