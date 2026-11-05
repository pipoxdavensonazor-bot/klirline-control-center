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
import { HQ_RUNNING_LEASE_MS, HQ_STATUSES, claimHqCommand } from "./hq/commands.js";
import { dispatchHq } from "./hq/dispatch.js";
import { memoryHqStore } from "./hq/memory-store.js";
import { HQ_ROSTER, rosterAgent, routeCommand } from "./hq/roster.js";
import { HQ_INDEX, HQ_INSERT, HQ_SCHEMA, HQ_SELECT, HQ_UPDATE, hqSelectBindings } from "./hq/sql.js";
import { routeAccess } from "./routes.js";
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

check(routeAccess("/api/health", "GET") === "public" && routeAccess("/api/sites", "GET") === "public", "La santé et les sites restent publics");
check(routeAccess("/api/sites", "POST") === "session", "Un autre verbe sur les sites reste une route de session");
check(routeAccess("/api/playbooks/company", "GET") === "public", "Les playbooks restent publics");
check(routeAccess("/api/command", "POST") === "session", "La commande de démonstration exige la session");
check(routeAccess("/api/hq/command", "POST") === "session" && routeAccess("/api/hq/commands", "GET") === "session" && routeAccess("/api/hq/roster", "GET") === "session", "Le bureau exige la même session que les autres routes /api");
check(routeAccess("/api/hq/commands/hq-11111111-1111-4111-8111-111111111111/claim", "POST") === "session", "Le claim du bureau reste une route de session");
check(HQ_STATUSES.join() === "pending,queued,dispatched,running,awaiting_validation,blocked,done,failed,cancelled", "Les statuts du bureau couvrent la file, la reprise et la clôture");
check(HQ_RUNNING_LEASE_MS === 15 * 60 * 1000, "Le bail d'une commande running est de 15 minutes");

const hqIds = ["office-klirline", "ops-klirline", "klirbuild", "klirmarket", "klirprospect", "klirline-ai", "noria", "black-wall-news", "bwn-redaction", "klirline-social", "youtube-channel", "ic-market", "cmcmarkets", "all-question", "sandbox-klirline"];
check(HQ_ROSTER.map((agent) => agent.id).join() === hqIds.join(), "Le roster du bureau est la liste nommée, distincte des 34 postes");
check(new Set(HQ_ROSTER.map((agent) => agent.id)).size === HQ_ROSTER.length, "Les identifiants du bureau sont uniques");
check(new Set(HQ_ROSTER.map((agent) => agent.grokAgentName)).size === HQ_ROSTER.length, "Chaque agent Grok a un nom de routage");
check(HQ_ROSTER.every((agent) => ["Ops", "Produits", "Média", "Trading", "Autres"].includes(agent.division) && agent.mission && agent.grokAgentName), "Chaque carte a une division, une mission et un nom Grok");
check(rosterAgent("office-klirline").covers.map((item) => item.name).join() === "Centia,Klirline.ca,KlirSecure,KlirPay", "Les produits sans agent dédié restent chez Office Klirline");
check(HQ_ROSTER.filter((agent) => agent.covers.length).length === 1, "Les autres cartes n'héritent pas de ces produits");
const routed = (text) => routeCommand(text).agent.id;
check(routed("rédiger l'article Black Wall News") === "bwn-redaction", "Un article Black Wall va à la rédaction");
check(routed("ouvrir blackwallnews.com") === "black-wall-news", "Le site Black Wall va à son agent");
check(routed("estimation KlirBuild") === "klirbuild", "KlirBuild est reconnu");
check(routed("vitrine https://klirline.com") === "klirmarket", "klirline.com va à KlirMarket");
check(routed("voir https://centre.klirline.com") === "ops-klirline", "Le centre ne part pas vers KlirMarket");
check(routed("livraison Centia") === "office-klirline" && routed("écart KlirPay") === "office-klirline" && routed("constat KlirSecure") === "office-klirline" && routed("admin klirline.ca") === "office-klirline", "Les produits sans spécialiste reviennent à Office");
check(routed("position IC Market") === "ic-market" && routed("compte CMCMarkets") === "cmcmarkets", "Les comptes de trading sont reconnus");
check(routed("vidéo YouTube") === "youtube-channel" && routed("post Instagram") === "klirline-social", "Les canaux média sont reconnus");
check(routed("essai sandbox") === "sandbox-klirline", "Le bac à sable est reconnu");
check(routed("bonjour le bureau") === "all-question" && routeCommand("bonjour le bureau").routedBy === "triage", "Une commande sans cible part au triage");

