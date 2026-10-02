/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  DEMO_PROFILE,
  configureTestWorker,
  grantTestSubscription,
  manualAccounts,
} from "./helpers";
import type { Id } from "../convex/_generated/dataModel";
import type { WorkerAccount } from "../convex/validators";
const modules = import.meta.glob("../convex/**/*.ts");
const identity = (
  org = "org_one",
  user = "user_admin",
  role = "org:admin",
) => ({
  subject: user,
  issuer: "https://clerk.test",
  org_id: org,
  org_role: role,
});
function approvals() {
  configureTestWorker();
  vi.stubEnv("SIGNALFOUNDRY_DISCOVERY_LAUNCH_APPROVED", "true");
  vi.stubEnv("SIGNALFOUNDRY_LICENSED_DATA_ACCESS_APPROVED", "true");
  vi.stubEnv("SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED", "true");
  vi.stubEnv("SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED", "true");
  vi.stubEnv("SIGNALFOUNDRY_DISCOVERY_JOB_BUDGET_MICROUSD", "100000");
  vi.stubEnv(
    "SIGNALFOUNDRY_DISCOVERY_WORKSPACE_MONTHLY_BUDGET_MICROUSD",
    "200000",
  );
  vi.stubEnv("SIGNALFOUNDRY_DISCOVERY_MONTHLY_BUDGET_MICROUSD", "300000");
}
async function setup() {
  approvals();
  const t = convexTest(schema, modules),
    admin = t.withIdentity(identity());
  await admin.mutation(api.workspaces.provision, {});
  await grantTestSubscription(t);
  const campaign = await admin.mutation(api.campaigns.create, {
    name: "Find customers",
    mode: "discovery",
    domains: [],
    profile_snapshot: DEMO_PROFILE,
    target_count: 2,
    offering_website: "https://product.com",
  });
  return { t, admin, campaign };
}
function accounts(id: Id<"campaigns">): WorkerAccount[] {
  return manualAccounts(DEMO_PROFILE, id, new Date().toISOString(), [
    "acme.com",
    "second.com",
  ]).map((account, i) => ({
    ...account,
    id: `worker_${i}`,
    contacts: [],
    source_provider: "exa",
    source_url: `https://${account.domain}/`,
    retrieved_at: new Date().toISOString(),
    license_reference: "offline-license-fixture",
    license_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    license_restrictions: ["No cross-customer reuse"],
  }));
}
function licensedContact(
  expiresAt = Date.now() + 43_200_000,
): WorkerAccount["contacts"][number] {
  return {
    name: "Offline Person",
    role: "VP Operations",
    email: "person@acme.com",
    verification_status: "unverified",
    source_url: "https://linkedin.com/in/offline-fixture",
    note: "Offline fixture",
    provider: "peopledatalabs",
    retrieved_at: new Date().toISOString(),
    employment_verified_at: null,
    email_checked_at: null,
    email_status: "not_checked",
    email_verification_provider: null,
    license_reference: "offline-pdl-license",
    license_expires_at: new Date(expiresAt).toISOString(),
    license_restrictions: ["No cross-customer reuse"],
  };
}
const ready = {
  enabled: true,
  providers: {
    discovery: { configured: true, licensed: true, reason: "Offline test" },
    contacts: { configured: true, licensed: true, reason: "Offline test" },
    verification: {
      configured: false,
      licensed: false,
      reason: "Not configured",
    },
  },
  max_target_count: 30,
  max_cost_microusd: 100000,
  blockers: [],
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("discovery-first durable jobs", () => {
  it("saves editable campaign criteria without a workspace profile and freezes later workspace changes", async () => {
    const { t, admin, campaign } = await setup();
    await admin.mutation(api.workspaces.saveProfile, {
      profile: { ...DEMO_PROFILE, buyer_roles: ["Different buyer"] },
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "snapshot_immutable",
    });
    const work = await t.mutation(internal.discovery.claim, {
      id: job.id,
      attempt: 1,
    });
    expect(work?.profile.buyer_roles).toEqual(DEMO_PROFILE.buyer_roles);
    expect(work?.offeringWebsite).toBe("https://product.com/");
    expect(campaign.domains).toEqual([]);
    expect(
      (await admin.query(api.campaigns.get, { id: campaign.id }))
        .profile_snapshot,
    ).toEqual(DEMO_PROFILE);
  });
  it("fails closed without approvals and makes no provider calls or budget reservations", async () => {
    const { t, admin, campaign } = await setup();
    vi.stubEnv("SIGNALFOUNDRY_DISCOVERY_LAUNCH_APPROVED", "false");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      admin.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "disabled_provider",
      }),
    ).rejects.toThrow("CONFIGURATION_ERROR");
    expect(fetch).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("discoverySpend").take(10)),
    ).toEqual([]);
  });
  it("reserves once per idempotency key, scopes tenancy, and refunds a queued cancellation", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "repeat_discovery",
    });
    const same = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "repeat_discovery",
    });
    expect(same.id).toBe(job.id);
    expect(
      await t.run((ctx) => ctx.db.query("discoverySpend").take(10)),
    ).toHaveLength(1);
    const outsider = t.withIdentity(identity("org_other"));
    await expect(outsider.query(api.jobs.get, { id: job.id })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(
      outsider.query(api.campaigns.get, { id: campaign.id }),
    ).rejects.toThrow("NOT_FOUND");
    expect(
      (await admin.mutation(api.jobs.cancel, { id: job.id })).spend_status,
    ).toBe("settled");
    expect(
      (await t.run((ctx) => ctx.db.query("discoveryUsage").take(10))).every(
        (row) => row.committedMicrousd === 0,
      ),
    ).toBe(true);
  });
  it("runs paid steps once, preserves provenance and unknown email status, and settles conservative costs", async () => {
    const { t, admin, campaign } = await setup();
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (url.endsWith("/discovery-status")) return Response.json(ready);
      if (url.endsWith("/discover"))
        return Response.json({
          accounts: accounts(campaign.id),
          errors: [],
          cost_microusd: 27000,
          spend_uncertain: false,
        });
      expect(body.org_id).toBe("org_one");
      expect(body.max_cost_microusd).toBeGreaterThan(0);
      return Response.json({
        account_id: body.account_id,
        contacts: [],
        errors: [],
        cost_microusd: 3000,
        spend_uncertain: false,
      });
    });
    vi.stubGlobal("fetch", fetch);
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "complete_discovery",
    });
    for (let attempt = 1; attempt <= 3; attempt++)
      await t.action(internal.discovery.execute, { id: job.id, attempt });
    await t.action(internal.discovery.execute, { id: job.id, attempt: 3 });
    vi.advanceTimersByTime(6100);
    await t.finishInProgressScheduledFunctions();
    vi.advanceTimersByTime(0);
    await t.finishInProgressScheduledFunctions();
    const final = await admin.query(api.jobs.get, { id: job.id });
    expect(final).toMatchObject({
      status: "partial",
      stage: "complete",
      spent_microusd: 33000,
      spend_status: "settled",
    });
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/contacts")),
    ).toHaveLength(2);
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toHaveLength(2);
    expect(
      (await t.run((ctx) => ctx.db.query("discoveryUsage").take(10))).every(
        (row) => row.committedMicrousd === 33000,
      ),
    ).toBe(true);
  });
  it("holds the full budget on uncertain calls and never retries a timed-out provider", async () => {
    const { t, admin, campaign } = await setup();
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/discovery-status")) return Response.json(ready);
      throw new Error("Network timeout");
    });
    vi.stubGlobal("fetch", fetch);
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "uncertain_discovery",
    });
    await t.action(internal.discovery.execute, { id: job.id, attempt: 1 });
    await t.action(internal.discovery.execute, { id: job.id, attempt: 1 });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "failed",
      spend_status: "uncertain",
      spent_microusd: 100000,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("discards late in-flight results after cancellation and holds unknown spend", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "cancel_discovery",
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await admin.mutation(api.jobs.cancel, { id: job.id });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: accounts(campaign.id),
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "cancelled",
      spend_status: "uncertain",
      spent_microusd: 100000,
    });
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
  });
  it("enforces monthly tenant budgets across jobs atomically", async () => {
    const { t, admin, campaign } = await setup();
    for (const key of ["consume_first", "consume_second"]) {
      const job = await admin.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: key,
      });
      await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
      await t.mutation(internal.discovery.stop, {
        id: job.id,
        attempt: 1,
        message: "Unknown charge",
        uncertain: true,
      });
    }
    await expect(
      admin.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "consume_third",
      }),
    ).rejects.toThrow("QUOTA_EXCEEDED");
    expect(
      await t.run((ctx) => ctx.db.query("discoverySpend").take(10)),
    ).toHaveLength(2);
  });
  it("blocks unlicensed export and hides/purges expired provider data", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "retention_discovery",
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    const rows = accounts(campaign.id);
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: [],
    });
    await expect(
      admin.query(api.campaigns.exportAccounts, { id: campaign.id }),
    ).rejects.toThrow("EXPORT_BLOCKED");
    vi.stubEnv("SIGNALFOUNDRY_LICENSED_DATA_EXPORT_APPROVED", "true");
    expect(
      await admin.query(api.campaigns.exportAccounts, { id: campaign.id }),
    ).toHaveLength(2);
    vi.setSystemTime(Date.now() + 86_400_001);
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
    await t.mutation(internal.discovery.purgeExpired, { id: job.id });
    expect(await t.run((ctx) => ctx.db.query("accounts").take(10))).toEqual([]);
  });
  it("rejects provider results with missing license provenance or over-budget charges", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "invalid_discovery",
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await expect(
      t.mutation(internal.discovery.advance, {
        id: job.id,
        attempt: 1,
        accounts: manualAccounts(
          DEMO_PROFILE,
          campaign.id,
          new Date().toISOString(),
        ),
        errors: [],
        cost: 1,
        uncertain: false,
        verificationEnabled: false,
      }),
    ).rejects.toThrow("RESEARCH_FAILED");
    await expect(
      t.mutation(internal.discovery.advance, {
        id: job.id,
        attempt: 1,
        accounts: accounts(campaign.id),
        errors: [],
        cost: 100001,
        uncertain: false,
        verificationEnabled: false,
      }),
    ).rejects.toThrow("RESEARCH_FAILED");
  });
});

