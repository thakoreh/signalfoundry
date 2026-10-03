/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import {
  DEMO_PROFILE,
  configureTestWorker,
  grantTestSubscription,
  manualAccounts,
} from "./helpers";

const modules = import.meta.glob("../convex/**/*.ts");
const identity = (org = "org_one") => ({
  subject: "user_admin",
  issuer: "https://clerk.test",
  org_id: org,
  org_role: "org:admin",
});
async function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity(identity());
  const stranger = t.withIdentity(identity("org_two"));
  for (const user of [admin, stranger]) {
    await user.mutation(api.workspaces.provision, {});
    await user.mutation(api.workspaces.saveProfile, { profile: DEMO_PROFILE });
  }
  configureTestWorker();
  vi.stubEnv("SIGNALFOUNDRY_MONTHLY_RESEARCH_LIMIT", "100");
  await grantTestSubscription(t);
  await grantTestSubscription(t, "org_two");
  let sequence = 0;
  async function research(
    user = admin,
    campaignId?: Id<"campaigns">,
    domains = ["acme.com"],
  ) {
    const id =
      campaignId ??
      (
        await user.mutation(api.campaigns.create, {
          name: "Review campaign",
          mode: "manual",
          domains,
        })
      ).id;
    const job = await user.mutation(api.jobs.start, {
      campaignId: id,
      idempotencyKey: `feedback_test_${++sequence}`,
    });
    await t.mutation(internal.jobs.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: manualAccounts(
        DEMO_PROFILE,
        id,
        new Date().toISOString(),
        domains,
      ),
      errors: [],
    });
    return {
      campaignId: id,
      accounts: await user.query(api.campaigns.accounts, { id }),
      jobId: job.id,
    };
  }
  return { t, admin, stranger, research };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("persistent, scoped review feedback", () => {
  it("persists latest reason and timestamp across reruns and replacement account IDs", async () => {
    const { t, admin, research } = await setup();
    const {
      campaignId,
      accounts: [account],
    } = await research();
    const reviewed = await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      reason: "wrong_size",
    });
    expect(reviewed).toMatchObject({
      status: "dismissed",
      review_reason: "wrong_size",
      reviewed_at: new Date().toISOString(),
      suppress_workspace: false,
    });
    expect((await research(admin, campaignId)).accounts[0]).toMatchObject({
      id: account.id,
      status: "dismissed",
      review_reason: "wrong_size",
      reviewed_at: reviewed.reviewed_at,
    });
    vi.advanceTimersByTime(1);
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      reason: "competitor",
    });
    const metadata = await t.run((ctx) =>
      ctx.db.query("accountFeedback").take(2),
    );
    expect(metadata).toHaveLength(1);
    expect(metadata[0]).toMatchObject({
      orgId: "org_one",
      campaignId,
      accountId: account.id,
      domain: "acme.com",
      reason: "competitor",
    });
    expect(metadata[0]).not.toHaveProperty("contacts");
    // A deleted passed row stays excluded, rather than being automatically refreshed.
    await t.run((ctx) => ctx.db.delete(account.id));
    expect((await research(admin, campaignId)).accounts).toEqual([]);
    expect(
      (await t.run((ctx) => ctx.db.query("accountFeedback").take(1)))[0],
    ).toMatchObject({ status: "dismissed", reason: "competitor" });
    const fresh = await research();
    const recreated = fresh.accounts[0];
    const cleared = await admin.mutation(api.accounts.setStatus, {
      id: recreated.id,
      status: "dismissed",
      reason: null,
    });
    expect(cleared.review_reason).toBeNull();
    expect(
      (await admin.query(api.accounts.get, { id: recreated.id })).review_reason,
    ).toBeNull();
  });

  it("does not infer workspace or category exclusions from one campaign pass", async () => {
    const { admin, research } = await setup();
    const {
      accounts: [account],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      reason: "wrong_industry",
    });
    const next = (await research()).accounts[0];
    expect(next).toMatchObject({
      domain: "acme.com",
      status: "new",
      suppress_workspace: false,
      review_reason: null,
    });
    expect((await admin.query(api.workspaces.get, {}))!.profile).toEqual(
      DEMO_PROFILE,
    );
  });

  it("requires explicit workspace scope, isolates tenants, and only explicit restore clears suppression", async () => {
    const { admin, stranger, research } = await setup();
    const {
      campaignId,
      accounts: [account],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      reason: "existing_customer",
      suppress_workspace: true,
    });
    const next = await research();
    expect(next.accounts).toHaveLength(0);
    expect((await research(admin, campaignId)).accounts[0]).toMatchObject({
      id: account.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    expect((await research(stranger)).accounts).toHaveLength(1);
    await expect(
      stranger.mutation(api.accounts.setStatus, {
        id: account.id,
        status: "dismissed",
        suppress_workspace: true,
      }),
    ).rejects.toThrow("NOT_FOUND");
    await stranger.mutation(api.accounts.restoreSuppression, {
      domain: "acme.com",
    });
    expect(
      (await admin.query(api.accounts.get, { id: account.id }))
        .suppress_workspace,
    ).toBe(true);
    const keptScope = await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "shortlisted",
    });
    expect(keptScope.suppress_workspace).toBe(true);
    const restored = await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "shortlisted",
      suppress_workspace: false,
    });
    expect(restored).toMatchObject({
      status: "shortlisted",
      review_reason: null,
      suppress_workspace: false,
    });
    expect((await research(admin, next.campaignId)).accounts).toHaveLength(1);
  });

  it("restores suppression after original row deletion and lists only the current tenant with bounded pages", async () => {
    const { t, admin, stranger, research } = await setup();
    const {
      accounts: [account],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      reason: "other",
      suppress_workspace: true,
    });
    await t.run((ctx) => ctx.db.delete(account.id));
    expect(
      (
        await admin.query(api.accounts.suppressions, {
          paginationOpts: { cursor: null, numItems: 1 },
        })
      ).page,
    ).toMatchObject([
      { domain: "acme.com", account_id: account.id, reason: "other" },
    ]);
    expect(
      (
        await stranger.query(api.accounts.suppressions, {
          paginationOpts: { cursor: null, numItems: 1 },
        })
      ).page,
    ).toEqual([]);
    for (const numItems of [0, 101])
      await expect(
        admin.query(api.accounts.suppressions, {
          paginationOpts: { cursor: null, numItems },
        }),
      ).rejects.toThrow();
    await admin.mutation(api.accounts.restoreSuppression, {
      domain: "www.ACME.com.",
    });
    expect(
      (
        await admin.query(api.accounts.suppressions, {
          paginationOpts: { cursor: null, numItems: 1 },
        })
      ).page,
    ).toEqual([]);
    expect((await research()).accounts).toHaveLength(1);
  });

  it("never accepts worker-supplied review metadata as a user decision", async () => {
    const { t, admin } = await setup();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Unreviewed",
      mode: "manual",
      domains: ["acme.com"],
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "untrusted_feedback",
    });
    await t.mutation(internal.jobs.claim, { id: job.id, attempt: 1 });
    const accounts = manualAccounts(
      DEMO_PROFILE,
      campaign.id,
      new Date().toISOString(),
    ).map((account) => ({
      ...account,
      status: "dismissed" as const,
      review_reason: "other" as const,
      reviewed_at: "2020-01-01T00:00:00Z",
      suppress_workspace: true,
    }));
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts,
      errors: [],
    });
    expect(
      (await admin.query(api.campaigns.accounts, { id: campaign.id }))[0],
    ).toMatchObject({
      status: "new",
      review_reason: null,
      reviewed_at: null,
      suppress_workspace: false,
    });
    expect(
      await t.run((ctx) => ctx.db.query("accountFeedback").take(1)),
    ).toEqual([]);
  });

  it("skips manual worker dispatch for a campaign Pass and preserves historical research", async () => {
    const { t, admin, research } = await setup();
    const {
      campaignId,
      accounts: [account],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      reason: "wrong_size",
    });
    const before = await admin.query(api.accounts.get, { id: account.id });
    const fetch = vi.mocked(globalThis.fetch);
    fetch.mockClear();
    const job = await admin.mutation(api.jobs.start, {
      campaignId,
      idempotencyKey: "skip_passed_manual",
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(await admin.query(api.accounts.get, { id: account.id })).toEqual(
      before,
    );
    expect((await admin.query(api.jobs.get, { id: job.id })).status).toBe(
      "succeeded",
    );
    expect(
      await admin.query(api.accounts.draft, { id: account.id }),
    ).toHaveProperty("body");
  });

  it("filters future manual dispatch by tenant and passes bounded trusted exclusions", async () => {
    const { t, admin, stranger, research } = await setup();
    const {
      accounts: [account],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    const fetch = vi.mocked(globalThis.fetch);
    fetch.mockClear();
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "Filtered",
      mode: "manual",
      domains: ["www.acme.com", "other.com"],
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "filtered_manual_dispatch",
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(request.domains).toEqual(["https://other.com"]);
    expect(request.excluded_domains).toEqual(["acme.com"]);
    expect(
      (await admin.query(api.campaigns.accounts, { id: campaign.id })).map(
        (a) => a.domain,
      ),
    ).toEqual(["other.com"]);
    const other = await stranger.mutation(api.campaigns.create, {
      name: "Other tenant",
      mode: "manual",
      domains: ["acme.com"],
    });
    const otherJob = await stranger.mutation(api.jobs.start, {
      campaignId: other.id,
      idempotencyKey: "unaffected_manual_dispatch",
    });
    await t.action(internal.research.execute, { id: otherJob.id, attempt: 1 });
    expect(
      await stranger.query(api.campaigns.accounts, { id: other.id }),
    ).toHaveLength(1);
    const otherRequest = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(otherRequest.excluded_domains).toEqual([]);
  });

  it("blocks late manual refresh when suppression changes after dispatch", async () => {
    const { t, admin, research } = await setup();
    const {
      campaignId,
      accounts: [account],
    } = await research();
    const job = await admin.mutation(api.jobs.start, {
      campaignId,
      idempotencyKey: "manual_suppression_race",
    });
    await t.mutation(internal.jobs.claim, { id: job.id, attempt: 1 });
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    const late = manualAccounts(
      DEMO_PROFILE,
      campaignId,
      "2099-01-01T00:00:00Z",
    );
    late[0].description =
      "Late refreshed description must not overwrite history";
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: late,
      errors: [],
    });
    const saved = await admin.query(api.accounts.get, { id: account.id });
    expect(saved.researched_at).toBe(account.researched_at);
    expect(saved.description).toBe(account.description);
    expect(saved.status).toBe("dismissed");
  });

  it("fails closed before manual dispatch when exclusions exceed the bounded snapshot", async () => {
    const { t, admin, research } = await setup();
    const {
      campaignId,
      accounts: [account],
    } = await research();
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++)
        await ctx.db.insert("workspaceSuppressions", {
          orgId: "org_one",
          domain: `blocked${i}.com`,
          campaignId,
          accountId: account.id,
          reason: null,
          updatedAt: new Date().toISOString(),
        });
    });
    const fetch = vi.mocked(globalThis.fetch);
    fetch.mockClear();
    const job = await admin.mutation(api.jobs.start, {
      campaignId,
      idempotencyKey: "overflow_manual_dispatch",
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect((await admin.query(api.jobs.get, { id: job.id })).status).toBe(
      "failed",
    );
  });

  it("blocks draft generation by live workspace suppression rather than a stale account flag", async () => {
    const { t, admin, research } = await setup();
    const {
      accounts: [account],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    await t.run(async (ctx) => {
      const row = (await ctx.db.get(account.id))!;
      await ctx.db.patch(row._id, {
        data: { ...row.data, suppress_workspace: false },
      });
    });
    await expect(
      admin.query(api.accounts.draft, { id: account.id }),
    ).rejects.toThrow("workspace-suppressed");
    await admin.mutation(api.accounts.restoreSuppression, {
      domain: account.domain,
    });
    expect(
      await admin.query(api.accounts.draft, { id: account.id }),
    ).toHaveProperty("body");
  });

  it("drafts from a campaign snapshot before any workspace profile was saved", async () => {
    const { t, admin } = await setup();
    await t.run(async (ctx) => {
      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("by_orgId", (q) => q.eq("orgId", "org_one"))
        .unique();
      await ctx.db.patch(workspace!._id, { profile: null });
    });
    const campaign = await admin.mutation(api.campaigns.create, {
      name: "First offering",
      mode: "manual",
      domains: ["acme.com"],
      profile_snapshot: DEMO_PROFILE,
    });
    const job = await admin.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "offering_first_draft",
    });
    await t.mutation(internal.jobs.claim, { id: job.id, attempt: 1 });
    await t.mutation(internal.jobs.finish, {
      id: job.id,
      attempt: 1,
      accounts: manualAccounts(
        DEMO_PROFILE,
        campaign.id,
        new Date().toISOString(),
      ),
      errors: [],
    });
    const [account] = await admin.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    const draft = await admin.query(api.accounts.draft, { id: account.id });
    expect(draft).toHaveProperty("body");
    expect(draft.body).toContain(DEMO_PROFILE.company_name);
  });

  it("status-only changes and Undo cannot clear another campaign's workspace exclusion", async () => {
    const { admin, stranger, research } = await setup();
    const {
      accounts: [first],
    } = await research();
    const {
      accounts: [second],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: first.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    for (const status of ["new", "shortlisted", "dismissed", "new"] as const) {
      const changed = await admin.mutation(api.accounts.setStatus, {
        id: second.id,
        status,
      });
      expect(changed).toMatchObject({ status, suppress_workspace: true });
      expect(
        (await admin.query(api.accounts.get, { id: first.id }))
          .suppress_workspace,
      ).toBe(true);
    }
    const {
      accounts: [foreign],
    } = await research(stranger);
    const otherTenant = await stranger.mutation(api.accounts.setStatus, {
      id: foreign.id,
      status: "shortlisted",
      suppress_workspace: false,
    });
    expect(otherTenant.suppress_workspace).toBe(false);
    expect(
      (await admin.query(api.accounts.get, { id: first.id }))
        .suppress_workspace,
    ).toBe(true);
    const restored = await admin.mutation(api.accounts.setStatus, {
      id: second.id,
      status: "shortlisted",
      suppress_workspace: false,
    });
    expect(restored.suppress_workspace).toBe(false);
    expect(
      (await admin.query(api.accounts.get, { id: first.id }))
        .suppress_workspace,
    ).toBe(false);
    const absent = await admin.mutation(api.accounts.setStatus, {
      id: second.id,
      status: "new",
    });
    expect(absent.suppress_workspace).toBe(false);
  });

  it("Undo preserves pre-existing workspace suppression without granting permission to create it", async () => {
    const { admin, research } = await setup();
    const {
      accounts: [first],
    } = await research();
    const {
      accounts: [second],
    } = await research();
    await admin.mutation(api.accounts.setStatus, {
      id: first.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    await admin.mutation(api.accounts.setStatus, {
      id: second.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    const restored = await admin.mutation(api.accounts.setStatus, {
      id: second.id,
      status: "new",
      reason: null,
      preserve_workspace_suppression: true,
    });
    expect(restored).toMatchObject({
      status: "new",
      suppress_workspace: true,
      review_reason: null,
    });
    for (const extra of [
      { suppress_workspace: true },
      { suppress_workspace: false },
      { reason: "other" as const },
      { status: "dismissed" as const },
    ])
      await expect(
        admin.mutation(api.accounts.setStatus, {
          id: second.id,
          status: "new",
          preserve_workspace_suppression: true,
          ...extra,
        }),
      ).rejects.toThrow("VALIDATION_ERROR");
    await admin.mutation(api.accounts.restoreSuppression, {
      domain: second.domain,
    });
    const absent = await admin.mutation(api.accounts.setStatus, {
      id: second.id,
      status: "shortlisted",
      preserve_workspace_suppression: true,
    });
    expect(absent.suppress_workspace).toBe(false);
  });

  it("does not refresh legacy passed domains through a www alias at final persistence", async () => {
    const { t, admin, research } = await setup();
    const {
      campaignId,
      accounts: [account],
    } = await research();
    await t.run(async (ctx) => {
      const row = (await ctx.db.get(account.id))!;
      await ctx.db.patch(row._id, {
        data: { ...row.data, status: "dismissed" },
      });
    });
    const rerun = await research(admin, campaignId, ["www.acme.com"]);
    expect(rerun.accounts).toHaveLength(1);
    expect(rerun.accounts[0]).toMatchObject({
      id: account.id,
      domain: "acme.com",
      status: "dismissed",
      researched_at: account.researched_at,
    });
  });

  it("rejects malformed reasons and ambiguous statuses without writes", async () => {
    const { t, admin, research } = await setup();
    const {
      accounts: [account],
    } = await research();
    for (const reason of ["made_up", "", 42])
      await expect(
        admin.mutation(api.accounts.setStatus, {
          id: account.id,
          status: "dismissed",
          reason,
        } as never),
      ).rejects.toThrow();
    for (const status of ["new", "shortlisted"] as const) {
      await expect(
        admin.mutation(api.accounts.setStatus, {
          id: account.id,
          status,
          reason: "other",
        }),
      ).rejects.toThrow("VALIDATION_ERROR");
      await expect(
        admin.mutation(api.accounts.setStatus, {
          id: account.id,
          status,
          suppress_workspace: true,
        }),
      ).rejects.toThrow("VALIDATION_ERROR");
    }
    expect(
      await t.run((ctx) => ctx.db.query("accountFeedback").take(1)),
    ).toEqual([]);
  });

  it("never extends licensed retention, stores only feedback metadata, and rejects expired row review", async () => {
    const { t, admin, research } = await setup();
    const {
      accounts: [account],
    } = await research();
    vi.stubEnv("SIGNALFOUNDRY_LICENSED_DATA_ACCESS_APPROVED", "true");
    vi.stubEnv("SIGNALFOUNDRY_EXA_DATA_ACCESS_APPROVED", "true");
    const expiry = new Date(Date.now() + 60_000).toISOString();
    await t.run(async (ctx) => {
      const row = (await ctx.db.get(account.id))!;
      await ctx.db.patch(row._id, {
        data: {
          ...row.data,
          source_provider: "exa",
          license_reference: "test-license",
          license_expires_at: expiry,
        },
      });
    });
    const result = await admin.mutation(api.accounts.setStatus, {
      id: account.id,
      status: "dismissed",
      suppress_workspace: true,
    });
    expect(result.license_expires_at).toBe(expiry);
    vi.advanceTimersByTime(60_001);
    await expect(
      admin.mutation(api.accounts.setStatus, { id: account.id, status: "new" }),
    ).rejects.toThrow("DATA_EXPIRED");
    const metadata = (
      await t.run((ctx) => ctx.db.query("accountFeedback").take(1))
    )[0];
    expect(metadata).not.toHaveProperty("license_expires_at");
    expect(metadata).not.toHaveProperty("data");
    await admin.mutation(api.accounts.restoreSuppression, {
      domain: "acme.com",
    });
    await expect(
      admin.query(api.accounts.get, { id: account.id }),
    ).rejects.toThrow("DATA_EXPIRED");
  });
});
