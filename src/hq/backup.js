// Lot 2 (B1/B2, local) : sauvegarde chiffrée et restauration vérifiée d'un Durable Object HQ.
// AUCUNE route HTTP : ces fonctions ne sont appelables que par du code d'exploitation humain
// (méthodes du Durable Object), après authorizeBackup. Clés fournies par l'appelant, jamais
// stockées ni journalisées. WebCrypto (Node et workerd) : AES-256-GCM + HMAC-SHA-256.
export const BACKUP_SCHEMA = "klirline.hq.backup/v1";
export const BACKUP_TABLES = ["hq_command", "hq_mission", "hq_audit"];
const BACKUP_ROLES = new Set(["ceo"]);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

// Humain seulement, rôle ceo, justification obligatoire. Une machine (même review) est refusée.
export function authorizeBackup(identity = {}, reason) {
  if (identity.human !== true || identity.service === true) fail(403, "Sauvegarde et restauration réservées à un humain.");
  if (!BACKUP_ROLES.has(String(identity.actorId || ""))) fail(403, "Rôle non autorisé pour la sauvegarde.");
  if (typeof reason !== "string" || reason.trim().length < 10) fail(400, "Justification obligatoire (10 caractères au moins).");
  return { actorId: identity.actorId, orgId: identity.orgId, reason: reason.trim().slice(0, 500) };
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function b64(buf) {
  const bytes = new Uint8Array(buf);
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function sha256(text) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}
function keyBytes(key, label) {
  const bytes = typeof key === "string" ? Uint8Array.from(key.match(/../g) || [], (h) => Number.parseInt(h, 16)) : key;
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) fail(400, `Clé ${label} : 32 octets attendus.`);
  return bytes;
}
async function hmac(key, text) {
  const k = await crypto.subtle.importKey("raw", keyBytes(key, "d'authentification"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(text)));
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// rows : { hq_command: [...], hq_mission: [...], hq_audit: [...] } (lignes SQL brutes).
export async function sealBackup({ rows, orgId, exportedAt, actorId }, { encryptionKey, authKey }) {
  const payload = JSON.stringify({ schema: BACKUP_SCHEMA, orgId, exportedAt, rows });
  const tables = {};
  for (const name of BACKUP_TABLES) tables[name] = { count: (rows[name] || []).length, sha256: await sha256(JSON.stringify(rows[name] || [])) };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey("raw", keyBytes(encryptionKey, "de chiffrement"), "AES-GCM", false, ["encrypt"]);
  const ciphertext = b64(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(`${BACKUP_SCHEMA}|${orgId}`) }, k, enc.encode(payload)));
  const manifest = { schema: BACKUP_SCHEMA, orgId, exportedAt, actorId, tables, payloadSha256: await sha256(payload), ciphertextSha256: await sha256(ciphertext), iv: b64(iv), cipher: "AES-256-GCM" };
  return { manifest, signature: await hmac(authKey, JSON.stringify(manifest)), ciphertext };
}

// Vérifie l'authenticité du manifeste, l'intégrité du chiffré et de chaque table, l'organisation.
export async function openBackup(bundle, { encryptionKey, authKey, expectedOrgId }) {
  const { manifest, signature, ciphertext } = bundle || {};
  if (!manifest || manifest.schema !== BACKUP_SCHEMA) fail(400, "Sauvegarde : schéma inconnu.");
  if (!sameHex(await hmac(authKey, JSON.stringify(manifest)), signature)) fail(409, "Sauvegarde : manifeste non authentifié.");
  if (expectedOrgId != null && manifest.orgId !== expectedOrgId) fail(409, "Sauvegarde : autre organisation.");
  if ((await sha256(ciphertext)) !== manifest.ciphertextSha256) fail(409, "Sauvegarde : chiffré altéré.");
  let payload;
  try {
    const k = await crypto.subtle.importKey("raw", keyBytes(encryptionKey, "de chiffrement"), "AES-GCM", false, ["decrypt"]);
    payload = dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(manifest.iv), additionalData: enc.encode(`${BACKUP_SCHEMA}|${manifest.orgId}`) }, k, unb64(ciphertext)));
  } catch (error) {
    if (error.status) throw error;
    fail(409, "Sauvegarde : déchiffrement impossible (clé ou données).");
  }
  if ((await sha256(payload)) !== manifest.payloadSha256) fail(409, "Sauvegarde : contenu altéré.");
  const parsed = JSON.parse(payload);
  for (const name of BACKUP_TABLES) {
    const got = { count: (parsed.rows[name] || []).length, sha256: await sha256(JSON.stringify(parsed.rows[name] || [])) };
    if (got.count !== manifest.tables[name]?.count || got.sha256 !== manifest.tables[name]?.sha256) fail(409, `Sauvegarde : table ${name} incohérente.`);
  }
  return { manifest, rows: parsed.rows };
}
