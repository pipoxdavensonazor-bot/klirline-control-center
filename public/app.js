const views = [
  ["scope", "Ce centre"],
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
  execute: "Exécution",
  log_call: "Exécution",
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
  if (playbookId) await openPlaybook(playbookId, false);
  render();
  refreshSites();
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
  return state.platformCatalog.find((item) => item.id === site.id)?.name || site.id;
}

function siteLabel(site) {
  if (site.status === "online") return "En ligne";
  if (site.status === "absent") return "Pas d'adresse";
  if (site.status === "unreachable") return "Injoignable";
  return "Réponse inattendue";
}

function siteChip(site) {
  const tone = site.status === "online" ? "done" : site.status === "absent" ? "pending_supervisor" : "blocked";
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
  note = "";
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
  if (artifact.kind === "email" || artifact.kind === "content") {
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
    ${task.security?.state === "blocked" ? `<p class="error">${escapeHtml(task.security.reason)}</p>` : ""}
    ${!task.actions.length && task.status === "pending_supervisor" ? `<p class="banner">Dossier chez ${escapeHtml(supervisor.name)}. La signature du CEO s'ouvre après sa recommandation.</p>` : ""}
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
    <article class="card"><h3>Ce qui fonctionne</h3><ul><li>Chaque poste prépare un dossier à partir de ses compétences.</li><li>Le supérieur recommande ou approuve. Philippe Azor ne signe qu'ensuite.</li><li>La sécurité peut geler un dossier. Un appel sans base enregistrée reste bloqué.</li><li>La page d'accueil de chaque site connu est vérifiée en direct.</li><li>La santé de KlirBuild est lue sur sa route réelle.</li></ul></article>
    <article class="card"><h3>Ce qui est simulé</h3><ul><li>Prospects, clients, factures et marges.</li><li>L'état métier des plateformes, y compris l'export Klirline OS.</li><li>L'identité choisie dans le menu. Ce n'est pas une connexion.</li></ul></article>
    <article class="card"><h3>Ce qui n'est pas branché</h3><ul><li>Envoi de courriel, composition d'appel, paiement, publication.</li><li>Lecture des dossiers, prospects et factures. Seule la page d'accueil est lue.</li><li>KlirMarket et Klirline OS n'ont pas encore d'adresse publique.</li></ul></article>
  </div>
  <div class="actions"><button data-view="report">Ouvrir le rapport du jour</button><button class="ghost" data-view="queue">Voir la file à valider</button></div>`;
}

function reportHtml() {
  const report = state.briefing;
  const lane = (title, items, empty = "Rien") => `<section class="lane"><h3>${title}</h3>${items.length ? items.join("") : `<p class="muted">${empty}</p>`}</section>`;
  const approveEmpty = actorId === "ceo"
    ? "Rien n'attend Philippe Azor. Un supérieur doit d'abord recommander le dossier."
    : "Rien";
  const finance = state.briefing.finance;
  return `<div class="banner">Les agents préparent les dossiers. Une action approuvée est consignée ici : elle n'envoie rien, n'appelle personne et ne déplace pas d'argent.</div>
  <div class="lanes">
    ${lane("À approuver", report.decisionsReady.map((item) => taskButton(item)), approveEmpty)}
    ${lane("À surveiller", report.decisionsWaiting.map((item) => taskButton(item)))}
    ${lane("Urgent", report.blocked.map((item) => taskButton(item)))}
    ${lane("Opportunités", report.sales.priority.map((item) => `<p>${escapeHtml(item.company)} · ${item.score} · ${escapeHtml(item.action)}</p>`))}
    ${lane("Résultats", report.results.map((item) => `<p>${escapeHtml(item)}</p>`))}
  </div>
  <div class="grid">
    <article class="card"><h3>Ventes</h3><p>${report.sales.prospects} prospects actifs. Démos : ${escapeHtml(report.sales.demos.join(" · ") || "aucune")}</p></article>
    <article class="card"><h3>Finance</h3><p>Revenus ${money(finance.revenue)} · dépenses ${money(finance.expenses)} · factures ouvertes ${money(finance.receivables)}</p><p class="muted">${escapeHtml(finance.source)}</p></article>
    <article class="card"><h3>Sites réels</h3>${sitesSummaryHtml()}</article>
    <article class="card"><h3>Opérations</h3>${report.operations.degraded.map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Toutes les plateformes sont opérationnelles dans l'état local.</p>"}<p class="muted">Ces notes viennent du jeu de démonstration.</p></article>
    <article class="card"><h3>Clients</h3>${report.customers.map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Aucune alerte à deux signaux.</p>"}</article>
  </div>`;
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
  const rows = liveSites.map((site) => `<div class="row-line"><span>${escapeHtml(siteName(site))}</span><span>${escapeHtml(site.health ? `${siteLabel(site)} · ${healthLabel(site)}` : siteLabel(site))}</span></div>`).join("");
  return `<p>${online} en ligne, ${absent} sans adresse.</p>${rows}`;
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
    return `<article class="card"><div class="chips">${siteChip(site)}</div><h3>${escapeHtml(siteName(site))}</h3>${address}${title}${healthHtml(site)}${note}</article>`;
  }).join("");
  return `<h2 class="section-title">Sites réels</h2><p class="muted">Page d'accueil vérifiée à ${escapeHtml(when(checked))}. La santé de KlirBuild vient de sa route réelle. Aucun dossier, aucun paiement.</p><div class="scope-grid">${cards}</div>`;
}

function platformsHtml() {
  const current = agent(actorId);
  const rows = state.platforms.map((platform) => {
    const name = state.platformCatalog.find((item) => item.id === platform.id);
    const write = current.writePlatforms.includes(platform.id) ? "Écriture prévue" : "Lecture seule";
    return `<tr><td>${escapeHtml(name.name)}</td><td>${escapeHtml(name.domain)}</td><td>${escapeHtml(platformStatusLabel[platform.status] || platform.status)}</td><td>${write}</td><td>${escapeHtml(platform.note)}</td></tr>`;
  }).join("");
  return `${sitesHtml()}<div class="banner">Le tableau suivant reste un jeu de démonstration, relu à ${escapeHtml(when(state.generatedAt))}. L'écriture réelle reste fermée.</div><article class="card"><h3>Un seul accès</h3><p>${escapeHtml(current.name)} voit les huit plateformes dans ce centre. Écriture réelle : aucune. Périmètre prévu : ${current.writePlatforms.length ? escapeHtml(current.writePlatforms.map((id) => state.platformCatalog.find((item) => item.id === id)?.name || id).join(", ")) : "aucun"}.</p><div class="table-wrap"><table><thead><tr><th>Plateforme</th><th>Domaine</th><th>État simulé</th><th>Droit</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

function peopleHtml() {
  const selected = agent(selectedAgentId);
  const buttons = state.agents.map((item) => `<button class="${item.id === selectedAgentId ? "active" : ""}" data-agent="${item.id}">${item.icon} ${escapeHtml(item.name)}</button>`).join("");
  const books = selected.playbooks.map((id) => `<button class="ghost" data-book="${id}">${escapeHtml(state.playbooks.find((item) => item.id === id)?.title || id)}</button>`).join("");
  return `<div class="agent-list"><div class="card">${buttons}</div><article class="card doc">${renderMarkdown(selected.skillDocument)}<div class="actions">${books}</div>${playbookBody ? `<hr />${renderMarkdown(playbookBody)}` : ""}</article></div>`;
}

function journalHtml() {
  const events = state.audit.map((item) => {
    const effect = item.action === "execute" ? state.outbox.find((entry) => entry.taskId === item.taskId) : null;
    const result = effect ? (effect.leftTheBuilding ? "Transmis à l'extérieur." : "Résultat : rien n'a quitté le centre.") : "";
    return `<article class="card timeline"><p class="eyebrow">${escapeHtml(journalKind[item.action] || "Événement")}</p><h3>${escapeHtml(journalAction[item.action] || item.action)}</h3><p>${escapeHtml(agent(item.actorId)?.name || item.actorId)} · ${escapeHtml(when(item.at))}</p><p>${escapeHtml(item.detail)}</p>${result ? `<p class="muted">${escapeHtml(result)}</p>` : ""}</article>`;
  }).join("");
  return events || `<article class="card"><p class="muted">Aucun événement.</p></article>`;
}

function mainHtml() {
  if (view === "scope") return scopeHtml();
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
    return `<div class="dept">${escapeHtml(department.name)}</div>${people.map((item) => `<div><button data-agent="${item.id}">${item.icon} ${escapeHtml(item.name)}</button></div>`).join("")}`;
  }).join("");
  app.innerHTML = `<div class="shell">
    <aside class="sidebar">
      <p class="brand">Klirline<span>Centre de contrôle</span></p>
      <div class="priority">${escapeHtml(date)}<br />Priorité : ventes</div>
      <nav class="desktop-nav">${views.map(([id, label]) => `<button class="${view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}</nav>
      <details class="tree" ${window.innerWidth > 1100 ? "open" : ""}><summary>Organigramme</summary><div class="dept">CEO</div><div>👑 ${escapeHtml(state.company.founder)}</div>${tree}</details>
    </aside>
    <section class="stage">
      <header class="top">
        <div><p class="eyebrow">Klirline Inc.</p><h1>${views.find(([id]) => id === view)[1]}</h1></div>
        <div class="session">
          <label for="actor">Identité de démonstration</label>
          <select id="actor">${options}</select>
          <p class="hint">Le serveur vérifie le rôle de la décision. Il n'authentifie pas la personne. ${actorId === "ceo" ? `<button class="ghost" id="reset">Recommencer la démonstration</button>` : ""}</p>
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
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { view = button.dataset.view; sessionStorage.setItem("klirline-view", view); error = ""; render(); }));
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
  document.querySelector("#actor").addEventListener("change", (event) => { actorId = event.target.value; sessionStorage.setItem("klirline-actor", actorId); load().catch(showLoadError); });
  document.querySelector("#reset")?.addEventListener("click", () => post("/api/reset", { actorId }));
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

load().catch(showLoadError);
