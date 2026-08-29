import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  // Immigration PII app — never let Sentry attach IPs, cookies, or bodies.
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  ...(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && {
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  }),
});
