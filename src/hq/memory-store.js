import { decideClaim, decideInterrupt, matchesFilter, sortCommands } from "./commands.js";

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
      if (index < 0) missing();
      commands[index] = { ...command };
    },
    async claim(id, options) {
      const current = commands.find((command) => command.id === id) || null;
      return commit(commands, id, decideClaim(current, options));
    },
    async interrupt(id, options) {
      const current = commands.find((command) => command.id === id) || null;
      return commit(commands, id, decideInterrupt(current, options));
    },
  };
}
