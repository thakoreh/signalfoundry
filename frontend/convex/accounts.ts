import { appError } from "./lib/errors";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  applyReviewFeedback,
  getWorkspaceSuppression,
  saveReviewFeedback,
} from "./lib/feedback";
import { tenantMutation, tenantQuery } from "./lib/auth";
import {
  accountResult,
  requireAccount,
  requireWorkspace,
  requireCampaign,
} from "./lib/records";
import { makeGroundedDraft } from "./lib/outreach";
import * as validators from "./validators";

export const get = tenantQuery({
  args: { id: v.id("accounts") },
  returns: validators.account,
  handler: async (ctx, args) => {
    const row = await requireAccount(ctx, ctx.principal.orgId, args.id);
    const campaign = await requireCampaign(ctx, row.orgId, row.campaignId);
    return accountResult(
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
    );
  },
});
export const setStatus = tenantMutation({
  args: {
    id: v.id("accounts"),
    status: validators.accountStatus,
    reason: v.optional(v.union(validators.reviewReason, v.null())),
    suppress_workspace: v.optional(v.boolean()),
    preserve_workspace_suppression: v.optional(v.boolean()),
  },
  returns: validators.account,
  handler: async (ctx, args) => {
    const row = await requireAccount(ctx, ctx.principal.orgId, args.id);
    const campaign = await requireCampaign(ctx, row.orgId, row.campaignId);
    // Validation happens before writes. Feedback never refreshes a licensed row's expiry.
    accountResult(row, campaign);
    const data = await saveReviewFeedback(ctx, row, args);
    await ctx.db.patch(row._id, { data });
    return accountResult({ ...row, data }, campaign);
  },
});
export const draft = tenantQuery({
  args: { id: v.id("accounts") },
  returns: validators.draft,
  handler: async (ctx, args) => {
    const row = await requireAccount(ctx, ctx.principal.orgId, args.id);
    if (await getWorkspaceSuppression(ctx, row.orgId, row.data.domain))
      throw appError(
        "VALIDATION_ERROR",
        "This domain is workspace-suppressed. Restore it before generating outreach drafts.",
      );
    const workspace = await requireWorkspace(ctx, ctx.principal.orgId);
    const campaign = await requireCampaign(
      ctx,
      ctx.principal.orgId,
      row.campaignId,
    );
    const profile = campaign.profile_snapshot ?? workspace.profile;
    if (!profile)
      throw appError(
        "WORKSPACE_REQUIRED",
        "Save a campaign brief or ICP profile before drafting",
      );
    const account = accountResult(row, campaign);
    return makeGroundedDraft(account, profile);
  },
});

const suppressionResult = v.object({
  domain: v.string(),
  campaign_id: v.id("campaigns"),
  account_id: v.id("accounts"),
  reason: v.union(validators.reviewReason, v.null()),
  updated_at: v.string(),
});
// Recovery remains possible when licensed account rows have already expired/deleted.
export const suppressions = tenantQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(suppressionResult),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw appError(
        "VALIDATION_ERROR",
        "Suppression page size must be between 1 and 100",
      );
    const result = await ctx.db
      .query("workspaceSuppressions")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .paginate(args.paginationOpts);
    return {
      page: result.page.map((row) => ({
        domain: row.domain,
        campaign_id: row.campaignId,
        account_id: row.accountId,
        reason: row.reason,
        updated_at: row.updatedAt,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
export const restoreSuppression = tenantMutation({
  args: { domain: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getWorkspaceSuppression(
      ctx,
      ctx.principal.orgId,
      args.domain,
    );
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});
