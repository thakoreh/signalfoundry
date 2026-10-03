import { appError } from "./lib/errors";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { callWorker } from "./lib/worker";
import { tenantMutation, tenantQuery, tenantAction } from "./lib/auth";
import {
  accountResult,
  campaignResult,
  iso,
  requireCampaign,
  requireWorkspace,
} from "./lib/records";
import {
  boundedLimit,
  normalizeDomains,
  normalizeWebsite,
  validateProfile,
  text,
} from "./lib/validation";
import { dataVisible, MAX_DISCOVERY_TARGETS } from "./lib/discoveryPolicy";
import * as validators from "./validators";
import { applyReviewFeedback } from "./lib/feedback";

export const list = tenantQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(validators.campaign),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("campaigns")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .order("desc")
      .take(boundedLimit(args.limit, 100));
    return rows.map(campaignResult);
  },
});
export const create = tenantMutation({
  args: {
    name: v.string(),
    mode: validators.mode,
    domains: v.array(v.string()),
    profile_snapshot: v.optional(validators.profile),
    offering_website: v.optional(v.union(v.string(), v.null())),
    target_count: v.optional(v.number()),
    enrich_contacts: v.optional(v.boolean()),
  },
  returns: validators.campaign,
  handler: async (ctx, args) => {
    if (args.mode === "demo")
      throw appError("VALIDATION_ERROR", "Demo campaigns are not available");
    if (args.enrich_contacts && args.mode !== "discovery")
      throw appError(
        "VALIDATION_ERROR",
        "Named-contact enrichment is only available for discovery campaigns",
      );
    const workspace = await requireWorkspace(ctx, ctx.principal.orgId);
    if (!workspace.profile && !args.profile_snapshot)
      throw appError(
        "WORKSPACE_REQUIRED",
        "Save an ICP profile before creating a campaign",
      );
    // Deliberate launch safety cap; grow via paginated archival rather than unbounded reads.
    const recent = await ctx.db
      .query("campaigns")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .take(100);
    if (recent.length >= 100)
      throw appError(
        "QUOTA_EXCEEDED",
        "Workspace campaign limit reached (100); contact your administrator",
      );
    const snapshot = validateProfile(
      args.profile_snapshot ?? workspace.profile!,
    );
    const targetCount =
      args.mode === "discovery"
        ? boundedLimit(args.target_count, 20, MAX_DISCOVERY_TARGETS)
        : args.domains.length;
    const website = args.offering_website
      ? normalizeWebsite(args.offering_website)
      : workspace.website;
    const timestamp = iso(Date.now());
    const id = await ctx.db.insert("campaigns", {
      orgId: ctx.principal.orgId,
      createdBy: ctx.principal.userId,
      name: text(args.name, "Campaign name", 200),
      mode: args.mode,
      profile_snapshot: snapshot,
      offering_website: website,
      target_count: targetCount,
      enrich_contacts: args.enrich_contacts ?? false,
      domains: normalizeDomains(args.mode, args.domains),
      status: "draft",
      created_at: timestamp,
      updated_at: timestamp,
      account_count: 0,
      qualified_count: 0,
      errors: [],
    });
    return campaignResult((await ctx.db.get(id))!);
  },
});
export const get = tenantQuery({
  args: { id: v.id("campaigns") },
  returns: validators.campaign,
  handler: async (ctx, args) =>
    campaignResult(await requireCampaign(ctx, ctx.principal.orgId, args.id)),
});
export const accounts = tenantQuery({
  args: { id: v.id("campaigns") },
  returns: v.array(validators.account),
  handler: async (ctx, args) => {
    const campaign = await requireCampaign(ctx, ctx.principal.orgId, args.id);
    const rows = await ctx.db
      .query("accounts")
      .withIndex("by_orgId_and_campaignId_and_score", (q) =>
        q.eq("orgId", ctx.principal.orgId).eq("campaignId", args.id),
      )
      .order("desc")
      .take(MAX_DISCOVERY_TARGETS);
    return Promise.all(
      rows
        .filter((row) => dataVisible(row.data))
        .map(async (row) =>
          accountResult(
            {
              ...row,
              data: await applyReviewFeedback(
                ctx,
                row.orgId,
                row.campaignId,
                row.data,
              ),
            },
            campaign,
          ),
        ),
    );
  },
});

export const exportAccounts = tenantQuery({
  args: { id: v.id("campaigns") },
  returns: v.array(validators.account),
  handler: async (ctx, args) => {
    const campaign = await requireCampaign(ctx, ctx.principal.orgId, args.id);
    const rows = await ctx.db
      .query("accounts")
      .withIndex("by_orgId_and_campaignId_and_score", (q) =>
        q.eq("orgId", ctx.principal.orgId).eq("campaignId", args.id),
      )
      .order("desc")
      .take(MAX_DISCOVERY_TARGETS);
    const visible = rows.filter((row) => dataVisible(row.data));
    if (
      visible.some(
        (row) =>
          row.data.source_provider ||
          row.data.contacts.some((contact) => contact.provider),
      ) &&
      process.env.SIGNALFOUNDRY_LICENSED_DATA_EXPORT_APPROVED !== "true"
    )
      throw appError(
        "EXPORT_BLOCKED",
        "Licensed-data export approval is required",
      );
    return Promise.all(
      visible.map(async (row) =>
        accountResult(
          {
            ...row,
            data: await applyReviewFeedback(
              ctx,
              row.orgId,
              row.campaignId,
              row.data,
            ),
          },
          campaign,
        ),
      ),
    );
  },
});

// A campaign preview never overwrites the organization's saved targeting profile.
export const suggestBrief = tenantAction({
  args: { website: v.string() },
  returns: v.object({ profile: validators.profile, website: v.string() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ profile: validators.Profile; website: string }> => {
    const website = normalizeWebsite(args.website);
    const lease: { version: number; lease: number } = await ctx.runMutation(
      internal.workspaces.beginAnalyze,
      { orgId: ctx.principal.orgId },
    );
    try {
      const response = await callWorker("/worker/analyze", { website });
      if (
        !response ||
        typeof response !== "object" ||
        !("profile" in response) ||
        !("website" in response) ||
        typeof response.website !== "string"
      )
        throw appError(
          "RESEARCH_FAILED",
          "Website analysis returned invalid data",
        );
      return {
        profile: validateProfile(response.profile as validators.Profile),
        website: normalizeWebsite(response.website),
      };
    } finally {
      await ctx.runMutation(internal.workspaces.releaseAnalyze, {
        orgId: ctx.principal.orgId,
        lease: lease.lease,
      });
    }
  },
});
