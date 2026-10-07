import { getAgent } from "./org/index.js";
import { THRESHOLDS, money, platformName } from "./policy.js";
import { CALL_OK, activeProspects } from "./seed.js";

function stamp() {
  return new Date().toISOString();
}

function builder() {
  let n = 1;
  const tasks = [];
  const add = (input) => {
    const security = input.security ?? { state: "clear", by: null, reason: "", hard: false };
    let status = input.status;
    if (!status) {
      if (security.state === "blocked") status = "blocked";
      else if (input.level === 1) status = "done";
      else status = "pending_supervisor";
    }
    const task = {
      id: `t-${String(n).padStart(3, "0")}`,
      createdAt: stamp(),
      approvals: [],
      action: null,
      artifact: null,
      security,
      ...input,
      status,
    };
    n += 1;
    tasks.push(task);
    return task;
  };
  return { add, tasks: () => tasks };
}

function emailArtifact(prospect, mode) {
  const product = platformName(prospect.product);
  const followUp = mode === "followup";
  const subject = followUp ? `${product} — suite à votre réponse` : `${product} — une question pour ${prospect.company}`;
  const opening = followUp
    ? `Je reviens vers vous à propos de ${product}. Vous aviez déjà répondu à Klirline Inc.`
    : `Je vous écris de la part de Klirline Inc. au sujet de ${product}.`;
  const body = [
    `Bonjour ${prospect.contact},`,
    "",
    opening,
    prospect.need ? `Nous avons noté ceci : ${prospect.need}.` : "",
    "",
    "Est-ce qu'un échange de vingt minutes cette semaine vous convient ?",
    "",
    "Klirline Inc.",
    "Équipe commerciale",
    "Message préparé par l'agent relance. Il ne part qu'après validation de la directrice commerciale.",
    "Pour ne plus recevoir de relance, répondez STOP.",
  ]
    .filter((line) => line !== "")
    .join("\n");
  return {
    kind: "email",
    to: prospect.email,
    subject,
    body,
    touchesAfterSend: prospect.touches + 1,
    checks: ["Identification Klirline", "Droit de retrait", `Touche ${prospect.touches + 1} sur ${THRESHOLDS.maxEmailTouches}`],
  };
}

function callArtifact(prospect, blockedReason) {
  const product = platformName(prospect.product);
  return {
    kind: "call",
    to: prospect.phone || "Numéro absent",
    consent: prospect.consentLabel,
    blockedReason,
    script: [
      `Bonjour ${prospect.contact}, ici l'équipe commerciale de Klirline Inc.`,
      `Je vous appelle au sujet de ${product}. ${prospect.consentLabel}.`,
      "Est-ce un moment acceptable pour une minute ?",
      `1. Où perdez-vous le plus de temps aujourd'hui sur : ${prospect.need} ?`,
      "2. Qui décide avec vous ?",
      "3. Quel délai serait utile ?",
      "Si la personne accepte une suite : proposer une démo, puis transmettre à l'agent rendez-vous.",
      "Si elle refuse : remercier, noter le refus, ne plus relancer sans nouvelle instruction.",
    ],
  };
}

