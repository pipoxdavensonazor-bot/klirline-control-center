import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDay } from "./engine.js";
import { seedWorld } from "./seed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statePath = path.join(root, "data", "state.json");

export function dataPath(...parts) {
  return path.join(root, ...parts);
}

export function freshState() {
  const world = seedWorld();
  const tasks = buildDay(world);
  return {
    ...world,
    tasks,
    audit: [
      {
        at: new Date().toISOString(),
        actorId: "chief-of-staff",
        action: "cycle",
        detail: "Journée préparée à partir de l'état local. Aucun message et aucun paiement n'est parti.",
      },
    ],
    outbox: [],
    calls: [],
  };
}

export function loadState() {
  if (!fs.existsSync(statePath)) {
    const state = freshState();
    saveState(state);
    return state;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

export function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function resetState() {
  const state = freshState();
  saveState(state);
  return state;
}
