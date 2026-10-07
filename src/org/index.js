import { directionAgents } from "./direction.js";
import { salesAgents } from "./sales.js";
import { marketingAgents } from "./marketing.js";
import { operationsAgents } from "./operations.js";
import { customerAgents } from "./customers.js";
import { financeAgents } from "./finance.js";
import { securityAgents } from "./security.js";

export const DEPARTMENTS = [
  { id: "direction", name: "Direction", lead: "chief-of-staff" },
  { id: "sales", name: "Ventes", lead: "sales-director" },
  { id: "marketing", name: "Marketing", lead: "marketing-director" },
  { id: "operations", name: "Opérations", lead: "coo" },
  { id: "customers", name: "Clients", lead: "cs-director" },
  { id: "finance", name: "Finance", lead: "finance-director" },
  { id: "security", name: "Sécurité et conformité", lead: "security-director" },
];

export const agents = [
  ...directionAgents,
  ...salesAgents,
  ...marketingAgents,
  ...operationsAgents,
  ...customerAgents,
  ...financeAgents,
  ...securityAgents,
];

const byId = new Map(agents.map((agent) => [agent.id, agent]));

export function getAgent(id) {
  const agent = byId.get(id);
  if (!agent) throw new Error(`Agent introuvable : ${id}`);
  return agent;
}

export function assertOrganization() {
  const ids = new Set(agents.map((agent) => agent.id));
  if (ids.size !== agents.length) throw new Error("Identifiants d'agents en double");
  for (const agent of agents) {
    if (agent.id !== "ceo" && !agent.reportsTo) {
      throw new Error(`${agent.id} n'a pas de supérieur`);
    }
    if (agent.reportsTo && !ids.has(agent.reportsTo)) {
      throw new Error(`${agent.id} rend compte à un supérieur inexistant`);
    }
    const seen = new Set();
    let cursor = agent;
    while (cursor.reportsTo) {
      if (seen.has(cursor.id)) throw new Error(`Boucle hiérarchique à ${agent.id}`);
      seen.add(cursor.id);
      cursor = byId.get(cursor.reportsTo);
    }
  }
  const leads = {
    sales: "sales-director",
    marketing: "marketing-director",
    operations: "coo",
    customers: "cs-director",
    finance: "finance-director",
    security: "security-director",
  };
  for (const agent of agents) {
    if (agent.id === "ceo" || agent.id === "chief-of-staff" || agent.id === "analytics") continue;
    if (agent.independent) {
      if (agent.reportsTo !== "ceo") throw new Error(`${agent.id} devrait relever du CEO`);
      continue;
    }
    const lead = leads[agent.department];
    if (!lead) throw new Error(`Département sans directeur : ${agent.department}`);
    if (agent.id !== lead && agent.reportsTo !== lead) {
      throw new Error(`${agent.id} ne rend pas compte au directeur ${lead}`);
    }
  }
}

export function directReports(id) {
  return agents.filter((agent) => agent.reportsTo === id);
}

export function skillDocument(agent) {
  const superior = agent.reportsTo ? getAgent(agent.reportsTo) : null;
  const lines = [
    `# ${agent.name}`,
    ``,
    `**Poste :** ${agent.title}`,
    `**Supérieur :** ${superior ? superior.name : "Aucun — autorité finale"}`,
    `**Mission :** ${agent.mission}`,
    ``,
    `## Doctrine`,
    agent.doctrine,
    ``,
    `## Compétences tenues en local`,
    ...agent.skills.flatMap((skill) => [`### ${skill.name}`, skill.knows, ``]),
    `## Procédure`,
    ...agent.procedures.map((step, index) => `${index + 1}. ${step}`),
    ``,
    `## Hors ligne`,
    ...(agent.offline.length ? agent.offline.map((item) => `- ${item}`) : ["- Lire son rôle et préparer un dossier."]),
    ``,
    `## Exige une connexion`,
    ...(agent.onlineOnly.length ? agent.onlineOnly.map((item) => `- ${item}`) : ["- Aucune action extérieure."]),
    ``,
    `## Interdit`,
    ...agent.forbidden.map((item) => `- ${item}`),
    ``,
    `## Indicateurs`,
    ...agent.kpis.map((item) => `- ${item}`),
    ``,
    `## Voix`,
    agent.style,
    ``,
    `## Lecture des plateformes`,
    `Toutes, via le centre de contrôle. Écriture limitée : ${agent.writePlatforms.length ? agent.writePlatforms.join(", ") : "aucune"}.`,
    ``,
    `## Playbooks`,
    ...(agent.playbooks.length ? agent.playbooks.map((item) => `- ${item}`) : ["- Aucun"]),
  ];
  return lines.join("\n");
}