export function buildDay(world) {
  const box = builder();
  const ranked = activeProspects(world.prospects);
  const byCompany = Object.fromEntries(ranked.map((prospect) => [prospect.id, prospect]));
  const client = (id) => world.clients.find((item) => item.id === id);
  const duplicates = world.prospects.filter((prospect) => prospect.duplicateOf);

  box.add({
    ownerId: "prospecting",
    supervisorId: "sales-director",
    department: "sales",
    level: 1,
    title: "Classement des prospects du jour",
    summary: `${ranked.length} fiches actives, ${duplicates.length} doublon fusionné.`,
    recommendation: "Traiter d'abord Construction ABC, Groupe Horizon Santé, puis la Banque des Laurentides par courriel seulement.",
    artifact: {
      kind: "ranking",
      merged: duplicates.map((item) => `${item.company} fusionné avec ${item.domain}`),
      rows: ranked.map((prospect) => ({
        company: prospect.company,
        product: platformName(prospect.product),
        score: prospect.score,
        action: prospect.action,
        reasons: prospect.reasons,
      })),
    },
  });

  const abc = byCompany["p-abc"];
  const horizon = byCompany["p-horizon"];
  const banque = byCompany["p-banque"];
  const atlas = byCompany["p-atlas"];
  const clinique = byCompany["p-clinique"];

  box.add({
    ownerId: "outreach",
    supervisorId: "sales-director",
    department: "sales",
    level: 2,
    title: `Appeler ${abc.company}`,
    summary: `Score ${abc.score}. Base d'appel enregistrée : ${abc.consentLabel}.`,
    recommendation: "La directrice commerciale valide la feuille, puis l'agent consigne l'appel. Le numéro n'est pas composé par le logiciel.",
    artifact: callArtifact(abc, null),
    action: { type: "release_call", prospectId: abc.id },
  });

  box.add({
    ownerId: "outreach",
    supervisorId: "sales-director",
    department: "sales",
    level: 2,
    title: `Courriel de suivi — ${clinique.company}`,
    summary: "Deuxième touche. La clinique a déjà répondu. La séquence autorise cette relance.",
    recommendation: "Approuver l'envoi dans le journal local.",
    artifact: emailArtifact(clinique, "followup"),
    action: { type: "send_email", prospectId: clinique.id },
  });

  box.add({
    ownerId: "outreach",
    supervisorId: "sales-director",
    department: "sales",
    level: 2,
    title: `Premier courriel — ${banque.company}`,
    summary: "Pas d'appel : aucune base enregistrée. Le courriel reste possible après validation.",
    recommendation: "Approuver le premier contact écrit, pas le téléphone.",
    artifact: emailArtifact(banque, "first"),
    action: { type: "send_email", prospectId: banque.id },
  });

  box.add({
    ownerId: "outreach",
    supervisorId: "sales-director",
    department: "sales",
    level: 2,
    title: `Appel bloqué — ${banque.company}`,
    summary: "La fiche a un numéro, mais aucune base d'appel. La conformité gèle la composition.",
    recommendation: "Ne pas appeler. Continuer par le courriel si la directrice commerciale l'approuve.",
    artifact: callArtifact(banque, "Aucune base d'appel enregistrée sur la fiche."),
    action: { type: "release_call", prospectId: banque.id },
    security: {
      state: "blocked",
      by: "compliance",
      reason: "Appel impossible sans base enregistrée (relation, demande entrante ou client).",
      hard: true,
    },
  });

  box.add({
    ownerId: "appointments",
    supervisorId: "sales-director",
    department: "sales",
    level: 1,
    title: `Brief de démo — ${horizon.company}`,
    summary: `${horizon.demoAt}, ${platformName(horizon.product)}, score ${horizon.score}.`,
    recommendation: "Tenir la démo avec le décideur nommé. Ne pas élargir le périmètre pendant l'appel.",
    artifact: {
      kind: "note",
      text: [
        `Horaire : ${horizon.demoAt}`,
        `Contact : ${horizon.contact}, ${horizon.role}`,
        `Besoin noté : ${horizon.need}`,
        "Questions : qui utilisera l'outil, quel export manque aujourd'hui, quel délai de décision.",
        "Interdit : promettre un module qui n'est pas dans la fiche Klirline OS.",
      ].join("\n"),
    },
  });

  box.add({
    ownerId: "appointments",
    supervisorId: "sales-director",
    department: "sales",
    level: 2,
    title: `Confirmation de démo — ${horizon.company}`,
    summary: "Le rappel écrit part seulement après la directrice commerciale.",
    recommendation: "Approuver la confirmation.",
    artifact: {
      kind: "email",
      to: horizon.email,
      subject: `Confirmation — démonstration ${platformName(horizon.product)}`,
      body: [
        `Bonjour ${horizon.contact},`,
        "",
        `Klirline Inc. confirme la démonstration de ${platformName(horizon.product)} ${horizon.demoAt}.`,
        "Vous pourrez déplacer ce rendez-vous en répondant à ce message.",
        "",
        "Klirline Inc.",
        "Pour ne plus être contacté, répondez STOP.",
      ].join("\n"),
      checks: ["Identification Klirline", "Horaire explicite", "Droit de retrait"],
    },
    action: { type: "send_email", prospectId: horizon.id },
  });

  box.add({
    ownerId: "proposals",
    supervisorId: "sales-director",
    department: "sales",
    level: 3,
    title: `Proposition ${abc.company} — ${money(abc.proposalAmount)}`,
    summary: "Le montant atteint le seuil contrat. La directrice commerciale recommande, le CEO signe.",
    recommendation: "Recommander la signature. Ne pas envoyer l'offre avant le CEO.",
    artifact: {
      kind: "proposal",
      client: abc.company,
      contact: abc.contact,
      product: platformName(abc.product),
      amount: abc.proposalAmount,
      scope: [
        "Mise en place du suivi de chantier",
        "Estimations pour trois équipes",
        "Accompagnement pendant 90 jours",
      ],
      exclusions: ["Développement spécifique non décrit", "Campagne publicitaire", "Mouvement d'argent KlirPay"],
      source: "Barème de travail du MVP, à confirmer par le CEO avant usage réel.",
    },
    action: { type: "commit_proposal", prospectId: abc.id, amount: abc.proposalAmount },
  });

  box.add({
    ownerId: "proposals",
    supervisorId: "sales-director",
    department: "sales",
    level: 2,
    title: `Proposition ${atlas.company} — ${money(atlas.proposalAmount)}`,
    summary: "Sous le seuil CEO. La directrice commerciale peut l'approuver.",
    recommendation: "Approuver si le périmètre KlirPay correspond au besoin noté.",
    artifact: {
      kind: "proposal",
      client: atlas.company,
      contact: atlas.contact,
      product: platformName(atlas.product),
      amount: atlas.proposalAmount,
      scope: ["Paramétrage des encaissements vendeurs", "Suivi des écarts pendant 60 jours"],
      exclusions: ["Partenariat de distribution", "Remise"],
      source: "Barème de travail du MVP.",
    },
    action: { type: "commit_proposal", prospectId: atlas.id, amount: atlas.proposalAmount },
  });

  box.add({
    ownerId: "content",
    supervisorId: "marketing-director",
    department: "marketing",
    level: 2,
    title: "Texte LinkedIn — suivi de chantier",
    summary: "Brouillon prêt. Publication soumise à la directrice marketing.",
    recommendation: "Publier seulement après validation. Aucun chiffre de performance inventé.",
    artifact: {
      kind: "content",
      channel: "LinkedIn",
      body: [
        "Trois équipes sur un chantier n'ont pas besoin d'un autre tableur.",
        "KlirBuild sert à suivre l'estimation et l'avancement au même endroit.",
        "Si vous dirigez une entreprise de construction, une démonstration de vingt minutes suffit pour voir si l'outil correspond.",
        "Klirline Inc.",
      ].join("\n\n"),
    },
    action: { type: "publish_content" },
  });

  box.add({
    ownerId: "seo",
    supervisorId: "marketing-director",
    department: "marketing",
    level: 1,
    title: "Carte de requêtes par produit",
    summary: "Brief interne, sans promesse de position.",
    recommendation: "Faire rédiger par l'agent contenu une page par produit prioritaire : KlirBuild, puis Klirline OS.",
    artifact: {
      kind: "note",
      text: [
        "KlirBuild — suivi de chantier, estimation construction",
        "Klirline OS — CRM et opérations dans le même outil",
        "KlirPay — encaissement et écarts",
        "KlirSecure — rapports de constats",
        "Aucune recommandation d'achat de liens.",
      ].join("\n"),
    },
  });

  box.add({
    ownerId: "advertising",
    supervisorId: "marketing-director",
    department: "marketing",
    level: 3,
    title: `Campagne LinkedIn KlirBuild — ${money(world.campaign.budget)}`,
    summary: "Le budget dépasse 1 000 $. Recommandation marketing, puis signature CEO.",
    recommendation: "Recommander uniquement avec la règle d'arrêt. Ne pas lancer la dépense.",
    artifact: {
      kind: "campaign",
      ...world.campaign,
      audience: "Dirigeants d'entreprises de construction déjà décrits dans KlirProspect. Pas de liste achetée.",
    },
    action: { type: "launch_campaign", budget: world.campaign.budget },
  });

  for (const platform of world.platforms) {
    const ownerId = `pm-${platform.id}`;
    box.add({
      ownerId,
      supervisorId: "coo",
      department: "operations",
      level: 1,
      title: `Note ${platformName(platform.id)}`,
      summary: platform.note,
      recommendation: platform.status === "degraded" ? "Le COO accuse réception de l'incident dans une tâche séparée." : "Maintenir la veille.",
      artifact: {
        kind: "platform",
        platform: platformName(platform.id),
        status: platform.status,
        note: platform.note,
      },
    });
  }

  box.add({
    ownerId: "pm-klirline-os",
    supervisorId: "coo",
    department: "operations",
    level: 2,
    title: "Incident — export comptable Klirline OS",
    summary: "Studio Lumière est bloqué sur un export. Ce n'est pas encore déclaré résolu.",
    recommendation: "Le COO accuse réception et garde le ticket ouvert.",
    artifact: {
      kind: "note",
      text: "Symptôme : export comptable incomplet.\nClient : Studio Lumière.\nContournement honnête : extraire les pièces déjà complètes, ne pas dire que l'export est rétabli.\nInvitation utilisateur : ticket séparé, gravité basse.",
    },
    action: { type: "ack_incident", ticketId: "ticket-export" },
  });

  box.add({
    ownerId: "pm-klirpay",
    supervisorId: "coo",
    department: "operations",
    level: 3,
    title: "Partenariat XYZ — distribution KlirPay",
    summary: world.partnership.summary,
    recommendation: "Le COO recommande ou refuse. Seul le CEO engage le partenariat.",
    artifact: {
      kind: "note",
      text: `${world.partnership.name}\n${world.partnership.summary}\nCe dossier ne crée pas d'accès technique et ne déplace pas d'argent.`,
    },
    action: { type: "commit_partnership" },
  });

  const cafe = client("c-cafe");
  const studio = client("c-studio");
  const belanger = client("c-belanger");

  box.add({
    ownerId: "onboarding",
    supervisorId: "cs-director",
    department: "customers",
    level: 1,
    title: `Accueil jour ${belanger.onboardingDay} — ${belanger.company}`,
    summary: "Premier geste utile dans KlirBuild : un chantier et une estimation.",
    recommendation: "Vérifier que l'accès est prêt avant d'écrire au client.",
    artifact: {
      kind: "note",
      text: "Jour 1 fait : accès et interlocuteur.\nJour 3 : créer un chantier réel et une estimation.\nJour 7 : revue de vingt minutes.\nAucun mois offert dans ce plan.",
    },
  });

  box.add({
    ownerId: "support",
    supervisorId: "cs-director",
    department: "customers",
    level: 2,
    title: `Réponse ticket — ${studio.company}`,
    summary: "L'export est encore incomplet. La réponse ne doit pas prétendre le contraire.",
    recommendation: "La directrice succès client valide l'envoi.",
    artifact: {
      kind: "email",
      to: studio.email,
      subject: "Export comptable — ce que nous savons",
      body: [
        `Bonjour ${studio.contact},`,
        "",
        "L'export comptable de Klirline OS est encore incomplet. Nous ne le marquons pas comme rétabli.",
        "Vous pouvez utiliser les pièces déjà complètes. Nous revenons vers vous quand l'export l'est vraiment.",
        "",
        "Klirline Inc. — succès client",
      ].join("\n"),
      checks: ["Aucun correctif inventé"],
    },
    action: { type: "send_email", clientId: studio.id },
  });

  box.add({
    ownerId: "account-manager",
    supervisorId: "cs-director",
    department: "customers",
    level: 1,
    title: `Revue de compte — ${studio.company}`,
    summary: "Compte actif, avec un incident ouvert. Pas d'expansion tant que l'export n'est pas rétabli.",
    recommendation: "Tenir la revue après le correctif. Ne pas proposer un second produit cette semaine.",
    artifact: {
      kind: "note",
      text: "Usage : stable dans l'état local.\nFacture ouverte : 890 $ , 12 jours.\nRisque : l'incident d'export, pas un silence client.\nSuite : laisser le support répondre, puis reprendre la revue.",
    },
  });

  box.add({
    ownerId: "retention",
    supervisorId: "cs-director",
    department: "customers",
    level: 1,
    title: `Alerte départ — ${cafe.company}`,
    summary: "Deux signaux : usage en baisse de 40 % et facture de 320 $ ouverte depuis 47 jours.",
    recommendation: "Plan opérationnel d'abord. Le geste commercial est une tâche séparée, soumise au CEO.",
    artifact: {
      kind: "alert",
      client: cafe.company,
      product: platformName(cafe.product),
      signals: ["Usage en baisse de 40 %", "Facture de 320 $ ouverte depuis 47 jours"],
      plan: "Appel du succès client pour comprendre l'usage, en parallèle de la relance de facture tenue par la finance.",
    },
  });

  box.add({
    ownerId: "retention",
    supervisorId: "cs-director",
    department: "customers",
    level: 3,
    title: `Geste commercial — ${cafe.company}`,
    summary: "Un mois offert représente plus de 10 %. La directrice recommande, le CEO décide.",
    recommendation: "Ne recommander le geste que si l'appel montre un blocage d'usage, pas seulement une facture ignorée.",
    artifact: {
      kind: "discount",
      client: cafe.company,
      gesture: "Un mois d'abonnement",
      percent: 15,
      threshold: THRESHOLDS.discountCeoPercent,
    },
    action: { type: "offer_discount", clientId: cafe.id, percent: 15 },
  });

  box.add({
    ownerId: "accounting",
    supervisorId: "finance-director",
    department: "finance",
    level: 1,
    title: "Paquet de pièces du jour",
    summary: world.finance.source,
    recommendation: "Deux factures ouvertes. Aucune ligne ne peut être marquée payée.",
    artifact: {
      kind: "note",
      text: [
        world.finance.source,
        `Revenus du mois (démo) : ${money(world.finance.monthRevenue)}`,
        `Dépenses reconnues (démo) : ${money(world.finance.monthExpenses)}`,
        "Écart : le solde bancaire réel n'est pas connecté.",
      ].join("\n"),
    },
  });

  box.add({
    ownerId: "billing",
    supervisorId: "finance-director",
    department: "finance",
    level: 3,
    title: `Remboursement gelé — ${cafe.company} ${money(world.finance.refund.amount)}`,
    summary: world.finance.refund.reason,
    recommendation: "Ne pas recommander. La sécurité doit d'abord conclure.",
    artifact: {
      kind: "payment",
      amount: world.finance.refund.amount,
      beneficiary: cafe.company,
      reason: world.finance.refund.reason,
    },
    action: { type: "payment_order", amount: world.finance.refund.amount, anomaly: true, label: "Remboursement Café Rivière" },
    security: {
      state: "blocked",
      by: "security-director",
      reason: "Remboursement hors profil : nouveau contact et montant inhabituel. Gel avant la signature du CEO.",
      hard: false,
    },
  });

  const cafeInvoice = world.invoices.find((item) => item.id === "inv-cafe");
  box.add({
    ownerId: "collections",
    supervisorId: "finance-director",
    department: "finance",
    level: 2,
    title: `Relance facture — ${cafe.company} ${money(cafeInvoice.amount)}`,
    summary: `Facture ouverte depuis ${cafeInvoice.ageDays} jours. Le client est aussi en alerte de départ.`,
    recommendation: "Approuver une relance correcte, sans menace, coordonnée avec le succès client.",
    artifact: {
      kind: "email",
      to: cafe.email,
      subject: `Facture ouverte — ${money(cafeInvoice.amount)}`,
      body: [
        `Bonjour ${cafe.contact},`,
        "",
        `La facture KlirPay de ${money(cafeInvoice.amount)} est ouverte depuis ${cafeInvoice.ageDays} jours.`,
        "Dites-nous si un obstacle empêche le règlement. Ce message n'est pas une mise en demeure.",
        "",
        "Klirline Inc. — finance",
        "Pour ne plus recevoir ce type de message sur cette facture, répondez STOP.",
      ].join("\n"),
      checks: ["Aucune menace", "Montant exact", "Coordination rétention"],
    },
    action: { type: "send_email", clientId: cafe.id },
  });

  box.add({
    ownerId: "financial-analyst",
    supervisorId: "finance-director",
    department: "finance",
    level: 1,
    title: "Marges de démonstration par produit",
    summary: "KlirBuild 32 %, Klirline OS 71 %, KlirPay en revenus transactionnels. Source : jeu de démonstration.",
    recommendation: "Ne pas fixer un prix réel sur ces marges. Les remplacer par la comptabilité quand elle sera branchée.",
    artifact: {
      kind: "note",
      text: [
        world.finance.source,
        "KlirBuild : marge de travail 32 %.",
        "Klirline OS : marge de travail 71 %.",
        `KlirPay : ${money(world.finance.klirpayTransactional)} de revenus transactionnels de démonstration, pas une marge.`,
        "CAC non calculé : les dépenses marketing ne sont pas encore des pièces reliées à des clients.",
      ].join("\n"),
    },
  });

  box.add({
    ownerId: "cashflow",
    supervisorId: "finance-director",
    department: "finance",
    level: 3,
    title: `Dépense à signer — ${money(world.finance.expense.amount)}`,
    summary: `${world.finance.expense.label} (${world.finance.expense.vendor}). Seuil CEO : ${money(THRESHOLDS.paymentCeoCad)}.`,
    recommendation: "La directrice finance vérifie le fournisseur, puis le CEO signe. Aucun virement n'est émis par l'agent.",
    artifact: {
      kind: "payment",
      amount: world.finance.expense.amount,
      beneficiary: world.finance.expense.vendor,
      reason: world.finance.expense.label,
    },
    action: {
      type: "payment_order",
      amount: world.finance.expense.amount,
      anomaly: false,
      label: world.finance.expense.label,
    },
  });

  box.add({
    ownerId: "cashflow",
    supervisorId: "finance-director",
    department: "finance",
    level: 1,
    title: "Position de trésorerie locale",
    summary: "Les propositions commerciales ne sont pas des encaissements.",
    recommendation: "Signer ou refuser les sorties en attente. Ne pas compter le pipeline.",
    artifact: {
      kind: "note",
      text: [
        `Facturé ouvert : ${money(world.invoices.reduce((sum, item) => sum + item.amount, 0))}`,
        `Sortie à signer : ${money(world.finance.expense.amount)}`,
        `Sortie gelée : ${money(world.finance.refund.amount)}`,
        "Solde bancaire : non connecté.",
      ].join("\n"),
    },
  });

  box.add({
    ownerId: "compliance",
    supervisorId: "security-director",
    department: "security",
    level: 1,
    title: "Contrôle des communications",
    summary: "Un appel est gelé. Les courriels portent l'identification et le retrait.",
    recommendation: "Maintenir le gel de la Banque des Laurentides tant que la fiche n'a pas de base d'appel.",
    artifact: {
      kind: "note",
      text: "Appel Construction ABC : base enregistrée, validation commerciale encore requise.\nAppel Banque des Laurentides : bloqué.\nPlafond de séquence : 4 touches.\nAucune liste achetée dans le cycle.",
    },
  });

  box.add({
    ownerId: "security-director",
    supervisorId: "ceo",
    department: "security",
    level: 1,
    title: "Revue sécurité du jour",
    summary: "Remboursement Café Rivière gelé. Aucun accès sensible demandé.",
    recommendation: "Le CEO voit le gel. Il ne le lève pas. Seul le directeur sécurité peut le lever après examen.",
    artifact: {
      kind: "note",
      text: "Gel : remboursement 1 200 $ , nouveau contact, hors historique.\nLecture des plateformes : ouverte à tous les agents via le centre.\nÉcriture : limitée au poste.\nJournal : chaque validation restera dans l'audit.",
    },
  });

  box.add({
    ownerId: "analytics",
    supervisorId: "chief-of-staff",
    department: "direction",
    level: 1,
    title: "Indicateurs sourcés",
    summary: `${ranked.length} prospects scorés, 1 plateforme dégradée, 1 client à deux signaux de départ.`,
    recommendation: "Garder la priorité ventes. Ne pas ouvrir de nouveau chantier d'agents.",
    artifact: {
      kind: "note",
      text: [
        `Prospects actifs : ${ranked.length}`,
        `Meilleur score : ${ranked[0].company} ${ranked[0].score}`,
        "Source des marges : jeu de démonstration.",
        "Source pipeline : CRM local.",
      ].join("\n"),
    },
  });

  const tasks = box.tasks();
  const plans = [
    ["sales-director", "sales", "Plan commercial du jour", "Prospection, deux suivis écrits, un appel autorisable, un appel gelé, une démo, deux propositions."],
    ["marketing-director", "marketing", "Plan marketing du jour", "Un texte à valider, une carte SEO, une campagne qui attend le CEO."],
    ["coo", "operations", "Plan d'exploitation du jour", "Huit notes produit, un incident Klirline OS, un partenariat à recommander."],
    ["cs-director", "customers", "Plan clients du jour", "Accueil Bélanger, réponse Studio Lumière, alerte Café Rivière."],
    ["finance-director", "finance", "Plan finance du jour", "Pièces, relance 320 $, dépense 850 $ à recommander, remboursement gelé."],
  ];
  for (const [ownerId, department, title, summary] of plans) {
    box.add({
      ownerId,
      supervisorId: getAgent(ownerId).reportsTo,
      department,
      level: 1,
      title,
      summary,
      recommendation: "Les agents exécutent après le niveau de validation indiqué sur chaque tâche.",
      artifact: {
        kind: "worklist",
        items: tasks.filter((task) => task.department === department && task.ownerId !== ownerId).map((task) => task.title),
      },
    });
  }

  return box.tasks();
}

