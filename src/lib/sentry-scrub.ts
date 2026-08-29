import type { ErrorEvent } from "@sentry/nextjs";

/**
 * This app handles immigration PII (nationality, occupation, documents) and
 * bearer credentials (guest session tokens). Sentry must never receive any of
 * it, so we strip request bodies, cookies, auth headers, and token-bearing URLs
 * from every event before it leaves the process.
 */

const SENSITIVE_QUERY_PARAM = /(^|[?&])(token|session_token|code|access_token|api_key)=[^&]*/gi;

/** Replace a guest session token embedded in an /api/guest/<token> path. */
function redactGuestTokenPath(url: string): string {
  return url.replace(/(\/api\/guest\/)[^/?#]+/gi, "$1[redacted]");
}

/** Redact token-like query parameters from a URL or query string. */
function redactQueryTokens(value: string): string {
  return value.replace(SENSITIVE_QUERY_PARAM, "$1$2=[redacted]");
}

/**
 * Strip PII and credentials from a Sentry error event before it is sent.
 * Removes request bodies, cookies, and auth headers; redacts tokens from URLs
 * and query strings; and reduces the user context to a bare id.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;

    if (request.headers) {
      delete request.headers.authorization;
      delete request.headers.Authorization;
      delete request.headers.cookie;
      delete request.headers.Cookie;
    }

    if (typeof request.url === "string") {
      request.url = redactQueryTokens(redactGuestTokenPath(request.url));
    }

    if (typeof request.query_string === "string") {
      request.query_string = redactQueryTokens(request.query_string);
    } else if (request.query_string) {
      delete request.query_string;
    }
  }

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }

  return event;
}
