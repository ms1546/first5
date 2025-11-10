import { performance } from "node:perf_hooks";
import { logError, logInfo } from "./logger";

type LLMTraceContext = {
  step: string;
  modelId: string;
};

type SuccessPayload = {
  durationMs: number;
  tokens?: number | null;
};

type FailurePayload = {
  durationMs: number;
  error: unknown;
};

export function createLLMTrace(context: LLMTraceContext) {
  const startedAt = performance.now();
  log("start", context);

  return {
    success(tokens?: number | null) {
      const durationMs = performance.now() - startedAt;
      const payload: SuccessPayload = { durationMs, tokens: tokens ?? null };
      log("success", context, payload);
    },
    failure(error: unknown) {
      const durationMs = performance.now() - startedAt;
      const payload: FailurePayload = { durationMs, error };
      log("failure", context, payload);
    },
  };
}

function log(
  status: "start" | "success" | "failure",
  context: LLMTraceContext,
  payload?: Record<string, unknown>
) {
  const base = {
    scope: "llm",
    status,
    step: context.step,
    modelId: context.modelId,
    timestamp: new Date().toISOString(),
  };

  const entry = payload ? { ...base, ...payload } : base;

  if (status === "failure") {
    logError("llm-trace", entry);
  } else {
    logInfo("llm-trace", entry);
  }
}
