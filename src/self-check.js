import fs from "node:fs";
import { generateKeyPairSync, createSign } from "node:crypto";
import { buildDay, decide, execute, issueCommand, logCall, briefing } from "./engine.js";
import { present } from "./present.js";
import { agents, assertOrganization, skillDocument } from "./org/index.js";
import { THRESHOLDS, canViewAdminHub } from "./policy.js";
import { ACCESS_VALUES, PRODUCT_SITES, productSiteFields } from "./product-sites.js";
import { activeProspects, seedWorld } from "./seed.js";
import { dataPath } from "./store.js";
import { accessSettings, assertServiceRoute, bindIdentity, HQ_SERVICE_ACTOR, identityFromAccess, orgObjectName, parseServiceClientIds, verifyAccessJwt } from "./access.js";
import { identifyAccess } from "./hq/machine-auth.js";
import { HQ_LEASE_MS, hashClaimToken } from "./hq/commands.js";
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
  await verifyAccessJwt(sign({ ...claims, iss: "https://autre.cloudflareaccess.com" }), { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs });
  check(false, "Un émetteur différent est refusé");
} catch (error) {
  check(error.status === 401, "Un émetteur différent est refusé");
}
try {
  const pieces = sign(claims).split(".");
  pieces[2] = pieces[2].slice(0, -4) + (pieces[2].endsWith("aaaa") ? "bbbb" : "aaaa");
  await verifyAccessJwt(pieces.join("."), { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs });
  check(false, "Une signature fausse est refusée");
} catch (error) {
  check(error.status === 401, "Une signature fausse est refusée");
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
check(accepted.kind === "user", "Un jeton humain reste un compte courriel");
check(trial.serviceClientIds.length === 0, "Sans allowlist, aucun Client ID de service n'est admis");
const listedId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.access";
const otherId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.access";
const withService = accessSettings({
  ACCESS_TEAM_DOMAIN: trial.teamDomain,
  ACCESS_AUD: trial.aud,
  ACCESS_ACCOUNTS: JSON.stringify([
    { email: "ada@example.com", role: "ceo", orgId: "klirline" },
    { email: "bea@example.com", role: "coo", orgId: "klirline" },
  ]),
  ACCESS_SERVICE_CLIENT_IDS: ` ${listedId.toUpperCase()} , cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc , pas-un-id `,
});
check(withService.ready && withService.serviceClientIds.join() === listedId, "L'allowlist ne garde que les Client ID .access");
check(parseServiceClientIds("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc").length === 0, "Une valeur sans suffixe .access est ignorée");
const serviceClaims = {
  type: "app",
  aud: ["aud-essai"],
  iss: "https://equipe.cloudflareaccess.com",
  sub: "",
  common_name: listedId.toUpperCase(),
  exp: nowMs / 1000 + 60,
};
const serviceOpts = { teamDomain: trial.teamDomain, aud: trial.aud, keys: [jwk], nowMs, serviceClientIds: withService.serviceClientIds };
const serviceJwt = await verifyAccessJwt(sign(serviceClaims), serviceOpts);
check(serviceJwt.kind === "service" && serviceJwt.clientId === listedId && serviceJwt.email == null, "Un JWT de service allowlisté n'a pas de courriel");
// I1 : un jeton de service sans fiche machine n'obtient plus l'identité de repli HQ_SERVICE_ACTOR.
try {
  const fallback = identityFromAccess(serviceJwt, withService.accounts);
  check(false, `Un jeton de service sans fiche machine est refusé (${fallback.actorId})`);
} catch (error) {
  check(error.status === 403, "Un jeton de service sans fiche machine est refusé");
}
check(HQ_SERVICE_ACTOR === "service:hq-poll", "L'ancien acteur de repli reste nommé, sans être attribué");
const machine = { service: true, actorId: "machine-klirprospect", orgId: "klirline", email: "machine:executor-klirprospect" };
const humanStill = identityFromAccess(accepted, withService.accounts);
check(!humanStill.service && humanStill.actorId === "ceo" && humanStill.email === "ada@example.com", "Le courriel continue de choisir le rôle");
try {
  await verifyAccessJwt(sign(serviceClaims), { ...serviceOpts, serviceClientIds: [] });
  check(false, "Sans allowlist, le JWT de service est refusé");
} catch (error) {
  check(error.status === 401, "Sans allowlist, le JWT de service est refusé");
}
try {
  await verifyAccessJwt(sign({ ...serviceClaims, common_name: otherId }), serviceOpts);
  check(false, "Un Client ID hors allowlist est refusé");
} catch (error) {
  check(error.status === 401, "Un Client ID hors allowlist est refusé");
}
try {
  await verifyAccessJwt(sign({ ...serviceClaims, exp: nowMs / 1000 - 10 }), serviceOpts);
  check(false, "Un JWT de service expiré est refusé");
} catch (error) {
  check(error.status === 401, "Un JWT de service expiré est refusé");
}
try {
  await verifyAccessJwt(sign({ ...serviceClaims, sub: "7335d417-61da-459d-899c-0a01c76a2f94" }), serviceOpts);
  check(false, "Un sujet non vide n'est pas un jeton de service");
} catch (error) {
  check(error.status === 401, "Un sujet non vide n'est pas un jeton de service");
}
const mixed = await verifyAccessJwt(sign({ ...claims, common_name: listedId, type: "app", sub: "" }), serviceOpts);
check(mixed.kind === "user" && mixed.email === "ada@example.com", "Un courriel valide reste humain même si common_name est allowlisté");
try {
  await verifyAccessJwt(sign({ ...serviceClaims, email: "pas un courriel" }), serviceOpts);
  check(false, "Un courriel illisible n'ouvre pas le poll");
} catch (error) {
  check(error.status === 401, "Un courriel illisible n'ouvre pas le poll");
}
const twoOrgs = accessSettings({
  ACCESS_TEAM_DOMAIN: trial.teamDomain,
  ACCESS_AUD: trial.aud,
  ACCESS_ACCOUNTS: JSON.stringify([
    { email: "ada@example.com", role: "ceo", orgId: "klirline" },
    { email: "bea@example.com", role: "coo", orgId: "autre" },
  ]),
  ACCESS_SERVICE_CLIENT_IDS: listedId,
});
try {
  identityFromAccess(serviceJwt, twoOrgs.accounts);
  check(false, "Deux organisations refusent le jeton de service");
} catch (error) {
  check(error.status === 403, "Deux organisations refusent le jeton de service");
}
assertServiceRoute(machine, "/api/hq/commands");
assertServiceRoute(machine, "/api/hq/commands/hq-00000000-0000-4000-8000-000000000001/claim");
assertServiceRoute(humanStill, "/api/bootstrap");
assertServiceRoute(humanStill, "/api/reset");
for (const path of ["/api/bootstrap", "/api/command", "/api/reset", "/api/hq", "/api/hq/../command"]) {
  try {
    assertServiceRoute(machine, path);
    check(false, `Le poll n'ouvre pas ${path}`);
  } catch (error) {
    check(error.status === 403, `Le poll n'ouvre pas ${path}`);
  }
}
const scopedName = "dddddddddddddddddddddddddddddddd.access";
const scopedEnv = {
  ACCESS_TEAM_DOMAIN: trial.teamDomain,
  ACCESS_AUD: trial.aud,
  ACCESS_ACCOUNTS: JSON.stringify([{ email: "ada@example.com", role: "ceo", orgId: "klirline" }]),
  HQ_MACHINE_IDENTITIES: JSON.stringify([
    { id: "executor-klirprospect", accessClientId: scopedName, actorId: "machine-klirprospect", orgId: "klirline", scopes: ["work"] },
  ]),
};
const scopedIdentity = identifyAccess({ kind: "service", commonName: scopedName }, scopedEnv).identity;
check(scopedIdentity.human === false && scopedIdentity.scopes.join() === "work" && scopedIdentity.actorId === "machine-klirprospect", "Une fiche machine ne reçoit que ses portées");
const cooMachineEnv = { ...scopedEnv, HQ_MACHINE_IDENTITIES: JSON.stringify([{ id: "machine-coo", accessClientId: scopedName, actorId: "coo", orgId: "klirline", scopes: ["review"] }]) };
check(identifyAccess({ kind: "service", commonName: scopedName }, cooMachineEnv).status === 403, "I2 : une fiche machine ne porte pas un rôle humain validateur");
const mappedHuman = identifyAccess({ kind: "human", email: "ada@example.com" }, scopedEnv).identity;
check(mappedHuman.human === true && mappedHuman.scopes.includes("review") && mappedHuman.actorId === "ceo", "Le courriel garde les permissions du poste");
check(identifyAccess({ kind: "service", commonName: scopedName }, { ...scopedEnv, HQ_MACHINE_IDENTITIES: "" }).status === 403, "Sans fiche, le mappeur applicatif ne donne pas de droit");

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
check(routeAccess("/api/hq/commands/hq-00000000-0000-4000-8000-000000000001/claim", "POST") === "session" && routeAccess("/api/hq/commands/hq-00000000-0000-4000-8000-000000000001/interrupt", "POST") === "session", "La prise et l'interruption exigent la même session");

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
  scopes: ["work"],
});
check(createdHq.status === 201 && createdHq.body.command.status === "pending" && createdHq.body.command.ownerSlug === "bwn-redaction", "Une commande du bureau naît en attente");
check(createdHq.body.mode === "hq" && createdHq.body.command.grokAgentName === "BWN Rédaction", "La réponse porte le nom Grok");
const pendingHq = await dispatchHq(hqStore, {
  method: "GET",
  pathname: "/api/hq/commands",
  searchParams: new URLSearchParams("status=pending"),
  body: {},
  actorId: "ceo",
  scopes: ["work"],
});
check(pendingHq.body.commands.length === 1 && pendingHq.body.commands[0].id === createdHq.body.command.id, "La file pending contient la commande");
const explicitHq = await dispatchHq(hqStore, {
  method: "POST",
  pathname: "/api/hq/command",
  searchParams: new URLSearchParams(),
  body: { text: "rédiger l'article Black Wall News", ownerSlug: "sandbox-klirline" },
  actorId: "ceo",
  scopes: ["work"],
});
check(explicitHq.body.command.ownerSlug === "sandbox-klirline" && explicitHq.body.command.routedBy === "explicit", "Un agent choisi gagne sur les mots-clés");
const claimedHq = await dispatchHq(hqStore, {
  method: "POST",
  pathname: `/api/hq/commands/${createdHq.body.command.id}/claim`,
  searchParams: new URLSearchParams(),
  body: {},
  actorId: "ceo",
  scopes: ["work"],
});
const doneHq = await dispatchHq(hqStore, {
  method: "PATCH",
  pathname: `/api/hq/commands/${createdHq.body.command.id}`,
  searchParams: new URLSearchParams(),
  body: {
    status: "done",
    result: "Article prêt",
    agentNote: "BWN Rédaction",
    attemptId: claimedHq.body.command.claim.attemptId,
    claimToken: claimedHq.body.claimToken,
  },
  actorId: "ceo",
  scopes: ["work"],
});
check(doneHq.status === 200 && doneHq.body.command.status === "done" && doneHq.body.command.result === "Article prêt" && doneHq.body.command.text.startsWith("rédiger"), "Le PATCH termine la commande sans réécrire l'ordre");
const stillPending = await dispatchHq(hqStore, {
  method: "GET",
  pathname: "/api/hq/commands",
  searchParams: new URLSearchParams("status=pending"),
  body: {},
  actorId: "ceo",
  scopes: ["work"],
});
check(stillPending.body.commands.length === 1 && stillPending.body.commands[0].id === explicitHq.body.command.id, "Le filtre pending retire la commande terminée");
const rosterHq = await dispatchHq(hqStore, {
  method: "GET",
  pathname: "/api/hq/roster",
  searchParams: new URLSearchParams(),
  body: {},
  actorId: "ceo",
  scopes: ["work"],
});
check(rosterHq.body.roster.length === HQ_ROSTER.length && rosterHq.body.roster.find((agent) => agent.id === "bwn-redaction").lastCommand.status === "done", "Le roster expose la dernière commande");
try {
  await dispatchHq(hqStore, { method: "POST", pathname: "/api/hq/command", searchParams: new URLSearchParams(), body: { text: "ok" }, actorId: "ceo", scopes: ["work"] });
  check(false, "Une commande trop courte est refusée");
} catch (error) {
  check(error.status === 400, "Une commande trop courte est refusée");
}
const unknownStatus = await dispatchHq(hqStore, { method: "PATCH", pathname: `/api/hq/commands/${createdHq.body.command.id}`, searchParams: new URLSearchParams(), body: { status: "publie" }, actorId: "ceo", scopes: ["work"] });
check(unknownStatus.status === 400, "Un statut hors liste est refusé");

