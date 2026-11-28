import { createHash, randomUUID } from "node:crypto";
import { DIVISIONS, fold, rosterAgent, routeCommand } from "./roster.js";

export const HQ_STATUSES = [
  "pending",
  "queued",
  "dispatched",
  "running",
  "awaiting_validation",
  "blocked",
  "done",
  "failed",
  "cancelled",
];
export const HQ_LIST_LIMIT = 200;
export const HQ_LEASE_MS = 30 * 60 * 1000;

const PRIORITIES = {
  basse: "basse",
  low: "basse",
  normale: "normale",
  normal: "normale",
  haute: "haute",
  high: "haute",
};

const OPEN_CLAIM = new Set(["pending", "queued"]);
const LEASED = new Set(["dispatched", "running"]);
const CLOSED = new Set(["awaiting_validation", "blocked", "done", "failed", "cancelled"]);
const TERMINAL = new Set(["done", "failed", "cancelled"]);

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

function clock(options = {}) {
  const now = options.now instanceof Date ? options.now : options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(400, "Horloge illisible.");
  return now;
}

function joinNotes(...parts) {
  const text = parts
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join("\n");
  if (!text) return null;
  if (text.length <= 4000) return text;
  return text.slice(text.length - 4000);
}

export function hashClaimToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function publicCommand(command) {
  if (!command || typeof command !== "object") return command;
  const copy = { ...command };
  delete copy.claimToken;
  // T9 : l'empreinte du jeton de la tentative terminée n'est jamais exposée (elle l'était dès que
  // claim valait null, c'est-à-dire sur toute commande terminée).
  delete copy.completedTokenHash;
  if (command.claim && typeof command.claim === "object") {
    copy.claim = {
      holder: String(command.claim.holder || ""),
      attemptId: command.claim.attemptId || null,
      claimedAt: command.claim.claimedAt || null,
      leaseUntil: command.claim.leaseUntil || null,
    };
  } else {
    copy.claim = null;
  }
  return copy;
}

function hasProof(command) {
  return [command?.result, command?.proof, command?.agentNote].some((value) => typeof value === "string" && value.trim());
}

function leaseActive(command, nowMs) {
  if (command?.claim?.leaseUntil) {
    const until = Date.parse(command.claim.leaseUntil);
    return !Number.isNaN(until) && until > nowMs;
  }
  if (command?.status === "running") {
    const updated = Date.parse(command.updatedAt || command.createdAt || "");
    return !Number.isNaN(updated) && updated + HQ_LEASE_MS > nowMs;
  }
  return false;
}

function issueLease(command, options, now, note, systemNote) {
  const token = randomUUID();
  const attemptId = randomUUID();
  const claimedAt = now.toISOString();
  const next = {
    ...command,
    status: "dispatched",
    updatedAt: claimedAt,
    agentNote: systemNote ? joinNotes(command.agentNote, note, systemNote) : note ? joinNotes(command.agentNote, note) : command.agentNote,
    claim: {
      tokenHash: hashClaimToken(token),
      attemptId,
      holder: String(options.actorId || ""),
      claimedAt,
      leaseUntil: new Date(now.getTime() + HQ_LEASE_MS).toISOString(),
    },
  };
  return { token, command: next };
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
    proof: null,
    agentNote: null,
    claim: null,
    routedBy,
    createdBy: String(actorId || ""),
    createdAt: now,
    updatedAt: now,
  };
}

// T5 (banc phase 5) : clé d'idempotence fournie par l'auteur (corps idempotencyKey ou en-tête
// Idempotency-Key). Portée : un auteur (createdBy). ASCII imprimable sans espace, 1 à 200 caractères.
export function normalizeIdempotencyKey(value) {
  if (value == null) return null;
  const key = String(value);
  if (!key) return null;
  if (!/^[\x21-\x7e]{1,200}$/.test(key)) fail(400, "Clé d'idempotence illisible.");
  return key;
}

export function sameIdempotentCommand(existing, command) {
  return existing.text === command.text && existing.ownerSlug === command.ownerSlug && existing.priority === command.priority;
}

export function findIdempotent(commands, command) {
  if (!command.idempotencyKey) return null;
  return commands.find((item) => item.idempotencyKey === command.idempotencyKey && item.createdBy === command.createdBy) || null;
}