export function briefing(state) {
  const ranked = activeProspects(state.prospects);
  const ready = state.tasks.filter((task) => task.status === "pending_ceo");
  const waiting = state.tasks.filter((task) => task.level === 3 && task.status === "pending_supervisor");
  const blocked = state.tasks.filter((task) => task.status === "blocked");
  const degraded = state.platforms.filter((platform) => platform.status !== "operational");
  const atRisk = state.clients.filter((client) => client.signals.length >= 2);
  const demos = ranked.filter((prospect) => prospect.demoAt);
  return {
    priority: "Ventes",
    sales: {
      prospects: ranked.length,
      priority: ranked.slice(0, 4).map((prospect) => ({
        company: prospect.company,
        product: platformName(prospect.product),
        score: prospect.score,
        action: prospect.action,
      })),
      demos: demos.map((prospect) => `${prospect.company} — ${prospect.demoAt}`),
    },
    finance: {
      source: state.finance.source,
      revenue: state.finance.monthRevenue,
      expenses: state.finance.monthExpenses,
      receivables: state.invoices.filter((item) => item.status === "open").reduce((sum, item) => sum + item.amount, 0),
    },
    operations: {
      degraded: degraded.map((platform) => `${platformName(platform.id)} : ${platform.note}`),
      urgentTasks: state.tasks.filter((task) => task.level > 1 && task.department === "operations" && !["done", "rejected", "executed"].includes(task.status)).length,
    },
    customers: atRisk.map((client) => `${client.company} — ${client.signals.length} signaux`),
    decisionsReady: ready.map(decisionLine),
    decisionsWaiting: waiting.map(decisionLine),
    blocked: blocked.map((task) => ({ id: task.id, title: task.title, reason: task.security.reason })),
    results: state.tasks.filter((task) => task.status === "executed").map((task) => task.title),
  };
}

