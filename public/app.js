const views = [
  ["scope", "Ce centre"],
  ["bureau", "Bureau"],
  ["report", "Rapport du jour"],
  ["queue", "À valider"],
  ["work", "Travaux"],
  ["comms", "Courriel et téléphone"],
  ["platforms", "Plateformes"],
  ["people", "Postes et compétences"],
  ["journal", "Journal"],
];

const statusLabel = {
  done: "Fait",
  pending_supervisor: "Chez le supérieur",
  pending_ceo: "Chez le CEO",
  approved: "Approuvé",
  rejected: "Refusé",
  blocked: "Gelé",
  executed: "Consigné",
};

const levelLabel = { 1: "Niveau 1 · autonome", 2: "Niveau 2 · supérieur", 3: "Niveau 3 · CEO" };
const platformStatusLabel = { operational: "Opérationnel", degraded: "Dégradé", down: "Interrompu" };
const journalKind = {
  cycle: "Préparation",
  recommend: "Décision",
  approve: "Décision",
  reject: "Décision",
  block: "Décision",
  release: "Décision",
  execute: "Simulation",
  log_call: "Simulation",
  command: "Préparation",
  assign: "Préparation",
  draft: "Préparation",
};
const journalAction = {
  cycle: "Journée préparée",
  recommend: "Recommandation",
  approve: "Approbation",
  reject: "Refus",
  block: "Gel",
  release: "Levée du gel",
  execute: "Action consignée",
  log_call: "Compte-rendu d'appel",
  command: "Commande reçue",
  assign: "Ordre transmis",
  draft: "Brouillon déposé",
};
const outcomeLabel = { joignable: "Joignable", message: "Message laissé", refus: "Refus", demo: "Démo acceptée" };
const actionLabel = {
  recommend: "Recommander au CEO",
  approve: "Approuver",
  reject: "Refuser",
  execute: "Consigner l'action",
  block: "Geler",
  release: "Lever le gel",
};

let actorId = sessionStorage.getItem("klirline-actor") || "ceo";
let view = sessionStorage.getItem("klirline-view") || "scope";
let selectedTaskId = null;
let selectedAgentId = "chief-of-staff";
let playbookId = null;
let playbookBody = "";
let state = null;
let error = "";
let note = "";
let liveSites = [];
let hqRoster = [];
let hqCommands = [];
let hqDivision = sessionStorage.getItem("klirline-hq-division") || "Toutes";
let hqError = "";
let hqDraft = "";
let hqOwner = "";
let hqPriority = "normale";
let hqLoad = 0;

const hqStatusLabel = {
  pending: "En attente",
  queued: "En file",
  dispatched: "Transmis",
  running: "En cours",
  awaiting_validation: "À valider",
  done: "Fait",
  blocked: "Bloqué",
  failed: "Échec",
  cancelled: "Annulé",
};
const hqDivisions = ["Toutes", "Ops", "Produits", "Média", "Trading", "Autres"];
const hqRouteLabel = { explicit: "Agent choisi", keyword: "Réparti par mot-clé", triage: "Triage" };
const hqPriorityLabel = { basse: "Basse", normale: "Normale", haute: "Haute" };

const app = document.querySelector("#app");
const money = (value) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const agent = (id) => state.agents.find((item) => item.id === id);
const taskById = (id) => state.tasks.find((item) => item.id === id);

