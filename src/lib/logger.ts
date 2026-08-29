import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

// Defense-in-depth redaction: even if a caller logs a secret or PII field by
// accident, pino censors it before the line is written. Call sites should still
// avoid logging credentials (see maskToken).
const REDACT_PATHS = [
  "token",
  "*.token",
  "session_token",
  "*.session_token",
  "password",
  "*.password",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "email",
  "*.email",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(stream?: pino.DestinationStream) {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? "info",
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    base: {
      service: "pathways-api",
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version,
    },
  };

  if (stream) {
    return pino(options, stream);
  }

  if (isDevelopment) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    });
  }

  return pino(options);
}

export const logger = createLogger();

export function createRequestLogger(correlationId: string) {
  return logger.child({ correlationId });
}

/**
 * Reduce a bearer token to a short, non-reversible prefix safe for logs.
 * Never log a raw session token — it is the sole credential for guest access.
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "(none)";
  return token.length <= 8 ? "***" : `${token.slice(0, 6)}…`;
}