function decisionLine(task) {
  return { id: task.id, title: task.title, ownerId: task.ownerId, supervisorId: task.supervisorId, status: task.status };
}

function findTask(state, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) {
    const error = new Error("Tâche introuvable");
    error.status = 404;
    throw error;
  }
  return task;
}

function audit(state, actorId, action, detail, taskId) {
  state.audit.unshift({ at: stamp(), actorId, action, detail, taskId: taskId ?? null });
}

export function actionsFor(actorId, task) {
  if (!actorId || !task) return [];
  const actions = [];
  if (task.security.state !== "blocked" && task.status === "pending_supervisor" && actorId === task.supervisorId) {
    actions.push(task.level === 3 ? "recommend" : "approve", "reject");
  }
  if (task.security.state !== "blocked" && task.status === "pending_ceo" && actorId === "ceo") {
    actions.push("approve", "reject");
  }
  if (actorId === "security-director" && task.status !== "executed" && task.status !== "rejected") {
    if (task.security.state === "blocked") actions.push("release");
    else if (task.level > 1) actions.push("block");
  }
  if (executionAllowed(actorId, task).ok) actions.push("execute");
  if (task.action?.type === "release_call" && task.status === "executed") actions.push("log_call");
  return actions;
}

function executionAllowed(actorId, task) {
  if (!task.action) return { ok: false, reason: "Rien à exécuter" };
  if (task.status !== "approved") return { ok: false, reason: "La validation n'est pas complète" };
  if (task.security.state === "blocked") return { ok: false, reason: task.security.reason };
  const actorOk = actorId === task.ownerId || actorId === task.supervisorId || actorId === "ceo";
  if (!actorOk) return { ok: false, reason: "Seul l'agent, son supérieur ou le CEO exécute" };
  return { ok: true };
}

