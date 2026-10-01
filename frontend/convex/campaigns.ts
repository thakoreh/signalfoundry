import { appError } from "./lib/errors";
import { v } from "convex/values";
import { tenantMutation, tenantQuery } from "./lib/auth";
import {
  accountResult,
  campaignResult,
  iso,
  requireCampaign,
  requireWorkspace,
} from "./lib/records";
import { boundedLimit, normalizeDomains, text } from "./lib/validation";
import * as validators from "./validators";

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
  },
  returns: validators.campaign,
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, ctx.principal.orgId);
    if (!workspace.profile)
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
    const timestamp = iso(Date.now());
    const id = await ctx.db.insert("campaigns", {
      orgId: ctx.principal.orgId,
      createdBy: ctx.principal.userId,
      name: text(args.name, "Campaign name", 200),
      mode: args.mode,
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
    await requireCampaign(ctx, ctx.principal.orgId, args.id);
    const rows = await ctx.db
      .query("accounts")
      .withIndex("by_orgId_and_campaignId_and_score", (q) =>
        q.eq("orgId", ctx.principal.orgId).eq("campaignId", args.id),
      )
      .order("desc")
      .take(10);
    return rows.map(accountResult);
  },
});
