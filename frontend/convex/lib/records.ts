import { appError } from "./errors";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export const iso = (timestamp: number) => new Date(timestamp).toISOString();
export function workspaceResult(row: Doc<"workspaces">) {
  return {
    id: row._id,
    name: row.name,
    website: row.website,
    profile: row.profile,
    created_at: iso(row.createdAt),
  };
}
export function campaignResult(row: Doc<"campaigns">) {
  return {
    id: row._id,
    name: row.name,
    mode: row.mode,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    account_count: row.account_count,
    qualified_count: row.qualified_count,
    domains: row.domains,
    errors: row.errors,
  };
}
export function accountResult(row: Doc<"accounts">) {
  return { id: row._id, campaign_id: row.campaignId, ...row.data };
}
export function jobResult(row: Doc<"jobs">) {
  return {
    id: row._id,
    campaign_id: row.campaignId,
    status: row.status,
    attempt: row.attempt,
    max_attempts: row.maxAttempts,
    error: row.error,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}
export async function getWorkspace(ctx: Pick<QueryCtx, "db">, orgId: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .unique();
}
export async function requireWorkspace(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
) {
  const row = await getWorkspace(ctx, orgId);
  if (!row)
    throw appError(
      "WORKSPACE_REQUIRED",
      "An organization admin must initialize the workspace",
    );
  return row;
}
export async function requireCampaign(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  id: Id<"campaigns">,
) {
  const row = await ctx.db.get(id);
  if (!row || row.orgId !== orgId)
    throw appError("NOT_FOUND", "Campaign not found");
  return row;
}
export async function requireAccount(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  id: Id<"accounts">,
) {
  const row = await ctx.db.get(id);
  if (!row || row.orgId !== orgId)
    throw appError("NOT_FOUND", "Account not found");
  return row;
}
export async function requireJob(
  ctx: Pick<QueryCtx, "db">,
  orgId: string,
  id: Id<"jobs">,
) {
  const row = await ctx.db.get(id);
  if (!row || row.orgId !== orgId)
    throw appError("NOT_FOUND", "Research job not found");
  return row;
}
