import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  ...(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && {
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  }),
});
