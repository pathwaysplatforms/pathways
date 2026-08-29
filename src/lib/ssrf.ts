import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ValidationError } from "@/lib/errors";

/**
 * SSRF guard for server-side fetches of user/admin-supplied URLs.
 *
 * Blocks non-HTTP(S) schemes, embedded credentials, and any hostname that resolves
 * to a private, loopback, link-local, or otherwise reserved address (including the
 * cloud metadata endpoint 169.254.169.254). Callers must additionally disable
 * redirect following, since a public URL can 3xx-redirect to an internal target
 * after this check passes (TOCTOU); see `safeFetch` below.
 */

/** Convert a dotted IPv4 string to its 32-bit integer value, or null if malformed. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** True if an IPv4 address falls in a private, loopback, link-local, or reserved range. */
function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // fail closed on anything we cannot parse
  const inRange = (base: string, maskBits: number): boolean => {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) return false;
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (n & mask) === (baseInt & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // "this" network
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // carrier-grade NAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local (cloud metadata)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved / broadcast
  );
}

/** True if an IPv6 address is loopback, unspecified, unique-local, link-local, or maps to a private IPv4. */
function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id
  if (addr === "::1" || addr === "::") return true;

  // IPv4-mapped / -embedded (e.g. ::ffff:169.254.169.254) — unwrap and re-check.
  const mappedMatch = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedMatch) return isPrivateIpv4(mappedMatch[1]);

  const firstHextet = addr.split(":")[0] ?? "";
  const prefix = parseInt(firstHextet || "0", 16);
  if (Number.isNaN(prefix)) return true; // fail closed
  if ((prefix & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((prefix & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((prefix & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** True if a literal IP string (v4 or v6) is in a blocked range. */
function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true; // not a valid IP → block
}

/**
 * Validate that `rawUrl` is a public HTTP(S) URL safe to fetch server-side.
 * Throws ValidationError on any disallowed scheme, credential, or private target.
 * Returns the parsed URL on success.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError("Malformed URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new ValidationError("URLs with embedded credentials are not allowed");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // Literal-IP hosts: check directly, no DNS.
  if (isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) {
      throw new ValidationError("URL resolves to a private or reserved address");
    }
    return url;
  }

  if (hostname.toLowerCase() === "localhost") {
    throw new ValidationError("URL resolves to a private or reserved address");
  }

  // Resolve DNS and reject if ANY returned address is blocked.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new ValidationError("Could not resolve URL host");
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
    throw new ValidationError("URL resolves to a private or reserved address");
  }

  return url;
}

/**
 * Fetch a validated public URL with SSRF protections: no redirect following
 * (a redirect to an internal host would bypass the pre-check) and a hard timeout.
 * A 3xx response is surfaced as a ValidationError so the caller can ask for the
 * final URL instead.
 */
export async function safeFetch(
  rawUrl: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<Response> {
  await assertPublicHttpUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 8000);

  try {
    const res = await fetch(rawUrl, {
      method: "GET",
      headers: init.headers,
      redirect: "manual",
      signal: controller.signal,
    });

    if (res.status >= 300 && res.status < 400) {
      throw new ValidationError(
        "URL redirects; provide the final destination URL instead"
      );
    }

    return res;
  } finally {
    clearTimeout(timeout);
  }
}
