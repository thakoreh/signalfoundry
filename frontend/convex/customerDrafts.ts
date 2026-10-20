import { v, type Infer } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { tenantAction } from "./lib/auth";
import { appError } from "./lib/errors";
import { requireWorkspace } from "./lib/records";
import { billingConfigured, billingPolicy, isEntitled } from "./lib/billingPolicy";
import { callWorker } from "./lib/worker";
import { normalizeWebsite } from "./lib/validation";
import { customerDraft, profile, workerAccount } from "./validators";

const draftVersion = "grounded-intro-v1:deepseek-flash";
type Draft = Infer<typeof customerDraft>;
const reservation = v.object({
  id: v.id("customerDrafts"),
  cached: v.union(customerDraft, v.null()),
  failed: v.boolean(),
  profile,
  account: workerAccount,
});

export const reserve = internalMutation({
  args: {
    orgId: v.string(), searchId: v.id("customerSearches"), accountId: v.string(),
    idempotency_key: v.string(),
  },
  returns: reservation,
  handler: async (ctx, args) => {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(args.idempotency_key))
      throw appError("VALIDATION_ERROR", "Invalid draft request");
    const search = await ctx.db.get(args.searchId);
    if (!search || search.orgId !== args.orgId)
      throw appError("NOT_FOUND", "Customer search not found");
    if (!["complete", "partial"].includes(search.status))
      throw appError("CONFLICT", "Wait for customer research to finish");
    const account = search.accounts.find((item) => item.id === args.accountId);
    if (!account) throw appError("NOT_FOUND", "Customer not found in this search");
    // Same admission predicate as Python customer_is_qualified. Geography or
    // incidental body text cannot compensate for missing customer-type evidence.
    if (account.is_demo ||
      account.score_breakdown.some((item) => item.label === "Exclusion penalty") ||
      !account.score_breakdown.some((item) => item.label === "Customer-type language" && item.points >= 60) ||
      !account.evidence.some((item) => {
        if (item.is_demo || !["company", "fit"].includes(item.kind) || !item.excerpt.trim()) return false;
        try { normalizeWebsite(item.url); return true; } catch { return false; }
      }))
      throw appError("VALIDATION_ERROR", "This business needs clearer evidence of customer fit before drafting");
    const workspace = await requireWorkspace(ctx, args.orgId);
    if (!workspace.profile) throw appError("VALIDATION_ERROR", "Save a business profile first");
    const cacheKey = `${draftVersion}:${args.searchId}:${args.accountId}:${workspace.profileVersion}`;
    const oldRequest = await ctx.db.query("customerDrafts")
      .withIndex("by_orgId_and_requestKey", (q) => q.eq("orgId", args.orgId).eq("requestKey", args.idempotency_key)).unique();
    if (oldRequest && oldRequest.cacheKey !== cacheKey)
      throw appError("CONFLICT", "This draft request belongs to an earlier business profile");
    if (oldRequest?.status === "failed")
      throw appError("DRAFT_FAILED", "This attempt could not finish. Choose Try draft again to make a new attempt.");
    const existing = await ctx.db.query("customerDrafts")
      .withIndex("by_orgId_and_cacheKey", (q) => q.eq("orgId", args.orgId).eq("cacheKey", cacheKey)).order("desc").first();
    const policy = billingPolicy();
    const billing = await ctx.db.query("billingAccounts").withIndex("by_orgId", (q) => q.eq("orgId", args.orgId)).unique();
    if (!billingConfigured() || !policy || !isEntitled(billing, policy))
      throw appError("BILLING_REQUIRED", "An active configured research subscription is required");
    if (existing?.status === "pending" && existing.createdAt < Date.now() - 90_000) {
      await ctx.db.patch(existing._id, { status: "failed" });
      // Returning commits recovery. Throwing here would roll it back.
      return { id: existing._id, cached: null, failed: true, profile: workspace.profile, account };
    }
    if (existing?.status === "pending")
      throw appError("CONFLICT", "This draft is already in progress. Check it again shortly; no extra attempt was made.");
    if (existing?.status === "complete" && existing.draft) {
      if (!oldRequest) {
        const aliases = await ctx.db.query("customerDrafts")
          .withIndex("by_orgId_and_cacheKey", (q) => q.eq("orgId", args.orgId).eq("cacheKey", cacheKey)).order("desc").take(100);
        if (aliases.filter((item) => !item.charged && item.createdAt > Date.now() - 3_600_000).length >= 100)
          throw appError("RATE_LIMITED", "Saved draft request allowance reached (100 per hour). Reuse the original request or try later.");
      }
      const id = oldRequest?._id || await ctx.db.insert("customerDrafts", {
        orgId: args.orgId, requestKey: args.idempotency_key, cacheKey, status: "complete",
        draft: existing.draft, charged: false, createdAt: Date.now(),
      });
      return { id, cached: existing.draft, failed: false, profile: workspace.profile, account };
    }
    const timestamp = Date.now();
    const recent = await ctx.db.query("customerDrafts").withIndex("by_orgId_and_charged", (q) => q.eq("orgId", args.orgId).eq("charged", true)).order("desc").take(5);
    if (recent.filter((item) => item.createdAt > timestamp - 3_600_000).length >= 5)
      throw appError("RATE_LIMITED", "AI draft allowance reached (5 per hour)");
    const month = new Date(timestamp).toISOString().slice(0, 7);
    const usage = await ctx.db.query("usage").withIndex("by_orgId_and_month", (q) => q.eq("orgId", args.orgId).eq("month", month)).unique();
    if ((usage?.draftStarts || 0) >= policy.monthlyResearchLimit * Math.min(5, policy.domainsPerCampaignLimit))
      throw appError("QUOTA_EXCEEDED", "Monthly AI draft allowance reached");
    if (usage) await ctx.db.patch(usage._id, { draftStarts: (usage.draftStarts || 0) + 1 });
    else await ctx.db.insert("usage", { orgId: args.orgId, month, researchStarts: 0, draftStarts: 1 });
    const id = await ctx.db.insert("customerDrafts", { orgId: args.orgId, requestKey: args.idempotency_key, cacheKey, status: "pending", charged: true, createdAt: timestamp });
    return { id, cached: null, failed: false, profile: workspace.profile, account };
  },
});

