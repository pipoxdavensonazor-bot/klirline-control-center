import fs from "node:fs";
import path from "node:path";
import { applyHqPatch, claimHqCommand, matchesFilter, sortCommands } from "./commands.js";
import { dataPath } from "../store.js";

function hqPath() {
  return process.env.HQ_COMMANDS_PATH || dataPath("data", "hq-commands.json");
}

function readAll() {
  const file = hqPath();
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) {
    const error = new Error("Journal du bureau illisible.");
    error.status = 500;
    throw error;
  }
  return parsed;
}

function writeAll(commands) {
  const file = hqPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(commands, null, 2));
  fs.renameSync(tmp, file);
}

export function fileHqStore() {
  return {
    async list(filter) {
      return sortCommands(readAll().filter((command) => matchesFilter(command, filter)));
    },
    async get(id) {
      return readAll().find((command) => command.id === id) || null;
    },
    async insert(command) {
      const commands = readAll();
      commands.push(command);
      writeAll(commands);
    },
    async replace(command) {
      const commands = readAll();
      const index = commands.findIndex((item) => item.id === command.id);
      if (index < 0) {
        const error = new Error("Commande introuvable");
        error.status = 404;
        throw error;
      }
      commands[index] = command;
      writeAll(commands);
    },
    async patch(id, input, actorId, options = {}) {
      const commands = readAll();
      const index = commands.findIndex((item) => item.id === id);
      const next = applyHqPatch(index < 0 ? null : commands[index], input, { ...options, actorId });
      commands[index] = next;
      writeAll(commands);
      return next;
    },
    async claim(id, input, actorId, options = {}) {
      const commands = readAll();
      const index = commands.findIndex((item) => item.id === id);
      const outcome = claimHqCommand(index < 0 ? null : commands[index], input, { ...options, actorId });
      if (outcome.changed) {
        commands[index] = outcome.command;
        writeAll(commands);
      }
      return outcome;
    },
  };
}
