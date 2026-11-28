// Lot 2 (revue KCO-2026-REVUE-P1, question 4) : contrôle de configuration avant déploiement.
// Entrée : un objet de variables (valeurs FICTIVES en local ; en CI, les variables réelles ne sont
// lues que par ce contrôle et jamais affichées). Sortie : erreurs bloquantes et avertissements,
// sans aucune valeur de jeton ni de Client ID complet (empreinte courte seulement).
import { createHash } from "node:crypto";
import { parseAccessAccounts, parseServiceClientIds, orgObjectName } from "../access.js";
import { HUMAN_VALIDATOR_ROLES } from "./machine-auth.js";

const SERVICE_CLIENT = /^[a-f0-9]{32}\.access$/;
const SCOPES = new Set(["work", "review"]);
const mask = (value) => `empreinte:${createHash("sha256").update(String(value)).digest("hex").slice(0, 8)}`;

export function checkIdentityConfig(env = {}, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  let fiches = [];
  const raw = env.HQ_MACHINE_IDENTITIES;
  if (raw != null && String(raw).trim()) {
    try {
      fiches = JSON.parse(String(raw));
      if (!Array.isArray(fiches)) { errors.push("HQ_MACHINE_IDENTITIES n'est pas une liste."); fiches = []; }
    } catch {
      errors.push("HQ_MACHINE_IDENTITIES illisible (JSON).");
    }
  }
  const byKey = (key) => {
    const seen = new Map();
    fiches.forEach((item, index) => {
      const value = item?.[key];
      if (value == null || value === "") return;
      const norm = String(value).trim().toLowerCase();
      seen.set(norm, [...(seen.get(norm) || []), item?.id ?? `#${index}`]);
    });
    return [...seen.entries()].filter(([, ids]) => ids.length > 1);
  };
  for (const [value, ids] of byKey("accessClientId")) errors.push(`Client ID ${mask(value)} déclaré par plusieurs fiches (${ids.join(", ")}) : identité ambiguë, refusée à l'exécution.`);
  for (const [value, ids] of byKey("token")) errors.push(`Jeton ${mask(value)} partagé par plusieurs fiches (${ids.join(", ")}).`);
  for (const [value, ids] of byKey("id")) errors.push(`Identifiant de fiche « ${value} » en double (${ids.join(", ")}).`);
  const allowed = new Set(parseServiceClientIds(env.ACCESS_SERVICE_CLIENT_IDS));
  fiches.forEach((item, index) => {
    const name = item?.id ? `fiche « ${item.id} »` : `fiche #${index}`;
    if (!item?.id || !item?.actorId) errors.push(`${name} : id et actorId obligatoires.`);
    if (!item?.accessClientId && !item?.token) errors.push(`${name} : ni accessClientId ni jeton.`);
    if (item?.accessClientId && !SERVICE_CLIENT.test(String(item.accessClientId))) errors.push(`${name} : Client ID ${mask(item.accessClientId)} mal formé.`);
    if (item?.accessClientId && SERVICE_CLIENT.test(String(item.accessClientId)) && !allowed.has(String(item.accessClientId))) warnings.push(`${name} : Client ID ${mask(item.accessClientId)} absent d'ACCESS_SERVICE_CLIENT_IDS (fiche inutilisable).`);
    if (HUMAN_VALIDATOR_ROLES.has(String(item?.actorId || "").trim().toLowerCase())) errors.push(`${name} : une machine ne porte pas le rôle humain « ${item.actorId} ».`);
    const scopes = Array.isArray(item?.scopes) ? item.scopes : [];
    if (!scopes.length || scopes.some((scope) => !SCOPES.has(String(scope)))) errors.push(`${name} : portées absentes ou inconnues (work, review).`);
    try { orgObjectName(String(item?.orgId || "")); } catch { errors.push(`${name} : organisation invalide.`); }
  });
  const declared = new Set(fiches.map((item) => String(item?.accessClientId || "").toLowerCase()).filter(Boolean));
  for (const id of allowed) if (!declared.has(id)) (strict ? errors : warnings).push(`Client ID ${mask(id)} autorisé sans fiche machine : refusé (403) à l'exécution${strict ? " (mode strict : le poll de cette identité s'arrêterait)" : ""}.`);
  if (env.ACCESS_ACCOUNTS != null) {
    const parsed = parseAccessAccounts(env.ACCESS_ACCOUNTS);
    if (parsed.error) errors.push(`ACCESS_ACCOUNTS : ${parsed.error}.`);
  }
  return { ok: errors.length === 0, errors, warnings, fiches: fiches.length };
}
