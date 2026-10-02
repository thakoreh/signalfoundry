import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { appError } from "./errors";
import { discoveryPolicy } from "./discoveryPolicy";

// Reserve before scheduling. Both tenant and global ledgers share this transaction.
// Unknown provider outcomes keep the full reservation; no automatic refund/retry.
export async function reserveDiscovery(ctx: MutationCtx, row: Doc<"jobs">) {
  const policy = discoveryPolicy();
  if (!policy)
    throw appError(
      "CONFIGURATION_ERROR",
      "Discovery license and spend approvals are required",
    );
  const month = new Date(row.createdAt).toISOString().slice(0, 7);
  for (const [scope, ceiling] of [
    ["global", policy.monthlyBudget],
    [row.orgId, policy.workspaceMonthlyBudget],
  ] as const) {
    const usage = await ctx.db
      .query("discoveryUsage")
      .withIndex("by_scope_and_month", (q) =>
        q.eq("scope", scope).eq("month", month),
      )
      .unique();
    const total = (usage?.committedMicrousd ?? 0) + policy.jobBudget;
    if (total > ceiling)
      throw appError(
        "QUOTA_EXCEEDED",
        "Discovery spending allowance has been reserved or used",
      );
    if (usage) await ctx.db.patch(usage._id, { committedMicrousd: total });
    else
      await ctx.db.insert("discoveryUsage", {
        scope,
        month,
        committedMicrousd: total,
      });
  }
  await ctx.db.insert("discoverySpend", {
    orgId: row.orgId,
    jobId: row._id,
    campaignId: row.campaignId,
    month,
    reservedMicrousd: policy.jobBudget,
    consumedMicrousd: 0,
    status: "reserved",
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  });
  await ctx.db.patch(row._id, {
    reservedMicrousd: policy.jobBudget,
    spentMicrousd: 0,
    spendStatus: "reserved",
  });
}

export async function settleDiscovery(
  ctx: MutationCtx,
  row: Doc<"jobs">,
  uncertain = false,
) {
  if (row.mode !== "discovery") return;
  const ledger = await ctx.db
    .query("discoverySpend")
    .withIndex("by_jobId", (q) => q.eq("jobId", row._id))
    .unique();
  if (!ledger || ledger.status !== "reserved") return;
  const unknown = uncertain || row.spendStatus === "uncertain";
  const consumed = unknown
    ? ledger.reservedMicrousd
    : Math.min(ledger.reservedMicrousd, row.spentMicrousd ?? 0);
  const unused = ledger.reservedMicrousd - consumed;
  for (const scope of ["global", row.orgId]) {
    const usage = await ctx.db
      .query("discoveryUsage")
      .withIndex("by_scope_and_month", (q) =>
        q.eq("scope", scope).eq("month", ledger.month),
      )
      .unique();
    if (usage && unused)
      await ctx.db.patch(usage._id, {
        committedMicrousd: Math.max(0, usage.committedMicrousd - unused),
      });
  }
  const status = unknown ? ("uncertain" as const) : ("settled" as const);
  await ctx.db.patch(ledger._id, {
    consumedMicrousd: consumed,
    status,
    updatedAt: Date.now(),
  });
  await ctx.db.patch(row._id, { spentMicrousd: consumed, spendStatus: status });
}
