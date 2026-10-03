import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../lib/api.ts";

test("API client preserves organization intent for Headers, tuples, and plain objects", async (t) => {
  const seen: Headers[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, options?: RequestInit) => {
      seen.push(new Headers(options?.headers));
      assert.equal(options?.cache, "no-store");
      return Response.json({ ok: true });
    },
  );
  const variants: HeadersInit[] = [
    new Headers({ "X-SignalFoundry-Organization": "org_a" }),
    [["X-SignalFoundry-Organization", "org_a"]],
    { "X-SignalFoundry-Organization": "org_a" },
  ];
  for (const headers of variants) await api("/workspace", { headers });
  assert.equal(seen.length, variants.length);
  for (const headers of seen) {
    assert.equal(headers.get("x-signalfoundry-organization"), "org_a");
    assert.equal(headers.get("content-type"), "application/json");
  }
});

test("API client keeps explicit content type and preserves cancellation", async (t) => {
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, options?: RequestInit) => {
      assert.equal(
        new Headers(options?.headers).get("content-type"),
        "application/custom+json",
      );
      return Response.json({ ok: true });
    },
  );
  await api("/workspace", {
    headers: new Headers({ "Content-Type": "application/custom+json" }),
  });
  mock.mock.mockImplementation(async () => {
    throw new DOMException("Cancelled", "AbortError");
  });
  await assert.rejects(api("/workspace"), { name: "AbortError" });
});

test("company discovery readiness is independent of optional contact enrichment", async () => {
  const { discoveryReady } = await import("../lib/api.ts");
  const status = {
    enabled: true,
    max_target_count: 10,
    max_cost_microusd: 1_000_000,
    blockers: [],
    providers: {
      discovery: { configured: true, licensed: true, reason: "Ready" },
      contacts: { configured: false, licensed: false, reason: "Optional" },
      verification: { configured: false, licensed: false, reason: "Optional" },
    },
  };
  assert.equal(discoveryReady(status), true);
  assert.equal(discoveryReady({ ...status, blockers: ["No budget"] }), false);
  assert.equal(
    discoveryReady({
      ...status,
      providers: {
        ...status.providers,
        discovery: { ...status.providers.discovery, licensed: false },
      },
    }),
    false,
  );
});
