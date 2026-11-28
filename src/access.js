import { agents } from "./org/index.js";
import { RATE_OBJECT_NAME } from "./limits.js";

const TEAM_DOMAIN = /^[a-z0-9-]+\.cloudflareaccess.com$/;

export function orgObjectName(orgId) {
  if (orgId === RATE_OBJECT_NAME) {
    const error = new Error("Organisation réservée.");
    error.status = 500;
    throw error;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(orgId || "")) {
    const error = new Error("Organisation invalide.");
    error.status = 500;
    throw error;
  }
  return orgId;
}

export function parseAccessAccounts(raw) {
  if (raw == null || String(raw).trim() === "") return { accounts: [], error: "ACCESS_ACCOUNTS manquant" };
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { accounts: [], error: "ACCESS_ACCOUNTS illisible" };
  }
  if (!Array.isArray(parsed) || !parsed.length) return { accounts: [], error: "ACCESS_ACCOUNTS vide" };
  const accounts = [];
  for (const item of parsed) {
    const email = String(item?.email || "").trim().toLowerCase();
    const role = String(item?.role || "").trim();
    const orgId = String(item?.orgId || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { accounts: [], error: "Courriel de compte invalide" };
    if (!agents.some((agent) => agent.id === role)) return { accounts: [], error: "Rôle de compte inconnu" };
    try {
      orgObjectName(orgId);
    } catch (error) {
      return { accounts: [], error: error.message };
    }
    accounts.push({ email, role, orgId });
  }
  if (new Set(accounts.map((item) => item.email)).size !== accounts.length) {
    return { accounts: [], error: "Courriel de compte en double" };
  }
  return { accounts, error: null };
}

const SERVICE_CLIENT_ID = /^[0-9a-f]{32}\.access$/;

export const HQ_SERVICE_ACTOR = "service:hq-poll";

export function parseServiceClientIds(raw) {
  const ids = new Set();
  for (const part of String(raw ?? "").split(",")) {
    const id = part.trim().toLowerCase();
    if (SERVICE_CLIENT_ID.test(id)) ids.add(id);
  }
  return [...ids];
}

export function accessSettings(env = {}) {
  const teamDomain = String(env.ACCESS_TEAM_DOMAIN || "").trim().toLowerCase().replace(/\.$/, "");
  const aud = String(env.ACCESS_AUD || "").trim();
  const parsed = parseAccessAccounts(env.ACCESS_ACCOUNTS);
  const domainOk = TEAM_DOMAIN.test(teamDomain);
  const audOk = aud.length > 0 && aud.length <= 128 && !/\s/.test(aud);
  const ready = domainOk && audOk && !parsed.error;
  let error = null;
  if (!ready) {
    if (!domainOk || !audOk) error = "ACCESS_TEAM_DOMAIN ou ACCESS_AUD manquant";
    else error = parsed.error;
  }
  return {
    teamDomain,
    aud,
    accounts: parsed.accounts,
    serviceClientIds: parseServiceClientIds(env.ACCESS_SERVICE_CLIENT_IDS),
    ready,
    error,
  };
}

export function bindIdentity(account) {
  return {
    actorId: account.role,
    orgId: orgObjectName(account.orgId),
    email: account.email,
    service: false,
  };
}

export function bindServiceIdentity(orgId) {
  return {
    actorId: HQ_SERVICE_ACTOR,
    orgId: orgObjectName(orgId),
    email: HQ_SERVICE_ACTOR,
    service: true,
  };
}

export function identityFromAccess(verified, accounts) {
  if (verified?.kind === "service") {
    // I1 (banc phase 5) : plus de repli « service:hq-poll » sans portées. Un jeton de service n'obtient
    // une identité que par sa fiche HQ_MACHINE_IDENTITIES (resolveServiceMachine, portées explicites).
    const error = new Error("Ce jeton de service n'a pas de fiche machine (HQ_MACHINE_IDENTITIES).");
    error.status = 403;
    throw error;
  }
  const account = (accounts || []).find((item) => item.email === verified?.email);
  if (!account) {
    const error = new Error("Ce compte n'est pas autorisé pour ce centre.");
    error.status = 403;
    throw error;
  }
  return bindIdentity(account);
}

export function assertServiceRoute(identity, pathname) {
  if (!identity?.service) return;
  const path = String(pathname || "");
  if (path.startsWith("/api/hq/") && !path.includes("..") && !path.includes("\\")) return;
  const error = new Error("Ce jeton de service n'ouvre que le bureau.");
  error.status = 403;
  throw error;
}

function bytesOf(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function jsonOf(part) {
  return JSON.parse(new TextDecoder().decode(bytesOf(part)));
}

function rejected(message = "Jeton refusé.") {
  const error = new Error(message);
  error.status = 401;
  throw error;
}

function serviceAllowlist(serviceClientIds) {
  const raw = Array.isArray(serviceClientIds) ? serviceClientIds.join(",") : serviceClientIds;
  return new Set(parseServiceClientIds(raw));
}

export async function verifyAccessJwt(token, { teamDomain, aud, keys, nowMs, serviceClientIds }) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) rejected();
  let header;
  let claims;
  try {
    header = jsonOf(parts[0]);
    claims = jsonOf(parts[1]);
  } catch {
    rejected();
  }
  if (header.alg !== "RS256" || !header.kid) rejected();
  const jwk = (keys || []).find((key) => key && key.kid === header.kid && key.kty === "RSA");
  if (!jwk) rejected();
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    bytesOf(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) rejected();
  if (claims.iss !== `https://${teamDomain}`) rejected();
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(aud)) rejected();
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= nowMs) rejected();
  if (typeof claims.nbf === "number" && claims.nbf * 1000 > nowMs) rejected();
  if (typeof claims.email === "string" && claims.email !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) rejected();
    return { kind: "user", email: claims.email.toLowerCase() };
  }
  const clientId = typeof claims.common_name === "string" ? claims.common_name.trim().toLowerCase() : "";
  if (
    claims.type === "app" &&
    claims.sub === "" &&
    SERVICE_CLIENT_ID.test(clientId) &&
    serviceAllowlist(serviceClientIds).has(clientId)
  ) {
    return { kind: "service", clientId };
  }
  rejected();
}
