import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export function createLogger(stream?: pino.DestinationStream) {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? "info",
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
