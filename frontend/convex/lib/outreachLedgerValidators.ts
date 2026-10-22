import { v } from "convex/values";

export const replyState = v.union(
  v.literal("awaiting_review"),
  v.literal("interested"),
  v.literal("question"),
  v.literal("not_now"),
  v.literal("not_interested"),
  v.literal("opt_out"),
  v.literal("uncertain"),
  v.literal("referral"),
  v.literal("source_question"),
  v.literal("auto_reply"),
  v.literal("bounce"),
);
export const contactBasis = v.object({
  version: v.literal(1),
  published_email: v.string(),
  source_url: v.string(),
  captured_at: v.string(),
  publisher_attribution: v.union(
    v.literal("recipient"),
    v.literal("caused_by_recipient"),
    v.literal("third_party"),
    v.literal("unknown"),
  ),
  notice_status: v.union(
    v.literal("clear"),
    v.literal("prohibits"),
    v.literal("unknown"),
  ),
  recipient_role: v.string(),
  message_relevance: v.string(),
  recipient_country: v.union(
    v.literal("US"),
    v.literal("CA"),
    v.literal("unknown"),
    v.literal("other"),
  ),
  recipient_timezone: v.union(v.string(), v.null()),
  basis_type: v.literal("conspicuous_publication"),
});
export const purpose = v.union(
  v.literal("initial"),
  v.literal("answer"),
  v.literal("cold_followup"),
  v.literal("meeting_confirmation"),
);
export const meetingState = v.union(
  v.literal("not_recorded"),
  v.literal("booked_reported"),
  v.literal("attended_reported"),
  v.literal("no_show_reported"),
  v.literal("cancelled_reported"),
);
export const saleState = v.union(
  v.literal("not_recorded"),
  v.literal("won_reported"),
  v.literal("lost_reported"),
);
export const lifecycle = v.object({
  purpose,
  dueAt: v.union(v.number(), v.null()),
  dueTimezone: v.union(v.string(), v.null()),
  meeting: v.union(
    v.object({
      at: v.number(),
      timezone: v.string(),
      version: v.number(),
      recipient: v.string(),
      state: meetingState,
    }),
    v.null(),
  ),
  sale: saleState,
});
export const activity = v.object({
  outboundCount: v.number(),
  coldFollowupsSent: v.number(),
  hadInbound: v.boolean(),
  initialRecipient: v.union(v.string(), v.null()),
  lastOutboundAt: v.union(v.number(), v.null()),
  lastOutboundRecipient: v.union(v.string(), v.null()),
  lastInboundRecipient: v.union(v.string(), v.null()),
  answeredInboundId: v.union(v.id("outreachMessages"), v.null()),
  confirmedMeetingVersions: v.array(v.number()),
});
export const sourceFact = v.object({
  id: v.string(),
  excerpt: v.string(),
  url: v.string(),
  retrievedAt: v.string(),
});
export const threadFields = {
  orgId: v.string(),
  searchId: v.id("customerSearches"),
  accountId: v.string(),
  companyKey: v.string(),
  companyName: v.string(),
  recipient: v.string(),
  recipientName: v.string(),
  recipientStatus: v.union(
    v.literal("missing"),
    v.literal("published_unverified"),
    v.literal("user_entered"),
  ),
  subject: v.string(),
  body: v.string(),
  contactBasis: v.union(contactBasis, v.null()),
  paused: v.boolean(),
  companyReviewVersion: v.number(),
  revision: v.number(),
  approvalId: v.union(v.id("outreachApprovals"), v.null()),
  latestInboundId: v.union(v.id("outreachMessages"), v.null()),
  replyState,
  coldFollowupsStopped: v.boolean(),
  revisitAt: v.union(v.number(), v.null()),
  revisitTimezone: v.union(v.string(), v.null()),
  messageCount: v.number(),
  createdBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  // Optional expansion for existing foundation rows. No historical snapshots change.
  lifecycle: v.optional(lifecycle),
  activity: v.optional(activity),
  eventCount: v.optional(v.number()),
  bookingLink: v.optional(v.string()),
  sourceFacts: v.optional(v.array(sourceFact)),
  sourceIsDemo: v.optional(v.boolean()),
  referral: v.optional(
    v.object({
      threadId: v.id("outreachThreads"),
      messageId: v.id("outreachMessages"),
      referrerName: v.string(),
    }),
  ),
  completedReferralIds: v.optional(v.array(v.id("outreachMessages"))),
};
export const thread = v.object({
  _id: v.id("outreachThreads"),
  _creationTime: v.number(),
  ...threadFields,
});
export const approvalFields = {
  orgId: v.string(),
  threadId: v.id("outreachThreads"),
  recipient: v.string(),
  subject: v.string(),
  body: v.string(),
  basis: contactBasis,
  binding: v.string(),
  profileVersion: v.number(),
  companyVersion: v.number(),
  approvedBy: v.string(),
  approvedAt: v.number(),
  lifecycleSnapshot: v.optional(lifecycle),
  bookingLink: v.optional(v.string()),
};
export const approval = v.object({
  _id: v.id("outreachApprovals"),
  _creationTime: v.number(),
  ...approvalFields,
});
export const messageFields = {
  orgId: v.string(),
  threadId: v.id("outreachThreads"),
  direction: v.union(v.literal("inbound"), v.literal("outbound")),
  recipient: v.string(),
  subject: v.string(),
  body: v.string(),
  approvalId: v.union(v.id("outreachApprovals"), v.null()),
  sentAs: v.union(v.literal("approved"), v.literal("with_changes"), v.null()),
  // This is the original manual classification, never rewritten as a provider fact.
  reportedReplyState: v.union(replyState, v.null()),
  source: v.literal("user_reported"),
  reportedBy: v.string(),
  createdAt: v.number(),
  purpose: v.optional(purpose),
  scheduledAt: v.optional(v.union(v.number(), v.null())),
  scheduledTimezone: v.optional(v.union(v.string(), v.null())),
  meetingVersion: v.optional(v.union(v.number(), v.null())),
};
export const eventFields = {
  orgId: v.string(),
  threadId: v.id("outreachThreads"),
  kind: v.union(
    v.literal("followup_planned"),
    v.literal("meeting_reported"),
    v.literal("outcome_reported"),
  ),
  at: v.number(),
  reportedBy: v.string(),
  source: v.literal("user_reported"),
  scheduledAt: v.union(v.number(), v.null()),
  timezone: v.union(v.string(), v.null()),
  meetingVersion: v.union(v.number(), v.null()),
  meetingState: v.union(meetingState, v.null()),
  saleState: v.union(saleState, v.null()),
};
export const event = v.object({
  _id: v.id("outreachEvents"),
  _creationTime: v.number(),
  ...eventFields,
});
export const message = v.object({
  _id: v.id("outreachMessages"),
  _creationTime: v.number(),
  ...messageFields,
});
export const view = v.object({
  thread,
  messages: v.array(message),
  approval: v.union(approval, v.null()),
  senderFooter: v.string(),
  blockedReason: v.union(v.string(), v.null()),
  readyForManualAction: v.boolean(),
  companyPaused: v.boolean(),
  suppressed: v.boolean(),
  invalidRecipient: v.boolean(),
  reviewDue: v.boolean(),
  events: v.array(event),
});
