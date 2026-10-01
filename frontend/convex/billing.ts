import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { tenantQuery } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  billingConfigured,
  billingPolicy,
  isEntitled,
} from "./lib/billingPolicy";

const kind = v.union(v.literal("checkout"), v.literal("portal"));
const snapshotFields = {
  orgId: v.string(),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  status: v.string(),
  priceId: v.optional(v.string()),
  currentPeriodEnd: v.optional(v.number()),
  cancelAtPeriodEnd: v.boolean(),
  updatedAt: v.number(),
  lastEventCreated: v.optional(v.number()),
  lastEventId: v.optional(v.string()),
};
const snapshot = v.object(snapshotFields);

export const status = tenantQuery({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    status: v.string(),
    entitled: v.boolean(),
    current_period_end: v.union(v.number(), v.null()),
    cancel_at_period_end: v.boolean(),
    can_manage: v.boolean(),
    monthly_research_limit: v.union(v.number(), v.null()),
    domains_per_campaign_limit: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("billingAccounts")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .unique();
    const policy = billingPolicy();
    const configured = billingConfigured();
    return {
      configured,
      status: configured ? (row?.status ?? "none") : "unconfigured",
      entitled: configured && isEntitled(row, policy),
      current_period_end: row?.currentPeriodEnd ?? null,
      cancel_at_period_end: row?.cancelAtPeriodEnd ?? false,
      can_manage: ctx.principal.role === "org:admin",
      monthly_research_limit: policy?.monthlyResearchLimit ?? null,
      domains_per_campaign_limit: policy?.domainsPerCampaignLimit ?? null,
    };
  },
});

export const forOrg = internalQuery({
  args: { orgId: v.string() },
  returns: v.union(snapshot, v.null()),
  handler: async (ctx, { orgId }) => {
    const row = await ctx.db
      .query("billingAccounts")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .unique();
    if (!row) return null;
    const { _id, _creationTime, ...data } = row;
    void _id;
    void _creationTime;
    return data;
  },
});

export const forCustomer = internalQuery({
  args: { customerId: v.string() },
  returns: v.union(snapshot, v.null()),
  handler: async (ctx, { customerId }) => {
    const row = await ctx.db
      .query("billingAccounts")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", customerId),
      )
      .unique();
    if (!row) return null;
    const { _id, _creationTime, ...data } = row;
    void _id;
    void _creationTime;
    return data;
  },
});

export const setCustomer = internalMutation({
  args: { orgId: v.string(), customerId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query("billingAccounts")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.customerId),
      )
      .unique();
    if (existingCustomer && existingCustomer.orgId !== args.orgId)
      throw appError("CONFLICT", "Billing customer conflict");
    const row = await ctx.db
      .query("billingAccounts")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .unique();
    if (row?.stripeCustomerId && row.stripeCustomerId !== args.customerId)
      throw appError("CONFLICT", "Billing customer conflict");
    if (row)
      await ctx.db.patch(row._id, {
        stripeCustomerId: args.customerId,
        updatedAt: Date.now(),
      });
    else
      await ctx.db.insert("billingAccounts", {
        orgId: args.orgId,
        stripeCustomerId: args.customerId,
        status: "none",
        cancelAtPeriodEnd: false,
        updatedAt: Date.now(),
      });
    return null;
  },
});

export const reserveOperation = internalMutation({
  args: { orgId: v.string(), kind, requestId: v.string() },
  returns: v.object({
    id: v.id("billingOperations"),
    url: v.union(v.string(), v.null()),
    requestId: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(args.requestId))
      throw appError(
        "VALIDATION_ERROR",
        "A valid request identifier is required",
      );
    const now = Date.now();
    const existing = await ctx.db
      .query("billingOperations")
      .withIndex("by_orgId_and_kind_and_requestId", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("kind", args.kind)
          .eq("requestId", args.requestId),
      )
      .unique();
    if (existing) {
      if (
        existing.createdAt < now - 23 * 60 * 60 * 1000 ||
        (existing.expiresAt && existing.expiresAt <= now)
      )
        throw appError(
          "CONFLICT",
          "This billing link expired. Start a new request",
        );
      return {
        id: existing._id,
        url: existing.sessionUrl ?? null,
        requestId: existing.requestId,
        expiresAt:
          existing.expiresAt ?? existing.createdAt + 23 * 60 * 60 * 1000,
      };
    }
    const recent = await ctx.db
      .query("billingOperations")
      .withIndex("by_orgId_and_kind", (q) =>
        q.eq("orgId", args.orgId).eq("kind", args.kind),
      )
      .order("desc")
      .take(5);
    // Reuse one open checkout across double-clicks/tabs, not merely a repeated request ID.
    const pending = recent[0];
    if (
      args.kind === "checkout" &&
      pending &&
      (pending.expiresAt ?? pending.createdAt + 23 * 60 * 60 * 1000) > now
    )
      return {
        id: pending._id,
        url: pending.sessionUrl ?? null,
        requestId: pending.requestId,
        expiresAt: pending.expiresAt ?? pending.createdAt + 23 * 60 * 60 * 1000,
      };
    if (recent.length === 5 && recent[4].createdAt > now - 60 * 60 * 1000)
      throw appError(
        "RATE_LIMITED",
        "Billing request limit reached. Try again later",
      );
    const expiresAt =
      now + (args.kind === "checkout" ? 23 * 60 * 60 * 1000 : 5 * 60 * 1000);
    const id = await ctx.db.insert("billingOperations", {
      ...args,
      createdAt: now,
      expiresAt,
    });
    return { id, url: null, requestId: args.requestId, expiresAt };
  },
});

