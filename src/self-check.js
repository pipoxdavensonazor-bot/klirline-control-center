import fs from "node:fs";
import { generateKeyPairSync, createSign } from "node:crypto";
import { buildDay, decide, execute, issueCommand, logCall, briefing } from "./engine.js";
import { present } from "./present.js";
import { agents, assertOrganization, skillDocument } from "./org/index.js";
import { THRESHOLDS, canViewAdminHub } from "./policy.js";
import { ACCESS_VALUES, PRODUCT_SITES, productSiteFields } from "./product-sites.js";
import { activeProspects, seedWorld } from "./seed.js";
import { dataPath } from "./store.js";
import { accessSettings, bindIdentity, orgObjectName, verifyAccessJwt } from "./access.js";
import { API_LIMITS, rateKey, take } from "./limits.js";
import { readProspectFeed } from "./prospect-feed.js";

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
const opening = briefing(state);
check(opening.finance.revenue === 18400 && opening.finance.receivables === 1210, "Les revenus et les factures ouvertes restent distincts");
check(opening.finance.proposalTotal === 6300 && opening.finance.proposalCount === 2, "Seules les propositions déjà chiffrées sont additionnées");
const outreachLoad = opening.agentLoad.find((item) => item.ownerId === "outreach");
check(outreachLoad?.open >= 1 && outreachLoad.blocked >= 1, "La charge sépare les tâches ouvertes et les tâches bloquées");

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
try {
  execute(state, followUp.id, "outreach");
  check(false, "Une relance déjà consignée ne part pas une seconde fois");
} catch (error) {
  check(error.status === 409, "Une relance déjà consignée ne part pas une seconde fois");
}
check(state.prospects.find((item) => item.id === "p-clinique").touches === after, "Le compteur de relance ne double pas");
check(state.outbox.some((item) => item.type === "send_email" && item.leftTheBuilding === false), "Le courriel reste dans le journal");
const mailAudit = state.audit.find((item) => item.action === "execute" && item.taskId === followUp.id);
check(mailAudit?.executionStatus === "simulated" && mailAudit.previousState === "approved", "L'audit marque l'envoi comme simulé");

decide(state, content.id, "marketing-director", "approve", "Voix conforme");
execute(state, content.id, "content");
check(content.status === "executed", "Le contenu validé est consigné, pas publié tout seul");

check(campaign.level === 3 && campaign.status === "pending_supervisor", "La campagne payante attend sa directrice");

const call = state.tasks.find((task) => task.title.startsWith("Appeler Construction"));
decide(state, call.id, "sales-director", "approve", "Base enregistrée");
execute(state, call.id, "outreach");
logCall(state, call.id, "outreach", "demo", "Démo acceptée");
check(state.tasks.some((task) => task.handoffFrom === call.id && task.ownerId === "appointments"), "Un rendez-vous doit passer à l'agent rendez-vous");
try {
  logCall(state, call.id, "outreach", "refus", "Second essai");
  check(false, "Un compte-rendu d'appel ne s'écrit pas deux fois");
} catch (error) {
  check(error.status === 409, "Un compte-rendu d'appel ne s'écrit pas deux fois");
}

const report = briefing(state);
check(report.sales.priority[0].score === 94 && report.sales.priority[0].potentialCad === 4500, "Le score 94 et le potentiel 4 500 $ restent séparés");
check(report.sales.priority.find((item) => item.company === "Groupe Horizon Santé").potentialCad === null, "Aucun potentiel n'est inventé");
check(String(report.finance.source).includes("démonstration"), "La finance reste marquée comme démonstration");
check(report.blocked.some((item) => item.title.includes("Banque")), "Le rapport montre l'appel bloqué");
check(report.customers.some((item) => item.includes("Café Rivière")), "Le rapport montre le client à risque");

const ordered = issueCommand(state, "ceo", "trouver 10 prospects");
check(ordered.ownerId === "prospecting", "Un ordre de prospects va au prospecteur");
check(ordered.artifact.kind === "prospect-search" && ordered.artifact.local.length === 5, "Le prospecteur remet les cinq fiches connues");
check(ordered.artifact.missing === 10 && ordered.artifact.live.length === 0, "Les fiches réelles manquantes ne sont pas inventées");
const abcOrder = ordered.artifact.local.find((item) => item.company === "Construction ABC");
check(abcOrder?.contact === "Marc Béland" && abcOrder.need && abcOrder.email && abcOrder.reasons.length, "La fiche commandée contient le contact, le besoin et les raisons");
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
try {
  issueCommand(state, "intrus", "trouver 10 prospects");
  check(false, "Un rôle inconnu est refusé");
} catch (error) {
  check(error.status === 403, "Un rôle inconnu est refusé");
}
try {
  issueCommand(state, "ceo", "x".repeat(501));
  check(false, "Un ordre trop long est refusé");
} catch (error) {
  check(error.status === 400, "Un ordre trop long est refusé");
}