const hqStore = memoryHqStore();
const createdHq = await dispatchHq(hqStore, {
  method: "POST",
  pathname: "/api/hq/command",
  searchParams: new URLSearchParams(),
  body: { text: "rédiger l'article Black Wall News", priority: "haute" },
  actorId: "ceo",
});
check(createdHq.status === 201 && createdHq.body.command.status === "pending" && createdHq.body.command.ownerSlug === "bwn-redaction", "Une commande du bureau naît en attente");
check(createdHq.body.mode === "hq" && createdHq.body.command.grokAgentName === "BWN Rédaction", "La réponse porte le nom Grok");
const pendingHq = await dispatchHq(hqStore, {
  method: "GET",
  pathname: "/api/hq/commands",
  searchParams: new URLSearchParams("status=pending"),
  body: {},
  actorId: "ceo",
});
check(pendingHq.body.commands.length === 1 && pendingHq.body.commands[0].id === createdHq.body.command.id, "La file pending contient la commande");
const explicitHq = await dispatchHq(hqStore, {
  method: "POST",
  pathname: "/api/hq/command",
  searchParams: new URLSearchParams(),
  body: { text: "rédiger l'article Black Wall News", ownerSlug: "sandbox-klirline" },
  actorId: "ceo",
});
check(explicitHq.body.command.ownerSlug === "sandbox-klirline" && explicitHq.body.command.routedBy === "explicit", "Un agent choisi gagne sur les mots-clés");
const doneHq = await dispatchHq(hqStore, {
  method: "PATCH",
  pathname: `/api/hq/commands/${createdHq.body.command.id}`,
  searchParams: new URLSearchParams(),
  body: { status: "done", result: "Article prêt", agentNote: "BWN Rédaction" },
  actorId: "ceo",
});
check(doneHq.status === 200 && doneHq.body.command.status === "done" && doneHq.body.command.result === "Article prêt" && doneHq.body.command.text.startsWith("rédiger"), "Le PATCH termine la commande sans réécrire l'ordre");
const stillPending = await dispatchHq(hqStore, {
  method: "GET",
  pathname: "/api/hq/commands",
  searchParams: new URLSearchParams("status=pending"),
  body: {},
  actorId: "ceo",
});
check(stillPending.body.commands.length === 1 && stillPending.body.commands[0].id === explicitHq.body.command.id, "Le filtre pending retire la commande terminée");
const rosterHq = await dispatchHq(hqStore, {
  method: "GET",
  pathname: "/api/hq/roster",
  searchParams: new URLSearchParams(),
  body: {},
  actorId: "ceo",
});
check(rosterHq.body.roster.length === HQ_ROSTER.length && rosterHq.body.roster.find((agent) => agent.id === "bwn-redaction").lastCommand.status === "done", "Le roster expose la dernière commande");
try {
  await dispatchHq(hqStore, { method: "POST", pathname: "/api/hq/command", searchParams: new URLSearchParams(), body: { text: "ok" }, actorId: "ceo" });
  check(false, "Une commande trop courte est refusée");
} catch (error) {
  check(error.status === 400, "Une commande trop courte est refusée");
}
try {
  await dispatchHq(hqStore, { method: "PATCH", pathname: `/api/hq/commands/${createdHq.body.command.id}`, searchParams: new URLSearchParams(), body: { status: "publie" }, actorId: "ceo" });
  check(false, "Un statut hors liste est refusé");
} catch (error) {
  check(error.status === 400, "Un statut hors liste est refusé");
}
try {
  await dispatchHq(hqStore, { method: "PATCH", pathname: `/api/hq/commands/${createdHq.body.command.id}`, searchParams: new URLSearchParams(), body: { status: "running" }, actorId: "ceo" });
  check(false, "Une commande close ne se rouvre pas");
} catch (error) {
  check(error.status === 409, "Une commande close ne se rouvre pas");
}

