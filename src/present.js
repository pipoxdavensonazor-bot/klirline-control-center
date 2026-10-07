import { actionsFor, briefing } from "./engine.js";
import { DEPARTMENTS, agents, skillDocument } from "./org/index.js";
import { COMPANY, PLATFORMS } from "./policy.js";

export function present(state, actorId, playbookList) {
  return {
    company: COMPANY,
    generatedAt: new Date().toISOString(),
    actorId,
    departments: DEPARTMENTS,
    agents: agents.map((agent) => ({
      ...agent,
      skillDocument: skillDocument(agent),
      reportIds: agents.filter((item) => item.reportsTo === agent.id).map((item) => item.id),
    })),
    platformCatalog: PLATFORMS,
    platforms: state.platforms,
    tasks: state.tasks.map((task) => ({ ...task, actions: actionsFor(actorId, task) })),
    briefing: briefing(state),
    audit: state.audit.slice(0, 50),
    outbox: state.outbox,
    calls: state.calls,
    playbooks: playbookList,
    demonstration: state.demonstration,
  };
}
