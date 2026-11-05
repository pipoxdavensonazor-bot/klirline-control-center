import { matchesFilter, sortCommands } from "./commands.js";

export function memoryHqStore(seed = []) {
  const commands = seed.map((command) => ({ ...command }));
  return {
    async list(filter) {
      return sortCommands(commands.filter((command) => matchesFilter(command, filter)));
    },
    async get(id) {
      return commands.find((command) => command.id === id) || null;
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
  };
}
