import { SCORE_WEIGHTS as W, platformName } from "./policy.js";

export function seedWorld() {
  const prospects = [
    {
      id: "p-abc",
      company: "Construction ABC",
      contact: "Marc Béland",
      role: "Président",
      email: "marc.beland@construction-abc.example",
      phone: "+1-514-555-0101",
      domain: "construction-abc.example",
      industry: "Construction",
      product: "klirbuild",
      fit: "high",
      decisionMaker: true,
      budget: true,
      urgency: true,
      inbound: false,
      replied: false,
      consent: "existing_relationship",
      consentLabel: "Demande de proposition déjà reçue",
      touches: 1,
      proposalAmount: 4500,
      need: "Suivre les chantiers et les estimations de trois équipes",
    },
    {
      id: "p-horizon",
      company: "Groupe Horizon Santé",
      contact: "Jean-Pierre Morel",
      role: "Directeur des opérations",
      email: "jp.morel@horizon-sante.example",
      phone: "+1-514-555-0102",
      domain: "horizon-sante.example",
      industry: "Santé",
      product: "klirline-os",
      fit: "high",
      decisionMaker: true,
      budget: false,
      urgency: true,
      inbound: true,
      replied: false,
      consent: "inquired",
      consentLabel: "A demandé une démonstration",
      touches: 1,
      demoAt: "aujourd'hui, 14 h",
      need: "Relier le suivi commercial et les opérations dans un seul outil",
    },
    {
      id: "p-banque",
      company: "Banque des Laurentides",
      contact: "Sophie Tremblay",
      role: "Cheffe de la sécurité",
      email: "sophie.tremblay@banque-laurentides.example",
      phone: "+1-514-555-0103",
      domain: "banque-laurentides.example",
      industry: "Finance",
      product: "klirsecure",
      fit: "high",
      decisionMaker: true,
      budget: false,
      urgency: false,
      inbound: true,
      replied: false,
      consent: "none",
      consentLabel: "Aucune base d'appel enregistrée",
      touches: 0,
      need: "Produire des constats de sécurité sans disperser les rapports",
    },
    {
      id: "p-atlas",
      company: "Marché Atlas",
      contact: "David Okonkwo",
      role: "Directeur général",
      email: "david.okonkwo@marche-atlas.example",
      phone: "",
      domain: "marche-atlas.example",
      industry: "Commerce",
      product: "klirpay",
      fit: "high",
      decisionMaker: true,
      budget: false,
      urgency: false,
      inbound: false,
      replied: true,
      consent: "existing_relationship",
      consentLabel: "A répondu à un premier échange",
      touches: 1,
      proposalAmount: 1800,
      need: "Encaisser les vendeurs du marché avec un suivi des écarts",
    },
    {
      id: "p-clinique",
      company: "Clinique du Parc",
      contact: "Dre Anne Gagnon",
      role: "Gestionnaire",
      email: "anne.gagnon@clinique-parc.example",
      phone: "+1-514-555-0105",
      domain: "clinique-parc.example",
      industry: "Santé",
      product: "klirprospect",
      fit: "medium",
      decisionMaker: true,
      budget: false,
      urgency: false,
      inbound: false,
      replied: true,
      consent: "existing_relationship",
      consentLabel: "A répondu au premier courriel",
      touches: 1,
      need: "Remettre de l'ordre dans les prospects de la clinique",
    },
    {
      id: "p-clinique-doublon",
      company: "Clinique Du Parc",
      contact: "",
      role: "",
      email: "info@clinique-parc.example",
      phone: "",
      domain: "clinique-parc.example",
      industry: "Santé",
      product: "klirprospect",
      fit: "medium",
      decisionMaker: false,
      budget: false,
      urgency: false,
      inbound: false,
      replied: false,
      consent: "none",
      consentLabel: "Doublon",
      touches: 0,
      duplicateOf: "p-clinique",
      need: "",
    },
  ];

  return {
    version: 1,
    demonstration: true,
    prospects,
    clients: [
      {
        id: "c-belanger",
        company: "Construction Bélanger",
        contact: "Alain Bélanger",
        email: "alain@belanger-construction.example",
        product: "klirbuild",
        health: "onboarding",
        onboardingDay: 3,
        usageDrop: 0,
        signals: [],
      },
      {
        id: "c-studio",
        company: "Studio Lumière",
        contact: "Léa Martin",
        email: "lea.martin@studio-lumiere.example",
        product: "klirline-os",
        health: "good",
        onboardingDay: null,
        usageDrop: 0,
        signals: [],
      },
      {
        id: "c-cafe",
        company: "Café Rivière",
        contact: "Nadia Pierre",
        email: "nadia.pierre@cafe-riviere.example",
        product: "klirpay",
        health: "at-risk",
        onboardingDay: null,
        usageDrop: 0.4,
        signals: ["usage", "invoice"],
      },
    ],
    invoices: [
      { id: "inv-cafe", clientId: "c-cafe", amount: 320, ageDays: 47, status: "open", product: "klirpay" },
      { id: "inv-studio", clientId: "c-studio", amount: 890, ageDays: 12, status: "open", product: "klirline-os" },
    ],
    finance: {
      source: "Jeu de démonstration du MVP — pas un état comptable réel",
      monthRevenue: 18400,
      monthExpenses: 6200,
      klirpayTransactional: 2400,
      margins: { klirbuild: 0.32, "klirline-os": 0.71 },
      expense: {
        label: "Données commerciales pour la prospection",
        amount: 850,
        vendor: "Fournisseur de fiches",
      },
      refund: {
        clientId: "c-cafe",
        amount: 1200,
        reason: "Demandé par un nouveau contact, hors de l'historique habituel du café.",
        anomaly: true,
      },
    },
    partnership: {
      name: "Partenariat XYZ",
      product: "klirpay",
      summary: "Distribuer KlirPay dans le réseau de commerçants XYZ.",
    },
    campaign: {
      product: "klirbuild",
      channel: "LinkedIn",
      budget: 2400,
      days: 14,
      stopRule: "Arrêt si aucune demande qualifiée après 7 jours.",
    },
    tickets: [
      {
        id: "ticket-export",
        platform: "klirline-os",
        clientId: "c-studio",
        severity: "high",
        title: "Export comptable incomplet",
      },
      {
        id: "ticket-invite",
        platform: "klirline-os",
        clientId: "c-studio",
        severity: "low",
        title: "Invitation d'utilisateur en attente",
      },
    ],
    platforms: [
      { id: "klirprospect", status: "operational", note: "Pipeline local chargé." },
      { id: "klirlead", status: "operational", note: "Aucune campagne payante active." },
      { id: "klirline-os", status: "degraded", note: "Export comptable incomplet pour Studio Lumière." },
      { id: "klirbuild", status: "operational", note: "Accueil Bélanger au jour 3." },
      { id: "klirpay", status: "operational", note: "Demande de remboursement inhabituelle à geler." },
      { id: "klirmarket", status: "operational", note: "Aucune commande litigieuse dans l'état local." },
      { id: "klirsecure", status: "operational", note: "Aucun audit ouvert dans l'état local." },
      { id: "centia", status: "operational", note: "Aucune livraison enregistrée aujourd'hui. Offre détaillée encore à fixer par le CEO." },
    ],
  };
}

