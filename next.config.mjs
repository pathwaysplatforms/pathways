import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
