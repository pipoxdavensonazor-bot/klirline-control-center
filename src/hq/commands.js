import { DIVISIONS, fold, rosterAgent, routeCommand } from "./roster.js";

export const HQ_STATUSES = ["pending", "queued", "dispatched", "running", "done", "blocked", "cancelled"];
export const HQ_LIST_LIMIT = 200;

const PRIORITIES = {
  basse: "basse",
  low: "basse",
  normale: "normale",
  normal: "normale",
  haute: "haute",
  high: "haute",
};

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
  const now = (options.now instanceof Date ? options.now : new Date()).toISOString();
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
    routedBy,
    createdBy: String(actorId || ""),
    createdAt: now,
    updatedAt: now,
  };
}

export function applyHqPatch(command, input, options = {}) {
  if (!command) fail(404, "Commande introuvable");
  const status = String(input?.status ?? "").trim();
  if (!HQ_STATUSES.includes(status)) fail(400, "Statut inconnu.");
  const next = {
    ...command,
    status,
    updatedAt: (options.now instanceof Date ? options.now : new Date()).toISOString(),
  };
  if (Object.hasOwn(input || {}, "result")) next.result = cleanNote(input.result, "Le résultat est trop long.");
  if (Object.hasOwn(input || {}, "agentNote")) next.agentNote = cleanNote(input.agentNote, "La note est trop longue.");
  return next;
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