export function decide(state, taskId, actorId, decision, note) {
  const task = findTask(state, taskId);
  const cleanNote = String(note ?? "").trim();
  if (task.security.state === "blocked" && decision !== "release") {
    const error = new Error("Action gelée par la sécurité. Seul le directeur sécurité peut lever un gel qui n'est pas une interdiction dure.");
    error.status = 409;
    throw error;
  }
  if (decision === "recommend") {
    if (task.level !== 3 || task.status !== "pending_supervisor" || actorId !== task.supervisorId) {
      const error = new Error("Seul le supérieur direct recommande une décision CEO.");
      error.status = 403;
      throw error;
    }
    task.status = "pending_ceo";
  } else if (decision === "approve") {
    const supervisorOk = task.level === 2 && task.status === "pending_supervisor" && actorId === task.supervisorId;
    const ceoOk = task.level === 3 && task.status === "pending_ceo" && actorId === "ceo";
    if (!supervisorOk && !ceoOk) {
      const error = new Error("Cette approbation n'appartient pas à cette personne, ou le supérieur n'a pas encore recommandé.");
      error.status = 403;
      throw error;
    }
    task.status = "approved";
  } else if (decision === "reject") {
    const supervisorOk = task.status === "pending_supervisor" && actorId === task.supervisorId;
    const ceoOk = task.status === "pending_ceo" && actorId === "ceo";
    if (!supervisorOk && !ceoOk) {
      const error = new Error("Ce refus n'appartient pas à cette personne.");
      error.status = 403;
      throw error;
    }
    if (cleanNote.length < 3) {
      const error = new Error("Un refus exige une raison.");
      error.status = 400;
      throw error;
    }
    task.status = "rejected";
  } else if (decision === "block") {
    if (actorId !== "security-director") {
      const error = new Error("Seul le directeur sécurité bloque.");
      error.status = 403;
      throw error;
    }
    if (cleanNote.length < 3) {
      const error = new Error("Un blocage exige une raison.");
      error.status = 400;
      throw error;
    }
    task.security = { state: "blocked", by: actorId, reason: cleanNote, hard: false, previous: task.status };
    task.status = "blocked";
  } else if (decision === "release") {
    if (actorId !== "security-director" || task.security.state !== "blocked") {
      const error = new Error("Seul le directeur sécurité lève un gel.");
      error.status = 403;
      throw error;
    }
    if (task.security.hard) {
      const error = new Error("Interdiction dure : la base d'appel manque encore. Lever le gel ne rend pas l'appel composable.");
      error.status = 409;
      throw error;
    }
    task.status = task.security.previous || "pending_supervisor";
    task.security = { state: "clear", by: null, reason: "", hard: false };
  } else {
    const error = new Error("Décision inconnue");
    error.status = 400;
    throw error;
  }
  task.approvals.push({ at: stamp(), actorId, decision, note: cleanNote });
  audit(state, actorId, decision, cleanNote || task.title, task.id);
  return task;
}

