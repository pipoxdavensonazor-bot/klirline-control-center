// Adaptateur minimal. Aucun fournisseur n'est importé.
// Un plafond de 0 $ refuse l'appel de modèle avant toute requête.

export const EXECUTION_KINDS = ["manual", "deterministic-script", "model"];

export function blockedModelResult(reason) {
  return {
    ok: false,
    executionKind: "model",
    model: null,
    body: null,
    result: null,
    usage: null,
    costCents: 0,
    billed: false,
    error: reason,
  };
}

export async function runModelAdapter(adapter, input, limits = {}) {
  const capCents = Number(limits.capCents);
  const timeoutMs = Number(limits.timeoutMs) > 0 ? Number(limits.timeoutMs) : 15000;
  const kind = adapter?.kind;
  if (!EXECUTION_KINDS.includes(kind)) {
    return blockedModelResult("Adaptateur inconnu.");
  }
  if (kind === "model" && (!(capCents > 0))) {
    return blockedModelResult("Plafond 0 $ : aucun appel de modèle. L'absence de facture API n'est pas un coût d'exploitation nul.");
  }
  if (typeof adapter.run !== "function") {
    return blockedModelResult("Cet adaptateur n'a pas de fonction d'exécution.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = limits.signal || controller.signal;
  try {
    const output = await adapter.run(input, { signal, capCents, timeoutMs });
    if (signal.aborted) return blockedModelResult("Délai dépassé.");
    const costCents = Number(output?.costCents) || 0;
    if (kind === "model" && costCents > capCents) {
      return blockedModelResult("Le coût annoncé dépasse le plafond. Le livrable n'est pas accepté.");
    }
    if (!output?.body || String(output.body).trim().length < 8) {
      return blockedModelResult("Le livrable produit est vide.");
    }
    return {
      ok: true,
      executionKind: kind,
      model: kind === "model" ? output.model || null : null,
      body: String(output.body),
      result: output.result ? String(output.result) : null,
      usage: output.usage || null,
      costCents,
      billed: kind === "model" && costCents > 0,
      error: null,
    };
  } catch (error) {
    const aborted = error?.name === "AbortError" || signal.aborted;
    return blockedModelResult(aborted ? "Délai dépassé." : "L'adaptateur a échoué sans produire de livrable.");
  } finally {
    clearTimeout(timer);
  }
}