async function load() {
  const response = await fetch(`/api/bootstrap?actor=${encodeURIComponent(actorId)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  state = body;
  if (state.accessMode === "cloudflare-access") actorId = state.actorId;
  if (playbookId) await openPlaybook(playbookId, false);
  render();
  refreshSites();
  if (view === "bureau") refreshHq({ force: true });
  ensureHqPoll();
}

async function refreshSites() {
  try {
    const response = await fetch("/api/sites");
    const body = await response.json();
    if (!response.ok) return;
    liveSites = body.sites || [];
    if (view === "report" || view === "platforms" || view === "scope") render();
  } catch {
    liveSites = [];
  }
}

function siteName(site) {
  return site.name || state.platformCatalog.find((item) => item.id === site.id)?.name || site.id;
}

function siteLabel(site) {
  if (site.status === "online") return "Page joignable";
  if (site.status === "private") return "Console privée";
  if (site.status === "absent") return "Pas d'adresse";
  if (site.status === "unreachable") return "Injoignable";
  return "Réponse inattendue";
}

function siteChip(site) {
  const tone = site.status === "online" ? "done" : site.status === "absent" || site.status === "private" ? "pending_supervisor" : "blocked";
  return chip(tone, siteLabel(site));
}

function healthLabel(site) {
  const health = site.health;
  if (!health) return "";
  if (health.status === "ok") return "Santé en ordre";
  if (health.status === "degraded") return "Santé à revoir";
  if (health.status === "unreachable") return "Santé injoignable";
  return "Santé inattendue";
}

function skillsHtml(site) {
  const skills = site.skills;
  if (!skills) return "";
  if (skills.status !== "ok" || skills.count === null) return `<p>Catalogue injoignable.</p>`;
  return `<p>Catalogue public : ${skills.count} compétences.</p>`;
}

function healthHtml(site) {
  const health = site.health;
  if (!health) return "";
  const rows = (health.checks || []).map((check) => `<div class="row-line"><span>${escapeHtml(check.label || check.name)}</span><span>${check.ok ? "En ordre" : "À revoir"}</span></div>`).join("");
  const whenHealth = health.at ? ` <span class="muted">lue à ${escapeHtml(when(health.at))}</span>` : "";
  return `<p>${escapeHtml(healthLabel(site))}${whenHealth}</p>${rows}`;
}

async function post(url, payload) {
  error = "";
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) {
    error = body.error;
    render();
    return;
  }
  state = body;
  if (state.accessMode === "cloudflare-access") actorId = state.actorId;
  note = "";
  if (url === "/api/command") {
    const created = state.tasks.find((task) => task.origin === "command");
    if (created) selectedTaskId = created.id;
    view = "report";
    sessionStorage.setItem("klirline-view", view);
  }
  render();
}

function inline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(markdown) {
  return markdown.split("\n").map((line) => {
    if (line.startsWith("### ")) return `<h3>${inline(line.slice(4))}</h3>`;
    if (line.startsWith("## ")) return `<h2>${inline(line.slice(3))}</h2>`;
    if (line.startsWith("# ")) return `<h1>${inline(line.slice(2))}</h1>`;
    if (line.startsWith("- ")) return `<li>${inline(line.slice(2))}</li>`;
    if (!line.trim()) return "";
    return `<p>${inline(line)}</p>`;
  }).join("");
}

function chip(className, text) {
  return `<span class="chip ${className}">${escapeHtml(text)}</span>`;
}

function taskButton(task) {
  return `<button data-task="${task.id}">${escapeHtml(task.title)}</button>`;
}

function artifactHtml(task) {
  const artifact = task.artifact;
  if (!artifact) return "";
  if (artifact.kind === "ranking") {
    const rows = artifact.rows.map((row) => `<tr><td>${escapeHtml(row.company)}</td><td>${escapeHtml(row.product)}</td><td>${row.score}</td><td>${escapeHtml(row.action)}</td></tr>`).join("");
    return `<p>${escapeHtml(artifact.merged.join(" · "))}</p><table><thead><tr><th>Prospect</th><th>Produit</th><th>Score</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (artifact.kind === "email" || artifact.kind === "content" || artifact.kind === "letter") {
    return `<p><strong>${escapeHtml(artifact.subject || artifact.channel || "")}</strong> ${artifact.to ? `→ ${escapeHtml(artifact.to)}` : ""}</p><pre>${escapeHtml(artifact.body)}</pre>`;
  }
  if (artifact.kind === "call") {
    return `<p>${escapeHtml(artifact.consent)}</p>${artifact.blockedReason ? `<p class="error">${escapeHtml(artifact.blockedReason)}</p>` : ""}<pre>${escapeHtml(artifact.script.join("\n"))}</pre>`;
  }
  if (artifact.kind === "proposal") {
    return `<p>${escapeHtml(artifact.client)} · ${escapeHtml(artifact.product)} · ${money(artifact.amount)}</p><ul>${artifact.scope.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p class="muted">Exclus : ${escapeHtml(artifact.exclusions.join(", "))}</p><p class="muted">${escapeHtml(artifact.source)}</p>`;
  }
  if (artifact.kind === "payment") return `<p>${money(artifact.amount)} — ${escapeHtml(artifact.beneficiary)}</p><p>${escapeHtml(artifact.reason)}</p>`;
  if (artifact.kind === "alert") return `<p>${escapeHtml(artifact.client)} · ${escapeHtml(artifact.product)}</p><ul>${artifact.signals.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p>${escapeHtml(artifact.plan)}</p>`;
  if (artifact.kind === "discount") return `<p>${escapeHtml(artifact.client)} · ${escapeHtml(artifact.gesture)} · ${artifact.percent} % (seuil CEO ${artifact.threshold} %)</p>`;
  if (artifact.kind === "campaign") return `<p>${escapeHtml(artifact.channel)} · ${money(artifact.budget)} · ${artifact.days} jours</p><p>${escapeHtml(artifact.audience)}</p><p>${escapeHtml(artifact.stopRule)}</p>`;
  if (artifact.kind === "platform") return `<p>${escapeHtml(artifact.platform)} · ${escapeHtml(platformStatusLabel[artifact.status] || artifact.status)}</p><p>${escapeHtml(artifact.note)}</p>`;
  if (artifact.kind === "worklist") return `<ul>${artifact.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  if (artifact.kind === "prospect-search") return prospectSearchHtml(artifact);
  return `<pre>${escapeHtml(artifact.text || "")}</pre>`;
}

function detailHtml(task) {
  if (!task) return `<div class="detail"><h2>Dossier</h2><p class="muted">Choisissez une tâche. Le supérieur voit les siennes. Le CEO ne signe que ce qui lui a été recommandé.</p></div>`;
  const owner = agent(task.ownerId);
  const supervisor = agent(task.supervisorId);
  const buttons = task.actions.map((action) => `<button class="${action === "reject" || action === "block" ? "danger" : ""}" data-decision="${action}">${actionLabel[action] || action}</button>`).join("");
  const outcomes = task.actions.includes("log_call") ? `<div class="actions">${Object.entries(outcomeLabel).map(([item, label]) => `<button class="ghost" data-outcome="${item}">${label}</button>`).join("")}</div>` : "";
  return `<div class="detail">
    <div class="chips">${chip(`l${task.level}`, levelLabel[task.level])}${chip(task.status, statusLabel[task.status])}</div>
    <h2>${escapeHtml(task.title)}</h2>
    <p>${escapeHtml(task.summary)}</p>
    <p><strong>Recommandation.</strong> ${escapeHtml(task.recommendation)}</p>
    <p class="muted">${escapeHtml(owner.name)} → ${escapeHtml(supervisor.name)}</p>
    <p class="voice"><strong>Voix.</strong> ${escapeHtml(owner.style)}</p>
    ${task.security?.state === "blocked" ? `<p class="error">${escapeHtml(task.security.reason)}</p>` : ""}
    ${!task.actions.length && task.status === "pending_supervisor" && task.level === 3 ? `<p class="banner">Dossier chez ${escapeHtml(supervisor.name)}. La signature du CEO s'ouvre après sa recommandation.</p>` : ""}
    ${!task.actions.length && task.status === "pending_supervisor" && task.level < 3 ? `<p class="banner">Le brouillon est sur le bureau. L'envoi attend ${escapeHtml(supervisor.name)}.</p>` : ""}
    ${!task.actions.length && task.status === "pending_ceo" && actorId !== "ceo" ? `<p class="banner">Recommandation faite. La signature appartient à Philippe Azor.</p>` : ""}
    ${artifactHtml(task)}
    ${(task.approvals || []).length ? `<h3>Historique</h3><ul class="history">${task.approvals.map((item) => `<li><span>${escapeHtml(when(item.at))}</span> ${escapeHtml(agent(item.actorId)?.name || item.actorId)} · ${escapeHtml(journalAction[item.decision] || item.decision)}${item.note ? ` — ${escapeHtml(item.note)}` : ""}</li>`).join("")}</ul>` : `<p class="muted">Aucune décision enregistrée sur ce dossier.</p>`}
    <textarea id="note" placeholder="Note de validation">${escapeHtml(note)}</textarea>
    <div class="actions">${buttons}</div>
    ${outcomes}
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  </div>`;
}

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function scopeHtml() {
  return `<div class="banner">Démonstration publique. Les entreprises, les montants et les états de plateformes sont un jeu. Aucun courriel, appel, paiement ou publication ne part d'ici.</div>
  <div class="scope-grid">
    <article class="card"><h3>Ce qui fonctionne</h3><ul><li>Chaque poste prépare un dossier à partir de ses compétences.</li><li>Philippe Azor passe une commande. Le chef de cabinet la transmet au poste.</li><li>Le supérieur recommande ou approuve. Philippe Azor ne signe qu'ensuite.</li><li>La sécurité peut geler un dossier. Un appel sans base enregistrée reste bloqué.</li><li>La page d'accueil de chaque site connu est vérifiée en direct.</li><li>La santé de KlirBuild est lue sur sa route réelle.</li><li>Le catalogue public de Klir IA est lu sur klirline.io.</li><li>Le CEO voit le hub des panneaux admin déjà connus.</li></ul></article>
    <article class="card"><h3>Ce qui est simulé</h3><ul><li>Prospects, clients, factures et marges.</li><li>L'état métier des plateformes, y compris l'export Klirline OS.</li><li>${state.accessMode === "cloudflare-access" ? "Les chiffres restent un jeu, même quand le rôle vient de Cloudflare Access." : "L'identité choisie dans le menu. Ce n'est pas une connexion. Le serveur local est en mode démonstration."}</li></ul></article>
    <article class="card"><h3>Ce qui n'est pas branché</h3><ul><li>Envoi de courriel, composition d'appel, paiement, publication.</li><li>${prospectSourceLine()}</li></ul></article>
  </div>
  <div class="actions"><button data-view="bureau">Ouvrir le bureau</button><button class="ghost" data-view="report">Ouvrir le rapport du jour</button><button class="ghost" data-view="queue">Voir la file à valider</button></div>`;
}

function reportHtml() {
  const report = state.briefing;
  const lane = (title, items, empty = "Rien") => `<section class="lane"><h3>${title}</h3>${items.length ? items.join("") : `<p class="muted">${empty}</p>`}</section>`;
  const approveEmpty = actorId === "ceo"
    ? "Rien n'attend Philippe Azor. Un supérieur doit d'abord recommander le dossier."
    : "Rien";
  const finance = state.briefing.finance;
  const desk = actorId === "ceo"
    ? `<article class="card"><h3>Place de commande · démonstration</h3><p>Écrivez l'ordre. Il reste dans le jeu des 34 postes. Le bureau réel est l'onglet Bureau.</p><textarea id="command" placeholder="Exemple : trouver 10 prospects"></textarea><div class="actions"><button id="send-command">Passer la commande</button></div></article>${deskPapersHtml()}`
    : "";
  return `<div class="banner">Les agents préparent les dossiers. Une action approuvée est consignée ici : elle n'envoie rien, n'appelle personne et ne déplace pas d'argent.</div>
  ${desk}
  <div class="lanes">
    ${lane("À approuver", report.decisionsReady.map((item) => taskButton(item)), approveEmpty)}
    ${lane("À surveiller", report.decisionsWaiting.map((item) => taskButton(item)))}
    ${lane("Urgent", report.blocked.map((item) => taskButton(item)))}
    ${lane("Opportunités", report.sales.priority.map((item) => `<p>${escapeHtml(item.company)} · score ${item.score}/100 · ${item.potentialCad == null ? "potentiel non chiffré" : `potentiel ${escapeHtml(money(item.potentialCad))}`} · ${escapeHtml(item.action)}</p>`))}
    ${lane("Consigné localement", report.results.map((item) => `<p>${escapeHtml(item)}</p>`), "Rien n'a été exécuté à l'extérieur")}
  </div>
  <div class="grid">
    <article class="card"><h3>Prospects KlirProspect</h3>${prospectSourceHtml()}</article>
    <article class="card"><h3>Ventes</h3><p>${report.sales.prospects} prospects actifs. Démos : ${escapeHtml(report.sales.demos.join(" · ") || "aucune")}</p><p class="muted">Un montant de proposition n'est pas un revenu. Ces fiches restent le jeu de démonstration.</p></article>
    <article class="card"><h3>Finance de démonstration</h3><p>Revenus du mois ${money(finance.revenue)}</p><p>Dépenses du mois ${money(finance.expenses)}</p><p>Factures ouvertes ${money(finance.receivables)}</p><p>Propositions chiffrées ${money(finance.proposalTotal)} · ${finance.proposalCount} fiches. Les autres n'ont pas de montant.</p><p class="muted">${escapeHtml(finance.source)} Aucune probabilité n'est appliquée.</p></article>
    ${loadHtml(report)}
    <article class="card"><h3>Sites réels</h3>${sitesSummaryHtml()}</article>
    <article class="card"><h3>Opérations</h3>${report.operations.degraded.map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Toutes les plateformes sont opérationnelles dans l'état local.</p>"}<p class="muted">Ces notes viennent du jeu de démonstration.</p></article>
    <article class="card"><h3>Clients</h3>${report.customers.map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Aucune alerte à deux signaux.</p>"}</article>
  </div>`;
}

function prospectSourceLine() {
  const source = state.prospectSource;
  if (!source) return "Lecture des dossiers, prospects et factures. Seule la page d'accueil est lue.";
  if (source.status === "ready") return "Les fiches KlirProspect sont lues. Le courriel, le téléphone, les factures et les paiements restent fermés.";
  if (source.status === "empty") return "KlirProspect répond. Aucune fiche réelle n'est enregistrée. Les factures restent fermées.";
  return "La lecture KlirProspect n'est pas disponible sur cette session. Les factures restent fermées.";
}

function prospectSourceHtml() {
  const source = state.prospectSource;
  if (!source || source.status === "unconfigured") return "<p>La lecture n'est pas configurée sur ce serveur. Les entreprises affichées ailleurs restent le jeu de démonstration.</p>";
  if (source.status === "unavailable" || source.status === "invalid") return "<p>KlirProspect n'a pas renvoyé de liste lisible. Les entreprises du rapport restent le jeu de démonstration.</p>";
  if (source.status === "empty" || !source.prospects.length) return "<p>KlirProspect est connecté. Aucune fiche réelle n'est enregistrée. Les entreprises du rapport restent le jeu de démonstration.</p>";
  const rows = source.prospects.map((item) => `<p>${escapeHtml(item.company)} · ${escapeHtml(item.product || "produit non précisé")} · ${item.score == null ? "score absent" : `score ${item.score}/100`} · ${escapeHtml(item.action || "suite non précisée")}</p>`).join("");
  return `<p class="muted">Lecture réelle. Le courriel et le téléphone ne sont pas demandés.</p>${rows}`;
}

function loadHtml(report) {
  const rows = (report.agentLoad || []).map((item) => {
    const name = agent(item.ownerId)?.name || item.ownerId;
    return `<div class="row-line"><span>${escapeHtml(name)}</span><span>ouvertes ${item.open} · bloquées ${item.blocked}</span></div>`;
  }).join("");
  return `<article class="card"><h3>Charge des tâches</h3><p class="muted">Dossiers encore ouverts ou gelés. Ceci mesure la charge des tâches, pas la disponibilité technique de l'agent.</p>${rows || "<p class=\"muted\">Aucune tâche ouverte.</p>"}</article>`;
}

function prospectField(label, value) {
  return `<div class="row-line"><span>${escapeHtml(label)}</span><span>${escapeHtml(value || "non précisé")}</span></div>`;
}

function prospectSearchHtml(artifact) {
  const asked = artifact.asked ? `${artifact.asked} demandé${artifact.asked > 1 ? "s" : ""}` : "Nombre non précisé";
  const missing = artifact.missing
    ? `<p>${artifact.missing} fiche${artifact.missing > 1 ? "s" : ""} réelle${artifact.missing > 1 ? "s" : ""} manquante${artifact.missing > 1 ? "s" : ""}. Aucune entreprise n'est ajoutée pour compléter le compte.</p>`
    : "<p>La demande est couverte par les fiches réelles.</p>";
  const live = artifact.live?.length
    ? artifact.live.map((item) => `<article class="card"><h3>${escapeHtml(item.company)}</h3>${prospectField("Produit", item.product)}${prospectField("Score", item.score == null ? "" : `${item.score}/100`)}${prospectField("Prochaine action", item.action)}<p class="muted">Lecture KlirProspect. Le courriel et le téléphone ne sont pas dans cette lecture.</p></article>`).join("")
    : "<p>KlirProspect n'a aucune fiche réelle enregistrée.</p>";
  const local = (artifact.local || []).map((item) => `<article class="card"><h3>${escapeHtml(item.company)}</h3>${prospectField("Contact", item.contact)}${prospectField("Rôle", item.role)}${prospectField("Secteur", item.industry)}${prospectField("Produit", item.product)}${prospectField("Score", item.score == null ? "" : `${item.score}/100`)}${prospectField("Raisons", (item.reasons || []).join(", "))}${prospectField("Prochaine action", item.action)}${prospectField("Besoin", item.need)}${prospectField("Base", item.consent)}${prospectField("Proposition", item.proposalAmount == null ? "non chiffré" : money(item.proposalAmount))}${prospectField("Démo", item.demoAt || "aucune")}${prospectField("Courriel", item.email)}${prospectField("Téléphone", item.phone)}</article>`).join("");
  return `<p><strong>${escapeHtml(asked)}.</strong> Fiches réelles : ${artifact.live?.length || 0}. Fiches du jeu local : ${artifact.local?.length || 0}.</p>${missing}<h3>Fiches réelles</h3>${live}<h3>Jeu local, dossier complet</h3>${local || "<p>Aucune fiche locale.</p>"}`;
}

function deskPapersHtml() {
  const papers = state.tasks.filter((task) => task.origin === "command");
  if (!papers.length) return `<article class="card"><h3>Vos commandes</h3><p class="muted">Chaque ordre passé ici reste affiché avec son détail.</p></article>`;
  return `<h2 class="section-title">Vos commandes</h2>${papers.map((task) => `<article class="card"><div class="chips">${chip(`l${task.level}`, levelLabel[task.level])}${chip(task.status, statusLabel[task.status])}</div><h3>${escapeHtml(task.title)}</h3><p class="muted">${escapeHtml(when(task.createdAt))}</p><p>${escapeHtml(task.summary)}</p>${artifactHtml(task)}<button class="ghost" data-task="${task.id}">Ouvrir le dossier</button></article>`).join("")}`;
}

function listHtml(tasks) {
  if (!tasks.length) return `<p class="muted">Aucune tâche dans cette file pour ${escapeHtml(agent(actorId).name)}.</p>`;
  return tasks.map((task) => `<article class="card"><div class="chips">${chip(`l${task.level}`, levelLabel[task.level])}${chip(task.status, statusLabel[task.status])}</div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.summary)}</p><button class="ghost" data-task="${task.id}">Ouvrir le dossier</button></article>`).join("");
}

function queueHtml() {
  const mine = state.tasks.filter((task) => task.actions.length);
  const upstream = state.tasks.filter((task) => task.level === 3 && task.status === "pending_supervisor" && !task.actions.length);
  const waitingCards = upstream.map((task) => {
    const supervisor = agent(task.supervisorId);
    return `<article class="card"><div class="chips">${chip("l3", levelLabel[3])}${chip(task.status, statusLabel[task.status])}</div><h3>${escapeHtml(task.title)}</h3><p>Chez ${escapeHtml(supervisor.name)}. La file de Philippe Azor s'ouvre après sa recommandation.</p><button class="ghost" data-assume="${task.supervisorId}" data-open="${task.id}">Prendre la session de ${escapeHtml(supervisor.name)}</button></article>`;
  }).join("");
  const ready = mine.length ? listHtml(mine) : `<article class="card"><p class="muted">${actorId === "ceo" ? "Aucun dossier ne lui a encore été recommandé." : "Aucun dossier n'attend cette session."}</p></article>`;
  return `<div class="grid"><h2 class="section-title">Pour ${escapeHtml(agent(actorId).name)}</h2>${ready}${upstream.length ? `<h2 class="section-title">Encore chez un supérieur</h2>${waitingCards}` : ""}</div>`;
}

function workHtml() {
  return state.departments.map((department) => {
    const tasks = state.tasks.filter((task) => task.department === department.id);
    const lead = agent(department.lead);
    return `<article class="card"><h3>${escapeHtml(department.name)}</h3><p class="muted">Supérieur : ${escapeHtml(lead.name)}</p>${tasks.map((task) => `<div class="row-line"><span>${escapeHtml(task.title)}</span><span class="muted">${escapeHtml(agent(task.ownerId).name)}</span></div>`).join("")}</article>`;
  }).join("");
}

function sitesSummaryHtml() {
  if (!liveSites.length) return `<p class="muted">Vérification des adresses en cours.</p>`;
  const online = liveSites.filter((site) => site.status === "online").length;
  const absent = liveSites.filter((site) => site.status === "absent").length;
  const consoles = liveSites.filter((site) => site.status === "private").length;
  const rows = liveSites.map((site) => {
    const extra = site.health ? ` · ${healthLabel(site)}` : site.skills?.status === "ok" ? ` · ${site.skills.count} compétences` : "";
    return `<div class="row-line"><span>${escapeHtml(siteName(site))}</span><span>${escapeHtml(siteLabel(site) + extra)}</span></div>`;
  }).join("");
  return `<p>${online} pages joignables, ${absent} sans adresse${consoles ? `, ${consoles} console privée` : ""}. Une page qui répond n'est pas la santé de l'application.</p>${rows}`;
}

function httpsUrl(value) {
  if (typeof value !== "string" || !value.startsWith("https://")) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function adminAccessChip(access) {
  if (access === "cf-access") return chip("pending_supervisor", "Protégé · Cloudflare Access");
  if (access === "cf-challenge") return chip("pending_supervisor", "Protégé · défi Cloudflare");
  if (access === "public-login") return chip("done", "Connexion publique");
  return chip("", "Pas d'admin");
}

function adminAccessText(access, hasLink) {
  if (access === "cf-access") return hasLink ? "Panneau derrière Cloudflare Access." : "Derrière Cloudflare Access. Pas de lien externe.";
  if (access === "cf-challenge") return "Page publique derrière un défi Cloudflare. Panneau non retenu.";
  if (access === "public-login") return "Panneau de connexion déjà connu.";
  return "Aucun panneau web retenu.";
}

function adminHubHtml() {
  if (!state.adminHub) {
    return `<h2 class="section-title">Admin produits</h2><article class="card"><p>Réservé au CEO.</p></article>`;
  }
  if (!liveSites.length) {
    return `<h2 class="section-title">Admin produits</h2><article class="card"><p class="muted">Vérification des adresses en cours.</p></article>`;
  }
  const cards = liveSites.map((site) => {
    const access = site.access || "none";
    const admin = access === "public-login" || access === "cf-access" ? httpsUrl(site.adminUrl) : "";
    const link = admin
      ? `<div class="actions"><a class="admin-link" href="${escapeHtml(admin)}" target="_blank" rel="noopener noreferrer">Ouvrir l'admin</a></div>`
      : "";
    const note = site.note ? `<p class="muted">${escapeHtml(site.note)}</p>` : "";
    return `<article class="card"><div class="chips">${siteChip(site)}${adminAccessChip(access)}</div><h3>${escapeHtml(siteName(site))}</h3><p>${escapeHtml(adminAccessText(access, Boolean(admin)))}</p>${note}${link}</article>`;
  }).join("");
  const here = `<article class="card"><div class="chips">${chip("pending_supervisor", "Ce poste")}${adminAccessChip("cf-access")}</div><h3>Klirline Office</h3><p>Ce centre, déjà ouvert dans ce navigateur. Pas de lien externe.</p></article>`;
  return `<h2 class="section-title">Admin produits</h2><p class="muted">Panneaux des logiciels. Le bouton n'apparaît que lorsqu'une adresse d'admin est retenue. Black Wall News est sondé avec les sites ; il ne fait pas partie du jeu des huit plateformes.</p><div class="scope-grid">${cards}${here}</div>`;
}

function sitesHtml() {
  if (!liveSites.length) return `<article class="card"><h3>Sites réels</h3><p class="muted">Vérification des adresses en cours.</p></article>`;
  const checked = liveSites.find((site) => site.checkedAt)?.checkedAt;
  const cards = liveSites.map((site) => {
    const address = site.url
      ? `<p><a href="${escapeHtml(site.url)}" target="_blank" rel="noreferrer">${escapeHtml(site.url.replace(/^https:\/\//, ""))}</a></p>`
      : `<p class="muted">Aucun nom public pour ce produit.</p>`;
    const title = site.title ? `<p>${escapeHtml(site.title)}</p>` : "";
    const note = site.note ? `<p class="muted">${escapeHtml(site.note)}</p>` : "";
    return `<article class="card"><div class="chips">${siteChip(site)}</div><h3>${escapeHtml(siteName(site))}</h3>${address}${title}${healthHtml(site)}${skillsHtml(site)}${note}</article>`;
  }).join("");
  return `<h2 class="section-title">Sites réels</h2><p class="muted">Page d'accueil vérifiée à ${escapeHtml(when(checked))}. La santé de KlirBuild et le catalogue de Klir IA viennent de leurs routes réelles. Aucun dossier, aucun paiement, aucun message.</p><div class="scope-grid">${cards}</div>`;
}

function platformsHtml() {
  const current = agent(actorId);
  const rows = state.platforms.map((platform) => {
    const name = state.platformCatalog.find((item) => item.id === platform.id);
    const write = current.writePlatforms.includes(platform.id) ? "Écriture prévue" : "Lecture seule";
    return `<tr><td>${escapeHtml(name.name)}</td><td>${escapeHtml(name.domain)}</td><td>${escapeHtml(platformStatusLabel[platform.status] || platform.status)}</td><td>${write}</td><td>${escapeHtml(platform.note)}</td></tr>`;
  }).join("");
  return `${sitesHtml()}${adminHubHtml()}<div class="banner">Le tableau suivant reste un jeu de démonstration, relu à ${escapeHtml(when(state.generatedAt))}. L'écriture réelle reste fermée.</div><article class="card"><h3>Un seul accès</h3><p>${escapeHtml(current.name)} voit les huit plateformes dans ce centre. Écriture réelle : aucune. Périmètre prévu : ${current.writePlatforms.length ? escapeHtml(current.writePlatforms.map((id) => state.platformCatalog.find((item) => item.id === id)?.name || id).join(", ")) : "aucun"}.</p><div class="table-wrap"><table><thead><tr><th>Plateforme</th><th>Domaine</th><th>État simulé</th><th>Droit</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

function peopleHtml() {
  const selected = agent(selectedAgentId);
  const buttons = state.agents.map((item) => `<button class="${item.id === selectedAgentId ? "active" : ""}" data-agent="${item.id}">${item.icon} ${escapeHtml(item.name)}</button>`).join("");
  const books = selected.playbooks.map((id) => `<button class="ghost" data-book="${id}">${escapeHtml(state.playbooks.find((item) => item.id === id)?.title || id)}</button>`).join("");
  return `<div class="agent-list"><div class="card">${buttons}</div><article class="card doc"><p class="voice"><strong>Voix du poste.</strong> ${escapeHtml(selected.style)}</p>${renderMarkdown(selected.skillDocument)}<div class="actions">${books}</div>${playbookBody ? `<hr />${renderMarkdown(playbookBody)}` : ""}</article></div>`;
}

function journalHtml() {
  const events = state.audit.map((item) => {
    const effect = item.action === "execute" ? state.outbox.find((entry) => entry.taskId === item.taskId) : null;
    const result = item.action === "log_call"
      ? "Compte-rendu local. Aucun numéro n'a été composé."
      : effect
        ? (effect.leftTheBuilding ? "Transmis à l'extérieur." : "Simulation consignée. Rien n'a quitté le centre.")
        : "";
    return `<article class="card timeline"><p class="eyebrow">${escapeHtml(journalKind[item.action] || "Événement")}</p><h3>${escapeHtml(journalAction[item.action] || item.action)}</h3><p>${escapeHtml(agent(item.actorId)?.name || item.actorId)} · ${escapeHtml(when(item.at))}</p><p>${escapeHtml(item.detail)}</p>${result ? `<p class="muted">${escapeHtml(result)}</p>` : ""}</article>`;
  }).join("");
  return events || `<article class="card"><p class="muted">Aucun événement.</p></article>`;
}

function hqTone(status) {
  if (status === "done") return "done";
  if (status === "blocked" || status === "cancelled" || status === "failed") return "blocked";
  return "pending_supervisor";
}

function lastHq(slug) {
  return hqCommands.filter((command) => command.ownerSlug === slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}

function hqCommandCard(command) {
  const result = command.result ? `<p><strong>Résultat.</strong> ${escapeHtml(command.result)}</p>` : "";
  const proof = command.proof ? `<p><strong>Preuve.</strong> ${escapeHtml(command.proof)}</p>` : "";
  const agentNote = command.agentNote ? `<p class="muted">${escapeHtml(command.agentNote)}</p>` : "";
  return `<article class="card" data-hq-command="${escapeHtml(command.id)}"><div class="chips">${chip(hqTone(command.status), hqStatusLabel[command.status] || command.status)}${chip("", hqPriorityLabel[command.priority] || command.priority)}</div><h3>${escapeHtml(command.ownerName)}</h3><p>${escapeHtml(command.text)}</p><p class="muted">${escapeHtml(when(command.createdAt))} · ${escapeHtml(hqRouteLabel[command.routedBy] || command.routedBy)}</p>${result}${proof}${agentNote}</article>`;
}

function bureauHtml() {
  const divisions = hqDivisions.map((division) => `<button class="${hqDivision === division ? "active" : ""}" data-hq-division="${escapeHtml(division)}">${escapeHtml(division)}</button>`).join("");
  const visibleAgents = hqRoster.filter((agent) => hqDivision === "Toutes" || agent.division === hqDivision);
  const visibleCommands = hqCommands.filter((command) => hqDivision === "Toutes" || command.division === hqDivision);
  const cards = visibleAgents.map((agent) => {
    const last = lastHq(agent.id);
    const address = httpsUrl(agent.productUrl);
    const link = address ? `<p><a href="${escapeHtml(address)}" target="_blank" rel="noopener noreferrer">${escapeHtml(address.replace(/^https:\/\//, ""))}</a></p>` : "";
    const covers = Array.isArray(agent.covers) && agent.covers.length
      ? `<p class="muted">Sans agent dédié : ${agent.covers.map((item) => escapeHtml(item.name)).join(", ")}.</p>`
      : "";
    const status = last ? chip(hqTone(last.status), hqStatusLabel[last.status] || last.status) : chip("", "Aucune commande");
    return `<article class="card" data-hq-agent="${escapeHtml(agent.id)}"><div class="chips">${chip("", agent.division)}${status}</div><h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.mission)}</p>${link}${covers}</article>`;
  }).join("");
  const owners = [`<option value="">Répartition automatique</option>`].concat(hqRoster.map((agent) => `<option value="${escapeHtml(agent.id)}" ${agent.id === hqOwner ? "selected" : ""}>${escapeHtml(agent.name)} — ${escapeHtml(agent.division)}</option>`)).join("");
  const lane = (title, items, empty) => `<section class="lane"><h3>${title}</h3>${items.length ? items.map(hqCommandCard).join("") : `<p class="muted">${empty}</p>`}</section>`;
  const open = visibleCommands.filter((command) => ["pending", "queued", "dispatched", "running", "awaiting_validation"].includes(command.status));
  const done = visibleCommands.filter((command) => command.status === "done");
  const blocked = visibleCommands.filter((command) => command.status === "blocked" || command.status === "cancelled" || command.status === "failed");
  const waiting = !hqRoster.length && !hqError ? `<article class="card"><p class="muted">Chargement du bureau.</p></article>` : "";
  return `<div class="banner">Bureau réel. Une commande est enregistrée ici, puis un exécuteur identifié la lit et renvoie le statut. Le menu de démonstration ne donne aucun droit sur ces routes. Le rapport du jour reste la démonstration des 34 postes. Ce Worker n'envoie rien vers les agents.</div>
  <article class="card"><h3>Nouvelle commande</h3><textarea id="hq-text" placeholder="Exemple : rédiger l'article Black Wall News">${escapeHtml(hqDraft)}</textarea>
  <div class="hq-compose"><label>Agent<select id="hq-owner">${owners}</select></label><label>Priorité<select id="hq-priority"><option value="basse" ${hqPriority === "basse" ? "selected" : ""}>Basse</option><option value="normale" ${hqPriority === "normale" ? "selected" : ""}>Normale</option><option value="haute" ${hqPriority === "haute" ? "selected" : ""}>Haute</option></select></label></div>
  <div class="actions"><button id="hq-send">Enregistrer la commande</button><button class="ghost" id="hq-refresh">Actualiser</button></div>
  ${hqError ? `<p class="error">${escapeHtml(hqError)}</p>` : ""}</article>
  <div class="filters" role="tablist">${divisions}</div>
  <div class="hq-lanes">
    ${lane("En cours", open, "Aucune commande en cours.")}
    ${lane("Fait", done, "Rien de terminé.")}
    ${lane("Bloqué", blocked, "Rien de bloqué.")}
  </div>
  ${waiting}
  <div class="scope-grid">${cards}</div>`;
}

function mainHtml() {
  if (view === "scope") return scopeHtml();
  if (view === "bureau") return bureauHtml();
  if (view === "report") return reportHtml();
  if (view === "queue") return queueHtml();
  if (view === "work") return `<div class="grid">${workHtml()}</div>`;
  if (view === "comms") return `<div class="grid">${listHtml(state.tasks.filter((task) => task.artifact?.kind === "email" || task.artifact?.kind === "call"))}</div>`;
  if (view === "platforms") return platformsHtml();
  if (view === "people") return peopleHtml();
  return `<div class="grid">${journalHtml()}</div>`;
}

function render() {
  const showDetail = ["report", "queue", "comms"].includes(view);
  const selected = selectedTaskId ? taskById(selectedTaskId) : null;
  const date = new Date(state.generatedAt).toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const options = state.agents.map((item) => `<option value="${item.id}" ${item.id === actorId ? "selected" : ""}>${escapeHtml(item.name)} — ${escapeHtml(item.title)}</option>`).join("");
  const tree = state.departments.map((department) => {
    const people = state.agents.filter((item) => item.department === department.id && item.id !== "ceo");
    return `<div class="dept">${escapeHtml(department.name)}</div>${people.map((item) => `<div><button data-agent="${item.id}" title="${escapeHtml(item.style)}">${item.icon} ${escapeHtml(item.name)}</button></div>`).join("")}`;
  }).join("");
  app.innerHTML = `<div class="shell">
    <aside class="sidebar">
      <img class="brand-mark" src="/klirline-office.png" alt="Klirline Office" />
      <p class="house-voice">${escapeHtml(state.company.officeVoice)}</p>
      <div class="priority">${escapeHtml(date)}<br />Priorité : ventes</div>
      <nav class="desktop-nav">${views.map(([id, label]) => `<button class="${view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}</nav>
      <details class="tree" ${window.innerWidth > 1100 ? "open" : ""}><summary>Organigramme</summary><div class="dept">CEO</div><div>👑 ${escapeHtml(state.company.founder)}</div>${tree}</details>
    </aside>
    <section class="stage">
      <header class="top">
        <div><p class="eyebrow">${escapeHtml(state.company.officeName)}</p><h1>${views.find(([id]) => id === view)[1]}</h1></div>
        <div class="session">
          ${state.accessMode === "cloudflare-access"
            ? `<p class="hint">Rôle attribué par Cloudflare Access : ${escapeHtml(agent(actorId)?.name || actorId)}. Un rôle envoyé par le navigateur est ignoré.</p>`
            : `<label for="actor">Identité de démonstration</label><select id="actor">${options}</select><p class="hint">Mode démonstration. Ce menu ne connecte personne. Le serveur local vérifie seulement le rôle annoncé. ${actorId === "ceo" ? `<button class="ghost" id="reset">Recommencer la démonstration</button>` : ""}</p>`}
        </div>
      </header>
      <nav class="section-nav">${views.map(([id, label]) => `<button class="${view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}</nav>
      <div class="layout ${showDetail ? "" : "single"}">
        <div>${mainHtml()}</div>
        ${showDetail ? detailHtml(selected) : ""}
      </div>
    </section>
  </div>`;
  bind();
}

function bind() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    view = button.dataset.view;
    sessionStorage.setItem("klirline-view", view);
    error = "";
    hqError = "";
    render();
    if (view === "bureau") refreshHq({ force: true });
  }));
  document.querySelectorAll("[data-assume]").forEach((button) => button.addEventListener("click", () => {
    actorId = button.dataset.assume;
    selectedTaskId = button.dataset.open;
    view = "queue";
    sessionStorage.setItem("klirline-actor", actorId);
    sessionStorage.setItem("klirline-view", view);
    load().catch(showLoadError);
  }));
  document.querySelectorAll("[data-task]").forEach((button) => button.addEventListener("click", () => { selectedTaskId = button.dataset.task; view = ["people", "platforms", "journal", "work"].includes(view) ? "queue" : view; error = ""; render(); }));
  document.querySelectorAll("[data-agent]").forEach((button) => button.addEventListener("click", () => { selectedAgentId = button.dataset.agent; playbookBody = ""; view = "people"; render(); }));
  document.querySelectorAll("[data-book]").forEach((button) => button.addEventListener("click", () => openPlaybook(button.dataset.book, true)));
  document.querySelector("#actor")?.addEventListener("change", (event) => { actorId = event.target.value; sessionStorage.setItem("klirline-actor", actorId); load().catch(showLoadError); });
  document.querySelector("#reset")?.addEventListener("click", () => post("/api/reset", { actorId }));
  document.querySelector("#send-command")?.addEventListener("click", () => post("/api/command", { actorId, text: document.querySelector("#command")?.value || "" }));
  document.querySelectorAll("[data-hq-division]").forEach((button) => button.addEventListener("click", () => {
    hqDivision = button.dataset.hqDivision;
    sessionStorage.setItem("klirline-hq-division", hqDivision);
    render();
  }));
  document.querySelector("#hq-text")?.addEventListener("input", (event) => { hqDraft = event.target.value; });
  document.querySelector("#hq-owner")?.addEventListener("change", (event) => { hqOwner = event.target.value; });
  document.querySelector("#hq-priority")?.addEventListener("change", (event) => { hqPriority = event.target.value; });
  document.querySelector("#hq-send")?.addEventListener("click", () => {
    const text = document.querySelector("#hq-text")?.value || "";
    const ownerSlug = document.querySelector("#hq-owner")?.value || "";
    const priority = document.querySelector("#hq-priority")?.value || "normale";
    hqDraft = text;
    hqOwner = ownerSlug;
    hqPriority = priority;
    postHq({ text, priority, ...(ownerSlug ? { ownerSlug } : {}) });
  });
  document.querySelector("#hq-refresh")?.addEventListener("click", () => refreshHq({ force: true }));
  document.querySelector("#note")?.addEventListener("input", (event) => { note = event.target.value; });
  document.querySelectorAll("[data-decision]").forEach((button) => button.addEventListener("click", () => {
    const decision = button.dataset.decision;
    if (decision === "execute") post("/api/execute", { taskId: selectedTaskId, actorId });
    else post("/api/decision", { taskId: selectedTaskId, actorId, decision, note });
  }));
  document.querySelectorAll("[data-outcome]").forEach((button) => button.addEventListener("click", () => post("/api/call", { taskId: selectedTaskId, actorId, outcome: button.dataset.outcome, note })));
}

async function openPlaybook(id, redraw) {
  playbookId = id;
  const response = await fetch(`/api/playbooks/${id}`);
  const body = await response.json();
  playbookBody = body.body || "";
  if (redraw) render();
}

function showLoadError(reason) {
  app.innerHTML = `<p class="error">${escapeHtml(reason.message)}</p>`;
}

async function refreshHq({ force = false } = {}) {
  const token = ++hqLoad;
  try {
    const [rosterResponse, commandResponse] = await Promise.all([fetch("/api/hq/roster"), fetch("/api/hq/commands")]);
    const rosterBody = await rosterResponse.json();
    const commandBody = await commandResponse.json();
    if (token !== hqLoad) return;
    if (!rosterResponse.ok || !commandResponse.ok) {
      hqError = rosterBody.error || commandBody.error || "Le bureau est indisponible.";
      if (view === "bureau") render();
      return;
    }
    const typing = document.activeElement && ["hq-text", "hq-owner", "hq-priority"].includes(document.activeElement.id);
    const same = JSON.stringify(rosterBody.roster || []) === JSON.stringify(hqRoster) && JSON.stringify(commandBody.commands || []) === JSON.stringify(hqCommands);
    hqRoster = rosterBody.roster || [];
    hqCommands = commandBody.commands || [];
    hqError = "";
    if (view === "bureau" && (force || (!same && !typing))) render();
  } catch (reason) {
    if (token !== hqLoad) return;
    hqError = reason.message || "Le bureau est indisponible.";
    if (view === "bureau") render();
  }
}

async function postHq(payload) {
  hqError = "";
  try {
    const response = await fetch("/api/hq/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      hqError = body.error || "La commande n'a pas été enregistrée.";
      render();
      return;
    }
    hqDraft = "";
    hqCommands = [body.command, ...hqCommands.filter((command) => command.id !== body.command.id)];
    render();
    refreshHq({ force: true });
  } catch (reason) {
    hqError = reason.message || "La commande n'a pas été enregistrée.";
    render();
  }
}

function ensureHqPoll() {
  if (ensureHqPoll.started) return;
  ensureHqPoll.started = true;
  setInterval(() => { if (view === "bureau") refreshHq(); }, 4000);
}

load().catch(showLoadError);
