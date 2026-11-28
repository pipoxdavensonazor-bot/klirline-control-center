// Contrôle : chaque suite de test du dépôt (scripts/hq-*-check|regression|local|lot2|flow) est exécutée par la CI.
// Échoue si une suite existe sans être référencée dans .github/workflows/ci.yml.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
const exclus = /driver|sim|identity|executor/;
const suites = fs.readdirSync(path.join(root, "scripts")).filter((f) => /^hq-.*\.mjs$/.test(f) && !exclus.test(f));
const manquantes = suites.filter((f) => !ci.includes(`scripts/${f}`));
if (manquantes.length) { console.error(`ÉCHEC — suites absentes de la CI : ${manquantes.join(", ")}`); process.exit(1); }
console.log(`OK — ${suites.length} suites, toutes exécutées par la CI`);
