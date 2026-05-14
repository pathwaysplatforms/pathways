/** Base class for application errors with optional HTTP status. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options?: { status?: number; code?: string; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "APP_ERROR";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { status: 400, code: "VALIDATION_ERROR", cause });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", cause?: unknown) {
    super(message, { status: 404, code: "NOT_FOUND", cause });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", cause?: unknown) {
    super(message, { status: 401, code: "UNAUTHORIZED", cause });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", cause?: unknown) {
    super(message, { status: 403, code: "FORBIDDEN", cause });
  }
}
