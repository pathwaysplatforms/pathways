import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  default: { lookup: (...args: unknown[]) => lookupMock(...args) },
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import { assertPublicHttpUrl, safeFetch } from "@/lib/ssrf";
import { ValidationError } from "@/lib/errors";

describe("assertPublicHttpUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    // Default: resolve any hostname to a public address.
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("allows a public https URL (happy path)", async () => {
    const url = await assertPublicHttpUrl("https://www.canada.ca/en/immigration.html");
    expect(url.hostname).toBe("www.canada.ca");
  });

  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toBeInstanceOf(ValidationError);
    await expect(assertPublicHttpUrl("gopher://example.com")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects embedded credentials", async () => {
    await expect(assertPublicHttpUrl("https://user:pass@example.com")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rejects the cloud metadata IP literal", async () => {
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /private or reserved/
    );
  });

  it.each([
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.16.0.1",
    "http://[::1]",
    "http://localhost",
  ])("rejects private/loopback host %s (edge case)", async (u) => {
    await expect(assertPublicHttpUrl(u)).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows a public IP literal", async () => {
    const url = await assertPublicHttpUrl("http://8.8.8.8/");
    expect(url.hostname).toBe("8.8.8.8");
  });

  it("rejects a hostname that DNS-resolves to a private address (rebinding defense)", async () => {
    lookupMock.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    await expect(assertPublicHttpUrl("http://evil.example.com")).rejects.toThrow(
      /private or reserved/
    );
  });

  it("rejects when any resolved address is private, even if others are public", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]);
    await expect(assertPublicHttpUrl("http://mixed.example.com")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rejects when DNS resolution fails (error case)", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicHttpUrl("http://nope.example.com")).rejects.toThrow(/resolve/);
  });

  it("rejects a malformed URL", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("safeFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a 2xx response for a public URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await safeFetch("https://www.canada.ca/");
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://www.canada.ca/",
      expect.objectContaining({ redirect: "manual" })
    );
  });

  it("rejects a redirect response instead of following it", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254" } }));
    await expect(safeFetch("https://www.canada.ca/")).rejects.toThrow(/redirect/);
  });

  it("does not call fetch when the URL fails validation", async () => {
    globalThis.fetch = vi.fn();
    await expect(safeFetch("http://127.0.0.1")).rejects.toBeInstanceOf(ValidationError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
