/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const identity = (org_id = "org_one", org_role = "org:admin") => ({
  subject: "user_admin",
  issuer: "https://clerk.test",
  org_id,
  org_role,
});
const profile = (company_name: string) => ({
  company_name,
  description: "Research software",
  industries: ["software"],
  company_sizes: ["11-50"],
  geographies: ["North America"],
  buyer_roles: ["founder"],
  keywords: ["research"],
  exclusions: [],
});
const data = (is_demo: boolean) => ({
  name: is_demo ? "Fictional Co" : "Real Co",
  domain: is_demo ? "fictional.example" : "real-company.com",
  description: "Public company description",
  industry: "software",
  employee_range: "Unknown",
  location: "Unknown",
  score: 50,
  confidence: "low" as const,
  decision_engine: "rules" as const,
  status: "new" as const,
  why_fit: [],
  why_now: [],
  unknowns: [],
  evidence: [],
  contacts: [],
  is_demo,
  researched_at: new Date(0).toISOString(),
  score_breakdown: [],
});

async function seeded() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity(identity());
  const ids = await t.run(async (ctx) => {
    const now = new Date(0).toISOString();
    const workspace = await ctx.db.insert("workspaces", {
      orgId: "org_one",
      name: "SignalFoundry Demo",
      website: null,
      profile: profile("SignalFoundry Demo"),
      createdAt: 0,
      updatedAt: 0,
      profileVersion: 1,
      activeJobs: 0,
      researchWindowStart: 0,
      researchWindowCount: 0,
      analysisWindowStart: 0,
      analysisWindowCount: 0,
      analysisLeaseUntil: 0,
    });
    const billing = await ctx.db.insert("billingAccounts", {
      orgId: "org_one",
      status: "active",
      cancelAtPeriodEnd: false,
      updatedAt: 0,
    });
    const demoCampaign = await ctx.db.insert("campaigns", {
      orgId: "org_one",
      createdBy: "user_admin",
      name: "Fictional campaign",
      mode: "demo",
      domains: [],
      status: "complete",
      created_at: now,
      updated_at: now,
      account_count: 1,
      qualified_count: 0,
      errors: [],
    });
    const realCampaign = await ctx.db.insert("campaigns", {
      orgId: "org_one",
      createdBy: "user_admin",
      name: "Real campaign",
      mode: "manual",
      domains: ["real-company.com"],
      status: "complete",
      created_at: now,
      updated_at: now,
      account_count: 1,
      qualified_count: 1,
      errors: [],
    });
    const demoJob = await ctx.db.insert("jobs", {
      orgId: "org_one",
      campaignId: demoCampaign,
      createdBy: "user_admin",
      idempotencyKey: "demo_job_key",
      status: "succeeded",
      attempt: 1,
      maxAttempts: 5,
      error: null,
      mode: "demo",
      domains: [],
      profile: profile("SignalFoundry Demo"),
      createdAt: 0,
      updatedAt: 0,
      leaseUntil: 0,
      countedActive: false,
    });
    const realJob = await ctx.db.insert("jobs", {
      orgId: "org_one",
      campaignId: realCampaign,
      createdBy: "user_admin",
      idempotencyKey: "real_job_key",
      status: "succeeded",
      attempt: 1,
      maxAttempts: 5,
      error: null,
      mode: "manual",
      domains: ["real-company.com"],
      profile: profile("SignalFoundry Demo"),
      createdAt: 0,
      updatedAt: 0,
      leaseUntil: 0,
      countedActive: false,
    });
    const demoAccount = await ctx.db.insert("accounts", {
      orgId: "org_one",
      campaignId: demoCampaign,
      jobId: demoJob,
      score: 50,
      data: data(true),
    });
    const realAccount = await ctx.db.insert("accounts", {
      orgId: "org_one",
      campaignId: realCampaign,
      jobId: realJob,
      score: 80,
      data: data(false),
    });
    return { workspace, billing, demoCampaign, realCampaign, demoJob, realJob, demoAccount, realAccount };
  });
  return { t, admin, ids };
}

afterEach(()=>vi.useRealTimers());
describe("SaaS no-demo boundary", () => {
  it("fails closed when an old scheduled demo job reaches dispatch", async()=>{
    vi.useFakeTimers();const {t,admin,ids}=await seeded();
    await t.run(async(ctx)=>{await ctx.db.delete(ids.demoAccount);await ctx.db.patch(ids.demoJob,{status:"queued",attempt:0});await ctx.db.patch(ids.demoCampaign,{activeJobId:ids.demoJob});});
    await t.action(internal.research.execute,{id:ids.demoJob,attempt:1});
    expect((await admin.query(api.jobs.get,{id:ids.demoJob})).status).toBe("failed");
    expect(await admin.query(api.campaigns.accounts,{id:ids.demoCampaign})).toEqual([]);
  });
  it("admin cleanup removes only fictional rows and the exact demo profile", async () => {
    const { t, admin, ids } = await seeded();
    await expect(admin.mutation(api.workspaces.cleanupDemo, {})).resolves.toMatchObject({
      accounts: 1,
      campaigns: 1,
      jobs: 1,
      profileCleared: true,
    });
    const remaining = await t.run(async (ctx) => ({
      workspace: await ctx.db.get(ids.workspace),
      billing: await ctx.db.get(ids.billing),
      campaigns: await ctx.db.query("campaigns").collect(),
      jobs: await ctx.db.query("jobs").collect(),
      accounts: await ctx.db.query("accounts").collect(),
    }));
    expect(remaining.workspace?.profile).toBeNull();
    expect(remaining.billing?.status).toBe("active");
    expect(remaining.campaigns.map((row) => row._id)).toEqual([ids.realCampaign]);
    expect(remaining.jobs.map((row) => row._id)).toEqual([ids.realJob]);
    expect(remaining.accounts.map((row) => row._id)).toEqual([ids.realAccount]);
  });

  it("releases only the capacity reserved by deleted fictional jobs", async () => {
    const {t,admin,ids}=await seeded();
    const global=await t.run(async(ctx)=>{await ctx.db.patch(ids.demoJob,{countedActive:true});await ctx.db.patch(ids.workspace,{activeJobs:1});return ctx.db.insert('systemLimits',{key:'research',activeJobs:3});});
    await admin.mutation(api.workspaces.cleanupDemo,{});
    const result=await t.run(async(ctx)=>({workspace:await ctx.db.get(ids.workspace),global:await ctx.db.get(global)}));
    expect(result.workspace?.activeJobs).toBe(0);expect(result.global?.activeJobs).toBe(2);
  });
  it("does not clear a real profile when fictional rows are absent", async () => {
    const { admin } = await seeded();
    await admin.mutation(api.workspaces.saveProfile, { profile: profile("Real Company") });
    await expect(admin.mutation(api.workspaces.cleanupDemo, {})).resolves.toMatchObject({
      accounts: 1,
      campaigns: 1,
      jobs: 1,
      profileCleared: false,
    });
    expect((await admin.query(api.workspaces.get, {}))?.profile?.company_name).toBe(
      "Real Company",
    );
  });
});
