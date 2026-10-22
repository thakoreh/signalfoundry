/** Internal manual lifecycle only. No network, jobs, automatic approval or sending. */
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internalAdminMutation } from "./lib/auth";
import { appError } from "./lib/errors";
import { text } from "./lib/validation";
import * as p from "./lib/outreachLedgerPolicy";
import {
  activityFromHistory,
  emptyActivity,
  life,
  localDay,
  weekdayGap,
} from "./lib/outreachLifecyclePolicy";
import * as s from "./lib/outreachLedgerStore";
import * as validators from "./lib/outreachLedgerValidators";

async function event(
  ctx: MutationCtx,
  row: Doc<"outreachThreads">,
  input: Omit<
    Doc<"outreachEvents">,
    "_id" | "_creationTime" | "orgId" | "threadId" | "at" | "source"
  >,
) {
  if ((row.eventCount ?? 0) >= 200)
    throw appError("RATE_LIMITED", "Planning history allowance reached");
  await ctx.db.insert("outreachEvents", {
    ...input,
    orgId: row.orgId,
    threadId: row._id,
    at: Date.now(),
    source: "user_reported",
  });
  return (row.eventCount ?? 0) + 1;
}
const messageArgs = { subject: v.string(), body: v.string() };
const message = (args: { subject: string; body: string }) => ({
  subject: p.line(args.subject, "Subject", 160),
  body: text(args.body, "Message", 6000),
});

export const preflightManualAction = internalAdminMutation({
  args: {
    ...s.scope,
    threadId: v.id("outreachThreads"),
    expectedRevision: v.number(),
    approvalId: v.id("outreachApprovals"),
  },
  returns: validators.approval,
  handler: async (ctx, args) => {
    s.gate(ctx.principal, args);
    // A read-only transaction, deliberately uncached. No sent/request/event row.
    const current = await s.view(
      ctx,
      await s.requireThread(ctx, ctx.principal.orgId, args.threadId),
    );
    if (
      !current.readyForManualAction ||
      current.thread.revision !== args.expectedRevision ||
      current.approval?._id !== args.approvalId
    )
      throw appError(
        "CONFLICT",
        "The exact approval or its time window is no longer current",
      );
    return current.approval!;
  },
});

