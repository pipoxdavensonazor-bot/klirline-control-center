export const ACCESS_VALUES = new Set(["public-login", "cf-access", "cf-challenge", "none"]);

export const PRODUCT_SITES = [
  { id: "klirprospect", url: "https://klirprospect.klirline.ca", adminUrl: null, access: "cf-challenge" },
  { id: "klirlead", url: "https://scintillating-croissant-147cda.netlify.app", adminUrl: null, access: "none" },
  { id: "klirline-os", url: "https://klirline.ca", adminUrl: "https://www.klirline.ca/admin", access: "cf-access" },
  { id: "klirbuild", url: "https://klirline.app", healthUrl: "https://klirline.app/api/health", adminUrl: "https://klirline.app/login", access: "cf-access" },
  { id: "klirpay", url: "https://pay.klirline.ca", note: "Bac à sable", adminUrl: "https://pay.klirline.ca/login", access: "cf-access" },
  { id: "klirmarket", url: "https://klirline.com", note: "Vitrine publique", adminUrl: "https://klirline.com/admin", access: "cf-access" },
  { id: "klirsecure", url: "https://secure.klirline.ca", adminUrl: "https://secure.klirline.ca/", access: "cf-access" },
  { id: "centia", url: "https://centia.app", adminUrl: "https://centia.app/connexion", access: "cf-access" },
  { id: "klir-ia", name: "Klir IA", url: "https://klirline.io", skillsUrl: "https://klirline.io/api/skills", note: "Assistant marketing", adminUrl: "https://klirline.io/dashboard/admin/credits", access: "cf-access" },
  { id: "black-wall-news", name: "Black Wall News", url: "https://www.blackwallnews.com", adminUrl: "https://www.blackwallnews.com/admin", access: "cf-access" },
  { id: "noria", name: "NORIA", url: "https://noriaedu.com", note: "Gestion scolaire", adminUrl: "https://noriaedu.com/app#admin", access: "cf-access" },
];

export function productSiteFields(site) {
  const access = site.access;
  if (!ACCESS_VALUES.has(access)) throw new Error(`Mode d'accès inconnu pour ${site.id || "un site"}`);
  const adminUrl = site.adminUrl ?? null;
  if (adminUrl !== null && (typeof adminUrl !== "string" || !adminUrl.startsWith("https://"))) {
    throw new Error(`adminUrl invalide pour ${site.id}`);
  }
  if (access === "public-login" && !adminUrl) throw new Error(`${site.id} : public-login sans adminUrl`);
  if (access === "cf-access" && !adminUrl) throw new Error(`${site.id} : cf-access sans adminUrl`);
  if (access !== "public-login" && access !== "cf-access" && adminUrl) {
    throw new Error(`${site.id} : un lien admin exige public-login ou cf-access`);
  }
  return { adminUrl, access };
}

for (const site of PRODUCT_SITES) productSiteFields(site);

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

function probedSite(site, checkedAt, extra) {
  return {
    id: site.id,
    name: site.name || "",
    url: site.url || null,
    status: extra.status,
    httpStatus: extra.httpStatus,
    title: extra.title || "",
    note: site.note || "",
    health: extra.health ?? null,
    skills: extra.skills ?? null,
    ...productSiteFields(site),
    checkedAt,
  };
}

async function probeOne(site, checkedAt) {
  if (!site.url) {
    return probedSite(site, checkedAt, { status: "absent", httpStatus: null });
  }
  if (site.private) {
    return probedSite(site, checkedAt, { status: "private", httpStatus: null });
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
    return probedSite(site, checkedAt, {
      status: response.ok ? "online" : "unexpected",
      httpStatus: response.status,
      title,
      health,
      skills,
    });
  } catch {
    return probedSite(site, checkedAt, { status: "unreachable", httpStatus: null });
  }
}

export async function probeProductSites() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  const checkedAt = new Date().toISOString();
  const body = await Promise.all(PRODUCT_SITES.map((site) => probeOne(site, checkedAt)));
  cache = { at: Date.now(), body };
  return body;
}
