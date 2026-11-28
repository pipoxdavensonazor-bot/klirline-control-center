// Dossiers de démonstration. Ce n'est pas un second CRM : KlirProspect reste la source des fiches réelles.
// Lot 2 (revue KCO-2026-REVUE-P1, question 5) : chaque dossier appartient à une organisation.
// Une organisation ne voit que son catalogue (avant : catalogue commun à toutes). Aucune donnée
// réelle tant que ce cloisonnement n'est pas validé en production.
export const DEMO_ORG = "klirline";
export const DEMO_CLIENTS = [
  {
    id: "cli-atelier-nord",
    orgId: DEMO_ORG,
    name: "Atelier Nord",
    source: "demonstration",
    state: "hypothesis",
    need: "Trouver des donneurs d'ordre pour des chantiers locaux.",
    product: "klirprospect",
    services: ["fiches", "préparation de démonstrations"],
    ownerId: "sales-director",
    readers: ["ceo", "chief-of-staff", "coo", "sales-director", "prospecting", "marketing-director"],
    confidential: false,
    contacts: [{ name: "Personne fictive", email: null, phone: null }],
    history: [],
    billingRef: null,
    nextAction: "Préparer le dossier de campagne. Ne pas contacter.",
    dueAt: null,
  },
  {
    id: "cli-reserve",
    orgId: DEMO_ORG,
    name: "Dossier réservé",
    source: "demonstration",
    state: "confidential",
    need: "Exemple d'isolation. Aucun contenu client réel.",
    product: "klirprospect",
    services: [],
    ownerId: "sales-director",
    readers: ["ceo", "sales-director"],
    confidential: true,
    contacts: [],
    history: [],
    billingRef: null,
    nextAction: null,
    dueAt: null,
  },
];

export function canReadClient(actorId, client) {
  if (!client) return false;
  return Array.isArray(client.readers) && client.readers.includes(actorId);
}

// orgId absent (dépôts locaux de test, pilote du banc) : organisation de démonstration. Le Worker
// passe toujours identity.orgId.
export function clientCatalog(orgId) {
  const org = orgId ?? DEMO_ORG;
  return DEMO_CLIENTS.filter((client) => client.orgId === org);
}

export function visibleClients(actorId, orgId) {
  return clientCatalog(orgId).filter((client) => canReadClient(actorId, client)).map(presentClient);
}

export function visibleClient(actorId, id, orgId) {
  const client = clientCatalog(orgId).find((item) => item.id === id);
  if (!client || !canReadClient(actorId, client)) return null;
  return presentClient(client);
}

function presentClient(client) {
  return {
    id: client.id,
    name: client.name,
    source: client.source,
    state: client.state,
    need: client.need,
    product: client.product,
    services: client.services,
    ownerId: client.ownerId,
    confidential: client.confidential,
    contacts: client.contacts,
    billingRef: client.billingRef,
    nextAction: client.nextAction,
    dueAt: client.dueAt,
  };
}