export function execute(state, taskId, actorId) {
  const task = findTask(state, taskId);
  const allowed = executionAllowed(actorId, task);
  if (!allowed.ok) {
    const error = new Error(allowed.reason);
    error.status = 409;
    throw error;
  }
  const externalBlock = externalGuard(state, task);
  if (externalBlock) {
    const error = new Error(externalBlock);
    error.status = 409;
    throw error;
  }
  const record = {
    at: stamp(),
    taskId: task.id,
    type: task.action.type,
    title: task.title,
    leftTheBuilding: false,
    detail: "",
  };
  if (task.action.type === "send_email") {
    record.detail = "Consigné dans le journal local. Aucun courriel n'a quitté la machine : le connecteur d'envoi n'est pas branché.";
    record.message = task.artifact;
    if (task.action.prospectId) {
      const prospect = state.prospects.find((item) => item.id === task.action.prospectId);
      if (prospect) prospect.touches += 1;
    }
    state.outbox.unshift(record);
  } else if (task.action.type === "release_call") {
    record.detail = "Feuille d'appel remise. Le numéro n'a pas été composé.";
    state.calls.unshift({
      id: `call-${task.id}`,
      taskId: task.id,
      prospectId: task.action.prospectId,
      script: task.artifact.script,
      outcome: null,
    });
    state.outbox.unshift(record);
  } else if (task.action.type === "payment_order") {
    record.detail = "Ordre consigné. Aucun argent n'a été déplacé.";
    state.outbox.unshift(record);
  } else if (task.action.type === "launch_campaign") {
    record.detail = "Plan média consigné. Aucune campagne n'a été lancée chez un régie.";
    state.outbox.unshift(record);
  } else if (task.action.type === "publish_content") {
    record.detail = "Texte consigné comme approuvé. Il n'a pas été publié sur un réseau.";
    state.outbox.unshift(record);
  } else if (task.action.type === "commit_proposal" || task.action.type === "commit_partnership" || task.action.type === "offer_discount" || task.action.type === "ack_incident") {
    record.detail = "Décision consignée dans le dossier local. Aucun effet externe.";
    state.outbox.unshift(record);
  } else {
    const error = new Error("Action inconnue");
    error.status = 400;
    throw error;
  }
  task.status = "executed";
  task.execution = record;
  audit(state, actorId, "execute", record.detail, task.id);
  return task;
}