export function applyHqPatch(command, input, options = {}) {
  if (!command) fail(404, "Commande introuvable");
  const status = String(input?.status ?? "").trim();
  if (!HQ_STATUSES.includes(status)) fail(400, "Statut inconnu.");
  const next = {
    ...command,
    status,
    updatedAt: clock(options).toISOString(),
  };
  if (Object.hasOwn(input || {}, "result")) next.result = cleanNote(input.result, "Le résultat est trop long.");
  if (Object.hasOwn(input || {}, "proof")) next.proof = cleanNote(input.proof, "La preuve est trop longue.");
  if (Object.hasOwn(input || {}, "agentNote")) next.agentNote = cleanNote(input.agentNote, "La note est trop longue.");
  if (next.status === "done" && !hasProof(next)) {
    fail(400, "Une preuve est requise (résultat, preuve ou note) pour clore.");
  }
  if (!LEASED.has(next.status)) next.claim = null;
  return next;
}

const IMPERSONATION = ["actorId", "role", "orgId", "validatorId", "createdBy", "readers", "permissions", "makeAdmin"];

export function rejectImpersonation(input) {
  if (!input || typeof input !== "object") return;
  for (const key of IMPERSONATION) {
    if (Object.hasOwn(input, key)) fail(400, "Ce champ ne change pas l'identité ni le propriétaire.");
  }
}

export function credentialMatches(claim, attemptId, token) {
  if (!claim?.tokenHash || !claim.attemptId) return false;
  if (String(attemptId || "") !== claim.attemptId) return false;
  if (!token) return false;
  return hashClaimToken(token) === claim.tokenHash;
}

export function decideCompletion(command, input, options = {}) {
  if (!command) return { http: 404, persist: false, body: { error: "Commande introuvable" } };
  try {
    rejectImpersonation(input);
    if (Object.hasOwn(input || {}, "ownerSlug")) fail(400, "Ce champ ne change pas le propriétaire.");
  } catch (error) {
    return { http: error.status || 400, persist: false, body: { error: error.message } };
  }
  const status = String(input?.status || command.status).trim();
  if (!HQ_STATUSES.includes(status)) return { http: 400, persist: false, body: { error: "Statut inconnu." } };
  const writesResult = status === "done" || status === "failed" || Object.hasOwn(input || {}, "result") || Object.hasOwn(input || {}, "proof");
  // T1 (banc phase 5) : une commande sous bail (dispatched/running) ne change que par la tentative
  // en cours (attemptId + claimToken) ou par un humain. Sans cela, un tiers pouvait la remettre en
  // pending puis la reprendre pendant que le titulaire travaillait encore.
  if (LEASED.has(command.status) && options.human !== true && !credentialMatches(command.claim, input?.attemptId, input?.claimToken)) {
    return {
      http: 409,
      persist: false,
      body: { mode: "hq", outcome: "rejected", error: "Cette tentative ne peut plus écrire le résultat.", command: publicCommand(command) },
    };
  }
  // T9 (banc phase 5) : une commande terminée (done/failed/cancelled) ne se rouvre que par un humain.
  // Seul le renvoi d'un résultat sur une commande done reste traité plus bas (duplicate ou 409).
  if (TERMINAL.has(command.status) && options.human !== true && !(command.status === "done" && status === "done")) {
    return {
      http: 409,
      persist: false,
      body: { mode: "hq", outcome: "rejected", error: "Une commande terminée ne se rouvre que par un humain.", command: publicCommand(command) },
    };
  }
  // T1 : on n'entre en dispatched/running que par un claim (sinon : running sans bail ni jeton).
  if (!LEASED.has(command.status) && LEASED.has(status) && options.human !== true) {
    return {
      http: 409,
      persist: false,
      body: { mode: "hq", outcome: "rejected", error: "Une commande ne passe transmise ou en cours que par un claim.", command: publicCommand(command) },
    };
  }
  if (!writesResult) {
    try {
      const next = applyHqPatch(command, input, options);
      return { http: 200, persist: true, command: next, body: { mode: "hq", outcome: "updated", command: publicCommand(next) } };
    } catch (error) {
      return { http: error.status || 500, persist: false, body: { error: error.message } };
    }
  }
  const attemptId = input?.attemptId;
  const token = input?.claimToken;
  if (command.status === "done") {
    const sameAttempt = credentialMatches(
      { tokenHash: command.completedTokenHash, attemptId: command.completedAttemptId },
      attemptId,
      token,
    );
    const sameResult = (input?.result == null || String(input.result).trim() === String(command.result || "").trim())
      && (input?.proof == null || String(input.proof).trim() === String(command.proof || "").trim());
    if (sameAttempt && sameResult) {
      return { http: 200, persist: false, body: { mode: "hq", outcome: "duplicate", command: publicCommand(command) } };
    }
    return {
      http: 409,
      persist: false,
      body: { mode: "hq", outcome: "rejected", error: "Le résultat est déjà enregistré.", command: publicCommand(command) },
    };
  }
  // T12 (banc phase 5) : la portée review ne remplace plus le jeton. Seul un humain écrit un
  // résultat sans la tentative en cours.
  const reviewer = options.human === true;
  if (!reviewer && !credentialMatches(command.claim, attemptId, token)) {
    return {
      http: 409,
      persist: false,
      body: { mode: "hq", outcome: "rejected", error: "Cette tentative ne peut plus écrire le résultat.", command: publicCommand(command) },
    };
  }
  try {
    const next = applyHqPatch(command, input, options);
    next.completedAttemptId = command.claim?.attemptId || null;
    next.completedTokenHash = command.claim?.tokenHash || null;
    return { http: 200, persist: true, command: next, body: { mode: "hq", outcome: "completed", command: publicCommand(next) } };
  } catch (error) {
    return { http: error.status || 500, persist: false, body: { error: error.message } };
  }
}

