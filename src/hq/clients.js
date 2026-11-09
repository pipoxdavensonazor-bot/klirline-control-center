// Dossiers de démonstration. Ce n'est pas un second CRM : KlirProspect reste la source des fiches réelles.
export const DEMO_CLIENTS = [
  {
    id: "cli-atelier-nord",
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

export function visibleClients(actorId) {
  return DEMO_CLIENTS.filter((client) => canReadClient(actorId, client)).map(presentClient);
}

export function visibleClient(actorId, id) {
  const client = DEMO_CLIENTS.find((item) => item.id === id);
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