check(!accessSettings({}).ready, "Sans configuration Access, aucun compte n'est prêt");
const trial = accessSettings({
  ACCESS_TEAM_DOMAIN: "equipe.cloudflareaccess.com",
  ACCESS_AUD: "aud-essai",
  ACCESS_ACCOUNTS: JSON.stringify([{ email: "ada@example.com", role: "ceo", orgId: "klirline" }]),
});
check(trial.ready, "Une configuration d'essai complète est reconnaissable");
check(!accessSettings({ ...{ ACCESS_TEAM_DOMAIN: trial.teamDomain, ACCESS_AUD: trial.aud, ACCESS_ACCOUNTS: JSON.stringify([{ email: "ada@example.com", role: "inconnu", orgId: "klirline" }]) } }).ready, "Un rôle hors organigramme est refusé");
const identity = bindIdentity(trial.accounts[0]);
check(identity.actorId === "ceo" && identity.orgId === "klirline", "Le rôle et l'organisation viennent du compte");
check(orgObjectName("autre-societe") !== identity.orgId, "Une autre organisation ne partage pas cet objet");
try {
  orgObjectName("api-rate");
  check(false, "Le nom du limiteur n'est pas une organisation");
} catch (error) {
  check(error.status === 500, "Le nom du limiteur n'est pas une organisation");
}
const samePerson = rateKey({ email: "Ada@example.com", ip: "203.0.113.5" });
check(samePerson === rateKey({ email: "ada@example.com", ip: "198.51.100.8" }), "La limite suit le courriel vérifié");
check(rateKey({ ip: "203.0.113.5" }) === "ip:203.0.113.5", "Sans courriel, la limite suit l'adresse de connexion");
const bucket = new Map();
const client = rateKey({ ip: "203.0.113.5" });
for (let i = 0; i < API_LIMITS.maxRequests; i += 1) check(take(bucket, client, 1_000).allowed, "La fenêtre accepte le débit prévu");
const blockedLimit = take(bucket, client, 1_000);
check(!blockedLimit.allowed && blockedLimit.retryAfter >= 1, "Le dépassement répond par un refus");
check(!take(bucket, rateKey({ ip: "203.0.113.5" }), 1_000).allowed, "Changer de rôle ne change pas la clé de limite");
check(take(bucket, rateKey({ ip: "203.0.113.6" }), 1_000).allowed, "Une autre adresse a sa propre fenêtre");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "essai";
const nowMs = Date.parse("2026-10-08T02:00:00Z");
const sign = (claims) => {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "essai" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const data = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(data).sign(privateKey).toString("base64url");
  return `${data}.${signature}`;
};
const claims = { email: "Ada@example.com", aud: "aud-essai", iss: "https://equipe.cloudflareaccess.com", exp: nowMs / 1000 + 60 };
const accepted = await verifyAccessJwt(sign(claims), { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs });
check(accepted.email === "ada@example.com", "Le jeton Access valide le courriel");
try {
  await verifyAccessJwt(sign({ ...claims, aud: "autre" }), { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs });
  check(false, "Une audience différente est refusée");
} catch (error) {
  check(error.status === 401, "Une audience différente est refusée");
}
try {
  await verifyAccessJwt(sign({ ...claims, exp: nowMs / 1000 - 10 }), { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs });
  check(false, "Un jeton expiré est refusé");
} catch (error) {
  check(error.status === 401, "Un jeton expiré est refusé");
}
try {
  const forged = `${Buffer.from(JSON.stringify({ alg: "none", kid: "essai" })).toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.aa`;
  await verifyAccessJwt(forged, { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs });
  check(false, "Un jeton non signé est refusé");
} catch (error) {
  check(error.status === 401, "Un jeton non signé est refusé");
}

const liveFeed = readProspectFeed({
  prospects: [{ company: "Atelier Nord", product: "Construction", score: 80, action: "Visite", public_email: "secret@example.com" }],
});
check(liveFeed.status === "ready" && liveFeed.prospects.length === 1, "Une fiche réelle est conservée");
check(liveFeed.prospects[0].company === "Atelier Nord" && liveFeed.prospects[0].score === 80, "La fiche garde l'entreprise, le produit et le score");
check(!Object.hasOwn(liveFeed.prospects[0], "public_email") && !JSON.stringify(liveFeed).includes("@"), "La lecture retire le courriel");
check(readProspectFeed({ prospects: [] }).status === "empty", "Une liste vide reste vide");
check(readProspectFeed(null).status === "invalid", "Une réponse illisible est refusée");

