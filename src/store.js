import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshState } from "./fresh-state.js";

export { freshState };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statePath = path.join(root, "data", "state.json");

export function dataPath(...parts) {
  return path.join(root, ...parts);
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
