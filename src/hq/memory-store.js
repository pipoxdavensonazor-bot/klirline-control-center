import { applyHqPatch, claimHqCommand, matchesFilter, sortCommands } from "./commands.js";

export function memoryHqStore(seed = []) {
  const commands = seed.map((command) => ({ ...command }));
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
  };
}
