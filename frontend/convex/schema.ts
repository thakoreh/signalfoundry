import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { threadFields, approvalFields, messageFields } from "./lib/outreachLedgerValidators";
import {
  accountData,
  campaignFields,
  jobStatus,
  mode,
  profile,
  workerAccount,
  customerDraft,
} from "./validators";

export default defineSchema({
  // Additive, internal-only manual ledger prerequisites. No mailbox or AI calls.
  outreachLedgers: defineTable({
    orgId: v.string(), requestCount: v.number(), threadCount: v.number(),
  }).index("by_orgId", ["orgId"]),
  outreachThreads: defineTable(threadFields)
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_searchId_and_accountId", ["orgId", "searchId", "accountId"])
    .index("by_orgId_and_companyKey", ["orgId", "companyKey"]),
  outreachCompanies: defineTable({
    orgId: v.string(), companyKey: v.string(), reviewVersion: v.number(),
    coldOwnerId: v.optional(v.id("outreachThreads")),
  }).index("by_orgId_and_companyKey", ["orgId", "companyKey"]),
  outreachApprovals: defineTable(approvalFields)
    .index("by_orgId_and_threadId", ["orgId", "threadId"]),
  outreachMessages: defineTable(messageFields)
    .index("by_orgId_and_threadId", ["orgId", "threadId"]),
  outreachSuppressions: defineTable({
    orgId: v.string(), target: v.string(),
    reason: v.union(v.literal("opt_out"), v.literal("source_question"), v.literal("bounce")),
    threadId: v.id("outreachThreads"), createdAt: v.number(),
  }).index("by_orgId_and_target", ["orgId", "target"]),
  outreachRequests: defineTable({
    orgId: v.string(), requestKey: v.string(), fingerprint: v.string(),
    threadIds: v.array(v.id("outreachThreads")), createdAt: v.number(),
  }).index("by_orgId_and_requestKey", ["orgId", "requestKey"]),
  customerDrafts: defineTable({
    orgId: v.string(),
    requestKey: v.string(),
    cacheKey: v.string(),
    status: v.union(v.literal("pending"), v.literal("complete"), v.literal("failed")),
    draft: v.optional(customerDraft),
    charged: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_orgId_and_requestKey", ["orgId", "requestKey"])
    .index("by_orgId_and_cacheKey", ["orgId", "cacheKey"])
    .index("by_orgId_and_charged", ["orgId", "charged"])
    .index("by_orgId", ["orgId"]),
  customerSearches: defineTable({
    orgId: v.string(),
    createdBy: v.string(),
    requestKey: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("partial"),
      v.literal("failed"),
    ),
    stage: v.string(),
    query: v.string(),
    target: v.string(),
    geography: v.string(),
    limit: v.number(),
    profile,
    website: v.union(v.string(), v.null()),
    accounts: v.array(workerAccount),
    errors: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_requestKey", ["orgId", "requestKey"]),
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
    ])
    .index("by_orgId", ["orgId"]),
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
    .index("by_orgId_and_campaignId", ["orgId", "campaignId"])
    .index("by_orgId_and_mode", ["orgId", "mode"]),
  usage: defineTable({
    orgId: v.string(),
    month: v.string(),
    researchStarts: v.number(),
    draftStarts: v.optional(v.number()),
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