export function decideClaim(command, options = {}) {
  if (!command) {
    return { http: 404, persist: false, body: { error: "Commande introuvable" } };
  }
  const now = clock(options);
  const nowMs = now.getTime();
  const note = options.note == null ? null : cleanNote(options.note, "La note est trop longue.");
  const visible = publicCommand(command);

  if (CLOSED.has(command.status)) {
    return {
      http: 409,
      persist: false,
      body: {
        mode: "hq",
        outcome: "refused",
        error: "Cette commande n'est plus prenable.",
        command: visible,
      },
    };
  }

  if (LEASED.has(command.status) && leaseActive(command, nowMs)) {
    return {
      http: 200,
      persist: false,
      body: { mode: "hq", outcome: "held", command: visible },
    };
  }

  if (command.status === "running") {
    const blocked = {
      ...command,
      status: "blocked",
      updatedAt: now.toISOString(),
      claim: null,
      agentNote: joinNotes(
        command.agentNote,
        note,
        `Interruption : exécution running trop ancienne (dernière mise à jour ${command.updatedAt}). Statut bloqué, bail non renouvelé.`,
      ),
    };
    return {
      http: 200,
      persist: true,
      command: blocked,
      body: { mode: "hq", outcome: "blocked", command: publicCommand(blocked) },
    };
  }

  if (command.status === "dispatched" && command.claim?.leaseUntil) {
    const issued = issueLease(
      command,
      options,
      now,
      note,
      `Reprise documentée : le bail du ${command.claim.claimedAt || command.updatedAt} a expiré. Nouvelle prise, une seule exécution.`,
    );
    return {
      http: 200,
      persist: true,
      command: issued.command,
      body: {
        mode: "hq",
        outcome: "reclaimed",
        claimToken: issued.token,
        command: publicCommand(issued.command),
      },
    };
  }

  if (command.status === "dispatched") {
    const issued = issueLease(command, options, now, note, null);
    return {
      http: 200,
      persist: true,
      command: issued.command,
      body: {
        mode: "hq",
        outcome: "issued",
        claimToken: issued.token,
        command: publicCommand(issued.command),
      },
    };
  }

  if (OPEN_CLAIM.has(command.status)) {
    const issued = issueLease(command, options, now, note, null);
    return {
      http: 200,
      persist: true,
      command: issued.command,
      body: {
        mode: "hq",
        outcome: "issued",
        claimToken: issued.token,
        command: publicCommand(issued.command),
      },
    };
  }

  return {
    http: 409,
    persist: false,
    body: {
      mode: "hq",
      outcome: "refused",
      error: "Cette commande n'est plus prenable.",
      command: visible,
    },
  };
}

export function decideInterrupt(command, options = {}) {
  if (!command) {
    return { http: 404, persist: false, body: { error: "Commande introuvable" } };
  }
  // T4 (banc phase 5) : interruption réservée au titulaire du bail, à un humain ou à la revue.
  const supervisor = options.human === true || (Array.isArray(options.scopes) && options.scopes.includes("review"));
  const holder = Boolean(command.claim?.holder) && command.claim.holder === String(options.actorId || "");
  if (!supervisor && !holder) {
    return {
      http: 403,
      persist: false,
      body: { mode: "hq", outcome: "refused", error: "Seul le titulaire, un humain ou la revue interrompt cette commande." },
    };
  }
  if (!LEASED.has(command.status)) {
    return {
      http: 409,
      persist: false,
      body: {
        mode: "hq",
        outcome: "refused",
        error: "Seule une commande transmise ou en cours peut être interrompue.",
        command: publicCommand(command),
      },
    };
  }
  const note = cleanNote(options.note, "La note est trop longue.");
  if (!note) fail(400, "Une note d'interruption est requise.");
  const now = clock(options).toISOString();
  const next = {
    ...command,
    updatedAt: now,
    agentNote: joinNotes(command.agentNote, note),
  };
  return {
    http: 200,
    persist: true,
    command: next,
    body: { mode: "hq", outcome: "interrupted", command: publicCommand(next) },
  };
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
