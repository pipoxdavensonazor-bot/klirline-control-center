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
  return { teamDomain, aud, accounts: parsed.accounts, ready, error };
}

export function bindIdentity(account) {
  return {
    actorId: account.role,
    orgId: orgObjectName(account.orgId),
    email: account.email,
  };
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

export async function verifyAccessJwt(token, { teamDomain, aud, keys, nowMs }) {
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
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: "human", email };
  const commonName = typeof claims.common_name === "string" ? claims.common_name.trim() : "";
  if (claims.type === "app" && claims.sub === "" && /^[a-f0-9]{32}\.access$/.test(commonName)) {
    return { kind: "service", commonName };
  }
  rejected();
}