export const refer = internalAdminMutation({
  args: {
    ...s.revision,
    recipient: v.string(),
    contactName: v.string(),
    referrerName: v.string(),
    referrerMessageId: v.id("outreachMessages"),
  },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await s.revise(
      ctx,
      ctx.principal,
      args,
      "refer",
      args,
    );
    if (admission.old)
      return s.view(
        ctx,
        await s.requireThread(ctx, row.orgId, admission.old.threadIds[0]),
      );
    const parent = await s.view(ctx, row);
    if (
      parent.suppressed ||
      row.replyState !== "referral" ||
      row.latestInboundId !== args.referrerMessageId
    )
      throw appError(
        "CONFLICT",
        "Review the current referral reply; suppression cannot be removed by a referral",
      );
    const received = parent.messages.find(
      (m) => m._id === args.referrerMessageId,
    );
    if (!received || received.direction !== "inbound")
      throw appError(
        "CONFLICT",
        "A referral needs its actual received message",
      );
    const recipient = p.email(args.recipient),
      contactName = p.line(args.contactName, "Contact name", 160, true),
      referrerName = p.line(args.referrerName, "Referrer name", 160);
    if (recipient.toLowerCase() === row.recipient.toLowerCase())
      throw appError(
        "VALIDATION_ERROR",
        "Use a different referred contact; preserve original history",
      );
    if (await s.stop(ctx, row.orgId, `email:${recipient.toLowerCase()}`))
      throw appError(
        "CONFLICT",
        "This referred address is suppressed or recorded as bounced",
      );
    const sameCompany = await ctx.db
      .query("outreachThreads")
      .withIndex("by_orgId_and_companyKey", (q) =>
        q.eq("orgId", row.orgId).eq("companyKey", row.companyKey),
      )
      .take(101);
    if (
      sameCompany.some(
        (t) => t.recipient.toLowerCase() === recipient.toLowerCase(),
      )
    )
      throw appError(
        "CONFLICT",
        "Reopen the existing company contact instead of duplicating it",
      );
    if (admission.limits.threadCount >= 100 || sameCompany.length > 100)
      throw appError("RATE_LIMITED", "Conversation allowance reached");
    const safety = await s.company(ctx, row);
    const id = await ctx.db.insert("outreachThreads", {
      orgId: row.orgId,
      searchId: row.searchId,
      accountId: `referral_${args.idempotencyKey}`,
      companyKey: row.companyKey,
      companyName: row.companyName,
      recipient,
      recipientName: contactName,
      recipientStatus: "user_entered",
      subject: "",
      body: "",
      contactBasis: null,
      paused: Boolean(safety.coldOwnerId),
      companyReviewVersion: safety.reviewVersion,
      revision: 1,
      approvalId: null,
      latestInboundId: null,
      replyState: "awaiting_review",
      coldFollowupsStopped: false,
      revisitAt: null,
      revisitTimezone: null,
      messageCount: 0,
      createdBy: ctx.principal.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycle: life({ latestInboundId: null }),
      activity: emptyActivity(),
      eventCount: 0,
      bookingLink: "",
      sourceFacts: row.sourceFacts ?? [],
      ...(row.sourceIsDemo !== undefined
        ? { sourceIsDemo: row.sourceIsDemo }
        : {}),
      referral: { threadId: row._id, messageId: received._id, referrerName },
      completedReferralIds: [],
    });
    await s.save(ctx, row, {
      approvalId: null,
      completedReferralIds: [
        ...new Set([...(row.completedReferralIds ?? []), received._id]),
      ],
    });
    await ctx.db.patch(admission.limits._id, {
      threadCount: admission.limits.threadCount + 1,
    });
    await s.record(ctx, row.orgId, args.idempotencyKey, admission, [id]);
    return s.view(ctx, await s.requireThread(ctx, row.orgId, id));
  },
});
export const planFollowup = internalAdminMutation({
  args: {
    ...s.revision,
    ...messageArgs,
    scheduledAt: v.string(),
    scheduledTimezone: v.string(),
  },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await s.revise(
      ctx,
      ctx.principal,
      args,
      "followup",
      args,
    );
    if (!admission.old) {
      const current = await s.view(ctx, row),
        a = activityFromHistory(current.messages),
        l = life(row);
      if (row.coldFollowupsStopped || a.hadInbound || l.meeting)
        throw appError(
          "CONFLICT",
          "A received reply or meeting permanently stops cold followups",
        );
      if (!a.outboundCount || a.coldFollowupsSent >= 2)
        throw appError(
          "CONFLICT",
          "At most two cold followups follow a reported initial send",
        );
      if (
        a.initialRecipient?.toLowerCase() !== row.recipient.toLowerCase() ||
        a.lastOutboundRecipient?.toLowerCase() !== row.recipient.toLowerCase()
      )
        throw appError(
          "CONFLICT",
          "Keep the original recipient for the cold sequence",
        );
      if (
        current.suppressed ||
        current.invalidRecipient ||
        row.paused ||
        current.companyPaused
      )
        throw appError(
          "CONFLICT",
          "Review the paused, invalid or suppressed contact before planning",
        );
      const at = p.zonedInstant(args.scheduledAt, args.scheduledTimezone);
      if (
        at <= Date.now() ||
        at <= a.lastOutboundAt! ||
        weekdayGap(a.lastOutboundAt!, at, args.scheduledTimezone) < 3 ||
        [0, 6].includes(
          new Date(localDay(at, args.scheduledTimezone)).getUTCDay(),
        )
      )
        throw appError(
          "VALIDATION_ERROR",
          "Choose a future weekday at least three business weekdays after the last reported send",
        );
      const eventCount = await event(ctx, row, {
        kind: "followup_planned",
        scheduledAt: at,
        timezone: args.scheduledTimezone,
        meetingVersion: null,
        meetingState: null,
        saleState: null,
        reportedBy: ctx.principal.userId,
      });
      await s.save(ctx, row, {
        ...message(args),
        bookingLink: "",
        approvalId: null,
        eventCount,
        lifecycle: {
          ...l,
          purpose: "cold_followup",
          dueAt: at,
          dueTimezone: args.scheduledTimezone,
        },
      });
      await s.record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return s.view(ctx, await s.requireThread(ctx, row.orgId, row._id));
  },
});
export const reportMeeting = internalAdminMutation({
  args: { ...s.revision, meetingAt: v.string(), meetingTimezone: v.string() },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await s.revise(
      ctx,
      ctx.principal,
      args,
      "meeting",
      args,
    );
    if (!admission.old) {
      const recipient = p.email(row.recipient),
        l = life(row);
      if (
        l.meeting &&
        l.meeting.recipient.toLowerCase() !== recipient.toLowerCase()
      )
        throw appError(
          "CONFLICT",
          "A booking stays with its original recipient; use a separate contact thread",
        );
      const at = p.zonedInstant(args.meetingAt, args.meetingTimezone);
      const version =
        l.meeting?.at === at
          ? l.meeting.version
          : (l.meeting?.version ?? 0) + 1;
      const safety = await s.company(ctx, row);
      const eventCount = await event(ctx, row, {
        kind: "meeting_reported",
        scheduledAt: at,
        timezone: args.meetingTimezone,
        meetingVersion: version,
        meetingState: "booked_reported",
        saleState: null,
        reportedBy: ctx.principal.userId,
      });
      await ctx.db.patch(safety._id, {
        reviewVersion: safety.reviewVersion + 1,
        coldOwnerId: undefined,
      });
      await s.save(ctx, row, {
        approvalId: null,
        coldFollowupsStopped: true,
        companyReviewVersion: safety.reviewVersion + 1,
        eventCount,
        lifecycle: {
          ...l,
          dueAt: null,
          dueTimezone: null,
          purpose: row.latestInboundId ? "answer" : "initial",
          meeting: {
            at,
            timezone: args.meetingTimezone,
            version,
            recipient,
            state: "booked_reported",
          },
        },
      });
      await s.record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return s.view(ctx, await s.requireThread(ctx, row.orgId, row._id));
  },
});
export const prepareConfirmation = internalAdminMutation({
  args: { ...s.revision, ...messageArgs },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await s.revise(
      ctx,
      ctx.principal,
      args,
      "confirmation",
      args,
    );
    if (!admission.old) {
      const l = life(row),
        a = activityFromHistory(await s.history(ctx, row));
      if (
        !l.meeting ||
        l.meeting.state !== "booked_reported" ||
        l.meeting.at <= Date.now()
      )
        throw appError(
          "CONFLICT",
          "Report a future timed booking before preparing its confirmation",
        );
      if (l.meeting.recipient.toLowerCase() !== row.recipient.toLowerCase())
        throw appError("CONFLICT", "This booking belongs to another recipient");
      if (a.confirmedMeetingVersions.includes(l.meeting.version))
        throw appError(
          "CONFLICT",
          "A confirmation was already recorded for this meeting version",
        );
      await s.save(ctx, row, {
        ...message(args),
        bookingLink: "",
        approvalId: null,
        lifecycle: {
          ...l,
          purpose: "meeting_confirmation",
          dueAt: null,
          dueTimezone: null,
        },
      });
      await s.record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return s.view(ctx, await s.requireThread(ctx, row.orgId, row._id));
  },
});
export const reportOutcomes = internalAdminMutation({
  args: {
    ...s.revision,
    meetingState: validators.meetingState,
    saleState: validators.saleState,
  },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await s.revise(
      ctx,
      ctx.principal,
      args,
      "outcome",
      args,
    );
    if (!admission.old) {
      const l = life(row);
      if (args.meetingState !== "not_recorded" && !l.meeting)
        throw appError("CONFLICT", "Report a timed meeting before its outcome");
      if (
        ["attended_reported", "no_show_reported"].includes(args.meetingState) &&
        (!l.meeting ||
          ![
            "booked_reported",
            "attended_reported",
            "no_show_reported",
          ].includes(l.meeting.state) ||
          l.meeting.at > Date.now())
      )
        throw appError(
          "CONFLICT",
          "Wait until a reported booked meeting time has passed",
        );
      const eventCount = await event(ctx, row, {
        kind: "outcome_reported",
        scheduledAt: l.meeting?.at ?? null,
        timezone: l.meeting?.timezone ?? null,
        meetingVersion: l.meeting?.version ?? null,
        meetingState: args.meetingState,
        saleState: args.saleState,
        reportedBy: ctx.principal.userId,
      });
      const safety = await s.company(ctx, row);
      if (args.meetingState !== "not_recorded")
        await ctx.db.patch(safety._id, {
          reviewVersion: safety.reviewVersion + 1,
          coldOwnerId: undefined,
        });
      await s.save(ctx, row, {
        approvalId: null,
        eventCount,
        ...(args.meetingState !== "not_recorded"
          ? {
              coldFollowupsStopped: true,
              companyReviewVersion: safety.reviewVersion + 1,
            }
          : {}),
        lifecycle: {
          ...l,
          dueAt: null,
          dueTimezone: null,
          purpose: row.latestInboundId ? "answer" : "initial",
          meeting: l.meeting
            ? { ...l.meeting, state: args.meetingState }
            : null,
          sale: args.saleState,
        },
      });
      await s.record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return s.view(ctx, await s.requireThread(ctx, row.orgId, row._id));
  },
});