// T4 : dispatchHq exige une portée explicite pour écrire. Ces appels unitaires jouent un agent
// (portée work, human=false), comme une fiche machine du Worker.
const hqCall = (method, pathname, body, now, actor = "ceo") => dispatchHq(hqStore, {
  method,
  pathname,
  searchParams: new URLSearchParams(),
  body,
  actorId: actor,
  scopes: ["work"],
  now,
});
const t0 = new Date("2026-11-05T12:00:00.000Z");
const leased = await hqCall("POST", "/api/hq/command", { text: "préparer la revue du bac à sable", ownerSlug: "sandbox-klirline" }, t0);
const leaseId = leased.body.command.id;
const firstClaim = await hqCall("POST", `/api/hq/commands/${leaseId}/claim`, {}, t0, "office-klirline");
check(firstClaim.status === 200 && firstClaim.body.outcome === "issued" && firstClaim.body.command.status === "dispatched", "Le premier claim transmet la commande une fois");
check(typeof firstClaim.body.claimToken === "string" && firstClaim.body.claimToken.length >= 32, "Le premier claim remet un bail");
check(!JSON.stringify(firstClaim.body.command).includes(firstClaim.body.claimToken) && !firstClaim.body.command.claim.tokenHash, "La réponse de claim ne copie pas le bail dans la commande");
const storedLease = await hqStore.get(leaseId);
check(storedLease.claim.tokenHash === hashClaimToken(firstClaim.body.claimToken) && storedLease.claimToken == null, "Le dépôt ne garde que l'empreinte du bail");
const secondClaim = await hqCall("POST", `/api/hq/commands/${leaseId}/claim`, {}, new Date(t0.getTime() + 1000), "ops-klirline");
check(secondClaim.status === 200 && secondClaim.body.outcome === "held" && secondClaim.body.command.status === "dispatched", "Le second claim est un no-op");
check(!Object.hasOwn(secondClaim.body, "claimToken") && !JSON.stringify(secondClaim.body).includes(firstClaim.body.claimToken), "Le second claim ne reçoit pas le bail");
check(secondClaim.body.command.updatedAt === firstClaim.body.command.updatedAt && (await hqStore.get(leaseId)).claim.tokenHash === storedLease.claim.tokenHash, "Le second claim ne redistribue pas");
const readLease = await hqCall("GET", `/api/hq/commands/${leaseId}`, {}, t0);
const listed = await hqCall("GET", "/api/hq/commands", {}, t0);
check(!JSON.stringify(readLease.body).includes(firstClaim.body.claimToken) && !JSON.stringify(listed.body).includes("tokenHash"), "La file et la fiche ne révèlent pas le bail");
const leaseAttempt = { attemptId: firstClaim.body.command.claim.attemptId, claimToken: firstClaim.body.claimToken };
let bareDone;
try {
  bareDone = await hqCall("PATCH", `/api/hq/commands/${leaseId}`, { status: "done" }, t0);
} catch (error) {
  bareDone = { status: error.status };
}
check(bareDone.status === 409 && (await hqStore.get(leaseId)).status === "dispatched", "Clore sans la tentative active est refusé");
let blankProof;
try {
  blankProof = await hqCall("PATCH", `/api/hq/commands/${leaseId}`, { status: "done", ...leaseAttempt, result: "  ", proof: "", agentNote: null }, t0);
} catch (error) {
  blankProof = { status: error.status };
}
check(blankProof.status === 400, "Une preuve vide est refusée");
const proved = await hqCall("PATCH", `/api/hq/commands/${leaseId}`, { status: "done", ...leaseAttempt, proof: "Note de revue déposée" }, new Date(t0.getTime() + 2000));
check(proved.status === 200 && proved.body.command.status === "done" && proved.body.command.proof === "Note de revue déposée", "Une preuve permet de clore");
const closedClaim = await hqCall("POST", `/api/hq/commands/${leaseId}/claim`, {}, new Date(t0.getTime() + 3000));
check(closedClaim.status === 409 && !Object.hasOwn(closedClaim.body, "claimToken"), "Une commande close ne se reprend pas");