const reliability = memoryHqStore();
const t0 = new Date("2026-11-05T16:00:00.000Z");
const leaseMs = 60 * 1000;
const reliabilityCall = (method, pathname, body, at) => dispatchHq(reliability, {
  method,
  pathname,
  searchParams: new URLSearchParams(),
  body,
  actorId: "ceo",
  now: at,
  leaseMs,
});
const taken = await reliabilityCall("POST", "/api/hq/command", { text: "rédiger l'article Black Wall News", priority: "haute" }, t0);
const takenId = taken.body.command.id;
check(taken.body.command.proof === null && taken.body.command.leaseExpired === false && taken.body.command.status === "pending", "Une commande neuve n'a ni preuve ni bail");
const claimToken = "poll-office-001";
const firstClaim = await reliabilityCall("POST", `/api/hq/commands/${takenId}/claim`, { claimedBy: "office-klirline", claimToken }, t0);
check(firstClaim.status === 200 && firstClaim.body.started === true && firstClaim.body.reason === "claimed", "Le premier claim démarre une seule exécution");
check(firstClaim.body.command.status === "running" && firstClaim.body.command.claimToken === claimToken && firstClaim.body.command.activityNote === "Prise en charge par office-klirline.", "Le claim laisse une trace running");
const listedPending = await reliabilityCall("GET", "/api/hq/commands", {}, t0);
const pendingOnly = listedPending.body.commands.filter((command) => command.status === "pending");
check(pendingOnly.length === 0, "Le claim retire la commande de la file pending");
const runningList = await dispatchHq(reliability, { method: "GET", pathname: "/api/hq/commands", searchParams: new URLSearchParams("status=running"), body: {}, actorId: "ceo", now: t0, leaseMs });
check(runningList.body.commands.length === 1 && runningList.body.commands[0].leaseExpired === false, "La file running expose le bail encore ouvert");
const rival = await reliabilityCall("POST", `/api/hq/commands/${takenId}/claim`, { claimedBy: "autre-poll", claimToken: "autre-poll-0002" }, new Date(t0.getTime() + 1000));
check(rival.status === 200 && rival.body.started === false && rival.body.reason === "already_active" && rival.body.command.claimToken === null && rival.body.command.updatedAt === firstClaim.body.command.updatedAt, "Un second claim est un no-op et ne redémarre pas");
const replay = await reliabilityCall("POST", `/api/hq/commands/${takenId}/claim`, { claimedBy: "office-klirline", claimToken }, new Date(t0.getTime() + 2000));
check(replay.status === 200 && replay.body.started === false && replay.body.reason === "replay" && replay.body.command.leaseUntil === firstClaim.body.command.leaseUntil, "Le même jeton ne prolonge pas le bail et ne réécrit rien");
const heartbeatAt = new Date(t0.getTime() + 30 * 1000);
const heartbeat = await reliabilityCall("PATCH", `/api/hq/commands/${takenId}`, { status: "running", claimToken }, heartbeatAt);
check(heartbeat.status === 200 && heartbeat.body.command.claimedAt === heartbeatAt.toISOString() && heartbeat.body.command.leaseUntil === new Date(heartbeatAt.getTime() + leaseMs).toISOString() && heartbeat.body.command.claimToken === null, "Le PATCH running avec le même jeton prolonge le bail");
const stillHeld = await reliabilityCall("POST", `/api/hq/commands/${takenId}/claim`, { claimedBy: "autre-poll", claimToken: "autre-poll-0003" }, new Date(heartbeatAt.getTime() + 1000));
check(stillHeld.body.started === false && stillHeld.body.reason === "already_active", "Après le battement, l'autre poll ne prend pas la commande");
const staleAt = new Date(heartbeatAt.getTime() + leaseMs);
const reclaimed = await reliabilityCall("POST", `/api/hq/commands/${takenId}/claim`, { claimedBy: "reprise-office", claimToken: "reprise-poll-01" }, staleAt);
check(reclaimed.body.started === true && reclaimed.body.reason === "reclaimed" && reclaimed.body.command.status === "running" && reclaimed.body.command.claimToken === "reprise-poll-01", "Un running trop vieux est repris, pas dupliqué");
check(reclaimed.body.command.activityNote.includes("Interruption") && reclaimed.body.command.activityNote.includes("office-klirline") && reclaimed.body.command.updatedAt === staleAt.toISOString(), "La reprise laisse une note, un statut et updatedAt");
const afterReclaim = await reliabilityCall("GET", `/api/hq/commands/${takenId}`, {}, staleAt);
check(afterReclaim.body.command.claimedBy === "reprise-office" && afterReclaim.body.command.claimToken === null && afterReclaim.body.command.status === "running", "La lecture montre la reprise sans livrer le jeton");
try {
  await reliabilityCall("PATCH", `/api/hq/commands/${takenId}`, { status: "done", result: "   ", proof: "", agentNote: null }, staleAt);
  check(false, "done sans preuve est refusé");
} catch (error) {
  check(error.status === 400 && /preuve/i.test(error.message), "done sans preuve est refusé");
}
const untouched = await reliabilityCall("GET", `/api/hq/commands/${takenId}`, {}, staleAt);
check(untouched.body.command.status === "running" && untouched.body.command.claimedBy === "reprise-office" && untouched.body.command.updatedAt === staleAt.toISOString(), "Un refus de clôture ne change pas la commande");
const proved = await reliabilityCall("PATCH", `/api/hq/commands/${takenId}`, { status: "done", proof: "Brouillon déposé au bureau" }, staleAt);
check(proved.status === 200 && proved.body.command.status === "done" && proved.body.command.proof === "Brouillon déposé au bureau", "La preuve seule permet de clore");
const noteOnly = await reliabilityCall("POST", "/api/hq/command", { text: "noter la veille KlirBuild", ownerSlug: "klirbuild" }, t0);
const noted = await reliabilityCall("PATCH", `/api/hq/commands/${noteOnly.body.command.id}`, { status: "done", agentNote: "Veille consignée" }, t0);
check(noted.body.command.status === "done" && noted.body.command.agentNote === "Veille consignée", "Une note d'agent suffit comme preuve");
const blocked = await reliabilityCall("POST", "/api/hq/command", { text: "tenir le centre", ownerSlug: "ops-klirline" }, t0);
const waiting = await reliabilityCall("PATCH", `/api/hq/commands/${blocked.body.command.id}`, { status: "awaiting_validation" }, t0);
const refusedClaim = await reliabilityCall("POST", `/api/hq/commands/${blocked.body.command.id}/claim`, { claimToken: "claim-attente-01" }, t0);
check(waiting.body.command.status === "awaiting_validation" && refusedClaim.status === 409 && refusedClaim.body.started === false && refusedClaim.body.reason === "not_claimable", "awaiting_validation ne se réclame pas");
const failed = await reliabilityCall("PATCH", `/api/hq/commands/${blocked.body.command.id}`, { status: "failed", agentNote: "Source indisponible" }, t0);
check(failed.body.command.status === "failed", "failed se pose sans exiger la preuve de done");
const closedClaim = await reliabilityCall("POST", `/api/hq/commands/${takenId}/claim`, { claimToken: "reprise-poll-01" }, staleAt);
check(closedClaim.status === 409 && closedClaim.body.reason === "terminal" && closedClaim.body.command.status === "done", "Une commande done ne se réclame plus");
const queued = claimHqCommand({ ...taken.body.command, status: "queued", claimToken: null, claimedAt: null }, { claimedBy: "office-klirline", claimToken: "file-claim-001" }, { now: t0, actorId: "ceo" });
const dispatched = claimHqCommand({ ...taken.body.command, status: "dispatched", claimToken: null, claimedAt: null }, { claimedBy: "office-klirline", claimToken: "emis-claim-01" }, { now: t0, actorId: "ceo" });
check(queued.started === true && queued.command.status === "running" && dispatched.started === true, "queued et dispatched se prennent comme pending");
const bureauDoc = fs.readFileSync(dataPath("knowledge", "hq-bureau.md"), "utf8");
const bureauUi = fs.readFileSync(dataPath("public", "app.js"), "utf8");
check(bureauDoc.includes("15 minutes") && bureauDoc.includes("preuve") && bureauDoc.includes("claimToken"), "Le playbook décrit le bail, le claim et la preuve");
check(bureauUi.includes("<strong>Preuve.</strong>") && bureauUi.includes('awaiting_validation: "À valider"') && bureauUi.includes('failed: "Échoué"'), "La colonne Fait peut afficher la preuve et les statuts ajoutés");
const demoUntouched = issueCommand(state, "ceo", "trouver 10 prospects");
check(demoUntouched.origin === "command" && demoUntouched.ownerId === "prospecting", "La commande de démonstration reste sur les 34 postes");

