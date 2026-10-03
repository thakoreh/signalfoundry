import { appError } from "./lib/errors";
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { tenantMutation, tenantQuery } from "./lib/auth";
import {
  iso,
  jobResult,
  contactsForCampaign,
  requireCampaign,
  requireJob,
  requireWorkspace,
} from "./lib/records";
import { text, validateResearchResult } from "./lib/validation";
import {
  billingConfigured,
  billingPolicy,
  isEntitled,
} from "./lib/billingPolicy";
import { workerConfiguration } from "./lib/worker";
import {
  discoveryPolicy,
  contactDataAccessible,
  dataVisible,
  filterAccessibleDiscoveryAccounts,
} from "./lib/discoveryPolicy";
import { reserveDiscovery, settleDiscovery } from "./lib/discoveryLedger";
import * as validators from "./validators";
import {
  applyReviewFeedback,
  feedbackDomain,
  isResearchExcluded,
  researchExclusions,
} from "./lib/feedback";

const MAX_ATTEMPTS = 5;
const LEASE_MS = 150_000;
const terminal = (status: Doc<"jobs">["status"]) =>
  ["succeeded", "partial", "failed", "cancelled"].includes(status);
export async function entitled(
  ctx: MutationCtx,
  orgId: string,
  domainCount: number,
) {
  const policy = billingPolicy();
  const billing = await ctx.db
    .query("billingAccounts")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .unique();
  if (!billingConfigured() || !policy || !isEntitled(billing, policy))
    throw appError(
      "BILLING_REQUIRED",
      "An active configured subscription is required for manual research",
    );
  if (domainCount > policy.domainsPerCampaignLimit)
    throw appError(
      "QUOTA_EXCEEDED",
      `Your configured plan allows ${policy.domainsPerCampaignLimit} domains per campaign`,
    );
  return policy;
}
export async function release(ctx: MutationCtx, row: Doc<"jobs">) {
  if (!row.countedActive) return;
  const workspace = await requireWorkspace(ctx, row.orgId);
  const global = await ctx.db
    .query("systemLimits")
    .withIndex("by_key", (q) => q.eq("key", "research"))
    .unique();
  await ctx.db.patch(workspace._id, {
    activeJobs: Math.max(0, workspace.activeJobs - 1),
  });
  if (global)
    await ctx.db.patch(global._id, {
      activeJobs: Math.max(0, global.activeJobs - 1),
    });
  await ctx.db.patch(row._id, { countedActive: false });
}
async function enqueue(ctx: MutationCtx, row: Doc<"jobs">, delay: number) {
  const scheduledId = await ctx.scheduler.runAfter(
    delay,
    row.mode === "discovery"
      ? internal.discovery.execute
      : internal.research.execute,
    { id: row._id, attempt: row.attempt + 1 },
  );
  await ctx.db.patch(row._id, {
    scheduledId,
    leaseUntil: Date.now() + delay + LEASE_MS,
  });
  await ctx.scheduler.runAfter(delay + LEASE_MS, internal.jobs.recover, {
    id: row._id,
    expectedAttempt: row.attempt + 1,
  });
}
export async function failJob(
  ctx: MutationCtx,
  row: Doc<"jobs">,
  error: string,
  retryable: boolean,
) {
  const now = Date.now();
  if (row.mode !== "discovery" && retryable && row.attempt < row.maxAttempts) {
    await ctx.db.patch(row._id, { status: "retrying", error, updatedAt: now });
    await enqueue(
      ctx,
      row,
      Math.min(15_000 * 2 ** Math.max(row.attempt - 1, 0), 120_000),
    );
    return;
  }
  await ctx.db.patch(row._id, {
    status: "failed",
    error,
    updatedAt: now,
    leaseUntil: 0,
  });
  await settleDiscovery(
    ctx,
    row,
    row.mode === "discovery" && row.stageInFlight === true,
  );
  await release(ctx, row);
  const campaign = await ctx.db.get(row.campaignId);
  if (campaign?.activeJobId === row._id)
    await ctx.db.patch(campaign._id, {
      status: "failed",
      errors: [error],
      updated_at: iso(now),
      activeJobId: undefined,
    });
}
export const start = tenantMutation({
  args: { campaignId: v.id("campaigns"), idempotencyKey: v.string() },
  returns: validators.job,
  handler: async (ctx, args) => {
    const key = text(args.idempotencyKey, "Idempotency key", 128);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(key))
      throw appError(
        "VALIDATION_ERROR",
        "Use an 8–128 character idempotency key",
      );
    const campaign = await requireCampaign(
      ctx,
      ctx.principal.orgId,
      args.campaignId,
    );
    if (campaign.mode === "demo")
      throw appError("VALIDATION_ERROR", "Demo jobs are not available");
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_orgId_and_idempotencyKey", (q) =>
        q.eq("orgId", ctx.principal.orgId).eq("idempotencyKey", key),
      )
      .unique();
    if (existing) {
      if (existing.campaignId !== args.campaignId)
        throw appError(
          "CONFLICT",
          "Idempotency key already belongs to another campaign",
        );
      return jobResult(existing);
    }
    if (campaign.activeJobId) {
      const active = await ctx.db.get(campaign.activeJobId);
      if (active && !terminal(active.status)) return jobResult(active);
    }
    const workspace = await requireWorkspace(ctx, ctx.principal.orgId);
    if (!workspace.profile && !campaign.profile_snapshot)
      throw appError(
        "WORKSPACE_REQUIRED",
        "Save an ICP profile before researching",
      );
    const now = Date.now();
    if (workspace.activeJobs >= 2)
      throw appError(
        "RATE_LIMITED",
        "This workspace already has two active research jobs",
      );
    const count =
      workspace.researchWindowStart > now - 3_600_000
        ? workspace.researchWindowCount
        : 0;
    if (count >= 20)
      throw appError(
        "RATE_LIMITED",
        "Research safety limit reached (20 starts per hour)",
      );
    const global = await ctx.db
      .query("systemLimits")
      .withIndex("by_key", (q) => q.eq("key", "research"))
      .unique();
    if (global && global.activeJobs >= 2)
      throw appError(
        "RATE_LIMITED",
        "Research capacity is busy; try again shortly",
      );
    if (campaign.mode === "manual" || campaign.mode === "discovery") {
      try {
        workerConfiguration();
      } catch {
        throw appError(
          "CONFIGURATION_ERROR",
          "Research worker is not configured",
        );
      }
      const policy = await entitled(
        ctx,
        ctx.principal.orgId,
        campaign.mode === "discovery" ? 0 : campaign.domains.length,
      );
      const month = new Date(now).toISOString().slice(0, 7);
      const usage = await ctx.db
        .query("usage")
        .withIndex("by_orgId_and_month", (q) =>
          q.eq("orgId", ctx.principal.orgId).eq("month", month),
        )
        .unique();
      if ((usage?.researchStarts ?? 0) >= policy.monthlyResearchLimit)
        throw appError("QUOTA_EXCEEDED", "Monthly research limit reached");
      if (usage)
        await ctx.db.patch(usage._id, {
          researchStarts: usage.researchStarts + 1,
        });
      else
        await ctx.db.insert("usage", {
          orgId: ctx.principal.orgId,
          month,
          researchStarts: 1,
        });
    }
    if (campaign.mode === "discovery" && !discoveryPolicy())
      throw appError(
        "CONFIGURATION_ERROR",
        "Discovery requires approved provider licenses and spend limits",
      );
    if (
      campaign.mode === "discovery" &&
      campaign.enrich_contacts === true &&
      !contactDataAccessible()
    )
      throw appError(
        "CONFIGURATION_ERROR",
        "Named-contact enrichment requires separate PDL data-access approval; use company-only discovery or configure that capability",
      );
    await ctx.db.patch(workspace._id, {
      activeJobs: workspace.activeJobs + 1,
      researchWindowCount: count + 1,
      researchWindowStart: count ? workspace.researchWindowStart : now,
    });
    if (global)
      await ctx.db.patch(global._id, { activeJobs: global.activeJobs + 1 });
    else
      await ctx.db.insert("systemLimits", { key: "research", activeJobs: 1 });
    const id = await ctx.db.insert("jobs", {
      orgId: ctx.principal.orgId,
      campaignId: campaign._id,
      createdBy: ctx.principal.userId,
      idempotencyKey: key,
      status: "queued",
      attempt: 0,
      maxAttempts:
        campaign.mode === "discovery"
          ? 2 * (campaign.target_count ?? 20) + 2
          : MAX_ATTEMPTS,
      error: null,
      mode: campaign.mode,
      domains: campaign.domains,
      profile: campaign.profile_snapshot ?? workspace.profile!,
      ...(campaign.mode === "discovery"
        ? {
            stage: "discovery" as const,
            stageCursor: 0,
            targetCount: campaign.target_count ?? 20,
            enrichContacts: campaign.enrich_contacts ?? false,
            offeringWebsite: campaign.offering_website ?? workspace.website,
          }
        : {}),
      createdAt: now,
      updatedAt: now,
      leaseUntil: now + LEASE_MS,
      countedActive: true,
    });
    let row = (await ctx.db.get(id))!;
    if (row.mode === "discovery") {
      await reserveDiscovery(ctx, row);
      row = (await ctx.db.get(id))!;
    }
    await ctx.db.patch(campaign._id, {
      status: "researching",
      activeJobId: id,
      errors: [],
      updated_at: iso(now),
    });
    await enqueue(ctx, row, 0);
    return jobResult(row);
  },
});
export const get = tenantQuery({
  args: { id: v.id("jobs") },
  returns: validators.job,
  handler: async (ctx, args) =>
    jobResult(await requireJob(ctx, ctx.principal.orgId, args.id)),
});
export const forCampaign = tenantQuery({
  args: { campaignId: v.id("campaigns") },
  returns: v.union(validators.job, v.null()),
  handler: async (ctx, args) => {
    await requireCampaign(ctx, ctx.principal.orgId, args.campaignId);
    const row = await ctx.db
      .query("jobs")
      .withIndex("by_orgId_and_campaignId", (q) =>
        q.eq("orgId", ctx.principal.orgId).eq("campaignId", args.campaignId),
      )
      .order("desc")
      .first();
    return row ? jobResult(row) : null;
  },
});
export const cancel = tenantMutation({
  args: { id: v.id("jobs") },
  returns: validators.job,
  handler: async (ctx, args) => {
    const row = await requireJob(ctx, ctx.principal.orgId, args.id);
    if (
      row.createdBy !== ctx.principal.userId &&
      ctx.principal.role !== "org:admin"
    )
      throw appError(
        "FORBIDDEN",
        "Only the researcher or organization admin may cancel this job",
      );
    if (terminal(row.status)) return jobResult(row);
    const patch = {
      status: "cancelled" as const,
      updatedAt: Date.now(),
      error: "Research cancelled; any in-flight results will be discarded",
    };
    await ctx.db.patch(row._id, patch);
    await settleDiscovery(
      ctx,
      row,
      row.mode === "discovery" && row.stageInFlight === true,
    );
    if (row.status !== "running") {
      if (row.scheduledId) await ctx.scheduler.cancel(row.scheduledId);
      await release(ctx, row);
    }
    const campaign = await ctx.db.get(row.campaignId);
    if (campaign?.activeJobId === row._id)
      await ctx.db.patch(campaign._id, {
        status: campaign.account_count ? "complete" : "draft",
        activeJobId: undefined,
        errors: [patch.error],
        updated_at: iso(patch.updatedAt),
      });
    return jobResult((await ctx.db.get(row._id))!);
  },
});
export const claim = internalMutation({
  args: { id: v.id("jobs"), attempt: v.number() },
  returns: v.union(
    v.object({
      orgId: v.string(),
      campaignId: v.id("campaigns"),
      mode: validators.mode,
      domains: v.array(v.string()),
      excludedDomains: v.array(v.string()),
      profile: validators.profile,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      !["queued", "retrying"].includes(row.status) ||
      row.attempt + 1 !== args.attempt ||
      args.attempt > row.maxAttempts
    )
      return null;
    if (row.mode !== "manual") {
      await failJob(ctx, row, "Demo research is disabled", false);
      return null;
    }
    if (row.mode === "manual") {
      try {
        await entitled(ctx, row.orgId, row.domains.length);
      } catch {
        await failJob(
          ctx,
          row,
          "Subscription is no longer eligible for manual research",
          false,
        );
        return null;
      }
    }
    let excludedDomains: string[];
    try {
      excludedDomains = await researchExclusions(
        ctx,
        row.orgId,
        row.campaignId,
      );
    } catch {
      await failJob(
        ctx,
        row,
        "Research paused because the exclusion set exceeds the safe 100-domain dispatch limit. Restore exclusions before retrying.",
        false,
      );
      return null;
    }
    const excluded = new Set(excludedDomains);
    const domains = row.domains.filter(
      (domain) => !excluded.has(feedbackDomain(new URL(domain).hostname)),
    );
    await ctx.db.patch(row._id, {
      status: "running",
      attempt: args.attempt,
      updatedAt: Date.now(),
      leaseUntil: Date.now() + LEASE_MS,
    });
    await ctx.scheduler.runAfter(LEASE_MS, internal.jobs.recover, {
      id: row._id,
      expectedAttempt: args.attempt,
    });
    return {
      orgId: row.orgId,
      campaignId: row.campaignId,
      mode: row.mode,
      domains,
      excludedDomains,
      profile: row.profile,
    };
  },
});
export const finish = internalMutation({
  args: {
    id: v.id("jobs"),
    attempt: v.number(),
    accounts: v.optional(v.array(validators.workerAccount)),
    errors: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.attempt !== args.attempt) return null;
    if (row.status === "cancelled") {
      await release(ctx, row);
      return null;
    }
    if (row.status !== "running" || row.leaseUntil < Date.now()) return null;
    const campaign = await requireCampaign(ctx, row.orgId, row.campaignId);
    if (campaign.activeJobId !== row._id) return null;
    const suppliedAccounts = args.accounts ?? row.intermediateAccounts ?? [];
    const suppliedErrors = args.errors ?? row.stageErrors ?? [];
    const contactScope = {
      mode: row.mode,
      enrich_contacts:
        row.enrichContacts === true && campaign.enrich_contacts === true,
    };
    const scopedAccounts = suppliedAccounts.map((account) => ({
      ...account,
      contacts: contactsForCampaign(account.contacts, contactScope),
    }));
    let accounts =
      row.mode === "discovery"
        ? filterAccessibleDiscoveryAccounts(scopedAccounts)
        : scopedAccounts;
    const pruned =
      accounts.length !== suppliedAccounts.length ||
      accounts.reduce(
        (total, account) => total + account.contacts.length,
        0,
      ) !==
        suppliedAccounts.reduce(
          (total, account) => total + account.contacts.length,
          0,
        );
    let errors = pruned
      ? [
          ...suppliedErrors.slice(0, 19),
          "Expired, revoked, or unselected contact data was removed before saving results.",
        ]
      : suppliedErrors;
    validateResearchResult(accounts, errors, row.campaignId, row.mode);
    const stored = await ctx.db
      .query("accounts")
      .withIndex("by_orgId_and_campaignId_and_score", (q) =>
        q.eq("orgId", row.orgId).eq("campaignId", row.campaignId),
      )
      .take(row.mode === "discovery" ? 31 : 11);
    const allManualExcluded =
      row.mode === "manual" &&
      (
        await Promise.all(
          row.domains.map((domain) => {
            const canonical = feedbackDomain(new URL(domain).hostname);
            const prior = stored.find(
              (account) => feedbackDomain(account.data.domain) === canonical,
            );
            return isResearchExcluded(
              ctx,
              row.orgId,
              row.campaignId,
              canonical,
              prior?.data,
            );
          }),
        )
      ).every(Boolean);
    if (
      !accounts.length &&
      !allManualExcluded &&
      (row.mode !== "discovery" || errors.length > 0)
    ) {
      await failJob(
        ctx,
        row,
        errors[0] ?? "No accounts could be researched",
        false,
      );
      return null;
    }
    const previous = [];
    for (const account of stored) {
      if (row.mode === "discovery" && !dataVisible(account.data))
        await ctx.db.delete(account._id);
      else {
        const data = {
          ...account.data,
          contacts: contactsForCampaign(account.data.contacts, contactScope),
        };
        if (data.contacts.length !== account.data.contacts.length)
          await ctx.db.patch(account._id, { data });
        previous.push({ ...account, data });
      }
    }
    const accountLimit =
      row.mode === "discovery" ? (row.targetCount ?? 30) : 10;
    if (previous.length > accountLimit)
      throw appError(
        "RESEARCH_FAILED",
        "Stored campaign account limit exceeded",
      );
    const existing = new Map(
      previous.map((account) => [account.data.domain, account]),
    );
    const suppressedPrevious = new Set<string>();
    for (const account of previous) {
      if (
        await isResearchExcluded(
          ctx,
          row.orgId,
          row.campaignId,
          account.data.domain,
          account.data,
        )
      )
        suppressedPrevious.add(account.data.domain);
    }
    const eligible = [];
    for (const account of accounts) {
      if (
        !(await isResearchExcluded(
          ctx,
          row.orgId,
          row.campaignId,
          account.domain,
          previous.find(
            (prior) =>
              feedbackDomain(prior.data.domain) ===
              feedbackDomain(account.domain),
          )?.data,
        ))
      )
        eligible.push(account);
    }
    accounts = eligible;
    if (
      (row.mode === "discovery" && errors.length) ||
      suppressedPrevious.size > 0
    ) {
      let room = Math.max(0, accountLimit - previous.length);
      const bounded = accounts.filter(
        (account) => existing.has(account.domain) || room-- > 0,
      );
      if (bounded.length !== accounts.length) {
        accounts = bounded;
        errors = [
          ...errors.slice(0, 19),
          "Prior evidence and review decisions were preserved. Additional new matches exceeded this campaign's company limit; use a new campaign for a new search.",
        ];
      }
    }
    // Partial research is not an instruction to delete earlier evidence or user decisions.
    const retained = previous.filter(
      (account) =>
        (errors.length > 0 || suppressedPrevious.has(account.data.domain)) &&
        !accounts.some((item) => item.domain === account.data.domain),
    );
    if (
      accounts.length + retained.length > accountLimit ||
      (row.mode === "manual" && accounts.length > row.domains.length)
    ) {
      throw appError(
        "RESEARCH_FAILED",
        "Merged campaign account limit exceeded",
      );
    }
    for (const result of accounts) {
      const { id: workerId, campaign_id: workerCampaignId, ...data } = result;
      void workerId;
      void workerCampaignId;
      const old = existing.get(data.domain);
      const reviewed = await applyReviewFeedback(
        ctx,
        row.orgId,
        row.campaignId,
        data,
        old?.data ?? {
          ...data,
          status: "new",
          review_reason: null,
          reviewed_at: null,
          suppress_workspace: false,
        },
      );
      if (old) {
        await ctx.db.patch(old._id, {
          data: reviewed,
          score: data.score,
          jobId: row._id,
        });
        existing.delete(data.domain);
      } else
        await ctx.db.insert("accounts", {
          orgId: row.orgId,
          campaignId: row.campaignId,
          jobId: row._id,
          score: data.score,
          data: reviewed,
        });
    }
    if (!errors.length) {
      for (const old of existing.values())
        if (!suppressedPrevious.has(old.data.domain))
          await ctx.db.delete(old._id);
    }
    const status = errors.length ? "partial" : "succeeded";
    await ctx.db.patch(row._id, {
      status,
      ...(row.mode === "discovery"
        ? { stage: "complete" as const, intermediateAccounts: undefined }
        : {}),
      error: errors.length ? "Some domains could not be researched" : null,
      updatedAt: Date.now(),
      leaseUntil: 0,
    });
    await ctx.db.patch(campaign._id, {
      status: status === "partial" ? "partial" : "complete",
      activeJobId: undefined,
      account_count: accounts.length + retained.length,
      qualified_count:
        accounts.filter((account) => account.score >= 65).length +
        retained.filter((account) => account.score >= 65).length,
      errors: errors,
      updated_at: iso(Date.now()),
    });
    await settleDiscovery(ctx, row);
    await release(ctx, row);
    return null;
  },
});
export const fail = internalMutation({
  args: {
    id: v.id("jobs"),
    attempt: v.number(),
    error: v.string(),
    retryable: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.attempt !== args.attempt) return null;
    if (row.status === "cancelled") {
      await release(ctx, row);
      return null;
    }
    if (row.status !== "running") return null;
    await failJob(
      ctx,
      row,
      text(args.error, "Research error", 1000),
      args.retryable,
    );
    return null;
  },
});
export const recover = internalMutation({
  args: { id: v.id("jobs"), expectedAttempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.attempt > args.expectedAttempt ||
      row.leaseUntil > Date.now()
    )
      return null;
    if (terminal(row.status)) {
      if (row.status === "cancelled") await release(ctx, row);
      return null;
    }
    if (row.mode === "discovery" && row.intermediateAccounts?.length) {
      // Preserve qualified companies if a later paid contact step times out. The
      // whole remaining reservation stays held because provider billing is unknown.
      await ctx.db.patch(row._id, {
        status: "running",
        leaseUntil: Date.now() + LEASE_MS,
        stageInFlight: false,
        spendStatus: row.stageInFlight ? "uncertain" : row.spendStatus,
        stageErrors: [
          "Discovery stopped after a lost stage. No automatic paid retry was made; contacts may be incomplete.",
        ],
      });
      await ctx.scheduler.runAfter(0, internal.jobs.finish, {
        id: row._id,
        attempt: row.attempt,
      });
      return null;
    }
    // A lost scheduled action also consumes an attempt, bounding recovery forever.
    const attempted = {
      ...row,
      attempt: Math.max(row.attempt, args.expectedAttempt),
    };
    await ctx.db.patch(row._id, { attempt: attempted.attempt });
    await failJob(
      ctx,
      attempted,
      "Research attempt expired; the durable scheduler recovered it",
      true,
    );
    return null;
  },
});