const stale = await hqCall("POST", "/api/hq/command", { text: "suivre l'exécution trop longue", ownerSlug: "ops-klirline" }, t0);
const staleId = stale.body.command.id;
const staleClaim = await hqCall("POST", `/api/hq/commands/${staleId}/claim`, {}, t0);
// T1 : passer running exige la tentative en cours (attemptId + claimToken).
await hqCall("PATCH", `/api/hq/commands/${staleId}`, { status: "running", agentNote: "Démarré", attemptId: staleClaim.body.command.claim.attemptId, claimToken: staleClaim.body.claimToken }, t0);
const staleAt = new Date(t0.getTime() + HQ_LEASE_MS + 1000);
const blockedRun = await hqCall("POST", `/api/hq/commands/${staleId}/claim`, {}, staleAt);
check(blockedRun.status === 200 && blockedRun.body.outcome === "blocked" && blockedRun.body.command.status === "blocked", "Un running trop ancien passe bloqué");
check(!Object.hasOwn(blockedRun.body, "claimToken") && blockedRun.body.command.updatedAt === staleAt.toISOString() && blockedRun.body.command.agentNote.includes("Interruption") && blockedRun.body.command.agentNote.includes("Démarré"), "L'interruption d'un running trop ancien laisse la date et la note");
const refusedWhileBlocked = await hqCall("POST", `/api/hq/commands/${staleId}/claim`, {}, staleAt);
check(refusedWhileBlocked.status === 409 && !Object.hasOwn(refusedWhileBlocked.body, "claimToken"), "Une commande bloquée ne se reprend pas toute seule");
const reopened = await hqCall("PATCH", `/api/hq/commands/${staleId}`, { status: "pending" }, staleAt);
const reissued = await hqCall("POST", `/api/hq/commands/${staleId}/claim`, {}, new Date(staleAt.getTime() + 1000));
check(reopened.body.command.status === "pending" && reissued.body.outcome === "issued" && reissued.body.claimToken && reissued.body.claimToken !== firstClaim.body.claimToken, "Une commande bloquée se relance seulement après un pending explicite");

