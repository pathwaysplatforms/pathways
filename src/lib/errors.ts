export class PathwaysError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    options: { code: string; statusCode: number; context?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.context = options.context;
  }
}

export class ValidationError extends PathwaysError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 400, context, cause });
  }
}

export class AuthError extends PathwaysError {
  constructor(message = "Unauthorized", context?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "AUTH_ERROR", statusCode: 401, context, cause });
  }
}

export class NotFoundError extends PathwaysError {
  constructor(message = "Not found", context?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "NOT_FOUND", statusCode: 404, context, cause });
  }
}

export class DatabaseError extends PathwaysError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "DATABASE_ERROR", statusCode: 500, context, cause });
  }
}

export class InternalError extends PathwaysError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "INTERNAL_ERROR", statusCode: 500, context, cause });
  }
}

export class RateLimitError extends PathwaysError {
  constructor(message = "Too many requests", context?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "RATE_LIMITED", statusCode: 429, context, cause });
  }
}
