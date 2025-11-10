import process from "node:process";

type LogLevel = "info" | "error";

type LogEntry = {
  level: LogLevel;
  scope: string;
  timestamp: string;
  payload?: unknown;
};

export function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return error;
}

function serializePayload(payload: unknown) {
  if (payload instanceof Error) {
    return normalizeError(payload);
  }

  return payload;
}

function write(level: LogLevel, scope: string, payload?: unknown) {
  const entry: LogEntry = {
    level,
    scope,
    timestamp: new Date().toISOString(),
    payload: serializePayload(payload),
  };
  const serialized = `${JSON.stringify(entry)}\n`;

  if (level === "error") {
    process.stderr.write(serialized);
  } else {
    process.stdout.write(serialized);
  }
}

export function logError(scope: string, payload?: unknown) {
  write("error", scope, payload);
}

export function logInfo(scope: string, payload?: unknown) {
  write("info", scope, payload);
}
