const views = [
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
const actionLabel = {
  recommend: "Recommander au CEO",
  approve: "Approuver",
  reject: "Refuser",
  execute: "Consigner l'action",
  block: "Geler",
  release: "Lever le gel",
};

let actorId = sessionStorage.getItem("klirline-actor") || "ceo";
let view = "report";
let selectedTaskId = null;
let selectedAgentId = "chief-of-staff";
let playbookId = null;
let playbookBody = "";
let state = null;
let error = "";
let note = "";

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
  if (artifact.kind === "platform") return `<p>${escapeHtml(artifact.platform)} · ${escapeHtml(artifact.status)}</p><p>${escapeHtml(artifact.note)}</p>`;
  if (artifact.kind === "worklist") return `<ul>${artifact.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  return `<pre>${escapeHtml(artifact.text || "")}</pre>`;
}

function detailHtml(task) {
  if (!task) return `<div class="detail"><h2>Dossier</h2><p class="muted">Choisissez une tâche. Le supérieur voit les siennes. Le CEO ne signe que ce qui lui a été recommandé.</p></div>`;
  const owner = agent(task.ownerId);
  const supervisor = agent(task.supervisorId);
  const buttons = task.actions.map((action) => `<button class="${action === "reject" || action === "block" ? "danger" : ""}" data-decision="${action}">${actionLabel[action] || action}</button>`).join("");
  const outcomes = task.actions.includes("log_call") ? `<div class="actions">${["joignable", "message", "refus", "demo"].map((item) => `<button class="ghost" data-outcome="${item}">${item}</button>`).join("")}</div>` : "";
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
    <textarea id="note" placeholder="Note de validation">${escapeHtml(note)}</textarea>
    <div class="actions">${buttons}</div>
    ${outcomes}
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  </div>`;
}

function reportHtml() {
  const report = state.briefing;
  const lane = (title, items) => `<section class="lane"><h3>${title}</h3>${items.length ? items.join("") : `<p class="muted">Rien</p>`}</section>`;
  const finance = state.briefing.finance;
  return `<div class="banner">Cerveau local actif. Les agents préparent avec les playbooks même sans réseau. Envoyer, appeler, payer ou publier réellement exige un connecteur : ici, l'action approuvée est consignée et ne quitte pas la machine.</div>
  <div class="lanes">
    ${lane("À approuver", report.decisionsReady.map((item) => taskButton(item)))}
    ${lane("À surveiller", report.decisionsWaiting.map((item) => taskButton(item)))}
    ${lane("Urgent", report.blocked.map((item) => taskButton(item)))}
    ${lane("Opportunités", report.sales.priority.map((item) => `<p>${escapeHtml(item.company)} · ${item.score} · ${escapeHtml(item.action)}</p>`))}
    ${lane("Résultats", report.results.map((item) => `<p>${escapeHtml(item)}</p>`))}
  </div>
  <div class="grid">
    <article class="card"><h3>Ventes</h3><p>${report.sales.prospects} prospects actifs. Démos : ${escapeHtml(report.sales.demos.join(" · ") || "aucune")}</p></article>
    <article class="card"><h3>Finance</h3><p>Revenus ${money(finance.revenue)} · dépenses ${money(finance.expenses)} · factures ouvertes ${money(finance.receivables)}</p><p class="muted">${escapeHtml(finance.source)}</p></article>
    <article class="card"><h3>Opérations</h3>${report.operations.degraded.map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Toutes les plateformes sont opérationnelles dans l'état local.</p>"}</article>
    <article class="card"><h3>Clients</h3>${report.customers.map((item) => `<p>${escapeHtml(item)}</p>`).join("") || "<p>Aucune alerte à deux signaux.</p>"}</article>
  </div>`;
}

function listHtml(tasks) {
  if (!tasks.length) return `<p class="muted">Aucune tâche dans cette file pour ${escapeHtml(agent(actorId).name)}.</p>`;
  return tasks.map((task) => `<article class="card"><div class="chips">${chip(`l${task.level}`, levelLabel[task.level])}${chip(task.status, statusLabel[task.status])}</div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.summary)}</p><button class="ghost" data-task="${task.id}">Ouvrir le dossier</button></article>`).join("");
}