export const completeOperation = internalMutation({
  args: {
    id: v.id("billingOperations"),
    url: v.string(),
    expiresAt: v.number(),
    stripeSessionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      sessionUrl: args.url,
      expiresAt: args.expiresAt,
      ...(args.stripeSessionId
        ? { stripeSessionId: args.stripeSessionId }
        : {}),
    });
    return null;
  },
});

export const applySubscription = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    created: v.number(),
    customerId: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  returns: v.union(
    v.literal("applied"),
    v.literal("duplicate"),
    v.literal("ignored"),
  ),
  handler: async (ctx, args) => {
    if (
      await ctx.db
        .query("stripeEvents")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .unique()
    )
      return "duplicate" as const;
    const row = await ctx.db
      .query("billingAccounts")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.customerId),
      )
      .unique();
    await ctx.db.insert("stripeEvents", {
      eventId: args.eventId,
      type: args.type,
      created: args.created,
      processedAt: Date.now(),
    });
    if (!row || (row.lastEventCreated ?? -1) > args.created)
      return "ignored" as const;
    // A second checkout must never replace an existing active subscription's entitlement.
    if (
      row.stripeSubscriptionId &&
      row.stripeSubscriptionId !== args.subscriptionId &&
      row.status === "active" &&
      (row.currentPeriodEnd ?? 0) > Date.now()
    )
      return "ignored" as const;
    // Same-second Stripe events have no reliable order. Never let a delayed
    // entitled snapshot override a non-entitled snapshot for that subscription.
    const policy = billingPolicy();
    const restoresAccess = policy
      ? !isEntitled(row, policy) && isEntitled(args, policy)
      : row.status !== "active" && args.status === "active";
    if (
      row.lastEventCreated === args.created &&
      row.stripeSubscriptionId === args.subscriptionId &&
      restoresAccess
    )
      return "ignored" as const;
    await ctx.db.patch(row._id, {
      stripeSubscriptionId: args.subscriptionId,
      status: args.status,
      priceId: args.priceId,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      lastEventCreated: args.created,
      lastEventId: args.eventId,
      updatedAt: Date.now(),
    });
    return "applied" as const;
  },
});

export const latestCheckout = internalQuery({
  args: { orgId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("billingOperations"),
      stripeSessionId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { orgId }) => {
    const row = await ctx.db
      .query("billingOperations")
      .withIndex("by_orgId_and_kind", (q) =>
        q.eq("orgId", orgId).eq("kind", "checkout"),
      )
      .order("desc")
      .first();
    return row
      ? { id: row._id, stripeSessionId: row.stripeSessionId ?? null }
      : null;
  },
});
export const eventProcessed = internalQuery({
  args: { eventId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { eventId }) =>
    !!(await ctx.db
      .query("stripeEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .unique()),
});

export const closeCheckout = internalMutation({
  args: { id: v.id("billingOperations") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row?.kind !== "checkout")
      throw appError("CONFLICT", "Invalid checkout operation");
    await ctx.db.patch(id, { expiresAt: 0, sessionUrl: undefined });
    return null;
  },
});

export const admitAttempt = internalMutation({
  args: { orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, { orgId }) => {
    const now = Date.now();
    const row = await ctx.db
      .query("billingThrottle")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .unique();
    const current = row && row.windowStart > now - 60_000;
    const attempts = current ? row.attempts : 0;
    if (attempts >= 10)
      throw appError(
        "RATE_LIMITED",
        "Billing attempt limit reached. Wait one minute before retrying",
      );
    if (row)
      await ctx.db.patch(row._id, {
        windowStart: current ? row.windowStart : now,
        attempts: attempts + 1,
      });
    else
      await ctx.db.insert("billingThrottle", {
        orgId,
        windowStart: now,
        attempts: 1,
      });
    return null;
  },
});
