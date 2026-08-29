import { describe, it, expect } from "vitest";
import {
  PathwaysError,
  ValidationError,
  AuthError,
  NotFoundError,
  DatabaseError,
  RateLimitError,
  safeErrorMessage,
} from "@/lib/errors";

describe("PathwaysError", () => {
  it("stores code, statusCode, and context", () => {
    const err = new PathwaysError("base error", {
      code: "TEST_CODE",
      statusCode: 418,
      context: { foo: "bar" },
    });
    expect(err.message).toBe("base error");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(418);
    expect(err.context).toEqual({ foo: "bar" });
  });

  it("is an instance of Error", () => {
    const err = new PathwaysError("oops", { code: "X", statusCode: 500 });
    expect(err).toBeInstanceOf(Error);
  });
});

describe("ValidationError", () => {
  it("has statusCode 400", () => {
    expect(new ValidationError("bad input").statusCode).toBe(400);
  });

  it("has code VALIDATION_ERROR", () => {
    expect(new ValidationError("bad input").code).toBe("VALIDATION_ERROR");
  });
});

describe("AuthError", () => {
  it("has statusCode 401", () => {
    expect(new AuthError().statusCode).toBe(401);
  });

  it("has code AUTH_ERROR", () => {
    expect(new AuthError().code).toBe("AUTH_ERROR");
  });

  it("uses default message", () => {
    expect(new AuthError().message).toBe("Unauthorized");
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404", () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it("has code NOT_FOUND", () => {
    expect(new NotFoundError().code).toBe("NOT_FOUND");
  });
});

describe("DatabaseError", () => {
  it("has statusCode 500", () => {
    expect(new DatabaseError("query failed").statusCode).toBe(500);
  });

  it("has code DATABASE_ERROR", () => {
    expect(new DatabaseError("query failed").code).toBe("DATABASE_ERROR");
  });
});

describe("RateLimitError", () => {
  it("has statusCode 429 and code RATE_LIMITED", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
  });
});

describe("safeErrorMessage", () => {
  it("returns the curated message for a PathwaysError (happy path)", () => {
    expect(safeErrorMessage(new NotFoundError("Session not found or expired"))).toBe(
      "Session not found or expired"
    );
  });

  it("returns a generic message for a raw Error, hiding internals (edge case)", () => {
    expect(safeErrorMessage(new Error("relation \"profiles\" does not exist"))).toBe(
      "An unexpected error occurred."
    );
  });

  it("returns a generic message for non-Error values (error case)", () => {
    expect(safeErrorMessage("boom")).toBe("An unexpected error occurred.");
    expect(safeErrorMessage(undefined)).toBe("An unexpected error occurred.");
  });
});
