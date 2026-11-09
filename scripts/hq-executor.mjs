import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runModelAdapter } from "../src/hq/model-run.js";

export const PROCEDURE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../knowledge/procedures/klirprospect-synthese.md");

export function readPinnedProcedure(file = PROCEDURE_PATH) {
  const text = fs.readFileSync(file, "utf8");
  const version = text.match(/^version:\s*(\S+)/m)?.[1];
  const id = text.match(/^id:\s*(\S+)/m)?.[1];
  const json = text.match(/```json\n([\s\S]*?)\n```/)?.[1];
  if (!version || !id || !json) throw new Error("Procédure illisible.");
  const fiches = JSON.parse(json).fiches;
  if (!Array.isArray(fiches) || fiches.length !== 3) throw new Error("La procédure doit contenir trois fiches.");
  return { id, version, fiches, text };
}

export function deterministicAdapter(procedure) {
  return {
    kind: "deterministic-script",
    async run() {
      const synthesis = buildSynthesis(procedure);
      return synthesis;
    },
  };
}

export function buildSynthesis(procedure) {
  const needs = procedure.fiches.map((fiche) => `- ${fiche.nom} : ${fiche.besoin} (${fiche.connu})`).join("\n");
  const missing = procedure.fiches.map((fiche) => `- ${fiche.nom} : ${fiche.manque}`).join("\n");
  const questions = procedure.fiches.map((fiche) => `- ${fiche.nom} : que manque-t-il pour ${fiche.besoin.charAt(0).toLowerCase()}${fiche.besoin.slice(1)} Préciser : ${fiche.manque}`).join("\n");
  const agenda = [
    "1. Rappeler que les trois fiches sont fictives et qu'aucune démonstration n'est réservée.",
    "2. Passer en revue le besoin de chaque fiche.",
    "3. Lister les informations manquantes avant tout contact.",
    "4. Décider si une démonstration réelle pourra être demandée plus tard, dans une validation séparée.",
  ].join("\n");
  const body = [
    `# Synthèse KlirProspect`,
    ``,
    `Procédure ${procedure.id} version ${procedure.version}.`,
    `Exécution déterministe d'un script. Aucun modèle d'IA n'a été appelé. Coût : 0 $.`,
    ``,
    `## Besoins`,
    needs,
    ``,
    `## Informations manquantes`,
    missing,
    ``,
    `## Questions à poser`,
    questions,
    ``,
    `## Ordre du jour proposé`,
    agenda,
    ``,
    `Aucune démonstration n'est réservée.`,
  ].join("\n");
  return {
    body,
    result: "Synthèse interne préparée. Aucune démonstration n'est réservée.",
    executionKind: "deterministic-script",
    model: null,
    costCents: 0,
  };
}

export async function runExecutor(base, token) {
  const procedure = readPinnedProcedure();
  const synthesis = await runModelAdapter(deterministicAdapter(procedure), {
    procedureId: procedure.id,
    procedureVersion: procedure.version,
    fiches: procedure.fiches,
  }, { capCents: 0, timeoutMs: 2000 });
  if (!synthesis.ok || synthesis.executionKind !== "deterministic-script") {
    throw new Error(synthesis.error || "La synthèse déterministe a échoué.");
  }
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const call = async (method, pathname, body) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  };
  const opened = await call("POST", "/api/hq/missions", { template: "klirprospect-synthese" });
  const missionId = opened.mission.id;
  await call("POST", `/api/hq/missions/${missionId}/transition`, { status: "ready" });
  const taskId = opened.mission.tasks[0].id;
  const started = await call("POST", `/api/hq/missions/${missionId}/tasks/${taskId}/start`, {});
  const delivered = await call("POST", `/api/hq/missions/${missionId}/deliverables`, {
    taskId,
    body: synthesis.body,
    result: synthesis.result,
    executionKind: synthesis.executionKind,
    attemptId: started.attemptId,
    claimToken: started.claimToken,
  });
  await call("POST", `/api/hq/missions/${missionId}/transition`, { status: "in_review" });
  return {
    missionId,
    attemptId: started.attemptId,
    procedure: { id: procedure.id, version: procedure.version },
    executionKind: synthesis.executionKind,
    model: synthesis.model,
    costCents: delivered.mission.cost.spentCents,
    deliverable: delivered.mission.deliverables.at(-1),
    events: delivered.mission.events,
    demosBooked: delivered.mission.outcomes.demosBooked,
  };
}
