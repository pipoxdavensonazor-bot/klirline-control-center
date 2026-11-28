import { decideClaim, decideCompletion, decideHeartbeat, decideInterrupt, expireLease, findIdempotent, matchesFilter, sortCommands } from "./commands.js";
import { runMissionOperation } from "./missions.js";

function missing() {
  const error = new Error("Commande introuvable");
  error.status = 404;
  throw error;
}

function commit(commands, id, decision) {
  if (!decision.persist) return { status: decision.http, body: decision.body };
  const index = commands.findIndex((item) => item.id === id);
  if (index < 0) missing();
  commands[index] = decision.command;
  return { status: decision.http, body: decision.body };
}

export function memoryHqStore(seed = []) {
  const commands = seed.map((command) => ({ ...command }));
  const missions = [];
  return {
    async sweep(now) {
      let count = 0;
      commands.forEach((command, index) => {
        const next = expireLease(command, { now });
        if (next) { commands[index] = next; count += 1; }
      });
      return count;
    },
    async list(filter) {
      return sortCommands(commands.filter((command) => matchesFilter(command, filter)));
    },
    async get(id) {
      return commands.find((command) => command.id === id) || null;
    },
    async insert(command) {
      commands.push({ ...command });
    },
    async insertIdempotent(command) {
      const existing = findIdempotent(commands, command);
      if (existing) return { created: false, command: { ...existing } };
      commands.push({ ...command });
      return { created: true, command };
    },
    async replace(command) {
      const index = commands.findIndex((item) => item.id === command.id);
      if (index < 0) missing();
      commands[index] = { ...command };
    },
    async claim(id, options) {
      const current = commands.find((command) => command.id === id) || null;
      return commit(commands, id, decideClaim(current, options));
    },
    async heartbeat(id, input, options) {
      const current = commands.find((command) => command.id === id) || null;
      return commit(commands, id, decideHeartbeat(current, input, options));
    },
    async interrupt(id, options) {
      const current = commands.find((command) => command.id === id) || null;
      return commit(commands, id, decideInterrupt(current, options));
    },
    async complete(id, input, options) {
      const current = commands.find((command) => command.id === id) || null;
      return commit(commands, id, decideCompletion(current, input, options));
    },
    async missionList() {
      return missions.map((mission) => JSON.parse(JSON.stringify(mission)));
    },
    async missionGet(id) {
      const found = missions.find((mission) => mission.id === id);
      return found ? JSON.parse(JSON.stringify(found)) : null;
    },
    async missionInsert(mission) {
      missions.push(JSON.parse(JSON.stringify(mission)));
    },
    async missionOperate(id, operation, input, actorId, options = {}) {
      const index = missions.findIndex((mission) => mission.id === id);
      const result = runMissionOperation(index < 0 ? null : missions[index], commands, operation, input, { ...options, actorId });
      if (result.insertCommand) commands.push({ ...result.command });
      else if (result.replaceCommand && result.command) {
        const commandIndex = commands.findIndex((command) => command.id === result.command.id);
        if (commandIndex >= 0) commands[commandIndex] = { ...result.command };
      }
      if (result.changed && index >= 0) missions[index] = JSON.parse(JSON.stringify(result.mission));
      return result;
    },
  };
}