const resumed = await hqCall("POST", "/api/hq/command", { text: "reprendre un envoi transmis", ownerSlug: "all-question" }, t0);
const resumedId = resumed.body.command.id;
const oldBail = await hqCall("POST", `/api/hq/commands/${resumedId}/claim`, {}, t0);
const reclaimAt = new Date(t0.getTime() + HQ_LEASE_MS + 1000);
const reclaimed = await hqCall("POST", `/api/hq/commands/${resumedId}/claim`, {}, reclaimAt);
check(reclaimed.status === 200 && reclaimed.body.outcome === "reclaimed" && reclaimed.body.command.status === "dispatched", "Un bail expiré sur une commande transmise se reprend");
check(reclaimed.body.claimToken && reclaimed.body.claimToken !== oldBail.body.claimToken && !JSON.stringify(reclaimed.body).includes(oldBail.body.claimToken), "La reprise remet un bail neuf");
check(reclaimed.body.command.agentNote.includes("Reprise documentée") && reclaimed.body.command.updatedAt === reclaimAt.toISOString(), "La reprise est notée");

const halted = await hqCall("POST", "/api/hq/command", { text: "couper le travail en cours", ownerSlug: "noria" }, t0);
const haltedId = halted.body.command.id;
const haltedClaim = await hqCall("POST", `/api/hq/commands/${haltedId}/claim`, {}, t0);
await hqCall("PATCH", `/api/hq/commands/${haltedId}`, { status: "running", attemptId: haltedClaim.body.command.claim.attemptId, claimToken: haltedClaim.body.claimToken }, t0);
const haltAt = new Date(t0.getTime() + 5000);
const interrupted = await hqCall("POST", `/api/hq/commands/${haltedId}/interrupt`, { note: "Processus arrêté avant la preuve." }, haltAt);
check(interrupted.status === 200 && interrupted.body.command.status === "running" && interrupted.body.command.updatedAt === haltAt.toISOString(), "L'interruption garde le statut et la date");
check(!Object.hasOwn(interrupted.body, "claimToken") && interrupted.body.command.agentNote === "Processus arrêté avant la preuve.", "L'interruption laisse la note sans rendre le bail");
const stillHeld = await hqCall("POST", `/api/hq/commands/${haltedId}/claim`, {}, new Date(t0.getTime() + 6000));
check(stillHeld.body.outcome === "held" && !Object.hasOwn(stillHeld.body, "claimToken"), "L'interruption ne lance pas une seconde exécution");
const duplicate = await hqCall("PATCH", `/api/hq/commands/${leaseId}`, { status: "done", ...leaseAttempt, proof: "Note de revue déposée" }, new Date(t0.getTime() + 4000));
check(duplicate.status === 200 && duplicate.body.outcome === "duplicate" && (await hqStore.get(leaseId)).proof === "Note de revue déposée", "Renvoyer le même résultat ne l'écrase pas");
const overwritten = await hqCall("PATCH", `/api/hq/commands/${leaseId}`, { status: "done", ...leaseAttempt, proof: "Autre texte" }, new Date(t0.getTime() + 5000));
check(overwritten.status === 409 && (await hqStore.get(leaseId)).proof === "Note de revue déposée", "Un second résultat différent est refusé");
const lateWrite = await hqCall("PATCH", `/api/hq/commands/${resumedId}`, {
  status: "done",
  attemptId: oldBail.body.command.claim.attemptId,
  claimToken: oldBail.body.claimToken,
  proof: "Ancienne tentative",
}, reclaimAt);
check(lateWrite.status === 409 && (await hqStore.get(resumedId)).status === "dispatched" && (await hqStore.get(resumedId)).proof == null, "L'ancienne tentative ne termine pas après la reprise");
const freshWrite = await hqCall("PATCH", `/api/hq/commands/${resumedId}`, {
  status: "done",
  attemptId: reclaimed.body.command.claim.attemptId,
  claimToken: reclaimed.body.claimToken,
  proof: "Tentative reprise",
}, reclaimAt);
check(freshWrite.status === 200 && freshWrite.body.command.proof === "Tentative reprise" && freshWrite.body.command.completedAttemptId === reclaimed.body.command.claim.attemptId, "Seule la tentative active peut clore");
const raced = await hqCall("POST", "/api/hq/command", { text: "deux prises simultanées", ownerSlug: "sandbox-klirline" }, t0);
const racedId = raced.body.command.id;
const pair = await Promise.all([
  hqCall("POST", `/api/hq/commands/${racedId}/claim`, {}, t0, "office-klirline"),
  hqCall("POST", `/api/hq/commands/${racedId}/claim`, {}, t0, "ops-klirline"),
]);
check(pair.filter((item) => item.body.outcome === "issued").length === 1 && pair.filter((item) => item.body.outcome === "held").length === 1, "Deux claims simultanés ne lancent qu'une exécution");
const forged = await hqCall("PATCH", `/api/hq/commands/${racedId}`, { status: "done", actorId: "ceo", proof: "Falsifié" }, t0, "office-klirline");
check(forged.status === 400 && (await hqStore.get(racedId)).status === "dispatched", "Un rôle fourni dans le corps ne change pas l'identité");
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
