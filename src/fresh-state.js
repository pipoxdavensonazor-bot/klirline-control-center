import { buildDay } from "./engine.js";
import { seedWorld } from "./seed.js";

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
