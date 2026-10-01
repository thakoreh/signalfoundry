/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { DEMO_PROFILE, manualAccounts, configureTestWorker, grantTestSubscription } from "./helpers";
import { principalFromIdentity } from "../convex/lib/auth";
import type { UserIdentity } from "convex/server";

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
  await admin.mutation(api.workspaces.saveProfile, { profile: DEMO_PROFILE });
  const member = t.withIdentity(
    identity("org_one", "user_member", "org:member"),
  );
  configureTestWorker(); await grantTestSubscription(t);
  const stranger = t.withIdentity(identity("org_two"));
  return { t, admin, member, stranger };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verified Clerk tenant boundary (mock identity, not live JWT proof)", () => {
  it("rejects no auth, absent organization, unknown role, pending sessions and conflicting claims", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.workspaces.get, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    for (const fields of [
      { subject: "u" },
      { ...identity(), org_role: "org:owner" },
      { ...identity(), sts: "pending" },
      { ...identity(), o: { id: "org_other", rol: "admin" } },
      { ...identity(), o: { id: "org_one", rol: "member" } },
    ]) {
      await expect(
        t.withIdentity(fields).query(api.workspaces.get, {}),
      ).rejects.toThrow();
    }
  });
  it("accepts compact v2 and legacy verified org claims, denies client-controlled metadata", () => {
    const verified = {
      subject: "u",
      issuer: "https://clerk.test",
      tokenIdentifier: "issuer|u",
      o: { id: "org_test", rol: "member" },
    } as UserIdentity;
    expect(principalFromIdentity(verified)).toEqual({
      userId: "u",
      orgId: "org_test",
      role: "org:member",
    });
    expect(() =>
      principalFromIdentity({
        ...verified,
        o: undefined,
        unsafe_metadata: { org_id: "org_test", org_role: "org:admin" },
      } as unknown as UserIdentity),
    ).toThrow("ORGANIZATION_REQUIRED");
  });
  it("provisions idempotently for admin only; members cannot alter profile or initialize orgs", async () => {
    const { t, admin, member } = await setup();
    const first = await admin.query(api.workspaces.get, {});
    expect(await admin.mutation(api.workspaces.provision, {})).toEqual(first);
    expect(
      await t.run((ctx) => ctx.db.query("workspaces").take(2)),
    ).toHaveLength(1);
    await expect(member.mutation(api.workspaces.provision, {})).rejects.toThrow(
      "ADMIN_REQUIRED",
    );
    await expect(member.mutation(api.workspaces.cleanupDemo, {})).rejects.toThrow(
      "ADMIN_REQUIRED",
    );
    await expect(
      member.mutation(api.workspaces.saveProfile, { profile: DEMO_PROFILE }),
    ).rejects.toThrow("ADMIN_REQUIRED");
    expect(await member.query(api.workspaces.get, {})).toEqual(first);
  });
  it("denies cross-org campaign, account, job reads and mutations without leaking record existence", async () => {
    vi.useFakeTimers();
    const { t, member, stranger } = await setup();
    const campaign = await member.mutation(api.campaigns.create, {
      name: "Demo",
      mode: "manual",
      domains: ["acme.com"],
    });
    const job = await member.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "tenant_isolation",
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    const [account] = await member.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    expect(await stranger.query(api.campaigns.list, {})).toEqual([]);
    expect(await stranger.query(api.workspaces.get, {})).toBeNull();
    await expect(
      stranger.query(api.campaigns.get, { id: campaign.id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      stranger.query(api.campaigns.accounts, { id: campaign.id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      stranger.query(api.accounts.get, { id: account.id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      stranger.mutation(api.accounts.setStatus, {
        id: account.id,
        status: "dismissed",
      }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      stranger.query(api.accounts.draft, { id: account.id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(stranger.query(api.jobs.get, { id: job.id })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(
      stranger.mutation(api.jobs.cancel, { id: job.id }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      stranger.mutation(api.jobs.start, {
        campaignId: campaign.id,
        idempotencyKey: "cross_tenant",
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("bounds arguments and exposes real-only research and grounded drafts", async () => {
    vi.useFakeTimers();
    const { t, admin, member } = await setup();
    await expect(
      admin.mutation(api.workspaces.saveProfile, {
        profile: { ...DEMO_PROFILE, keywords: Array(21).fill("x") },
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
    for (const limit of [0, -1, 101, 2.5])
      await expect(member.query(api.campaigns.list, { limit })).rejects.toThrow(
        "VALIDATION_ERROR",
      );
    for (const domain of [
      "http://localhost",
      "http://127.0.0.1",
      "https://someone:secret@example.com",
      "https://company.local",
      "file:///etc/passwd",
    ]) {
      await expect(
        member.mutation(api.campaigns.create, {
          name: "Bad",
          mode: "manual",
          domains: [domain],
        }),
      ).rejects.toThrow("VALIDATION_ERROR");
    }
    const campaign = await member.mutation(api.campaigns.create, {
      name: "Fiction only",
      mode: "manual",
      domains: ["acme.com"],
    });
    const job = await member.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "fiction_job",
    });
    await t.action(internal.research.execute, { id: job.id, attempt: 1 });
    const accounts = await member.query(api.campaigns.accounts, {
      id: campaign.id,
    });
    expect(accounts).toHaveLength(1);
    expect(accounts.every((a) => !a.is_demo && a.domain === "acme.com" && a.evidence.every((e) => !e.is_demo) && a.contacts.every((c) => c.email === null))).toBe(true);

    const draft = await member.query(api.accounts.draft, {
      id: accounts[0].id,
    });
    expect(draft.warning).not.toContain("FICTIONAL DEMO");
    expect(draft.warning).toContain("nothing is sent");
    await member.mutation(api.accounts.setStatus, {
      id: accounts[0].id,
      status: "shortlisted",
    });
    expect(
      (await member.query(api.accounts.get, { id: accounts[0].id })).status,
    ).toBe("shortlisted");
  });
  it("rejects forged fixture metadata before saving anything", async () => {
    vi.useFakeTimers();
    const { t, member } = await setup();
    const campaign = await member.mutation(api.campaigns.create, {
      name: "Demo",
      mode: "manual",
      domains: ["acme.com"],
    });
    const job = await member.mutation(api.jobs.start, {
      campaignId: campaign.id,
      idempotencyKey: "bad_fixture",
    });
    await t.mutation(internal.jobs.claim, { id: job.id, attempt: 1 });
    const accounts = manualAccounts(
      DEMO_PROFILE,
      campaign.id,
      new Date().toISOString(),
    );
    accounts[0].is_demo = true;
    await expect(
      t.mutation(internal.jobs.finish, {
        id: job.id,
        attempt: 1,
        accounts,
        errors: [],
      }),
    ).rejects.toThrow("RESEARCH_FAILED");
    expect(
      await member.query(api.campaigns.accounts, { id: campaign.id }),
    ).toEqual([]);
  });
});
