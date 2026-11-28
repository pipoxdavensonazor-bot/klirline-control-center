// Lot 2 : entrée du journal d'audit (acteur, organisation, mission, commande, tentative, action,
// horodatage, autorisation, résultat, empreinte du contenu, coût). Jamais de secret : ni
// claimToken, ni corps complet (seulement son empreinte SHA-256), ni jeton d'accès.
import { createHash } from "node:crypto";

const sha = (text) => `sha256-${createHash("sha256").update(String(text)).digest("hex")}`;

function contentHashOf(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.presentedHash === "string") return body.presentedHash;
  const parts = ["body", "proof", "result", "text", "recipient"].filter((key) => typeof body[key] === "string").map((key) => [key, body[key]]);
  return parts.length ? sha(JSON.stringify(parts)) : null;
}

export function auditEntry({ method, pathname, body, actorId, scopes, human, orgId, clock, result }) {
  const command = pathname.match(/^\/api\/hq\/commands\/([^/]+)/)?.[1] || result?.body?.command?.id || null;
  const mission = pathname.match(/^\/api\/hq\/missions\/([^/]+)/)?.[1] || result?.body?.mission?.id || null;
  const action = `${method} ${pathname.replace(/hq-[0-9a-f-]{36}/g, ":commande").replace(/msn-[0-9a-f-]{36}/g, ":mission").replace(/tsk-[0-9a-z-]+/g, ":tache")}`;
  return {
    at: clock.toISOString(),
    actorId: String(actorId || ""),
    orgId: orgId ?? null,
    missionId: mission,
    commandId: command,
    attemptId: (typeof body?.attemptId === "string" ? body.attemptId : null) || result?.body?.attemptId || result?.body?.command?.claim?.attemptId || null,
    action,
    authorization: {
      scopes: Array.isArray(scopes) ? scopes.slice(0, 4) : null,
      human: human === true,
      override: typeof body?.overrideReason === "string" ? body.overrideReason.slice(0, 500) : null,
      approval: typeof body?.presentedHash === "string" ? body.presentedHash : null,
      idempotencyKey: typeof body?.idempotencyKey === "string" ? sha(body.idempotencyKey).slice(0, 23) : null,
    },
    result: { status: result?.status ?? 500, outcome: result?.body?.outcome || result?.body?.reason || null, error: result?.body?.error ? String(result.body.error).slice(0, 200) : null },
    contentHash: contentHashOf(body),
    costCents: typeof body?.costCents === "number" && Number.isSafeInteger(body.costCents) ? body.costCents : null,
  };
}
