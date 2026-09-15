export const MODEL_LADDER = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
] as const;

export type LadderModel = (typeof MODEL_LADDER)[number];

export const GEMINI_PRIMARY_MODEL = MODEL_LADDER[0];

export function isModelFallbackError(err: any): boolean {
  if (err?.isTimeout) return true;
  if (err?.name === "AbortError") return false;
  const status = err?.status ?? err?.code;
  if (status === 429 || status === 404) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (!status && err instanceof TypeError) return true; // Network error
  return false;
}

export function getModelsToTry(requestedModel?: string): string[] {
  if (!requestedModel) return [...MODEL_LADDER];
  const index = MODEL_LADDER.indexOf(requestedModel as LadderModel);
  if (index !== -1) {
    return MODEL_LADDER.slice(index);
  }
  return [requestedModel, ...MODEL_LADDER];
}
