const REQUIRED = ["id", "name", "title", "department", "mission", "skills", "procedures", "doctrine", "kpis", "style"];

export function defineAgent(spec) {
  for (const key of REQUIRED) {
    if (spec[key] == null || spec[key] === "") {
      throw new Error(`Agent incomplet (${spec.id ?? "sans id"}) : ${key}`);
    }
  }
  if (!Array.isArray(spec.skills) || spec.skills.length < 4) {
    throw new Error(`${spec.id} doit exposer au moins 4 compétences`);
  }
  if (!Array.isArray(spec.procedures) || spec.procedures.length < 4) {
    throw new Error(`${spec.id} doit exposer au moins 4 étapes de procédure`);
  }
  if (String(spec.doctrine).trim().length < 180) {
    throw new Error(`${spec.id} : la doctrine est trop courte pour travailler hors ligne`);
  }
  return {
    icon: "•",
    human: false,
    reportsTo: null,
    independent: false,
    writePlatforms: [],
    tools: [],
    offline: [],
    onlineOnly: [],
    forbidden: [],
    playbooks: [],
    informs: [],
    ...spec,
    readPlatforms: "*",
  };
}
