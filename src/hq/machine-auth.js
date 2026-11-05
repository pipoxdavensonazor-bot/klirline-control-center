import { timingSafeEqual } from "node:crypto";

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
  return parsed.filter((item) => item && item.id && item.token && item.actorId);
}

export function authenticateMachine(authorizationHeader, env = {}) {
  const token = bearer(authorizationHeader);
  if (!token) return null;
  const match = machineIdentities(env).find((item) => sameSecret(item.token, token));
  if (!match) return null;
  return {
    id: String(match.id),
    actorId: String(match.actorId),
    scopes: Array.isArray(match.scopes) ? match.scopes.map(String) : [],
  };
}

export function accessScopes(actorId) {
  if (actorId === "ceo" || actorId === "coo" || actorId === "chief-of-staff") return ["work", "review"];
  return ["work"];
}
