/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  configureTestWorker,
  DEMO_PROFILE,
  grantTestSubscription,
  manualAccounts,
} from "./helpers";
const modules = import.meta.glob("../convex/**/*.ts");
const identity = {
  subject: "user_admin",
  org_id: "org_one",
  org_role: "org:admin",
};
const body = {
  target: "Accounting firms",
  geography: "Toronto",
  limit: 2,
  idempotency_key: "customer_request_123",
};
async function setup(paid = true) {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity(identity);
  await admin.mutation(api.workspaces.provision, {});
  await admin.mutation(api.workspaces.saveProfile, { profile: DEMO_PROFILE });
  configureTestWorker();
  if (paid) await grantTestSubscription(t);
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/worker/customer-status"))
      return Response.json({
        discovery: { provider: "deepseek", status: "ready" },
        contacts: { provider: "hunter", status: "unconfigured" },
      });
    const request = JSON.parse(String(init?.body));
    return Response.json({
      accounts: manualAccounts(
        request.profile,
        request.search_id,
        new Date().toISOString(),
      ),
      errors: [],
      query: "Accounting firms Toronto company",
    });
  });
  vi.stubGlobal("fetch", fetch);
  return { t, admin, fetch };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("customer discovery (offline Convex mock)", () => {
  it("persists scoped results, preserves idempotency, and never repeats paid work", async () => {
    const { t, admin, fetch } = await setup();
    const first = await admin.action(api.customers.start, body);
    const repeated = await admin.action(api.customers.start, body);
    expect(first.id).toBe(repeated.id);
    await expect(
      admin.action(api.customers.start, {
        ...body,
        idempotency_key: "different_request",
      }),
    ).rejects.toThrow();
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    const completed = await admin.query(api.customers.get, { id: first.id });
    expect(completed.status).toBe("complete");
    expect(completed.accounts).toHaveLength(1);
    const calls = fetch.mock.calls.filter(([url]) =>
      url.endsWith("/worker/customers"),
    ).length;
    expect(calls).toBe(1);
    await t.action(internal.customers.execute, { id: first.id });
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/worker/customers")),
    ).toHaveLength(1);
    expect(
      (await t.run((ctx) => ctx.db.query("usage").take(2)))[0].researchStarts,
    ).toBe(1);
    const other = t.withIdentity({
      ...identity,
      subject: "other",
      org_id: "org_two",
    });
    await expect(
      other.query(api.customers.get, { id: first.id }),
    ).rejects.toThrow();
    await expect(
      t.query(api.customers.get, { id: first.id }),
    ).rejects.toThrow();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await admin.query(api.customers.get, { id: first.id })).status,
    ).toBe("complete");
  });
  it("fails closed for subscription, input limits, and provider configuration", async () => {
    const { t, admin, fetch } = await setup(false);
    await expect(admin.action(api.customers.start, body)).rejects.toThrow();
    await grantTestSubscription(t);
    await expect(
      admin.action(api.customers.start, { ...body, limit: 6 }),
    ).rejects.toThrow();
    fetch.mockImplementation(async () =>
      Response.json({
        discovery: { provider: "deepseek", status: "unconfigured" },
        contacts: { provider: "hunter", status: "unconfigured" },
      }),
    );
    await expect(admin.action(api.customers.start, body)).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("customerSearches").take(2)),
    ).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("usage").take(2))).toHaveLength(0);
  });
  it("fails once on worker error without leaking secrets or automatically retrying", async () => {
    const { t, admin, fetch } = await setup();
    fetch.mockImplementation(async (url: string) =>
      url.endsWith("/worker/customer-status")
        ? Response.json({
            discovery: { provider: "deepseek", status: "ready" },
          })
        : new Response("private provider key and body", { status: 503 }),
    );
    const first = await admin.action(api.customers.start, body);
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const completed = await admin.query(api.customers.get, { id: first.id });
    expect(completed.status).toBe("failed");
    expect(JSON.stringify(completed)).not.toContain("private provider");
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/worker/customers")),
    ).toHaveLength(1);
  });
});
