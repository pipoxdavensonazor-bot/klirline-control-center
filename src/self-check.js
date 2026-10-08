import fs from "node:fs";
import { buildDay, decide, execute, issueCommand, logCall, briefing } from "./engine.js";
import { agents, assertOrganization, skillDocument } from "./org/index.js";
import { THRESHOLDS } from "./policy.js";
import { activeProspects, seedWorld } from "./seed.js";
import { dataPath } from "./store.js";

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

assertOrganization();
check(agents.length === 34, `34 postes attendus, reçu ${agents.length}`);

for (const agent of agents) {
  const doc = skillDocument(agent);
  check(doc.includes("## Compétences"), `${agent.id} sans document de compétences`);
  check(agent.playbooks.every((id) => fs.existsSync(dataPath("knowledge", `${id}.md`))), `${agent.id} playbook manquant`);
  check(agent.readPlatforms === "*", `${agent.id} devrait lire toutes les plateformes`);
}

const expected = ["ceo", "chief-of-staff", "analytics", "sales-director", "prospecting", "outreach", "appointments", "proposals", "marketing-director", "content", "seo", "advertising", "coo", "pm-klirprospect", "pm-klirlead", "pm-klirline-os", "pm-klirbuild", "pm-klirpay", "pm-klirmarket", "pm-klirsecure", "pm-centia", "cs-director", "onboarding", "support", "account-manager", "retention", "finance-director", "accounting", "billing", "collections", "financial-analyst", "cashflow", "security-director", "compliance"];
check(expected.every((id) => agents.some((agent) => agent.id === id)), "Un poste attendu manque");

const world = seedWorld();
const ranked = activeProspects(world.prospects);
check(ranked[0].score === 94 && ranked[0].action === "Appeler", "Construction ABC devrait scorer 94 et être à appeler");
check(ranked.find((item) => item.id === "p-horizon").score === 91, "Horizon devrait scorer 91");
check(ranked.find((item) => item.id === "p-banque").score === 87, "Banque devrait scorer 87");
check(ranked.find((item) => item.id === "p-atlas").score === 83 && ranked.find((item) => item.id === "p-atlas").action === "Proposition", "Atlas devrait scorer 83");
check(!ranked.some((item) => item.id === "p-clinique-doublon"), "Le doublon ne doit pas rester dans le classement");

const state = { ...world, tasks: buildDay(world), audit: [], outbox: [], calls: [] };
check(state.tasks.every((task) => task.ownerId && task.supervisorId), "Tâche sans propriétaire ou sans supérieur");
check(state.tasks.filter((task) => task.level === 1).every((task) => task.status === "done"), "Le niveau 1 doit être terminé sans validation");

const proposal = state.tasks.find((task) => task.action?.type === "commit_proposal" && task.action.amount >= THRESHOLDS.contractCeoCad);
const expense = state.tasks.find((task) => task.action?.type === "payment_order" && task.action.amount === 850);
const refund = state.tasks.find((task) => task.action?.anomaly);
const blockedCall = state.tasks.find((task) => task.security.hard);
const followUp = state.tasks.find((task) => task.title.includes("Clinique du Parc") && task.action?.type === "send_email");
const content = state.tasks.find((task) => task.action?.type === "publish_content");
const campaign = state.tasks.find((task) => task.action?.type === "launch_campaign");

try {
  decide(state, proposal.id, "ceo", "approve", "");
  check(false, "Le CEO ne doit pas signer avant la recommandation");
} catch (error) {
  check(error.status === 403, "Refus de signature prématurée");
}

try {
  decide(state, proposal.id, "outreach", "recommend", "Je recommande");
  check(false, "Un agent ne recommande pas à la place de son supérieur");
} catch (error) {
  check(error.status === 403, "L'agent relance ne peut pas recommander");
}

decide(state, proposal.id, "sales-director", "recommend", "Périmètre conforme");
check(proposal.status === "pending_ceo", "La recommandation doit ouvrir la signature CEO");
decide(state, proposal.id, "ceo", "approve", "Signé");
execute(state, proposal.id, "proposals");
check(proposal.status === "executed", "La proposition signée se consigne");
check(state.outbox[0].leftTheBuilding === false, "Rien ne doit quitter la machine");

