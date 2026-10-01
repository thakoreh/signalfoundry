/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { DEMO_PROFILE, demoAccounts } from "../convex/lib/fixtures";
const modules = import.meta.glob("../convex/**/*.ts");
const identity = (
  org = "org_one",
  subject = "user_admin",
  role = "org:admin",
) => ({ subject, issuer: "https://clerk.test", org_id: org, org_role: role });
async function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity(identity());
  await admin.mutation(api.workspaces.provision, {});
  await admin.mutation(api.workspaces.loadDemo, {});
  return { t, admin };
}
function configured() {
  vi.stubEnv("SIGNALFOUNDRY_WORKER_URL", "https://worker.example.com");
  vi.stubEnv(
    "SIGNALFOUNDRY_WORKER_TOKEN",
    "test-only-worker-token-not-a-real-secret",
  );
  vi.stubEnv("STRIPE_PRICE_ID", "price_test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture_only");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT", "5");
  vi.stubEnv("SIGNALFOUNDRY_DOMAINS_PER_CAMPAIGN_LIMIT", "3");
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("durable jobs (local Convex mock)", () => {
  it("atomically schedules and completes a demo without worker access, duplicate saves or quota leaks", async () => {
    const { t, admin } = await setup();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Demo",
      mode: "demo",
      domains: [],
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "repeat_click",
    });
    const same = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "repeat_click",
    });
    const active = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "another_click",
    });
    expect(same.id).toBe(job.id);
    expect(active.id).toBe(job.id);
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "succeeded",
      attempt: 1,
    });
    expect(
      await admin.query(api.campaigns.get, { id: campaign.id }),
    ).toMatchObject({ status: "complete", account_count: 8 });
    const accounts = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual(accounts);
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("systemLimits").first())?.activeJobs,
      ),
    ).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("usage").take(2))).toEqual([]);
  });
  it("scopes cancellation to creator/admin and discards late results while holding running capacity", async () => {
    const { t, admin } = await setup();
    const owner = t.withIdentity(identity("org_one", "user_one", "org:member"));
    const colleague = t.withIdentity(
      identity("org_one", "user_two", "org:member"),
    );
    const campaign = await owner.mutation(api.campaigns.create, {
      name: "Cancel",
      mode: "demo",
      domains: [],
    });
    const job = await owner.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "cancel_running",
    });
    await t.mutation(internal.jobs.claim, { id: job.id, attempt: 1 });
    await expect(
      colleague.mutation(api.jobs.cancel, { id: job.id }),
    ).rejects.toThrow("FORBIDDEN");
    expect((await admin.mutation(api.jobs.cancel, { id: job.id })).status).toBe(
      "cancelled",
    );
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(1);
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: demoAccounts(
        DEMO_PROFILE,
        campaign.id,
        new Date().toISOString(),
      ),
      errors: [],
    });
    expect(
      await owner.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
    expect((await owner.query(api.jobs.get, { id: job.id })).status).toBe(
      "cancelled",
    );
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
    await admin.mutation(api.jobs.cancel, { id: job.id });
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("systemLimits").first())?.activeJobs,
      ),
    ).toBe(0);
  });
  it("enforces per-org and global concurrency and releases queued cancellations", async () => {
    const { t, admin } = await setup();
    const make = async (user: typeof admin, key: string) => {
      const campaign = await user.mutation(api.campaigns.create, {
        name: key,
        mode: "demo",
        domains: [],
      });
      return user.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: key,
      });
    };
    const first = await make(admin, "first_pending");
    await make(admin, "second_pending");
    await expect(make(admin, "third_pending")).rejects.toThrow("RATE_LIMITED");
    await admin.mutation(api.jobs.cancel, { id: first.id });
    await make(admin, "fourth_pending");
    const extra = t.withIdentity(identity("org_overflow"));
    await extra.mutation(api.workspaces.provision, {});
    await extra.mutation(api.workspaces.loadDemo, {});
    await expect(make(extra, "overflow_pending")).rejects.toThrow(
      "Research capacity is busy",
    );
  });
  it("recovers a lost scheduled action at most five times and releases slots", async () => {
    const { t, admin } = await setup();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Lost",
      mode: "demo",
      domains: [],
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "lost_dispatch",
    });
    for (let attempt = 1; attempt <= 5; attempt++) {
      vi.setSystemTime(Date.now() + 300_000);
      await t.mutation(internal.jobs.recover, {
        id: job.id,
        expectedAttempt: attempt,
      });
    }
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "failed",
      attempt: 5,
    });
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
  });
  it("retries transient worker failures durably, not invalid worker responses, without extra monthly usage", async () => {
    configured();
    const { t, admin } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("billingAccounts", {
        orgId: "org_one",
        status: "active",
        priceId: "price_test",
        currentPeriodEnd: Date.now() + 86_400_000,
        cancelAtPeriodEnd: false,
        updatedAt: Date.now(),
      }),
    );
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Real",
      mode: "manual",
      domains: ["https://acme.com"],
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "retry_research",
    });
    const mock = vi.fn(async () => new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", mock);
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "retrying",
      attempt: 1,
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 2 });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "retrying",
      attempt: 2,
    });
    mock.mockImplementation(async () =>
      Response.json({ accounts: [{ invalid: true }], errors: [] }),
    );
    await t.action(internal.research.execute, { id: job.id, attempt: 3 });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "failed",
      attempt: 3,
    });
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("usage").first())?.researchStarts,
      ),
    ).toBe(1);
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls).toHaveLength(3);
  });
  it("rejects unconfigured, expired, wrong-plan, over-domain and over-quota paid research", async () => {
    configured();
    const { t, admin } = await setup();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Manual",
      mode: "manual",
      domains: ["https://acme.com"],
    });
    const start = () =>
      admin.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "monthly_request",
      });
    await expect(start()).rejects.toThrow("BILLING_REQUIRED");
    const billing = await t.run((ctx) =>
      ctx.db.insert("billingAccounts", {
        orgId: "org_one",
        status: "active",
        priceId: "price_wrong",
        currentPeriodEnd: Date.now() + 86_400_000,
        cancelAtPeriodEnd: false,
        updatedAt: Date.now(),
      }),
    );
    await expect(start()).rejects.toThrow("BILLING_REQUIRED");
    await t.run((ctx) =>
      ctx.db.patch(billing, {
        priceId: "price_test",
        currentPeriodEnd: Date.now() - 1,
      }),
    );
    await expect(start()).rejects.toThrow("BILLING_REQUIRED");
    await t.run((ctx) =>
      ctx.db.patch(billing, { currentPeriodEnd: Date.now() + 86_400_000 }),
    );
    vi.stubEnv("SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT", "1");
    const first = await start();
    await admin.mutation(api.jobs.cancel, { id: first.id });
    await expect(
      admin.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "after_cancellation",
      }),
    ).rejects.toThrow("QUOTA_EXCEEDED");
    const bigger = await admin.mutation(api.campaigns.create, {
      name: "Big",
      mode: "manual",
      domains: [
        "https://one.com",
        "https://two.com",
        "https://three.com",
        "https://four.com",
      ],
    });
    await expect(
      admin.mutation(api.jobs.start, {
        campaignId: bigger.id,
        idempotencyKey: "too_many_domains",
      }),
    ).rejects.toThrow("QUOTA_EXCEEDED");
    vi.stubEnv("STRIPE_PRICE_ID", "");
    await expect(
      admin.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "missing_config",
      }),
    ).rejects.toThrow("BILLING_REQUIRED");
  });
  it("re-checks entitlement at dispatch and rejects stale completion tokens", async () => {
    configured();
    const { t, admin } = await setup();
    const billing = await t.run((ctx) =>
      ctx.db.insert("billingAccounts", {
        orgId: "org_one",
        status: "active",
        priceId: "price_test",
        currentPeriodEnd: Date.now() + 86_400_000,
        cancelAtPeriodEnd: false,
        updatedAt: Date.now(),
      }),
    );
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Expired",
      mode: "manual",
      domains: ["https://acme.com"],
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "recheck_plan",
    });
    await t.run((ctx) => ctx.db.patch(billing, { status: "canceled" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await admin.query(api.jobs.get, { id: job.id })).status).toBe(
      "failed",
    );
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
  });
  it("preserves user shortlist decisions on a successful rerun", async () => {
    const { t, admin } = await setup();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Repeat",
      mode: "demo",
      domains: [],
    });
    const first = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "first_research",
    });
    await t.action(internal.research.execute, { id: first.id, attempt: 1 });
    const [account] = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "shortlisted",
    });
    const second = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "second_research",
    });
    await t.action(internal.research.execute, { id: second.id, attempt: 1 });
    expect(
      (await admin.query(api.accounts.get, { id: account.id })).status,
    ).toBe("shortlisted");
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toHaveLength(8);
  });
  it("preserves untouched prior results, stable IDs, decisions and merged counts on a partial rerun", async () => {
    const { t, admin } = await setup();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Partial",
      mode: "demo",
      domains: [],
    });
    const first = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "initial_complete",
    });
    await t.action(internal.research.execute, { id: first.id, attempt: 1 });
    const previous = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    const untouched = previous[0];
    await admin.mutation(api.accounts.setStatus, {
      id: untouched.id,
      status: "shortlisted",
    });
    const second = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "partial_rerun",
    });
    await t.mutation(internal.jobs.claim, { id: second.id, attempt: 1 });
    const fresh = demoAccounts(
      DEMO_PROFILE,
      campaign.id,
      new Date().toISOString(),
    ).filter((account) => account.domain !== untouched.domain);
    await t.mutation(internal.jobs.finish, {
      id: second.id,
      attempt: 1,
      accounts: fresh,
      errors: ["One public domain was unavailable"],
    });
    const results = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    expect(results).toHaveLength(8);
    expect(
      await admin.query(api.accounts.get, { id: untouched.id }),
    ).toMatchObject({
      status: "shortlisted",
      researched_at: untouched.researched_at,
    });
    expect(
      await admin.query(api.campaigns.get, { id: campaign.id }),
    ).toMatchObject({
      status: "partial",
      account_count: 8,
      qualified_count: results.filter((account) => account.score >= 60).length,
    });
  });

  it("fails closed on missing Stripe setup both before start and after a queued reservation", async () => {
    configured();
    const { t, admin } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("billingAccounts", {
        orgId: "org_one",
        status: "active",
        priceId: "price_test",
        currentPeriodEnd: Date.now() + 86_400_000,
        cancelAtPeriodEnd: false,
        updatedAt: Date.now(),
      }),
    );
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Configured",
      mode: "manual",
      domains: ["https://acme.com"],
    });
    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "APP_URL",
    ]) {
      vi.stubEnv(key, "");
      await expect(
        admin.mutation(api.jobs.start, {
          campaignId: campaign.id,
          idempotencyKey: "missing_setup",
        }),
      ).rejects.toThrow("BILLING_REQUIRED");
      configured();
    }
    expect(await t.run((ctx) => ctx.db.query("usage").take(1))).toEqual([]);
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "before_config_removed",
    });
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await admin.query(api.jobs.get, { id: job.id })).status).toBe(
      "failed",
    );
  });

  it("survives worker capacity occupied beyond 15 seconds with bounded backoff and one usage charge", async () => {
    configured();
    const { t, admin } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("billingAccounts", {
        orgId: "org_one",
        status: "active",
        priceId: "price_test",
        currentPeriodEnd: Date.now() + 86_400_000,
        cancelAtPeriodEnd: false,
        updatedAt: Date.now(),
      }),
    );
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Occupied worker",
      mode: "manual",
      domains: ["https://acme.com"],
    });
    const startedAt = Date.now();
    const fixture = demoAccounts(
      DEMO_PROFILE,
      campaign.id,
      new Date().toISOString(),
    )[0];
    const account = {
      ...fixture,
      domain: "acme.com",
      is_demo: false,
      evidence: fixture.evidence.map((item) => ({
        ...item,
        url: "https://acme.com/",
        is_demo: false,
      })),
    };
    const fetchMock = vi.fn(async () =>
      Date.now() - startedAt < 40_000
        ? new Response("busy", { status: 429 })
        : Response.json({ accounts: [account], errors: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "worker_capacity",
    });
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "retrying",
      attempt: 1,
    });
    vi.advanceTimersByTime(15_000);
    await t.finishInProgressScheduledFunctions();
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "retrying",
      attempt: 2,
    });
    vi.advanceTimersByTime(30_000);
    await t.finishInProgressScheduledFunctions();
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "succeeded",
      attempt: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("usage").first())?.researchStarts,
      ),
    ).toBe(1);
  });
});
