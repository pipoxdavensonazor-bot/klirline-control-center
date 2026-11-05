import { skillsForAgent } from "./skills.js";

export const DIVISIONS = ["Ops", "Produits", "Média", "Trading", "Autres"];

const OFFICE_COVERS = [
  { name: "Centia", productUrl: "https://centia.app" },
  { name: "Klirline.ca", productUrl: "https://klirline.ca" },
  { name: "KlirSecure", productUrl: "https://secure.klirline.ca" },
  { name: "KlirPay", productUrl: "https://pay.klirline.ca" },
];

// Agents nommés du bureau réel. Office et Ops sont deux cartes.
// Centia, Klirline.ca, KlirSecure et KlirPay n'ont pas d'agent dédié :
// leur propriétaire reste Office Klirline.
export const HQ_ROSTER = [
  {
    id: "office-klirline",
    name: "Office Klirline",
    division: "Ops",
    mission: "Reçoit les commandes du bureau et les répartit. Le Worker n'écrit à aucun agent.",
    productUrl: null,
    grokAgentName: "Office Klirline",
    covers: OFFICE_COVERS,
  },
  {
    id: "ops-klirline",
    name: "Ops Klirline",
    division: "Ops",
    mission: "Tient le centre de contrôle et l'exploitation de centre.klirline.com.",
    productUrl: "https://centre.klirline.com",
    grokAgentName: "Ops Klirline",
    covers: [],
  },
  {
    id: "klirbuild",
    name: "KlirBuild",
    division: "Produits",
    mission: "Estimation et suivi de chantier.",
    productUrl: "https://klirline.app",
    grokAgentName: "KlirBuild",
    covers: [],
  },
  {
    id: "klirmarket",
    name: "KlirMarket",
    division: "Produits",
    mission: "Vitrine, vendeurs et commandes du marché.",
    productUrl: "https://klirline.com",
    grokAgentName: "KlirMarket",
    covers: [],
  },
  {
    id: "klirprospect",
    name: "KlirProspect",
    division: "Produits",
    mission: "Fiches, pipeline et prochaine action commerciale.",
    productUrl: "https://klirprospect.klirline.ca",
    grokAgentName: "KlirProspect",
    covers: [],
  },
  {
    id: "klirline-ai",
    name: "Klirline AI",
    division: "Produits",
    mission: "Assistant et compétences publiées sur klirline.io.",
    productUrl: "https://klirline.io",
    grokAgentName: "Klirline AI",
    covers: [],
  },
  {
    id: "noria",
    name: "NORIA",
    division: "Produits",
    mission: "Gestion scolaire.",
    productUrl: "https://noriaedu.com",
    grokAgentName: "NORIA",
    covers: [],
  },
  {
    id: "black-wall-news",
    name: "Black wall news",
    division: "Média",
    mission: "Ligne et publication de Black Wall News.",
    productUrl: "https://blackwallnews.com",
    grokAgentName: "Black wall news",
    covers: [],
  },
  {
    id: "bwn-redaction",
    name: "BWN Rédaction",
    division: "Média",
    mission: "Prépare les textes pour blackwallnews.com.",
    productUrl: "https://blackwallnews.com",
    grokAgentName: "BWN Rédaction",
    covers: [],
  },
  {
    id: "klirline-social",
    name: "Klirline Social",
    division: "Média",
    mission: "Présence sociale de Klirline.",
    productUrl: null,
    grokAgentName: "Klirline Social",
    covers: [],
  },
  {
    id: "youtube-channel",
    name: "YouTube Channel",
    division: "Média",
    mission: "Chaîne vidéo de Klirline.",
    productUrl: null,
    grokAgentName: "YouTube Channel",
    covers: [],
  },
  {
    id: "ic-market",
    name: "IC MARKET",
    division: "Trading",
    mission: "Suit le compte IC Markets.",
    productUrl: null,
    grokAgentName: "IC MARKET",
    covers: [],
  },
  {
    id: "cmcmarkets",
    name: "CMCMarkets",
    division: "Trading",
    mission: "Suit le compte CMC Markets.",
    productUrl: null,
    grokAgentName: "CMCMarkets",
    covers: [],
  },
  {
    id: "all-question",
    name: "All Question",
    division: "Autres",
    mission: "Triage des demandes qui ne visent pas encore un agent.",
    productUrl: null,
    grokAgentName: "All Question",
    covers: [],
  },
  {
    id: "sandbox-klirline",
    name: "Sandbox Klirline",
    division: "Autres",
    mission: "Bac à sable pour essais, sans effet sur les produits.",
    productUrl: null,
    grokAgentName: "Sandbox Klirline",
    covers: [],
  },
];