function workHtml() {
  return state.departments.map((department) => {
    const tasks = state.tasks.filter((task) => task.department === department.id);
    const lead = agent(department.lead);
    return `<article class="card"><h3>${escapeHtml(department.name)}</h3><p class="muted">Supérieur : ${escapeHtml(lead.name)}</p>${tasks.map((task) => `<div class="row-line"><span>${escapeHtml(task.title)}</span><span class="muted">${escapeHtml(agent(task.ownerId).name)}</span></div>`).join("")}</article>`;
  }).join("");
}

function platformsHtml() {
  const current = agent(actorId);
  const rows = state.platforms.map((platform) => {
    const name = state.platformCatalog.find((item) => item.id === platform.id);
    const write = current.writePlatforms.includes(platform.id) ? "Écriture" : "Lecture";
    return `<tr><td>${escapeHtml(name.name)}</td><td>${escapeHtml(name.domain)}</td><td>${escapeHtml(platform.status)}</td><td>${write}</td><td>${escapeHtml(platform.note)}</td></tr>`;
  }).join("");
  return `<article class="card"><h3>Un seul accès</h3><p>${escapeHtml(current.name)} lit les huit plateformes par le centre de contrôle. Écriture : ${current.writePlatforms.length ? escapeHtml(current.writePlatforms.join(", ")) : "aucune"}.</p><table><thead><tr><th>Plateforme</th><th>Domaine</th><th>État</th><th>Droit</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></article>`;
}

function peopleHtml() {
  const selected = agent(selectedAgentId);
  const buttons = state.agents.map((item) => `<button class="${item.id === selectedAgentId ? "active" : ""}" data-agent="${item.id}">${item.icon} ${escapeHtml(item.name)}</button>`).join("");
  const books = selected.playbooks.map((id) => `<button class="ghost" data-book="${id}">${escapeHtml(state.playbooks.find((item) => item.id === id)?.title || id)}</button>`).join("");
  return `<div class="agent-list"><div class="card">${buttons}</div><article class="card doc">${renderMarkdown(selected.skillDocument)}<div class="actions">${books}</div>${playbookBody ? `<hr />${renderMarkdown(playbookBody)}` : ""}</article></div>`;
}

function journalHtml() {
  const lines = state.audit.map((item) => `<div class="row-line"><span>${escapeHtml(agent(item.actorId)?.name || item.actorId)} · ${escapeHtml(item.action)}</span><span class="muted">${escapeHtml(item.detail)}</span></div>`).join("");
  const outbox = state.outbox.map((item) => `<div class="row-line"><span>${escapeHtml(item.title)}</span><span class="muted">${escapeHtml(item.detail)}</span></div>`).join("");
  return `<article class="card"><h3>Journal d'exécution</h3>${outbox || `<p class="muted">Rien n'a encore été consigné.</p>`}</article><article class="card"><h3>Audit</h3>${lines}</article>`;
}

function mainHtml() {
  if (view === "report") return reportHtml();
  if (view === "queue") return `<div class="grid">${listHtml(state.tasks.filter((task) => task.actions.length))}</div>`;
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
      <nav>${views.map(([id, label]) => `<button class="${view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}</nav>
      <div class="tree"><div class="dept">CEO</div><div>👑 ${escapeHtml(state.company.founder)}</div>${tree}</div>
    </aside>
    <section class="stage">
      <header class="top">
        <div><p class="eyebrow">Klirline Inc.</p><h1>${views.find(([id]) => id === view)[1]}</h1></div>
        <div class="session">
          <label for="actor">Session de validation</label>
          <select id="actor">${options}</select>
          <p class="hint">Le rôle choisi est l'identité qui valide. ${actorId === "ceo" ? `<button class="ghost" id="reset">Recommencer la démonstration</button>` : ""}</p>
        </div>
      </header>
      <div class="layout ${showDetail ? "" : "single"}">
        <div>${mainHtml()}</div>
        ${showDetail ? detailHtml(selected) : ""}
      </div>
    </section>
  </div>`;
  bind();
}

function bind() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { view = button.dataset.view; error = ""; render(); }));
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
