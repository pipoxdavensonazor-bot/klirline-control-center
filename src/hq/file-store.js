import fs from "node:fs";
import path from "node:path";
import { applyHqPatch, claimHqCommand, matchesFilter, sortCommands } from "./commands.js";
import { runMissionOperation } from "./missions.js";
import { dataPath } from "../store.js";

function hqPath() {
  return process.env.HQ_COMMANDS_PATH || dataPath("data", "hq-commands.json");
}

function missionPath() {
  return process.env.HQ_MISSIONS_PATH || dataPath("data", "hq-missions.json");
}

function readMissions() {
  const file = missionPath();
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) {
    const error = new Error("Journal des missions illisible.");
    error.status = 500;
    throw error;
  }
  return parsed;
}

function writeMissions(missions) {
  const file = missionPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(missions, null, 2));
  fs.renameSync(tmp, file);
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
    async missionList() {
      return readMissions();
    },
    async missionGet(id) {
      return readMissions().find((mission) => mission.id === id) || null;
    },
    async missionInsert(mission) {
      const missions = readMissions();
      missions.push(mission);
      writeMissions(missions);
    },
    async missionOperate(id, operation, input, actorId, options = {}) {
      const missions = readMissions();
      const commands = readAll();
      const index = missions.findIndex((mission) => mission.id === id);
      const result = runMissionOperation(index < 0 ? null : missions[index], commands, operation, input, { ...options, actorId });
      if (result.insertCommand) {
        commands.push(result.command);
        writeAll(commands);
      } else if (result.replaceCommand && result.command) {
        const commandIndex = commands.findIndex((command) => command.id === result.command.id);
        if (commandIndex >= 0) {
          commands[commandIndex] = result.command;
          writeAll(commands);
        }
      }
      if (result.changed && index >= 0) {
        missions[index] = result.mission;
        writeMissions(missions);
      }
      return result;
    },
  };
}
