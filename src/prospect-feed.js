export const PROSPECT_FEED_URL = "https://cbklwmjudobqwbkbxqgy.supabase.co/functions/v1/prospects";

function text(value, max = 160) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function score(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

export function readProspectFeed(body) {
  const rows = body && Array.isArray(body.prospects) ? body.prospects : null;
  if (!rows) return { status: "invalid", source: "klirprospect", prospects: [] };
  const prospects = [];
  for (const item of rows.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const company = text(item.company);
    if (!company || company.includes("@")) continue;
    prospects.push({
      company,
      product: text(item.product),
      score: score(item.score),
      action: text(item.action),
    });
  }
  return {
    status: prospects.length ? "ready" : "empty",
    source: "klirprospect",
    prospects,
  };
}

let cache = { at: 0, body: null };

export async function loadProspectSource(env, fetchImpl = fetch) {
  const token = env?.PROSPECTS_READ_TOKEN;
  if (!token) return { status: "unconfigured", source: "klirprospect", prospects: [] };
  if (cache.body && Date.now() - cache.at < 60_000) return cache.body;
  try {
    const response = await fetchImpl(PROSPECT_FEED_URL, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = { status: "unavailable", source: "klirprospect", prospects: [] };
      cache = { at: Date.now(), body };
      return body;
    }
    const body = readProspectFeed(await response.json());
    cache = { at: Date.now(), body };
    return body;
  } catch {
    return { status: "unavailable", source: "klirprospect", prospects: [] };
  }
}