export const finish = internalMutation({
  args: { id: v.id("customerDrafts"), draft: v.union(customerDraft, v.null()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "pending") return false;
    if (args.draft) await ctx.db.patch(row._id, { status: "complete", draft: args.draft });
    else await ctx.db.patch(row._id, { status: "failed" });
    return true;
  },
});

export const generate = tenantAction({
  args: { searchId: v.id("customerSearches"), accountId: v.string(), idempotency_key: v.string() },
  returns: customerDraft,
  handler: async (ctx, args): Promise<Draft> => {
    const capability = await callWorker("/worker/customer-status", {}) as { drafts?: { status?: string } };
    if (capability?.drafts?.status !== "ready")
      throw appError("CONFIGURATION_ERROR", "AI message drafting is not connected yet");
    const reserved = await ctx.runMutation(internal.customerDrafts.reserve, { ...args, orgId: ctx.principal.orgId });
    if (reserved.failed) throw appError("DRAFT_FAILED", "The earlier draft was interrupted. Choose Try draft again to make a new attempt.");
    if (reserved.cached) return reserved.cached;
    try {
      const draft = await callWorker("/worker/customer-draft", { profile: reserved.profile, account: reserved.account }) as Draft;
      const known = new Set(reserved.account.evidence.filter((item) => !item.is_demo).map((item) => item.id));
      if (!draft || draft.generation_engine !== "deepseek" || typeof draft.subject !== "string" || !draft.subject.trim() || draft.subject.length > 160 || /[\r\n]/.test(draft.subject) ||
        typeof draft.body !== "string" || !draft.body.trim() || draft.body.length > 1800 ||
        !Array.isArray(draft.evidence_ids) || draft.evidence_ids.length < 1 || draft.evidence_ids.length > 5 || !draft.evidence_ids.every((id) => known.has(id)) ||
        !Array.isArray(draft.warnings) || draft.warnings.length > 5 || !draft.warnings.every((item) => typeof item === "string" && item.length <= 500) ||
        typeof draft.created_at !== "string" || !Number.isFinite(Date.parse(draft.created_at)))
        throw new Error("Invalid draft response");
      if (!await ctx.runMutation(internal.customerDrafts.finish, { id: reserved.id, draft }))
        throw new Error("Draft attempt interrupted");
      return draft;
    } catch {
      await ctx.runMutation(internal.customerDrafts.finish, { id: reserved.id, draft: null });
      throw appError("DRAFT_FAILED", "AI drafting could not finish safely. No automatic retry was made.");
    }
  },
});
