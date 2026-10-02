import { appError } from "./lib/errors";
import { v } from "convex/values";
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
  handler: async (ctx, args) =>
    accountResult(await requireAccount(ctx, ctx.principal.orgId, args.id)),
});
export const setStatus = tenantMutation({
  args: { id: v.id("accounts"), status: validators.accountStatus },
  returns: validators.account,
  handler: async (ctx, args) => {
    const row = await requireAccount(ctx, ctx.principal.orgId, args.id);
    await ctx.db.patch(row._id, { data: { ...row.data, status: args.status } });
    return accountResult({
      ...row,
      data: { ...row.data, status: args.status },
    });
  },
});
export const draft = tenantQuery({
  args: { id: v.id("accounts") },
  returns: validators.draft,
  handler: async (ctx, args) => {
    const row = await requireAccount(ctx, ctx.principal.orgId, args.id);
    const workspace = await requireWorkspace(ctx, ctx.principal.orgId);
    if (!workspace.profile)
      throw appError(
        "WORKSPACE_REQUIRED",
        "Save an ICP profile before drafting",
      );
    const account = accountResult(row);
    const campaign = await requireCampaign(
      ctx,
      ctx.principal.orgId,
      row.campaignId,
    );
    return makeGroundedDraft(
      account,
      campaign.profile_snapshot ?? workspace.profile,
    );
  },
});
