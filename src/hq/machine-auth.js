import { timingSafeEqual } from "node:crypto";
import { bindIdentity, orgObjectName, accessSettings } from "../access.js";

function bearer(headerValue) {
  const value = String(headerValue || "");
  if (!value.startsWith("Bearer ")) return "";
  return value.slice(7).trim();
}

function sameSecret(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function machineIdentities(env = {}) {
  const raw = env.HQ_MACHINE_IDENTITIES;
  if (!raw || !String(raw).trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => item && item.id && item.actorId && (item.token || item.accessClientId));
}

const SERVICE_CLIENT = /^[a-f0-9]{32}\.access$/;
const APP_SCOPES = new Set(["work", "review"]);
// I2 (banc phase 5) : rôles humains validateurs (A3). Une fiche machine ne les porte jamais :
// une machine qui se déclarerait « coo » ou « ceo » pourrait approuver puis clore une mission.
export const HUMAN_VALIDATOR_ROLES = new Set(["ceo", "coo", "chief-of-staff"]);

function humanRole(actorId) {
  return HUMAN_VALIDATOR_ROLES.has(String(actorId || "").trim().toLowerCase());
}

export function resolveServiceMachine(commonName, env = {}) {
  if (!SERVICE_CLIENT.test(commonName || "")) return null;
  const match = machineIdentities(env).find((item) => item.accessClientId === commonName);
  if (!match) return null;
  const scopes = Array.isArray(match.scopes) ? [...new Set(match.scopes.map(String))] : [];
  if (!scopes.length || scopes.some((scope) => !APP_SCOPES.has(scope))) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(match.actorId || ""))) return null;
  if (humanRole(match.actorId)) return null;
  let orgId;
  try {
    orgId = orgObjectName(String(match.orgId || ""));
  } catch {
    return null;
  }
  return {
    id: String(match.id),
    actorId: String(match.actorId),
    orgId,
    scopes,
    human: false,
  };
}

export function identifyAccess(claims, env = {}) {
  if (claims?.kind === "human" && claims.email) {
    const settings = accessSettings(env);
    const account = settings.accounts.find((item) => item.email === claims.email);
    if (!account) return { status: 403, error: "Ce compte n'est pas autorisé pour ce centre." };
    const identity = bindIdentity(account);
    return {
      identity: {
        ...identity,
        human: true,
        scopes: accessScopes(identity.actorId),
      },
    };
  }
  if (claims?.kind === "service") {
    const machine = resolveServiceMachine(claims.commonName, env);
    if (!machine) return { status: 403, error: "Ce jeton de service n'a pas de permission applicative." };
    return {
      identity: {
        actorId: machine.actorId,
        orgId: machine.orgId,
        email: `machine:${machine.id}`,
        human: false,
        scopes: machine.scopes,
      },
    };
  }
  return { status: 401, error: "Jeton refusé." };
}

export function authenticateMachine(authorizationHeader, env = {}) {
  const token = bearer(authorizationHeader);
  if (!token) return null;
  const match = machineIdentities(env).find((item) => item.token && sameSecret(item.token, token));
  if (!match) return null;
  if (humanRole(match.actorId)) return null;
  return {
    id: String(match.id),
    actorId: String(match.actorId),
    scopes: Array.isArray(match.scopes) ? match.scopes.map(String) : [],
  };
}

// Serveur Node de démonstration uniquement (src/server.js, jamais publié) : une personne locale
// déclarée dans HQ_LOCAL_HUMANS, seul moyen d'y tenir un rôle humain validateur. Le Worker publié
// n'utilise pas cette fonction : ses humains viennent du JWT Access (courriel).
export function authenticateLocalHuman(authorizationHeader, env = {}) {
  const token = bearer(authorizationHeader);
  if (!token || !env.HQ_LOCAL_HUMANS) return null;
  let parsed;
  try {
    parsed = JSON.parse(String(env.HQ_LOCAL_HUMANS));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const match = parsed.find((item) => item && item.id && item.token && humanRole(item.actorId) && sameSecret(item.token, token));
  if (!match) return null;
  const actorId = String(match.actorId).trim().toLowerCase();
  return { id: String(match.id), actorId, human: true, scopes: accessScopes(actorId) };
}

export function accessScopes(actorId) {
  if (actorId === "ceo" || actorId === "coo" || actorId === "chief-of-staff") return ["work", "review"];
  return ["work"];
}
