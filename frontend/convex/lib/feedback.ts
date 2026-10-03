import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { appError } from "./errors";

export function feedbackDomain(domain: string): string {
  // Exact business host only, never inferred industry/geography/category exclusions.
  const value = domain
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (
    value.length > 253 ||
    !value.includes(".") ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value) ||
    value
      .split(".")
      .some(
        (label) =>
          !label ||
          label.length > 63 ||
          label.startsWith("-") ||
          label.endsWith("-"),
      )
  )
    throw appError(
      "VALIDATION_ERROR",
      "Enter an exact company domain without a URL path",
    );
  return value;
}

export async function getReviewFeedback(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  campaignId: Id<"campaigns">,
  domain: string,
) {
  return ctx.db
    .query("accountFeedback")
    .withIndex("by_orgId_and_campaignId_and_domain", (q) =>
      q
        .eq("orgId", orgId)
        .eq("campaignId", campaignId)
        .eq("domain", feedbackDomain(domain)),
    )
    .unique();
}

export async function getWorkspaceSuppression(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  domain: string,
) {
  return ctx.db
    .query("workspaceSuppressions")
    .withIndex("by_orgId_and_domain", (q) =>
      q.eq("orgId", orgId).eq("domain", feedbackDomain(domain)),
    )
    .unique();
}

export async function isWorkspaceSuppressed(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  domain: string,
): Promise<boolean> {
  return (await getWorkspaceSuppression(ctx, orgId, domain)) !== null;
}

export async function applyReviewFeedback(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  campaignId: Id<"campaigns">,
  data: Doc<"accounts">["data"],
  previousData?: Doc<"accounts">["data"],
): Promise<Doc<"accounts">["data"]> {
  const feedback = await getReviewFeedback(ctx, orgId, campaignId, data.domain);
  const previous = previousData ?? data;
  return {
    ...data,
    status: feedback?.status ?? previous.status,
    review_reason: feedback
      ? feedback.reason
      : (previous.review_reason ?? null),
    reviewed_at: feedback?.reviewedAt ?? previous.reviewed_at ?? null,
    suppress_workspace: await isWorkspaceSuppressed(ctx, orgId, data.domain),
  };
}

export async function saveReviewFeedback(
  ctx: Pick<MutationCtx, "db">,
  row: Doc<"accounts">,
  update: {
    status: Doc<"accountFeedback">["status"];
    reason?: Doc<"accountFeedback">["reason"];
    suppress_workspace?: boolean;
    preserve_workspace_suppression?: boolean;
  },
): Promise<Doc<"accounts">["data"]> {
  if (
    update.preserve_workspace_suppression &&
    (update.status === "dismissed" ||
      update.reason != null ||
      update.suppress_workspace !== undefined)
  )
    throw appError(
      "VALIDATION_ERROR",
      "Preserving existing suppression requires a non-dismissed status, no reason, and no suppression change",
    );
  if (
    update.status !== "dismissed" &&
    (update.reason != null || update.suppress_workspace)
  )
    throw appError(
      "VALIDATION_ERROR",
      "Pass reasons and workspace suppression require dismissed status",
    );
  const domain = feedbackDomain(row.data.domain);
  const timestamp = new Date().toISOString();
  const existing = await getReviewFeedback(
    ctx,
    row.orgId,
    row.campaignId,
    domain,
  );
  const feedback = {
    orgId: row.orgId,
    campaignId: row.campaignId,
    accountId: row._id,
    domain,
    status: update.status,
    reason: update.reason ?? null,
    reviewedAt: timestamp,
  };
  // Keep latest user metadata, not copies of licensed profiles, contacts, or evidence.
  if (existing) await ctx.db.patch(existing._id, feedback);
  else await ctx.db.insert("accountFeedback", feedback);

  const suppression = await getWorkspaceSuppression(ctx, row.orgId, domain);
  if (update.suppress_workspace === true) {
    const data = {
      orgId: row.orgId,
      campaignId: row.campaignId,
      accountId: row._id,
      domain,
      reason: update.reason ?? null,
      updatedAt: timestamp,
    };
    if (suppression) await ctx.db.patch(suppression._id, data);
    else await ctx.db.insert("workspaceSuppressions", data);
  } else if (
    update.suppress_workspace === false ||
    (update.status !== "dismissed" && !update.preserve_workspace_suppression)
  ) {
    if (suppression) await ctx.db.delete(suppression._id);
  }
  return {
    ...row.data,
    status: update.status,
    review_reason: feedback.reason,
    reviewed_at: timestamp,
    suppress_workspace: await isWorkspaceSuppressed(ctx, row.orgId, domain),
  };
}

// Bounded trusted metadata only. A large exclusion set must never silently truncate
// and dispatch research against excluded companies.
export const MAX_RESEARCH_EXCLUSIONS = 100;
export async function researchExclusions(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  campaignId: Id<"campaigns">,
): Promise<string[]> {
  const workspace = await ctx.db
    .query("workspaceSuppressions")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .take(MAX_RESEARCH_EXCLUSIONS + 1);
  const campaign = await ctx.db
    .query("accountFeedback")
    .withIndex("by_orgId_and_campaignId_and_status", (q) =>
      q
        .eq("orgId", orgId)
        .eq("campaignId", campaignId)
        .eq("status", "dismissed"),
    )
    .take(MAX_RESEARCH_EXCLUSIONS + 1);
  // Campaign rows are independently capped at 30; include legacy dismissed rows.
  const previous = await ctx.db
    .query("accounts")
    .withIndex("by_orgId_and_campaignId_and_score", (q) =>
      q.eq("orgId", orgId).eq("campaignId", campaignId),
    )
    .take(31);
  if (
    workspace.length > MAX_RESEARCH_EXCLUSIONS ||
    campaign.length > MAX_RESEARCH_EXCLUSIONS ||
    previous.length > 30
  )
    throw appError(
      "VALIDATION_ERROR",
      "Research paused: the exclusion set exceeds the safe 100-domain dispatch limit. Restore exclusions before retrying.",
    );
  const domains = new Set(
    [...workspace, ...campaign].map((row) => feedbackDomain(row.domain)),
  );
  for (const row of previous) {
    if (row.data.status === "dismissed") {
      const latest = await getReviewFeedback(
        ctx,
        orgId,
        campaignId,
        row.data.domain,
      );
      if (!latest || latest.status === "dismissed")
        domains.add(feedbackDomain(row.data.domain));
    }
  }
  if (domains.size > MAX_RESEARCH_EXCLUSIONS)
    throw appError(
      "VALIDATION_ERROR",
      "Research paused: the exclusion set exceeds the safe 100-domain dispatch limit. Restore exclusions before retrying.",
    );
  return [...domains].sort();
}

export async function isResearchExcluded(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  campaignId: Id<"campaigns">,
  domain: string,
  previousData?: Doc<"accounts">["data"],
): Promise<boolean> {
  if (await isWorkspaceSuppressed(ctx, orgId, domain)) return true;
  const latest = await getReviewFeedback(ctx, orgId, campaignId, domain);
  return latest
    ? latest.status === "dismissed"
    : previousData?.status === "dismissed";
}
