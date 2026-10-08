export const PRODUCT_SITES = [
  { id: "klirprospect", url: "https://klirprospect.klirline.ca" },
  { id: "klirlead", url: "https://scintillating-croissant-147cda.netlify.app" },
  { id: "klirline-os", url: null },
  { id: "klirbuild", url: "https://klirline.app", healthUrl: "https://klirline.app/api/health" },
  { id: "klirpay", url: "https://pay.klirline.ca", note: "Bac à sable" },
  { id: "klirmarket", url: null },
  { id: "klirsecure", url: "https://secure.klirline.ca" },
  { id: "centia", url: "https://centia.app" },
  { id: "klir-ia", name: "Klir IA", url: "https://klirline.io", skillsUrl: "https://klirline.io/api/skills", note: "Assistant marketing" },
];

const CACHE_MS = 60_000;
let cache = { at: 0, body: null };

function decodeTitle(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

const HEALTH_LABELS = {
  app: "Application",
  googleOAuth: "Connexion Google",
};

async function probeHealth(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "application/json", "User-Agent": "KlirlineControlCenter/0.1" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { status: "unexpected", httpStatus: response.status, checks: [] };
    const body = await response.json();
    const checks = Object.entries(body.checks || {}).map(([name, value]) => ({
      name,
      label: HEALTH_LABELS[name] || name,
      ok: Boolean(value && value.ok),
    }));
    const healthy = body.status === "ok" && checks.every((check) => check.ok);
    return { status: healthy ? "ok" : "degraded", httpStatus: response.status, at: body.timestamp || null, checks };
  } catch {
    return { status: "unreachable", httpStatus: null, checks: [] };
  }
}

async function probeSkills(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "application/json", "User-Agent": "KlirlineControlCenter/0.1" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { status: "unexpected", httpStatus: response.status, count: null };
    const body = await response.json();
    const count = Number.isInteger(body.count) ? body.count : Array.isArray(body.skills) ? body.skills.length : null;
    return { status: count === null ? "unexpected" : "ok", httpStatus: response.status, count };
  } catch {
    return { status: "unreachable", httpStatus: null, count: null };
  }
}

async function probeOne(site, checkedAt) {
  if (!site.url) {
    return { id: site.id, name: site.name || "", url: null, status: "absent", httpStatus: null, title: "", note: site.note || "", health: null, skills: null, checkedAt };
  }
  try {
    const response = await fetch(site.url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "KlirlineControlCenter/0.1" },
      signal: AbortSignal.timeout(5000),
    });
    const html = (await response.text()).slice(0, 80_000);
    const title = decodeTitle(html.match(/<title>([^<]*)<\/title>/i)?.[1] || "");
    const health = site.healthUrl ? await probeHealth(site.healthUrl) : null;
    const skills = site.skillsUrl ? await probeSkills(site.skillsUrl) : null;
    return {
      id: site.id,
      name: site.name || "",
      url: site.url,
      status: response.ok ? "online" : "unexpected",
      httpStatus: response.status,
      title,
      note: site.note || "",
      health,
      skills,
      checkedAt,
    };
  } catch {
    return { id: site.id, name: site.name || "", url: site.url, status: "unreachable", httpStatus: null, title: "", note: site.note || "", health: null, skills: null, checkedAt };
  }
}

export async function probeProductSites() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  const checkedAt = new Date().toISOString();
  const body = await Promise.all(PRODUCT_SITES.map((site) => probeOne(site, checkedAt)));
  cache = { at: Date.now(), body };
  return body;
}
