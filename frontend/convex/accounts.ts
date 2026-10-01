import { appError } from "./lib/errors";
import { v } from "convex/values";
import { tenantMutation, tenantQuery } from "./lib/auth";
import { accountResult, requireAccount, requireWorkspace } from "./lib/records";
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
    const account = row.data;
    const cited =
      account.evidence.find((item) => item.kind === "fit") ??
      account.evidence[0];
    const observed = cited?.excerpt ?? account.description;
    return {
      subject: `A question for ${account.name}`.slice(0, 180),
      body: `Hi ${account.name} team,\n\nYour website includes this description: “${observed.slice(0, 220)}”\n\nI’m reaching out from ${workspace.profile.company_name}. Would a short conversation to see whether there is a relevant fit be useful?\n\n[Your name]`,
      basis: [
        cited
          ? `${cited.title}: ${cited.url}`
          : "Account description; no independent source available",
        "Sender company name comes from your editable workspace profile",
      ],
      engine: "grounded_template" as const,
      warning: `${account.is_demo ? "FICTIONAL DEMO: do not send this sample. " : ""}Draft only; nothing is sent. Review quoted website text, recipient, relevance, and applicable outreach requirements before use. No verified contact is available.`,
    };
  },
});
