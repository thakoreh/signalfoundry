/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { configureTestWorker, DEMO_PROFILE, grantTestSubscription, manualAccounts } from "./helpers";
const modules = import.meta.glob("../convex/**/*.ts");
const identity = { subject: "user_admin", org_id: "org_one", org_role: "org:admin" };

async function setup(paid = true) {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity(identity);
  await admin.mutation(api.workspaces.provision, {});
  await admin.mutation(api.workspaces.saveProfile, { profile: DEMO_PROFILE });
  configureTestWorker();
  if (paid) await grantTestSubscription(t);
  const account = manualAccounts(DEMO_PROFILE, "search_test", new Date().toISOString())[0];
  account.score_breakdown = [{ label: "Customer-type language", points: 60, max_points: 60, reason: "Company identity" }];
  account.evidence = account.evidence.map((item) => ({ ...item, kind: "company" as const, excerpt: "The business provides property management services." }));
  const searchId = await t.run((ctx) => ctx.db.insert("customerSearches", {
    orgId: "org_one", createdBy: "user_admin", requestKey: "search_request", status: "complete", stage: "Search finished",
    query: "property management", target: "property management", geography: "", limit: 5, profile: DEMO_PROFILE,
    website: null, accounts: [account], errors: [], createdAt: Date.now(), updatedAt: Date.now(),
  }));
  const draft = { subject: "A question for your team", body: "Hello, would a short conversation be useful?", evidence_ids: [account.evidence[0].id], warnings: ["Review before using. Nothing was sent."], generation_engine: "deepseek" as const, created_at: new Date().toISOString() };
  const fetch = vi.fn(async (url: string) => url.endsWith("customer-status") ? Response.json({ drafts: { status: "ready" } }) : Response.json(draft));
  vi.stubGlobal("fetch", fetch);
  return { t, admin, searchId, account, draft, fetch, args: { searchId, accountId: account.id, idempotency_key: "draft_request_123" } };
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("AI customer drafts (offline worker mocks)", () => {
  it("charges once, caches across keys, and binds cached aliases to their profile snapshot", async () => {
    const { t, admin, args, draft, fetch } = await setup();
    expect(await admin.action(api.customerDrafts.generate, args)).toEqual(draft);
    expect(await admin.action(api.customerDrafts.generate, args)).toEqual(draft);
    const alias = { ...args, idempotency_key: "cached_alias_123" };
    expect(await admin.action(api.customerDrafts.generate, alias)).toEqual(draft);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(1);
    const usage = await t.run((ctx) => ctx.db.query("usage").take(2));
    expect(usage[0].draftStarts).toBe(1);
    expect(usage[0].researchStarts).toBe(0);
    await admin.mutation(api.workspaces.saveProfile, { profile: { ...DEMO_PROFILE, description: "A changed offering" } });
    await expect(admin.action(api.customerDrafts.generate, alias)).rejects.toThrow("earlier business profile");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(1);
  });

  it("requires identity, tenant ownership and an entitled subscription", async () => {
    const { t, admin, args, fetch } = await setup(false);
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("subscription");
    await grantTestSubscription(t);
    await expect(t.action(api.customerDrafts.generate, args)).rejects.toThrow();
    const other = t.withIdentity({ ...identity, org_id: "org_two" });
    await expect(other.action(api.customerDrafts.generate, args)).rejects.toThrow("not found");
    await expect(admin.action(api.customerDrafts.generate, { ...args, accountId: "not_in_search" })).rejects.toThrow("not found");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("customerDrafts").take(1))).toHaveLength(0);
  });

  it("bounds new cache aliases while keeping existing request retries free", async () => {
    const { admin, args, draft, fetch } = await setup();
    await admin.action(api.customerDrafts.generate, args);
    for (let i = 0; i < 100; i++)
      expect(await admin.action(api.customerDrafts.generate, { ...args, idempotency_key: `cache_alias_${i}` })).toEqual(draft);
    await expect(admin.action(api.customerDrafts.generate, { ...args, idempotency_key: "cache_alias_over_limit" })).rejects.toThrow("request allowance");
    expect(await admin.action(api.customerDrafts.generate, args)).toEqual(draft);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(1);
  });

  it("rejects weak customer type despite a high geography score, exclusions and private evidence", async () => {
    const { t, admin, searchId, account, args, fetch } = await setup();
    const cases = [
      { ...account, score: 70, score_breakdown: [{ label: "Customer-type language", points: 30, max_points: 60, reason: "Body only" }, { label: "Location language", points: 40, max_points: 40, reason: "Nearby" }] },
      { ...account, score_breakdown: [...account.score_breakdown, { label: "Exclusion penalty", points: 0, max_points: 0, reason: "Excluded" }] },
      { ...account, evidence: account.evidence.map((item) => ({ ...item, url: "http://127.0.0.1/" })) },
    ];
    for (const bad of cases) {
      await t.run((ctx) => ctx.db.patch(searchId, { accounts: [bad] }));
      await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("clearer evidence");
    }
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("customerDrafts").take(1))).toHaveLength(0);
  });

  it("records terminal failures, only retries on a new explicit key, and counts both attempts", async () => {
    const { t, admin, args, fetch, draft } = await setup();
    let fail = true;
    fetch.mockImplementation(async (url) => {
      if (url.endsWith("customer-status")) return Response.json({ drafts: { status: "ready" } });
      return fail ? new Response("provider unavailable", { status: 503 }) : Response.json(draft);
    });
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("No automatic retry");
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("Try draft again");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(1);
    fail = false;
    await expect(admin.action(api.customerDrafts.generate, { ...args, idempotency_key: "explicit_retry_123" })).resolves.toEqual(draft);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(2);
    expect((await t.run((ctx) => ctx.db.query("usage").take(1)))[0].draftStarts).toBe(2);
  });

  it("deduplicates pending snapshots even with a new key", async () => {
    const { t, admin, args, fetch } = await setup();
    await t.mutation(internal.customerDrafts.reserve, { ...args, orgId: "org_one" });
    await expect(admin.action(api.customerDrafts.generate, { ...args, idempotency_key: "pending_other_key" })).rejects.toThrow("in progress");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.query("usage").take(1)))[0].draftStarts).toBe(1);
  });

  it("commits interrupted-attempt recovery and rejects late completion after explicit retry", async () => {
    const { t, admin, args, draft, fetch } = await setup();
    const old = await t.mutation(internal.customerDrafts.reserve, { ...args, orgId: "org_one" });
    await t.run((ctx) => ctx.db.patch(old.id, { createdAt: Date.now() - 100_000 }));
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("interrupted");
    expect((await t.run((ctx) => ctx.db.get(old.id)))?.status).toBe("failed");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(0);
    const retry = await t.mutation(internal.customerDrafts.reserve, { ...args, orgId: "org_one", idempotency_key: "explicit_retry_123" });
    expect(await t.mutation(internal.customerDrafts.finish, { id: old.id, draft })).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(retry.id)))?.status).toBe("pending");
    expect(await t.mutation(internal.customerDrafts.finish, { id: retry.id, draft })).toBe(true);
    expect(await admin.action(api.customerDrafts.generate, { ...args, idempotency_key: "cached_retry_result" })).toEqual(draft);
  });

  it("allows cached retrieval again after the alias admission window expires", async () => {
    const { t, admin, args, draft, fetch } = await setup();
    await admin.action(api.customerDrafts.generate, args);
    // Seed only noncharged cache bindings; no provider calls or quota writes.
    const first = (await t.run((ctx) => ctx.db.query("customerDrafts").take(1)))[0];
    for (let i = 0; i < 100; i++) await t.run((ctx) => ctx.db.insert("customerDrafts", {
      orgId: "org_one", requestKey: `old_alias_${i}`, cacheKey: first.cacheKey,
      status: "complete", draft, charged: false, createdAt: Date.now() - 3_700_000,
    }));
    expect(await admin.action(api.customerDrafts.generate, { ...args, idempotency_key: "new_window_cached" })).toEqual(draft);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(1);
  });

  it("fails closed for missing configuration and monthly or hourly allowance", async () => {
    const { t, admin, args, fetch } = await setup();
    fetch.mockResolvedValueOnce(Response.json({ drafts: { status: "unconfigured" } }));
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("not connected");
    expect(await t.run((ctx) => ctx.db.query("usage").take(1))).toHaveLength(0);
    const month = new Date().toISOString().slice(0, 7);
    const usageId = await t.run((ctx) => ctx.db.insert("usage", { orgId: "org_one", month, researchStarts: 0, draftStarts: 15 }));
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("Monthly");
    await t.run((ctx) => ctx.db.patch(usageId, { draftStarts: 0 }));
    for (let i = 0; i < 5; i++) await t.run((ctx) => ctx.db.insert("customerDrafts", { orgId: "org_one", requestKey: `failed_${i}`, cacheKey: `test_${i}`, status: "failed", charged: true, createdAt: Date.now() }));
    await expect(admin.action(api.customerDrafts.generate, args)).rejects.toThrow("5 per hour");
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("customer-draft"))).toHaveLength(0);
  });
});
