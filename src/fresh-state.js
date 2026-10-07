import { buildDay } from "./engine.js";
import { THRESHOLDS } from "./policy.js";
import { seedWorld } from "./seed.js";

export function freshState() {
  const world = seedWorld();
  const tasks = buildDay(world);
  const preparedAt = new Date(Date.now() - 60_000).toISOString();
  const recommendedAt = new Date().toISOString();
  const proposal = tasks.find((task) => task.action?.type === "commit_proposal" && task.action.amount >= THRESHOLDS.contractCeoCad);
  const note = "Périmètre conforme au barème de démonstration.";
  proposal.status = "pending_ceo";
  proposal.approvals.push({ at: recommendedAt, actorId: "sales-director", decision: "recommend", note });
  return {
    ...world,
    tasks,
    audit: [
      {
        at: recommendedAt,
        actorId: "sales-director",
        action: "recommend",
        detail: note,
        taskId: proposal.id,
      },
      {
        at: preparedAt,
        actorId: "chief-of-staff",
        action: "cycle",
        detail: "Journée préparée à partir de l'état local. Aucun message et aucun paiement n'est parti.",
      },
    ],
    outbox: [],
    calls: [],
  };
}