decide(state, expense.id, "finance-director", "recommend", "Fournisseur identifié");
decide(state, expense.id, "ceo", "approve", "Dépense acceptée");
execute(state, expense.id, "cashflow");
check(expense.status === "executed" && state.outbox[0].detail.includes("Aucun argent"), "Le paiement signé reste un ordre, pas un virement");

try {
  execute(state, refund.id, "ceo");
  check(false, "Le remboursement gelé ne s'exécute pas");
} catch (error) {
  check(error.status === 409, "Gel du remboursement");
}

try {
  decide(state, blockedCall.id, "security-director", "release", "");
  check(false, "L'appel sans base ne se débloque pas");
} catch (error) {
  check(error.status === 409, "Interdiction dure d'appel");
}

const before = world.prospects.find((item) => item.id === "p-clinique").touches;
decide(state, followUp.id, "sales-director", "approve", "Séquence conforme");
execute(state, followUp.id, "outreach");
const after = state.prospects.find((item) => item.id === "p-clinique").touches;
check(after === before + 1, "La relance approuvée avance le compteur local");
check(state.outbox.some((item) => item.type === "send_email" && item.leftTheBuilding === false), "Le courriel reste dans le journal");

decide(state, content.id, "marketing-director", "approve", "Voix conforme");
execute(state, content.id, "content");
check(content.status === "executed", "Le contenu validé est consigné, pas publié tout seul");

check(campaign.level === 3 && campaign.status === "pending_supervisor", "La campagne payante attend sa directrice");

const call = state.tasks.find((task) => task.title.startsWith("Appeler Construction"));
decide(state, call.id, "sales-director", "approve", "Base enregistrée");
execute(state, call.id, "outreach");
logCall(state, call.id, "outreach", "demo", "Démo acceptée");
check(state.tasks.some((task) => task.handoffFrom === call.id && task.ownerId === "appointments"), "Un rendez-vous doit passer à l'agent rendez-vous");

const report = briefing(state);
check(report.sales.priority[0].score === 94, "Le rapport ventes ouvre sur le score 94");
check(report.blocked.some((item) => item.title.includes("Banque")), "Le rapport montre l'appel bloqué");
check(report.customers.some((item) => item.includes("Café Rivière")), "Le rapport montre le client à risque");

const ordered = issueCommand(state, "ceo", "trouver 10 prospects");
check(ordered.ownerId === "prospecting", "Un ordre de prospects va au prospecteur");
check(ordered.artifact.items.some((line) => line.includes("Construction ABC")), "Le prospecteur cite les fiches connues");
check(state.audit[0].actorId === "chief-of-staff" && state.audit[0].action === "assign", "Le chef de cabinet transmet l'ordre");
check(state.audit[1].actorId === "ceo" && state.audit[1].action === "command", "Le CEO passe la commande");
try {
  issueCommand(state, "prospecting", "trouver 10 prospects");
  check(false, "Un agent ne passe pas la commande du CEO");
} catch (error) {
  check(error.status === 403, "Un agent ne passe pas la commande du CEO");
}
const letter = issueCommand(state, "ceo", "faire une lettre pour Construction ABC");
check(letter.artifact.kind === "letter" && letter.artifact.body.includes("Philippe Azor"), "La lettre est rédigée et signée");
check(letter.artifact.body.includes("Marc Béland"), "La lettre nomme le destinataire connu");
check(letter.artifact.body.includes("ne part pas"), "La lettre reste au bureau");
const mail = issueCommand(state, "ceo", "faire un courriel");
check(mail.artifact.kind === "email" && mail.artifact.body.includes("STOP"), "Le courriel est rédigé avec un droit de retrait");
check(mail.ownerId === "outreach", "Le courriel est préparé par l'agent relance");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK — ${agents.length} postes, ${state.tasks.length} tâches, chaîne de validation tenue.`);
