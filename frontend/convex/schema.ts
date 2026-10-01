import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accountData,
  campaignFields,
  jobStatus,
  mode,
  profile,
} from "./validators";

export default defineSchema({
  billingThrottle: defineTable({
    orgId: v.string(),
    windowStart: v.number(),
    attempts: v.number(),
  }).index("by_orgId", ["orgId"]),
  workspaces: defineTable({
    orgId: v.string(),
    name: v.string(),
    website: v.union(v.string(), v.null()),
    profile: v.union(profile, v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    profileVersion: v.number(),
    activeJobs: v.number(),
    researchWindowStart: v.number(),
    researchWindowCount: v.number(),
    analysisWindowStart: v.number(),
    analysisWindowCount: v.number(),
    analysisLeaseUntil: v.number(),
  }).index("by_orgId", ["orgId"]),
  campaigns: defineTable({
    orgId: v.string(),
    createdBy: v.string(),
    ...campaignFields,
    activeJobId: v.optional(v.id("jobs")),
  }).index("by_orgId", ["orgId"]),
  accounts: defineTable({
    orgId: v.string(),
    campaignId: v.id("campaigns"),
    jobId: v.id("jobs"),
    score: v.number(),
    data: accountData,
  })
    .index("by_orgId_and_campaignId_and_score", [
      "orgId",
      "campaignId",
      "score",
    ])
    .index("by_orgId_and_campaignId_and_domain", [
      "orgId",
      "campaignId",
      "data.domain",
    ]),
  jobs: defineTable({
    orgId: v.string(),
    campaignId: v.id("campaigns"),
    createdBy: v.string(),
    idempotencyKey: v.string(),
    status: jobStatus,
    attempt: v.number(),
    maxAttempts: v.number(),
    error: v.union(v.string(), v.null()),
    mode,
    domains: v.array(v.string()),
    profile,
    createdAt: v.number(),
    updatedAt: v.number(),
    leaseUntil: v.number(),
    scheduledId: v.optional(v.id("_scheduled_functions")),
    countedActive: v.boolean(),
  })
    .index("by_orgId_and_idempotencyKey", ["orgId", "idempotencyKey"])
    .index("by_orgId_and_campaignId", ["orgId", "campaignId"]),
  usage: defineTable({
    orgId: v.string(),
    month: v.string(),
    researchStarts: v.number(),
  }).index("by_orgId_and_month", ["orgId", "month"]),
  systemLimits: defineTable({ key: v.string(), activeJobs: v.number() }).index(
    "by_key",
    ["key"],
  ),
  billingAccounts: defineTable({
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
  })
    .index("by_orgId", ["orgId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),
  stripeEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    created: v.number(),
    processedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
  billingOperations: defineTable({
    orgId: v.string(),
    kind: v.union(v.literal("checkout"), v.literal("portal")),
    requestId: v.string(),
    createdAt: v.number(),
    sessionUrl: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_orgId_and_kind", ["orgId", "kind"])
    .index("by_orgId_and_kind_and_requestId", ["orgId", "kind", "requestId"]),
});
