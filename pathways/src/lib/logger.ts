import pino from "pino";

/**
 * Shared application logger (Pino). Configure level via LOG_LEVEL env in production.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
