import { appError } from "./errors";
import type { QueryCtx } from "../_generated/server";
import { dataVisible } from "./discoveryPolicy";
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
    enrich_contacts: row.enrich_contacts ?? false,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    account_count: row.account_count,
    qualified_count: row.qualified_count,
    domains: row.domains,
    errors: row.errors,
    ...(row.profile_snapshot ? { profile_snapshot: row.profile_snapshot } : {}),
    ...(row.offering_website !== undefined
      ? { offering_website: row.offering_website }
      : {}),
    ...(row.target_count !== undefined
      ? { target_count: row.target_count }
      : {}),
    ...(row.discovery_budget_used_microusd !== undefined
      ? { discovery_budget_used_microusd: row.discovery_budget_used_microusd }
      : {}),
  };
}
// Campaign selection is an independent data-use boundary, including legacy rows.
// Company search cannot supply named people; manual research retains only honest
// role suggestions with no person, email, or provider-derived personal data.
export function contactsForCampaign(
  contacts: Doc<"accounts">["data"]["contacts"],
  campaign: Pick<Doc<"campaigns">, "mode" | "enrich_contacts">,
): Doc<"accounts">["data"]["contacts"] {
  if (campaign.mode !== "discovery")
    return contacts
      .filter(
        (contact) =>
          !contact.provider && contact.name === null && contact.email === null,
      )
      .map((contact) => ({
        name: null,
        role: contact.role,
        email: null,
        verification_status: "not_available" as const,
        source_url: null,
        note: "Suggested role to research, not an identified person. No contact enrichment was requested.",
      }));
  if (campaign.enrich_contacts !== true) return [];
  return contacts.filter(
    (contact) =>
      contact.provider === "peopledatalabs" &&
      !!contact.license_reference &&
      !!contact.retrieved_at &&
      Number.isFinite(Date.parse(contact.retrieved_at)) &&
      dataVisible({
        source_provider: contact.provider,
        license_expires_at: contact.license_expires_at,
      }),
  );
}
export function accountResult(
  row: Doc<"accounts">,
  campaign: Pick<Doc<"campaigns">, "mode" | "enrich_contacts">,
) {
  if (!dataVisible(row.data))
    throw appError(
      "DATA_EXPIRED",
      "Licensed prospect data is unavailable or expired",
    );
  const contacts = contactsForCampaign(row.data.contacts, campaign);
  return { id: row._id, campaign_id: row.campaignId, ...row.data, contacts };
}
export function jobResult(row: Doc<"jobs">) {
  return {
    id: row._id,
    campaign_id: row.campaignId,
    status: row.status,
    ...(row.stage ? { stage: row.stage } : {}),
    ...(row.reservedMicrousd !== undefined
      ? { reserved_microusd: row.reservedMicrousd }
      : {}),
    ...(row.spentMicrousd !== undefined
      ? { spent_microusd: row.spentMicrousd }
      : {}),
    ...(row.spendStatus ? { spend_status: row.spendStatus } : {}),
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