process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning") return;
  console.error(warning.stack || warning.message);
});
const { DatabaseSync } = await import("node:sqlite");
const hqDb = new DatabaseSync(":memory:");
hqDb.exec(HQ_SCHEMA);
hqDb.exec(HQ_INDEX);
const insertHq = hqDb.prepare(HQ_INSERT);
const selectHq = hqDb.prepare(HQ_SELECT);
const first = createdHq.body.command;
const second = explicitHq.body.command;
insertHq.run(first.id, first.status, first.ownerSlug, first.division, first.createdAt, JSON.stringify(first));
insertHq.run(second.id, second.status, second.ownerSlug, second.division, second.createdAt, JSON.stringify(second));
const pendingRows = selectHq.all(...hqSelectBindings({ status: "pending" })).map((row) => JSON.parse(row.body));
check(pendingRows.length === 2, "Le SQL du bureau retrouve les commandes en attente");
hqDb.prepare(HQ_UPDATE).run("done", first.ownerSlug, first.division, JSON.stringify({ ...first, status: "done" }), first.id);
const pendingAfter = selectHq.all(...hqSelectBindings({ status: "pending" })).map((row) => JSON.parse(row.body));
check(pendingAfter.length === 1 && pendingAfter[0].id === second.id, "Le SQL du bureau retire une commande passée à done");
const doneRows = selectHq.all(...hqSelectBindings({ status: "done" })).map((row) => JSON.parse(row.body));
check(doneRows.length === 1 && doneRows[0].status === "done", "Le SQL du bureau enregistre un PATCH");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK — ${agents.length} postes, ${state.tasks.length} tâches, chaîne de validation tenue.`);