check(PRODUCT_SITES.length === 11, "Onze sites produits, NORIA compris");
check(new Set(PRODUCT_SITES.map((site) => site.id)).size === PRODUCT_SITES.length, "Les identifiants de sites sont uniques");
const sitesById = Object.fromEntries(PRODUCT_SITES.map((site) => [site.id, site]));
for (const site of PRODUCT_SITES) {
  const fields = productSiteFields(site);
  check(ACCESS_VALUES.has(fields.access), `${site.id} : mode d'accès hors liste`);
  check(Object.hasOwn(site, "adminUrl") && Object.hasOwn(site, "access"), `${site.id} sans adminUrl ou access`);
}
const cfAccessIds = ["klirline-os", "klirbuild", "klirpay", "klirmarket", "klirsecure", "centia", "klir-ia", "black-wall-news", "noria"];
for (const id of cfAccessIds) {
  const fields = productSiteFields(sitesById[id]);
  check(fields.access === "cf-access" && typeof fields.adminUrl === "string" && fields.adminUrl.startsWith("https://"), `${id} est derrière Cloudflare Access avec un lien admin`);
}
check(productSiteFields({ id: "essai", access: "cf-access", adminUrl: "https://exemple.klirline.ca/admin" }).adminUrl === "https://exemple.klirline.ca/admin", "cf-access accepte un adminUrl");
for (const access of ["cf-challenge", "none"]) {
  let rejected = false;
  try {
    productSiteFields({ id: "essai", access, adminUrl: "https://exemple.klirline.ca/admin" });
  } catch {
    rejected = true;
  }
  check(rejected, `Un lien admin est refusé pour ${access}`);
}
check(sitesById.klirbuild.adminUrl === "https://klirline.app/login" && sitesById.klirbuild.healthUrl === "https://klirline.app/api/health", "KlirBuild garde sa santé et son login");
check(sitesById.klirpay.adminUrl === "https://pay.klirline.ca/login", "KlirPay pointe vers /login");
check(sitesById["black-wall-news"].name === "Black Wall News" && sitesById["black-wall-news"].url === "https://www.blackwallnews.com" && sitesById["black-wall-news"].adminUrl === "https://www.blackwallnews.com/admin", "Black Wall News a son site et son admin");
check(sitesById.noria.name === "NORIA" && sitesById.noria.url === "https://noriaedu.com" && sitesById.noria.adminUrl === "https://noriaedu.com/app#admin" && new URL(sitesById.noria.adminUrl).hash === "#admin", "NORIA garde le lien admin avec le fragment #admin");
check(sitesById["klirline-os"].adminUrl === "https://www.klirline.ca/admin", "Klirline OS pointe vers /admin");
check(sitesById.klirmarket.adminUrl === "https://klirline.com/admin", "KlirMarket pointe vers /admin");
check(sitesById.klirsecure.adminUrl === "https://secure.klirline.ca/", "KlirSecure pointe vers son panneau");
check(sitesById.centia.adminUrl === "https://centia.app/connexion", "Centia pointe vers /connexion");
check(sitesById["klir-ia"].skillsUrl === "https://klirline.io/api/skills" && sitesById["klir-ia"].adminUrl === "https://klirline.io/dashboard/admin/credits", "Klir IA garde son catalogue et son panneau crédits");
check(sitesById.klirlead.adminUrl === null && sitesById.klirlead.access === "none" && sitesById.klirlead.url === "https://scintillating-croissant-147cda.netlify.app", "KlirLead garde l'adresse Netlify, sans admin");
check(sitesById.klirprospect.url === "https://klirprospect.klirline.ca" && sitesById.klirprospect.adminUrl === "https://klirprospect.klirline.ca/#/login" && sitesById.klirprospect.access === "public-login" && new URL(sitesById.klirprospect.adminUrl).hash === "#/login", "KlirProspect pointe vers la connexion publique #/login");
check(canViewAdminHub("ceo"), "Le CEO voit le hub admin");
check(!canViewAdminHub("coo") && !canViewAdminHub("pm-klirbuild") && !canViewAdminHub("chief-of-staff"), "Le hub admin n'est pas ouvert aux autres postes");
check(present(state, "ceo", []).adminHub === true, "Le bootstrap CEO ouvre le hub admin");
check(present(state, "coo", []).adminHub === false, "Le bootstrap des autres postes ferme le hub admin");
check(present(state, "ceo", []).platforms.length === 8, "Les huit plateformes simulées restent dans le bootstrap");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK — ${agents.length} postes, ${state.tasks.length} tâches, chaîne de validation tenue.`);
