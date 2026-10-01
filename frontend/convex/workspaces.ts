import { appError } from "./lib/errors";
import { v, ConvexError, type Infer } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { adminAction, adminMutation, tenantQuery } from "./lib/auth";
import { getWorkspace, requireWorkspace, workspaceResult } from "./lib/records";
import { normalizeWebsite, validateProfile } from "./lib/validation";
import { DEMO_PROFILE } from "./lib/fixtures";
import { callWorker, WorkerFailure, workerConfiguration } from "./lib/worker";
import * as validators from "./validators";

export const get = tenantQuery({
  args: {},
  returns: v.union(validators.workspace, v.null()),
  handler: async (ctx) => {
    const row = await getWorkspace(ctx, ctx.principal.orgId);
    return row ? workspaceResult(row) : null;
  },
});
export const provision = adminMutation({
  args: {},
  returns: validators.workspace,
  handler: async (ctx) => {
    const existing = await getWorkspace(ctx, ctx.principal.orgId);
    if (existing) return workspaceResult(existing);
    const now = Date.now();
    const id = await ctx.db.insert("workspaces", {
      orgId: ctx.principal.orgId,
      name: "Your workspace",
      website: null,
      profile: null,
      createdAt: now,
      updatedAt: now,
      profileVersion: 0,
      activeJobs: 0,
      researchWindowStart: now,
      researchWindowCount: 0,
      analysisWindowStart: now,
      analysisWindowCount: 0,
      analysisLeaseUntil: 0,
    });
    return workspaceResult((await ctx.db.get(id))!);
  },
});
export const saveProfile = adminMutation({
  args: { profile: validators.profile, website: v.optional(v.string()) },
  returns: validators.workspace,
  handler: async (ctx, args) => {
    const row = await requireWorkspace(ctx, ctx.principal.orgId);
    const profile = validateProfile(args.profile);
    const patch = {
      profile,
      name: profile.company_name,
      website:
        args.website === undefined
          ? row.website
          : normalizeWebsite(args.website),
      updatedAt: Date.now(),
      profileVersion: row.profileVersion + 1,
    };
    await ctx.db.patch(row._id, patch);
    return workspaceResult({ ...row, ...patch });
  },
});
export const loadDemo = adminMutation({
  args: {},
  returns: validators.workspace,
  handler: async (ctx) => {
    const row = await requireWorkspace(ctx, ctx.principal.orgId);
    const patch = {
      profile: DEMO_PROFILE,
      name: DEMO_PROFILE.company_name,
      website: null,
      updatedAt: Date.now(),
      profileVersion: row.profileVersion + 1,
    };
    await ctx.db.patch(row._id, patch);
    return workspaceResult({ ...row, ...patch });
  },
});

// Server-only reservation prevents unbounded paid worker calls and lost profile edits.
export const beginAnalyze = internalMutation({
  args: { orgId: v.string() },
  returns: v.object({ version: v.number(), lease: v.number() }),
  handler: async (ctx, args) => {
    const row = await requireWorkspace(ctx, args.orgId);
    const now = Date.now();
    if (row.analysisLeaseUntil > now)
      throw appError("CONFLICT", "A website analysis is already running");
    const count =
      row.analysisWindowStart > now - 3_600_000 ? row.analysisWindowCount : 0;
    if (count >= 10)
      throw appError(
        "RATE_LIMITED",
        "Website analysis limit reached (10 per hour)",
      );
    const lease = now + 150_000;
    await ctx.db.patch(row._id, {
      analysisLeaseUntil: lease,
      analysisWindowCount: count + 1,
      analysisWindowStart: count ? row.analysisWindowStart : now,
    });
    return { version: row.profileVersion, lease };
  },
});
export const finishAnalyze = internalMutation({
  args: {
    orgId: v.string(),
    version: v.number(),
    lease: v.number(),
    profile: validators.profile,
    website: v.string(),
  },
  returns: validators.workspace,
  handler: async (ctx, args) => {
    const row = await requireWorkspace(ctx, args.orgId);
    if (
      row.profileVersion !== args.version ||
      row.analysisLeaseUntil !== args.lease ||
      Date.now() > args.lease
    )
      throw appError(
        "CONFLICT",
        "Profile changed while analyzing; your changes were preserved. Try again.",
      );
    const profile = validateProfile(args.profile);
    const patch = {
      profile,
      name: profile.company_name,
      website: normalizeWebsite(args.website),
      profileVersion: row.profileVersion + 1,
      updatedAt: Date.now(),
      analysisLeaseUntil: 0,
    };
    await ctx.db.patch(row._id, patch);
    return workspaceResult({ ...row, ...patch });
  },
});
export const releaseAnalyze = internalMutation({
  args: { orgId: v.string(), lease: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getWorkspace(ctx, args.orgId);
    if (row?.analysisLeaseUntil === args.lease)
      await ctx.db.patch(row._id, { analysisLeaseUntil: 0 });
    return null;
  },
});
export const analyze = adminAction({
  args: { website: v.string() },
  returns: validators.workspace,
  handler: async (ctx, args): Promise<Infer<typeof validators.workspace>> => {
    const website = normalizeWebsite(args.website);
    try {
      workerConfiguration();
    } catch {
      throw appError(
        "CONFIGURATION_ERROR",
        "Research worker is not configured",
      );
    }
    const reservation: { version: number; lease: number } =
      await ctx.runMutation(internal.workspaces.beginAnalyze, {
        orgId: ctx.principal.orgId,
      });
    try {
      const result = await callWorker("/worker/analyze", { website });
      if (
        !result ||
        typeof result !== "object" ||
        !("profile" in result) ||
        !("website" in result)
      )
        throw new WorkerFailure(
          "Website analysis returned an invalid response",
          false,
        );
      const data = result as {
        profile: Infer<typeof validators.profile>;
        website: string;
      };
      return await ctx.runMutation(internal.workspaces.finishAnalyze, {
        orgId: ctx.principal.orgId,
        ...reservation,
        profile: data.profile,
        website: data.website,
      });
    } catch (error) {
      await ctx.runMutation(internal.workspaces.releaseAnalyze, {
        orgId: ctx.principal.orgId,
        lease: reservation.lease,
      });
      if (error instanceof ConvexError) throw error;
      if (error instanceof WorkerFailure)
        throw appError("RESEARCH_FAILED", error.message);
      throw appError(
        "RESEARCH_FAILED",
        "Website analysis failed; your previous profile was preserved",
      );
    }
  },
});
