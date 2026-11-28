// Contrôle avant déploiement des identités HQ. Usage :
//   node scripts/hq-identity-check.mjs <fichier.json>   (objet { HQ_MACHINE_IDENTITIES, ACCESS_SERVICE_CLIENT_IDS, ACCESS_ACCOUNTS })
//   --strict : un Client ID autorisé (ACCESS_SERVICE_CLIENT_IDS) sans fiche devient une erreur (le poll de cette identité recevrait 403)
//   node scripts/hq-identity-check.mjs --env            (lit ces trois variables dans l'environnement du processus, p. ex. en CI)
// Code de sortie 1 si une erreur bloquante est trouvée. N'affiche jamais de jeton ni de Client ID complet.
import fs from "node:fs";
import { checkIdentityConfig } from "../src/hq/identity-check.js";

const strict = process.argv.includes("--strict");
const arg = process.argv.slice(2).find((item) => !item.startsWith("--") || item === "--env");
if (!arg) { console.error("Usage : hq-identity-check.mjs <fichier.json> | --env"); process.exit(2); }
const env = arg === "--env"
  ? { HQ_MACHINE_IDENTITIES: process.env.HQ_MACHINE_IDENTITIES, ACCESS_SERVICE_CLIENT_IDS: process.env.ACCESS_SERVICE_CLIENT_IDS, ACCESS_ACCOUNTS: process.env.ACCESS_ACCOUNTS }
  : JSON.parse(fs.readFileSync(arg, "utf8"));
const result = checkIdentityConfig(env, { strict });
for (const line of result.errors) console.log(`ERREUR  ${line}`);
for (const line of result.warnings) console.log(`AVERTIS ${line}`);
console.log(result.ok ? `OK — ${result.fiches} fiche(s), aucune identité ambiguë` : `REFUS — ${result.errors.length} erreur(s) bloquante(s)`);
process.exit(result.ok ? 0 : 1);