const ROUTES = [
  {
    slug: "bwn-redaction",
    pattern: /(?:\bbwn\b|\bblackwall(?:news)?(?:\.com)?\b|\bblack wall\b).{0,48}\b(?:redaction|rediger|article|edito|editoriale)\b|\b(?:redaction|rediger|article|edito|editoriale)\b.{0,48}(?:\bbwn\b|\bblackwall(?:news)?(?:\.com)?\b|\bblack wall\b)/,
  },
  { slug: "black-wall-news", pattern: /\bblack wall\b|\bblackwall(?:news)?(?:\.com)?\b|\bbwn\b/ },
  { slug: "youtube-channel", pattern: /\byoutube\b|\bchaine video\b/ },
  { slug: "klirline-social", pattern: /\bklirline social\b|\binstagram\b|\btiktok\b|\blinkedin\b|\breseaux sociaux\b/ },
  { slug: "ic-market", pattern: /\bic markets?\b|\bicmarket\b/ },
  { slug: "cmcmarkets", pattern: /\bcmcmarkets\b|\bcmc markets\b|\bcmc\b/ },
  { slug: "klirbuild", pattern: /\bklirbuild\b|(?<![a-z0-9.-])klirline\.app\b|\bchantier\b/ },
  { slug: "klirmarket", pattern: /\bklirmarket\b|\bklir market\b|(?<![a-z0-9.-])klirline\.com\b/ },
  { slug: "klirprospect", pattern: /\bklirprospect\b|\bklir prospect\b|(?<![a-z0-9.-])klirprospect\.klirline\.ca\b/ },
  { slug: "klirline-ai", pattern: /\bklirline ai\b|\bklir ia\b|\bklirlineai\b|(?<![a-z0-9.-])klirline\.io\b/ },
  { slug: "noria", pattern: /\bnoria\b|\bnoriaedu\b|(?<![a-z0-9.-])noriaedu\.com\b|\bscolaire\b/ },
  {
    slug: "office-klirline",
    pattern: /\bcentia\b|\bklirpay\b|\bklirsecure\b|\bklirline os\b|\bklirlineos\b|(?<![a-z0-9.-])klirline\.ca\b|(?<![a-z0-9.-])pay\.klirline\.ca\b|(?<![a-z0-9.-])secure\.klirline\.ca\b|(?<![a-z0-9.-])centia\.app\b/,
  },
  { slug: "sandbox-klirline", pattern: /\bsandbox\b|\bbac a sable\b/ },
  { slug: "ops-klirline", pattern: /\bops klirline\b|(?<![a-z0-9.-])centre\.klirline(?:\.com)?\b|\bcentre de controle\b/ },
  { slug: "office-klirline", pattern: /\boffice klirline\b|\boffice\b/ },
  { slug: "all-question", pattern: /\ball question\b|\btriage\b/ },
];

export function fold(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function rosterAgent(slug) {
  return HQ_ROSTER.find((agent) => agent.id === slug) || null;
}

export function routeCommand(text) {
  const folded = fold(text);
  const match = ROUTES.find((route) => route.pattern.test(folded));
  if (!match) return { agent: rosterAgent("all-question"), routedBy: "triage" };
  return { agent: rosterAgent(match.slug), routedBy: "keyword" };
}

const OFFICE_PROFILE = {
  "office-klirline": { officeRole: "secretariat", reportsTo: "ceo", skills: ["klir-coordination", "klir-draft-message"] },
  "ops-klirline": { officeRole: "operations", reportsTo: "ceo", skills: ["klir-quality-claims", "klir-coordination"] },
  "klirprospect": { officeRole: "commercial", reportsTo: "office-klirline", skills: ["klir-prospect-qualification"] },
  "klirline-social": { officeRole: "marketing", reportsTo: "office-klirline", skills: ["klir-draft-message"] },
  "bwn-redaction": { officeRole: "marketing", reportsTo: "office-klirline", skills: ["klir-draft-message"] },
  "klirbuild": { officeRole: "product", reportsTo: "ops-klirline", skills: [] },
  "klirmarket": { officeRole: "product", reportsTo: "ops-klirline", skills: [] },
  "klirline-ai": { officeRole: "product", reportsTo: "ops-klirline", skills: [] },
  "noria": { officeRole: "product", reportsTo: "ops-klirline", skills: [] },
  "black-wall-news": { officeRole: "product", reportsTo: "ops-klirline", skills: [] },
  "youtube-channel": { officeRole: "marketing", reportsTo: "office-klirline", skills: [] },
  "ic-market": { officeRole: "trading", reportsTo: "ceo", skills: [], operationalPath: false },
  "cmcmarkets": { officeRole: "trading", reportsTo: "ceo", skills: [], operationalPath: false },
  "all-question": { officeRole: "secretariat", reportsTo: "office-klirline", skills: ["klir-coordination"] },
  "sandbox-klirline": { officeRole: "quality", reportsTo: "ops-klirline", skills: ["klir-quality-claims"] },
};

const OPEN_COMMANDS = new Set(["pending", "queued", "dispatched", "running", "awaiting_validation"]);

export function officeProfile(agent) {
  const extra = OFFICE_PROFILE[agent.id] || {};
  const trading = agent.division === "Trading";
  return {
    officeRole: extra.officeRole || "product",
    reportsTo: extra.reportsTo || "office-klirline",
    escalation: extra.reportsTo || "office-klirline",
    skills: skillsForAgent(extra.skills || []),
    executable: false,
    engine: null,
    engineNote: "Aucun moteur n'est branché. Une carte n'est pas une exécution.",
    operationalPath: trading ? false : extra.operationalPath !== false,
    success: "Un livrable relu, avec preuve, sans envoi externe.",
    costCapCents: 0,
    lease: "15 minutes",
  };
}

export function rosterView(commands = []) {
  return HQ_ROSTER.map((agent) => {
    const owned = commands.filter((command) => command.ownerSlug === agent.id);
    const last = owned.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      id: agent.id,
      name: agent.name,
      division: agent.division,
      mission: agent.mission,
      productUrl: agent.productUrl,
      grokAgentName: agent.grokAgentName,
      covers: agent.covers,
      ...officeProfile(agent),
      workload: owned.filter((command) => OPEN_COMMANDS.has(command.status)).length,
      lastActivity: last?.updatedAt || last?.createdAt || null,
      lastCommand: last ? { id: last.id, status: last.status, createdAt: last.createdAt, updatedAt: last.updatedAt || last.createdAt } : null,
    };
  });
}