describe("discovery settlement races and retention boundaries", () => {
  it("settles a completed stage only once before the finalizer runs", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "duplicate_settlement",
    });
    const rows = accounts(campaign.id).slice(0, 1);
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    const discovery = {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    };
    await t.mutation(internal.discovery.advance, discovery);
    await t.mutation(internal.discovery.advance, discovery);
    expect(
      (await admin.query(api.jobs.get, { id: job.id })).spent_microusd,
    ).toBe(27000);
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 });
    const contact = { ...discovery, attempt: 2, cost: 3000 };
    await t.mutation(internal.discovery.advance, contact);
    await t.mutation(internal.discovery.advance, contact);
    await t.mutation(internal.discovery.stop, {
      id: job.id,
      attempt: 2,
      message: "Duplicate stop",
      uncertain: true,
    });
    expect(
      (await admin.query(api.jobs.get, { id: job.id })).spent_microusd,
    ).toBe(30000);
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: [],
    });
    await t.mutation(internal.discovery.advance, contact);
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "succeeded",
      spent_microusd: 30000,
      spend_status: "settled",
    });
    expect(
      (await t.run((ctx) => ctx.db.query("discoveryUsage").take(10))).every(
        (row) => row.committedMicrousd === 30000,
      ),
    ).toBe(true);
  });

  it("discards late advance and stop callbacks after recovery claimed settlement", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "late_recovery_settlement",
    });
    const rows = accounts(campaign.id);
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 });
    vi.setSystemTime(Date.now() + 150001);
    await t.mutation(internal.jobs.recover, { id: job.id, expectedAttempt: 2 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: [],
      cost: 3000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.discovery.stop, {
      id: job.id,
      attempt: 2,
      message: "Late response",
      uncertain: false,
    });
    const recovering = await t.run((ctx) => ctx.db.get(job.id));
    expect(recovering).toMatchObject({
      stageInFlight: false,
      spentMicrousd: 27000,
      spendStatus: "uncertain",
    });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: ["Lost response"],
    });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "partial",
      spent_microusd: 100000,
      spend_status: "uncertain",
    });
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toHaveLength(2);
  });

  it("does not let a duplicate stop change a known no-charge failure into uncertainty", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "duplicate_stage_stop",
    });
    const rows = accounts(campaign.id);
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 });
    await t.mutation(internal.discovery.stop, {
      id: job.id,
      attempt: 2,
      message: "Provider disabled before dispatch",
      uncertain: false,
    });
    await t.mutation(internal.discovery.stop, {
      id: job.id,
      attempt: 2,
      message: "Duplicate callback",
      uncertain: true,
    });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: ["Provider disabled before dispatch"],
    });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "partial",
      spent_microusd: 27000,
      spend_status: "settled",
    });
  });

  it("settles expired final results without an unrecoverable finish loop", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "expired_final_results",
    });
    const rows = accounts(campaign.id);
    rows[0].license_expires_at = new Date(Date.now() + 1000).toISOString();
    rows[1].contacts = [licensedContact(Date.now() + 1000)];
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 });
    vi.setSystemTime(Date.now() + 1001);
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: [],
    });
    const saved = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].domain).toBe("second.com");
    expect(saved[0].contacts).toEqual([]);
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "partial",
      spend_status: "settled",
      spent_microusd: 27000,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(job.id)))?.intermediateAccounts,
    ).toBeUndefined();
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
  });

  it("stops before paid work if a checkpoint expires instead of shifting the company cursor", async () => {
    const { t, admin, campaign } = await setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "expired_before_contact",
    });
    const rows = accounts(campaign.id);
    rows[0].license_expires_at = new Date(Date.now() + 1000).toISOString();
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    vi.setSystemTime(Date.now() + 1001);
    expect(
      await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 }),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    const checkpoint = await t.run((ctx) => ctx.db.get(job.id));
    expect(checkpoint).toMatchObject({
      status: "running",
      stageInFlight: false,
      attempt: 2,
    });
    expect(checkpoint?.intermediateAccounts?.map((row) => row.domain)).toEqual([
      "second.com",
    ]);
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: checkpoint!.intermediateAccounts!,
      errors: ["Saved data expired"],
    });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "partial",
      spent_microusd: 27000,
      spend_status: "settled",
    });
  });

  it("physically purges an in-flight checkpoint, holds unknown spend, and rejects its late callback", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "expiry_during_contact",
    });
    const rows = accounts(campaign.id);
    rows[0].license_expires_at = new Date(Date.now() + 1000).toISOString();
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 27000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 2 });
    vi.setSystemTime(Date.now() + 1001);
    await t.mutation(internal.discovery.purgeExpired, { id: job.id });
    const checkpoint = await t.run((ctx) => ctx.db.get(job.id));
    expect(checkpoint).toMatchObject({
      stageInFlight: false,
      spendStatus: "uncertain",
    });
    expect(checkpoint?.intermediateAccounts?.map((row) => row.domain)).toEqual([
      "second.com",
    ]);
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 2,
      accounts: rows,
      errors: [],
      cost: 3000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 2,
      accounts: checkpoint!.intermediateAccounts!,
      errors: ["Retention expired"],
    });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "partial",
      spend_status: "uncertain",
      spent_microusd: 100000,
    });
    expect(
      (await admin.query(api.campaigns.accounts, { id: campaign.id })).map(
        (row) => row.domain,
      ),
    ).toEqual(["second.com"]);
  });

  it("hides revoked contacts independently and never returns revoked company data", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "provider_read_revocation",
    });
    const rows = accounts(campaign.id);
    rows[0].contacts = [licensedContact()];
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
    });
    vi.stubEnv("SIGNALFOUNDRY_LICENSED_DATA_EXPORT_APPROVED", "true");
    let saved = await admin.query(api.campaigns.accounts, { id: campaign.id });
    expect(
      saved.find((row) => row.domain === "acme.com")?.contacts,
    ).toHaveLength(1);
    vi.stubEnv("SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED", "false");
    saved = await admin.query(api.campaigns.exportAccounts, {
      id: campaign.id,
    });
    expect(saved).toHaveLength(2);
    expect(saved.every((row) => !row.contacts.length)).toBe(true);
    vi.stubEnv("SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED", "false");
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
    expect(
      await admin.query(api.campaigns.exportAccounts, { id: campaign.id }),
    ).toEqual([]);
    await expect(
      admin.query(api.accounts.get, { id: saved[0].id }),
    ).rejects.toThrow("DATA_EXPIRED");
  });

  it("physically expires PDL contacts earlier than their Exa account and schedules the next expiry", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "independent_retention",
    });
    const rows = accounts(campaign.id);
    rows[0].contacts = [licensedContact(Date.now() + 1000)];
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
    });
    vi.setSystemTime(Date.now() + 1001);
    await t.mutation(internal.discovery.purgeExpired, { id: job.id });
    const saved = await t.run((ctx) => ctx.db.query("accounts").take(10));
    expect(saved).toHaveLength(2);
    expect(saved.every((row) => row.data.contacts.length === 0)).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(job.id)))?.retentionSweepAt).toBe(
      Date.parse(rows[0].license_expires_at!),
    );
    expect(
      await admin.query(api.campaigns.get, { id: campaign.id }),
    ).toMatchObject({ account_count: 2 });
  });
});

