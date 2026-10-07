export const COMPANY = {
  legalName: "Klirline Inc.",
  founder: "Philippe Azor",
  founderTitle: "CEO / Fondateur",
  currency: "CAD",
  priority: "Ventes : transformer les prospects qualifiés en rendez-vous, propositions et clients.",
};

export const PLATFORMS = [
  { id: "klirprospect", name: "KlirProspect", domain: "CRM, prospects, pipeline et scoring" },
  { id: "klirlead", name: "KlirLead", domain: "Génération, campagnes et qualification de leads" },
  { id: "klirline-os", name: "Klirline OS", domain: "CRM, ERP, automatisation et modules IA" },
  { id: "klirbuild", name: "KlirBuild", domain: "Construction, estimation, projets et suivi de chantier" },
  { id: "klirpay", name: "KlirPay", domain: "Paiements, transactions, facturation et risques" },
  { id: "klirmarket", name: "KlirMarket", domain: "Vendeurs, acheteurs, commandes et marketplace" },
  { id: "klirsecure", name: "KlirSecure", domain: "Audits, vulnérabilités, rapports et risques" },
  { id: "centia", name: "Centia", domain: "Services et opérations de la ligne Centia" },
];

export const THRESHOLDS = {
  paymentCeoCad: 500,
  contractCeoCad: 2500,
  discountCeoPercent: 10,
  adBudgetCeoCad: 1000,
  maxEmailTouches: 4,
};

export const SCORE_WEIGHTS = {
  base: 35,
  fitHigh: 18,
  fitMedium: 10,
  decisionMaker: 15,
  email: 8,
  phone: 6,
  budget: 8,
  urgency: 4,
  inbound: 5,
  replied: 7,
};

export const LEVEL = {
  AUTO: 1,
  SUPERVISOR: 2,
  CEO: 3,
};

export function money(amount) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function platformName(id) {
  return PLATFORMS.find((item) => item.id === id)?.name ?? id;
}