function externalGuard(state, task) {
  if (task.action.type === "release_call") {
    const prospect = state.prospects.find((item) => item.id === task.action.prospectId);
    if (!prospect || !CALL_OK.has(prospect.consent)) return "Appel refusé : la fiche n'a pas de base enregistrée.";
  }
  if (task.action.type === "send_email") {
    const touches = task.action.prospectId ? state.prospects.find((item) => item.id === task.action.prospectId)?.touches : 0;
    if (touches >= THRESHOLDS.maxEmailTouches) return "Séquence stoppée à 4 touches.";
  }
  return null;
}

export function logCall(state, taskId, actorId, outcome, note) {
  const task = findTask(state, taskId);
  const allowed = ["joignable", "message", "refus", "demo"];
  if (!allowed.includes(outcome)) {
    const error = new Error("Résultat d'appel inconnu");
    error.status = 400;
    throw error;
  }
  const call = state.calls.find((item) => item.taskId === taskId);
  if (!call || task.status !== "executed") {
    const error = new Error("La feuille d'appel n'est pas encore remise.");
    error.status = 409;
    throw error;
  }
  const actorOk = actorId === task.ownerId || actorId === task.supervisorId || actorId === "ceo";
  if (!actorOk) {
    const error = new Error("Seul l'agent relance, sa directrice ou le CEO consigne l'appel.");
    error.status = 403;
    throw error;
  }
  call.outcome = outcome;
  call.note = String(note ?? "").trim();
  call.loggedAt = stamp();
  audit(state, actorId, "log_call", `${outcome} — ${call.note}`, task.id);
  if (outcome === "demo") {
    const prospect = state.prospects.find((item) => item.id === call.prospectId);
    const exists = state.tasks.some((item) => item.handoffFrom === task.id);
    if (prospect && !exists) {
      const created = {
        id: `t-${String(state.tasks.length + 1).padStart(3, "0")}`,
        createdAt: stamp(),
        ownerId: "appointments",
        supervisorId: "sales-director",
        department: "sales",
        level: 2,
        status: "pending_supervisor",
        title: `Nouveau rendez-vous — ${prospect.company}`,
        summary: "Transmis par l'agent relance après l'appel.",
        recommendation: "La directrice commerciale confirme le créneau avant l'envoi.",
        handoffFrom: task.id,
        approvals: [],
        security: { state: "clear", by: null, reason: "", hard: false },
        artifact: {
          kind: "email",
          to: prospect.email,
          subject: `Rendez-vous ${platformName(prospect.product)}`,
          body: `Bonjour ${prospect.contact},\n\nComme convenu au téléphone avec Klirline Inc., nous proposons de fixer la démonstration de ${platformName(prospect.product)}.\n\nKlirline Inc.\nRépondez STOP pour ne plus être contacté.`,
          checks: ["Identification", "Retrait", "Transmis après appel consigné"],
        },
        action: { type: "send_email", prospectId: prospect.id },
      };
      state.tasks.unshift(created);
    }
  }
  return call;
}