export function scoreProspect(prospect) {
  if (prospect.duplicateOf) return null;
  let score = W.base;
  const reasons = [`Base ${W.base}`];
  const add = (condition, points, label) => {
    if (!condition) return;
    score += points;
    reasons.push(`${label} +${points}`);
  };
  add(prospect.fit === "high", W.fitHigh, "Adéquation forte");
  add(prospect.fit === "medium", W.fitMedium, "Adéquation moyenne");
  add(prospect.decisionMaker, W.decisionMaker, "Décideur nommé");
  add(Boolean(prospect.email), W.email, "Courriel connu");
  add(Boolean(prospect.phone), W.phone, "Téléphone connu");
  add(prospect.budget, W.budget, "Budget évoqué");
  add(prospect.urgency, W.urgency, "Urgence");
  add(prospect.inbound, W.inbound, "Demande entrante");
  add(prospect.replied, W.replied, "A déjà répondu");
  return { score, reasons };
}

const CALL_OK = new Set(["existing_relationship", "inquired", "customer"]);

export function nextActionFor(prospect, score) {
  if (prospect.duplicateOf) return "Fusionner le doublon";
  if (prospect.touches >= 4) return "Arrêter la séquence";
  if (prospect.demoAt) return "Démo";
  if (prospect.phone && CALL_OK.has(prospect.consent) && score >= 90) return "Appeler";
  if (prospect.proposalAmount && !prospect.phone) return "Proposition";
  if (prospect.email) return "Courriel";
  return "Compléter la fiche";
}

export function activeProspects(prospects) {
  return prospects
    .filter((prospect) => !prospect.duplicateOf)
    .map((prospect) => {
      const scored = scoreProspect(prospect);
      return { ...prospect, score: scored.score, reasons: scored.reasons, action: nextActionFor(prospect, scored.score) };
    })
    .sort((a, b) => b.score - a.score);
}

export function productLabel(id) {
  return platformName(id);
}

export { CALL_OK };
