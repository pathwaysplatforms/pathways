import * as Sentry from "@sentry/nextjs";

/**
 * Client-safe structured logger.
 *
 * The pino logger in ./logger.ts is server-only — importing it into a client
 * component bundles pino (and its transports) into the browser. This wrapper
 * mirrors the same `log.error({ action, ... })` call shape but routes errors and
 * warnings to Sentry (already PII-scrubbed via beforeSend) and only mirrors to
 * the console in development. No secrets or PII should be passed here.
 */

type LogFields = { action: string; [key: string]: unknown };
type ClientLevel = "error" | "warning" | "info" | "debug";

const isProduction = process.env.NODE_ENV === "production";

function emit(level: ClientLevel, scope: string, fields: LogFields): void {
  const { action, ...extra } = fields;

  if (level === "error" || level === "warning") {
    Sentry.captureMessage(`${scope}.${action}`, { level, extra });
  }

  if (!isProduction) {
    const method =
      level === "error" ? console.error : level === "warning" ? console.warn : console.info;
    method(`[${scope}] ${action}`, extra);
  }
}

/** Structured client logger with the same field-object shape as the server logger. */
export interface ClientLogger {
  error(fields: LogFields): void;
  warn(fields: LogFields): void;
  info(fields: LogFields): void;
  debug(fields: LogFields): void;
}

/** Create a scoped client logger. `scope` is prefixed to every event name. */
export function createClientLogger(scope: string): ClientLogger {
  return {
    error: (fields) => emit("error", scope, fields),
    warn: (fields) => emit("warning", scope, fields),
    info: (fields) => emit("info", scope, fields),
    debug: (fields) => emit("debug", scope, fields),
  };
}