describe("discovery shared-account budgets and tenant isolation", () => {
  it("enforces the monthly global allowance across organizations and resets only in a new month", async () => {
    const { t, admin, campaign } = await setup();
    const second = t.withIdentity(identity("org_second"));
    await second.mutation(api.workspaces.provision, {});
    await grantTestSubscription(t, "org_second");
    const other = await second.mutation(api.campaigns.create, {
      name: "Other discovery",
      mode: "discovery",
      domains: [],
      profile_snapshot: DEMO_PROFILE,
      target_count: 2,
    });
    for (const [client, id, key] of [
      [admin, campaign.id, "global_first"],
      [admin, campaign.id, "global_second"],
      [second, other.id, "global_third"],
    ] as const) {
      const job = await client.mutation(api.jobs.start, {
        campaignId: id,
        idempotencyKey: key,
      });
      await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
      await t.mutation(internal.discovery.stop, {
        id: job.id,
        attempt: 1,
        message: "Ambiguous provider dispatch",
        uncertain: true,
      });
    }
    await expect(
      second.mutation(api.jobs.start, {
        campaignId: other.id,
        idempotencyKey: "global_fourth",
      }),
    ).rejects.toThrow("QUOTA_EXCEEDED");
    const usage = await t.run((ctx) => ctx.db.query("discoveryUsage").take(10));
    expect(usage.find((row) => row.scope === "global")?.committedMicrousd).toBe(
      300000,
    );
    expect(
      usage.find((row) => row.scope === "org_second")?.committedMicrousd,
    ).toBe(100000);
    expect(
      await t.run((ctx) => ctx.db.query("discoverySpend").take(10)),
    ).toHaveLength(3);
    const now = new Date();
    vi.setSystemTime(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    await t.run(async (ctx) => {
      const billing = await ctx.db
        .query("billingAccounts")
        .withIndex("by_orgId", (q) => q.eq("orgId", "org_second"))
        .unique();
      await ctx.db.patch(billing!._id, {
        currentPeriodEnd: Date.now() + 86_400_000,
      });
    });
    const next = await second.mutation(api.jobs.start, {
      campaignId: other.id,
      idempotencyKey: "new_month_first",
    });
    expect(next.spend_status).toBe("reserved");
    const all = await t.run((ctx) => ctx.db.query("discoveryUsage").take(10));
    expect(
      all
        .filter((row) => row.scope === "global")
        .map((row) => row.committedMicrousd)
        .sort(),
    ).toEqual([100000, 300000]);
  });

  it("shares a 6100ms PDL request interval across organizations without consuming deferred attempts", async () => {
    const { t, admin, campaign } = await setup();
    const second = t.withIdentity(identity("org_second"));
    await second.mutation(api.workspaces.provision, {});
    await grantTestSubscription(t, "org_second");
    const other = await second.mutation(api.campaigns.create, {
      name: "Other discovery",
      mode: "discovery",
      domains: [],
      profile_snapshot: DEMO_PROFILE,
      target_count: 2,
    });
    const jobs: { id: Id<"jobs"> }[] = [];
    for (const [client, id, key] of [
      [admin, campaign.id, "shared_pdl_first"],
      [second, other.id, "shared_pdl_second"],
    ] as const) {
      const job = await client.mutation(api.jobs.start, {
        campaignId: id,
        idempotencyKey: key,
      });
      jobs.push(job);
      await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
      await t.mutation(internal.discovery.advance, {
        id: job.id,
        attempt: 1,
        accounts: accounts(id),
        errors: [],
        cost: 27000,
        uncertain: false,
        verificationEnabled: false,
      });
    }
    expect(
      await t.mutation(internal.discovery.claim, {
        id: jobs[0].id,
        attempt: 2,
      }),
    ).not.toBeNull();
    expect(
      await t.mutation(internal.discovery.claim, {
        id: jobs[1].id,
        attempt: 2,
      }),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(jobs[1].id)))?.attempt).toBe(1);
    vi.setSystemTime(Date.now() + 6099);
    expect(
      await t.mutation(internal.discovery.claim, {
        id: jobs[1].id,
        attempt: 2,
      }),
    ).toBeNull();
    vi.setSystemTime(Date.now() + 1);
    expect(
      await t.mutation(internal.discovery.claim, {
        id: jobs[1].id,
        attempt: 2,
      }),
    ).not.toBeNull();
    expect(
      await t.mutation(internal.discovery.claim, {
        id: jobs[1].id,
        attempt: 2,
      }),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("discoveryProviderWindow").take(10)),
    ).toHaveLength(1);
  });

  it("denies cross-tenant discovery account reads, exports, cancellation, starts and status writes", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "private_discovery_data",
    });
    const rows = accounts(campaign.id);
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
    });
    const saved = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    const outsider = t.withIdentity(identity("org_other"));
    for (const endpoint of [
      api.campaigns.accounts,
      api.campaigns.exportAccounts,
    ])
      await expect(
        outsider.query(endpoint, { id: campaign.id }),
      ).rejects.toThrow("NOT_FOUND");
    await expect(
      outsider.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "attempt_cross_tenant",
      }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      outsider.mutation(api.jobs.cancel, { id: job.id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      outsider.query(api.accounts.get, { id: saved[0].id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      outsider.query(api.accounts.draft, { id: saved[0].id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      outsider.mutation(api.accounts.setStatus, {
        id: saved[0].id,
        status: "shortlisted",
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(
      (await admin.query(api.accounts.get, { id: saved[0].id })).status,
    ).toBe("new");
  });
});

describe("discovery finalization guardrails", () => {
  it("keeps provider data out of durable scheduled-function arguments", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "scheduler_data_minimization",
    });
    const rows = accounts(campaign.id);
    rows[0].contacts = [licensedContact()];
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(100),
    );
    expect(scheduled.length).toBeGreaterThan(0);
    for (const task of scheduled) {
      const args = JSON.stringify(task.args);
      expect(args).not.toContain("person@acme.com");
      expect(args).not.toContain("offline-pdl-license");
      expect(args).not.toContain("accounts");
    }
    await t.mutation(internal.jobs.finish, { id: job.id, attempt: 1 });
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toHaveLength(2);
  });

  it("releases capacity and settles known spend when every final account expires", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "all_expired_final_results",
    });
    const rows = accounts(campaign.id).map((row) => ({
      ...row,
      license_expires_at: new Date(Date.now() + 1000).toISOString(),
    }));
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: ["Partial provider result"],
      cost: 27000,
      uncertain: true,
      verificationEnabled: false,
    });
    vi.setSystemTime(Date.now() + 1001);
    await t.mutation(internal.jobs.finish, { id: job.id, attempt: 1 });
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "failed",
      spend_status: "uncertain",
      spent_microusd: 100000,
    });
    expect(
      await admin.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("workspaces").first())?.activeJobs,
      ),
    ).toBe(0);
    await t.mutation(internal.jobs.recover, { id: job.id, expectedAttempt: 1 });
    expect((await admin.query(api.jobs.get, { id: job.id })).status).toBe(
      "failed",
    );
  });

  it("prunes provider revocation between settlement and final saving", async () => {
    const { t, admin, campaign } = await setup();
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "revoked_during_finalization",
    });
    const rows = accounts(campaign.id);
    rows[0].contacts = [licensedContact()];
    await t.mutation(internal.discovery.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: job.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    vi.stubEnv("SIGNALFOUNDRY_PDL_DATA_ACCESS_APPROVED", "false");
    await t.mutation(internal.jobs.finish, { id: job.id, attempt: 1 });
    const saved = await t.run((ctx) => ctx.db.query("accounts").take(10));
    expect(saved).toHaveLength(2);
    expect(saved.every((row) => row.data.contacts.length === 0)).toBe(true);
    expect(await admin.query(api.jobs.get, { id: job.id })).toMatchObject({
      status: "partial",
      spend_status: "settled",
    });
  });

  it("bounds a partial rerun without dropping previous review decisions or looping", async () => {
    const { t, admin, campaign } = await setup();
    const first = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "partial_rerun_first",
    });
    const rows = accounts(campaign.id);
    await t.mutation(internal.discovery.claim, { id: first.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: first.id,
      attempt: 1,
      accounts: rows,
      errors: [],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.jobs.finish, { id: first.id, attempt: 1 });
    const original = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    const reviewed = original.find((row) => row.domain === "acme.com")!;
    await admin.mutation(api.accounts.setStatus, {
      id: reviewed.id,
      status: "shortlisted",
    });
    const second = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "partial_rerun_second",
    });
    const changed = accounts(campaign.id);
    changed[1] = { ...changed[1], domain: "newmatch.com", name: "New match" };
    await t.mutation(internal.discovery.claim, { id: second.id, attempt: 1 });
    await t.mutation(internal.discovery.advance, {
      id: second.id,
      attempt: 1,
      accounts: changed,
      errors: ["Verification unavailable"],
      cost: 100000,
      uncertain: false,
      verificationEnabled: false,
    });
    await t.mutation(internal.jobs.finish, { id: second.id, attempt: 1 });
    const saved = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    expect(saved.map((row) => row.domain).sort()).toEqual([
      "acme.com",
      "second.com",
    ]);
    expect(saved.find((row) => row.domain === "acme.com")?.status).toBe(
      "shortlisted",
    );
    expect(await admin.query(api.jobs.get, { id: second.id })).toMatchObject({
      status: "partial",
      spend_status: "settled",
      spent_microusd: 100000,
    });
    expect(
      (await admin.query(api.campaigns.get, { id: campaign.id })).errors.some(
        (message) => message.includes("company limit"),
      ),
    ).toBe(true);
  });
});
