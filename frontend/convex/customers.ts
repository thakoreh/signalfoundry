import { v, type Infer } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { tenantAction, tenantQuery } from "./lib/auth";
import { requireWorkspace } from "./lib/records";
import { appError } from "./lib/errors";
import {
  billingConfigured,
  billingPolicy,
  isEntitled,
} from "./lib/billingPolicy";
import {
  normalizeWebsite,
  text,
  validateResearchResult,
} from "./lib/validation";
import { callWorker } from "./lib/worker";
import { profile, workerAccount } from "./validators";

const status = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("complete"),
  v.literal("partial"),
  v.literal("failed"),
);
const capability = v.object({
  provider: v.string(),
  status: v.union(
    v.literal("ready"),
    v.literal("unconfigured"),
    v.literal("unavailable"),
  ),
  detail: v.string(),
});
const engineResult = v.object({
  discovery: capability,
  contacts: capability,
  drafts: capability,
  max_results: v.number(),
});
type Engine = Infer<typeof engineResult>;
const result = v.object({
  id: v.id("customerSearches"),
  status,
  stage: v.string(),
  query: v.string(),
  accounts: v.array(workerAccount),
  errors: v.array(v.string()),
  created_at: v.string(),
  updated_at: v.string(),
});
type Result = Infer<typeof result>;
function output(row: Doc<"customerSearches">): Result {
  return {
    id: row._id,
    status: row.status,
    stage: row.stage,
    query: row.query,
    accounts: row.accounts,
    errors: row.errors,
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
  };
}
async function engineState(): Promise<Engine> {
  try {
    const raw = (await callWorker("/worker/customer-status", {})) as Record<
      string,
      unknown
    >;
    const parse = (
      name: "discovery" | "contacts" | "drafts",
      provider: string,
    ): Engine["discovery"] => {
      const item = raw?.[name] as Record<string, unknown> | undefined;
      const ready = item?.status === "ready";
      return {
        provider:
          name === "discovery" &&
          ["deepseek", "brave"].includes(String(item?.provider))
            ? String(item?.provider)
            : provider,
        status: ready ? "ready" : "unconfigured",
        detail: ready
          ? "Provider configured. Live availability is checked when searching."
          : name === "discovery"
            ? "Customer discovery has not been connected yet."
            : name === "drafts"
              ? "AI message drafting has not been connected yet."
              : "Contact lookup is not connected. Company research can still run.",
      };
    };
    return {
      discovery: parse("discovery", "deepseek"),
      contacts: parse("contacts", "hunter"),
      drafts: parse("drafts", "deepseek"),
      max_results: 5,
    };
  } catch {
    return {
      discovery: {
        provider: "deepseek",
        status: "unavailable",
        detail:
          "The research service is unavailable or has not been connected.",
      },
      contacts: {
        provider: "hunter",
        status: "unavailable",
        detail: "Contact lookup availability could not be checked.",
      },
      drafts: {
        provider: "deepseek",
        status: "unavailable",
        detail: "AI message drafting availability could not be checked.",
      },
      max_results: 5,
    };
  }
}
export const engine = tenantAction({
  args: {},
  returns: engineResult,
  handler: async () => engineState(),
});
export const start = tenantAction({
  args: {
    target: v.string(),
    geography: v.string(),
    limit: v.number(),
    idempotency_key: v.string(),
  },
  returns: result,
  handler: async (ctx, args): Promise<Result> => {
    if ((await engineState()).discovery.status !== "ready")
      throw appError(
        "CONFIGURATION_ERROR",
        "Customer discovery is not connected",
      );
    return await ctx.runMutation(internal.customers.reserve, {
      ...args,
      orgId: ctx.principal.orgId,
      userId: ctx.principal.userId,
    });
  },
});
export const get = tenantQuery({
  args: { id: v.id("customerSearches") },
  returns: result,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== ctx.principal.orgId)
      throw appError("NOT_FOUND", "Customer search not found");
    return output(row);
  },
});
export const reserve = internalMutation({
  args: {
    target: v.string(),
    geography: v.string(),
    limit: v.number(),
    idempotency_key: v.string(),
    orgId: v.string(),
    userId: v.string(),
  },
  returns: result,
  handler: async (ctx, args) => {
    const target = text(args.target, "Customer target", 200);
    const geography = args.geography.trim();
    if (
      target.length < 2 ||
      geography.length > 120 ||
      /[\u0000-\u001f]/u.test(geography) ||
      !Number.isInteger(args.limit) ||
      args.limit < 1 ||
      args.limit > 5 ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(args.idempotency_key)
    )
      throw appError("VALIDATION_ERROR", "Invalid customer search fields");
    const existing = await ctx.db
      .query("customerSearches")
      .withIndex("by_orgId_and_requestKey", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.idempotency_key),
      )
      .unique();
    if (existing) return output(existing);
    const workspace = await requireWorkspace(ctx, args.orgId);
    if (!workspace.profile)
      throw appError("VALIDATION_ERROR", "Save a business profile first");
    const policy = billingPolicy();
    const billing = await ctx.db
      .query("billingAccounts")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .unique();
    if (!billingConfigured() || !isEntitled(billing, policy) || !policy)
      throw appError(
        "BILLING_REQUIRED",
        "An active configured research subscription is required",
      );
    if (args.limit > policy.domainsPerCampaignLimit)
      throw appError(
        "QUOTA_EXCEEDED",
        "Result limit exceeds the configured plan",
      );
    const timestamp = Date.now();
    const recent = await ctx.db
      .query("customerSearches")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(6);
    if (
      recent.some(
        (row) =>
          ["queued", "running"].includes(row.status) &&
          row.createdAt > timestamp - 180_000,
      )
    )
      throw appError("CONFLICT", "A customer search is already running");
    if (
      recent.filter((row) => row.createdAt > timestamp - 3_600_000).length >= 5
    )
      throw appError("RATE_LIMITED", "Customer search allowance reached");
    const month = new Date(timestamp).toISOString().slice(0, 7);
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_orgId_and_month", (q) =>
        q.eq("orgId", args.orgId).eq("month", month),
      )
      .unique();
    if ((usage?.researchStarts || 0) >= policy.monthlyResearchLimit)
      throw appError("QUOTA_EXCEEDED", "Monthly research allowance reached");
    if (usage)
      await ctx.db.patch(usage._id, {
        researchStarts: usage.researchStarts + 1,
      });
    else
      await ctx.db.insert("usage", {
        orgId: args.orgId,
        month,
        researchStarts: 1,
      });
    const id = await ctx.db.insert("customerSearches", {
      orgId: args.orgId,
      createdBy: args.userId,
      requestKey: args.idempotency_key,
      status: "queued",
      stage: "Queued",
      query: target,
      target,
      geography,
      limit: args.limit,
      profile: workspace.profile,
      website: workspace.website,
      accounts: [],
      errors: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await ctx.scheduler.runAfter(0, internal.customers.execute, { id });
    await ctx.scheduler.runAfter(180_000, internal.customers.recover, { id });
    return output((await ctx.db.get(id))!);
  },
});
const snapshot = v.object({
  search_id: v.id("customerSearches"),
  profile,
  website: v.union(v.string(), v.null()),
  target: v.string(),
  geography: v.string(),
  limit: v.number(),
});
export const claim = internalMutation({
  args: { id: v.id("customerSearches") },
  returns: v.union(snapshot, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "queued") return null;
    await ctx.db.patch(row._id, {
      status: "running",
      stage: "Finding businesses and checking public facts",
      updatedAt: Date.now(),
    });
    return {
      search_id: row._id,
      profile: row.profile,
      website: row.website,
      target: row.target,
      geography: row.geography,
      limit: row.limit,
    };
  },
});
export const finish = internalMutation({
  args: {
    id: v.id("customerSearches"),
    accounts: v.array(workerAccount),
    errors: v.array(v.string()),
    query: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "running") return null;
    if (args.accounts.length > row.limit)
      throw appError("RESEARCH_FAILED", "Too many customer results");
    validateResearchResult(args.accounts, args.errors, row._id, "manual");
    const query = text(args.query, "Search query", 500);
    for (const account of args.accounts)
      for (const contact of account.contacts) {
        if (contact.source_url) normalizeWebsite(contact.source_url);
        if (
          contact.email &&
          !/^[^\s@,;<>]{1,64}@[A-Za-z0-9.-]{1,253}$/u.test(contact.email)
        )
          throw appError("RESEARCH_FAILED", "Invalid contact response");
        if (contact.verification_status === "verified" && !contact.email)
          throw appError(
            "RESEARCH_FAILED",
            "Verified contact is missing its address",
          );
      }
    await ctx.db.patch(row._id, {
      accounts: args.accounts,
      errors: args.errors,
      query,
      status: args.errors.length
        ? args.accounts.length
          ? "partial"
          : "failed"
        : "complete",
      stage: "Search finished",
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const fail = internalMutation({
  args: { id: v.id("customerSearches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row && ["queued", "running"].includes(row.status))
      await ctx.db.patch(row._id, {
        status: "failed",
        stage: "Search could not finish",
        errors: [
          "Customer research could not complete. Check provider configuration and allowance before starting a new search. No automatic retry was made.",
        ],
        updatedAt: Date.now(),
      });
    return null;
  },
});
export const recover = internalMutation({
  args: { id: v.id("customerSearches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row && ["queued", "running"].includes(row.status))
      await ctx.db.patch(row._id, {
        status: "failed",
        stage: "Search interrupted",
        errors: [
          "Search timed out or was interrupted. No automatic retry was made.",
        ],
        updatedAt: Date.now(),
      });
    return null;
  },
});
export const execute = internalAction({
  args: { id: v.id("customerSearches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.runMutation(internal.customers.claim, args);
    if (!request) return null;
    try {
      const raw = await callWorker("/worker/customers", request);
      if (
        !raw ||
        typeof raw !== "object" ||
        !("accounts" in raw) ||
        !("errors" in raw) ||
        !("query" in raw)
      )
        throw new Error("Invalid worker response");
      const data = raw as {
        accounts: Infer<typeof workerAccount>[];
        errors: string[];
        query: string;
      };
      await ctx.runMutation(internal.customers.finish, {
        id: args.id,
        ...data,
      });
    } catch {
      await ctx.runMutation(internal.customers.fail, args);
    }
    return null;
  },
});
