import { applyHqPatch, claimHqCommand, matchesFilter, sortCommands } from "./commands.js";
import { runMissionOperation } from "./missions.js";

export function memoryHqStore(seed = [], missionSeed = []) {
  const commands = seed.map((command) => ({ ...command }));
  const missions = missionSeed.map((mission) => ({ ...mission }));
  function persistOperation(id, operation, input, actorId, options = {}) {
    const index = missions.findIndex((mission) => mission.id === id);
    const current = index < 0 ? null : missions[index];
    const result = runMissionOperation(current, commands, operation, input, { ...options, actorId });
    if (result.insertCommand) commands.push({ ...result.command });
    else if (result.replaceCommand && result.command) {
      const commandIndex = commands.findIndex((command) => command.id === result.command.id);
      if (commandIndex >= 0) commands[commandIndex] = { ...result.command };
    }
    if (result.changed && index >= 0) missions[index] = { ...result.mission };
    return result;
  }
  return {
    async list(filter) {
      return sortCommands(commands.filter((command) => matchesFilter(command, filter)));
    },
    async get(id) {
      const found = commands.find((command) => command.id === id);
      return found ? { ...found } : null;
    },
    async insert(command) {
      commands.push({ ...command });
    },
    async replace(command) {
      const index = commands.findIndex((item) => item.id === command.id);
      if (index < 0) {
        const error = new Error("Commande introuvable");
        error.status = 404;
        throw error;
      }
      commands[index] = { ...command };
    },
    async patch(id, input, actorId, options = {}) {
      const index = commands.findIndex((item) => item.id === id);
      const next = applyHqPatch(index < 0 ? null : commands[index], input, { ...options, actorId });
      commands[index] = { ...next };
      return { ...next };
    },
    async claim(id, input, actorId, options = {}) {
      const index = commands.findIndex((item) => item.id === id);
      const outcome = claimHqCommand(index < 0 ? null : commands[index], input, { ...options, actorId });
      if (outcome.changed) commands[index] = { ...outcome.command };
      return { ...outcome, command: { ...outcome.command } };
    },
    async missionList() {
      return missions.map((mission) => ({ ...mission, tasks: mission.tasks.map((task) => ({ ...task })) }));
    },
    async missionGet(id) {
      const found = missions.find((mission) => mission.id === id);
      return found ? JSON.parse(JSON.stringify(found)) : null;
    },
    async missionInsert(mission) {
      missions.push(JSON.parse(JSON.stringify(mission)));
    },
    async missionOperate(id, operation, input, actorId, options = {}) {
      return persistOperation(id, operation, input, actorId, options);
    },
  };
}
