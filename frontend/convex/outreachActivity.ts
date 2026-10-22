/** Read-only hosted return work and honest reported metrics. No scheduler or inbox. */
import { v } from "convex/values";
import { internalAdminMutation, internalTenantQuery } from "./lib/auth";
import { appError } from "./lib/errors";
import * as s from "./lib/outreachLedgerStore";
import * as p from "./lib/outreachLedgerPolicy";
import {
  activityFromHistory,
  life,
  qualifiedAccount,
} from "./lib/outreachLifecyclePolicy";

const args = { ...s.scope, clockBucket: v.number() };
const action = v.union(
  v.literal("review_history"),
  v.literal("review_reply"),
  v.literal("answer_reply"),
  v.literal("report_meeting"),
  v.literal("review_followup"),
  v.literal("manual_send"),
  v.literal("plan_followup"),
  v.literal("review_message"),
);
const item = v.object({
  threadId: v.id("outreachThreads"),
  searchId: v.id("customerSearches"),
  companyName: v.string(),
  recipient: v.string(),
  action,
  revision: v.number(),
  updatedAt: v.number(),
  dueAt: v.union(v.number(), v.null()),
});
export const nextUp = internalTenantQuery({
  args,
  returns: v.array(item),
  handler: async (ctx, input) => {
    s.gate(ctx.principal, input);
    s.checkClock(input.clockBucket);
    const rows = await ctx.db
      .query("outreachThreads")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .order("desc")
      .take(101);
    if (rows.length > 100)
      throw appError(
        "CONFLICT",
        "Conversation allowance exceeded; recovery required",
      );
    const tasks: Array<{
      priority: number;
      item: {
        threadId: (typeof rows)[number]["_id"];
        searchId: (typeof rows)[number]["searchId"];
        companyName: string;
        recipient: string;
        action:
          | "review_history"
          | "review_reply"
          | "answer_reply"
          | "report_meeting"
          | "review_followup"
          | "manual_send"
          | "plan_followup"
          | "review_message";
        revision: number;
        updatedAt: number;
        dueAt: number | null;
      };
    }> = [];
    const current = Date.now();
    for (const row of rows) {
      const base = {
        threadId: row._id,
        searchId: row.searchId,
        companyName: row.companyName,
        recipient: row.recipient,
        revision: row.revision,
        updatedAt: row.updatedAt,
        dueAt: null,
      };
      if (!row.activity) {
        tasks.push({
          priority: 0,
          item: { ...base, action: "review_history" },
        });
        continue;
      }
      const a = row.activity,
        l = life(row);
      const state = await s.context(ctx, row, a);
      const meetingDue =
        l.meeting?.state === "booked_reported" && l.meeting.at <= current;
      if (
        !meetingDue &&
        ["not_now", "auto_reply"].includes(row.replyState) &&
        row.revisitAt !== null &&
        row.revisitAt > current
      )
        continue;
      if (meetingDue)
        tasks.push({
          priority: 2,
          item: { ...base, action: "report_meeting", dueAt: l.meeting!.at },
        });
      else if (
        l.dueAt !== null &&
        l.dueAt <= current &&
        !a.hadInbound &&
        !row.coldFollowupsStopped &&
        !state.companyPaused &&
        !row.paused &&
        !state.suppressed &&
        !state.invalidRecipient
      )
        tasks.push({
          priority: 2,
          item: { ...base, action: "review_followup", dueAt: l.dueAt },
        });
      else if (
        row.latestInboundId &&
        row.replyState === "referral" &&
        row.completedReferralIds?.includes(row.latestInboundId)
      )
        continue;
      else if (
        row.latestInboundId &&
        ["not_interested", "opt_out", "source_question", "bounce"].includes(
          row.replyState,
        )
      )
        continue;
      else if (
        row.latestInboundId &&
        [
          "awaiting_review",
          "uncertain",
          "not_now",
          "auto_reply",
          "referral",
        ].includes(row.replyState)
      )
        tasks.push({
          priority: 0,
          item: { ...base, action: "review_reply", dueAt: row.revisitAt },
        });
      else if (
        row.latestInboundId &&
        ["interested", "question"].includes(row.replyState) &&
        !state.suppressed &&
        !state.invalidRecipient &&
        (!a.answeredInboundId ||
          a.answeredInboundId !== row.latestInboundId ||
          Boolean(row.body))
      )
        tasks.push({ priority: 1, item: { ...base, action: "answer_reply" } });
      else if (state.readyForManualAction)
        tasks.push({ priority: 3, item: { ...base, action: "manual_send" } });
      else if (
        a.outboundCount &&
        !a.hadInbound &&
        !row.coldFollowupsStopped &&
        !l.meeting &&
        !l.dueAt &&
        a.coldFollowupsSent < 2 &&
        !state.companyPaused &&
        !row.paused &&
        !state.suppressed &&
        !state.invalidRecipient
      )
        tasks.push({ priority: 4, item: { ...base, action: "plan_followup" } });
      else if (
        row.body &&
        !state.approval &&
        !l.dueAt &&
        !row.paused &&
        !state.companyPaused &&
        !state.suppressed &&
        !state.invalidRecipient
      )
        tasks.push({
          priority: 4,
          item: { ...base, action: "review_message" },
        });
    }
    return tasks
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          a.item.updatedAt - b.item.updatedAt ||
          a.item.threadId.localeCompare(b.item.threadId),
      )
      .slice(0, 20)
      .map((t) => t.item);
  },
});
export const insights = internalTenantQuery({
  args,
  returns: v.object({
    source: v.literal("reported_by_you"),
    contacted: v.number(),
    replied: v.number(),
    interested: v.number(),
    meetingsHeld: v.number(),
    customers: v.number(),
    unknownHistory: v.number(),
    pendingApprovals: v.number(),
    companies: v.array(
      v.object({
        companyKey: v.string(),
        contacted: v.boolean(),
        suppressed: v.boolean(),
        paused: v.boolean(),
      }),
    ),
    upcoming: v.array(
      v.object({
        threadId: v.id("outreachThreads"),
        companyName: v.string(),
        kind: v.union(
          v.literal("followup"),
          v.literal("revisit"),
          v.literal("meeting"),
        ),
        at: v.number(),
        timezone: v.string(),
      }),
    ),
  }),
  handler: async (ctx, input) => {
    s.gate(ctx.principal, input);
    s.checkClock(input.clockBucket);
    const rows = await ctx.db
      .query("outreachThreads")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .take(101);
    if (rows.length > 100)
      throw appError(
        "CONFLICT",
        "Conversation allowance exceeded; recovery required",
      );
    const metrics = {
      contacted: new Set<string>(),
      replied: new Set<string>(),
      interested: new Set<string>(),
      meetingsHeld: new Set<string>(),
      customers: new Set<string>(),
    };
    const companies = new Map<
      string,
      {
        companyKey: string;
        contacted: boolean;
        suppressed: boolean;
        paused: boolean;
      }
    >();
    const upcoming: Array<{
      threadId: (typeof rows)[number]["_id"];
      companyName: string;
      kind: "followup" | "revisit" | "meeting";
      at: number;
      timezone: string;
    }> = [];
    let pendingApprovals = 0,
      unknownHistory = 0;
    for (const row of rows) {
      const a = row.activity,
        l = life(row);
      if (!a) unknownHistory++;
      const state = a ? await s.context(ctx, row, a) : null;
      const prior = companies.get(row.companyKey) ?? {
        companyKey: row.companyKey,
        contacted: false,
        suppressed: false,
        paused: false,
      };
      companies.set(row.companyKey, {
        ...prior,
        contacted: prior.contacted || Boolean(a?.outboundCount),
        suppressed: prior.suppressed || Boolean(state?.suppressed),
        paused: prior.paused || row.paused || Boolean(state?.companyPaused),
      });
      if (state?.readyForManualAction) pendingApprovals++;
      if (a && row.sourceIsDemo === false) {
        if (a.outboundCount) metrics.contacted.add(row.companyKey);
        if (
          row.latestInboundId &&
          !["awaiting_review", "uncertain", "auto_reply", "bounce"].includes(
            row.replyState,
          )
        )
          metrics.replied.add(row.companyKey);
        if (row.latestInboundId && row.replyState === "interested")
          metrics.interested.add(row.companyKey);
        if (l.meeting?.state === "attended_reported")
          metrics.meetingsHeld.add(row.companyKey);
        if (l.sale === "won_reported") metrics.customers.add(row.companyKey);
      }
      const base = { threadId: row._id, companyName: row.companyName };
      if (
        l.dueAt !== null &&
        l.dueTimezone &&
        l.dueAt > Date.now() &&
        !row.coldFollowupsStopped &&
        !row.paused &&
        !state?.companyPaused &&
        !state?.suppressed &&
        !state?.invalidRecipient
      )
        upcoming.push({
          ...base,
          kind: "followup",
          at: l.dueAt,
          timezone: l.dueTimezone,
        });
      if (
        row.revisitAt !== null &&
        row.revisitTimezone &&
        row.revisitAt > Date.now() &&
        ["not_now", "auto_reply"].includes(row.replyState)
      )
        upcoming.push({
          ...base,
          kind: "revisit",
          at: row.revisitAt,
          timezone: row.revisitTimezone,
        });
      if (l.meeting?.state === "booked_reported" && l.meeting.at > Date.now())
        upcoming.push({
          ...base,
          kind: "meeting",
          at: l.meeting.at,
          timezone: l.meeting.timezone,
        });
    }
    return {
      source: "reported_by_you" as const,
      contacted: metrics.contacted.size,
      replied: metrics.replied.size,
      interested: metrics.interested.size,
      meetingsHeld: metrics.meetingsHeld.size,
      customers: metrics.customers.size,
      unknownHistory,
      pendingApprovals,
      companies: [...companies.values()].sort((a, b) =>
        a.companyKey.localeCompare(b.companyKey),
      ),
      upcoming: upcoming.sort((a, b) => a.at - b.at).slice(0, 100),
    };
  },
});
export const repairActivity = internalAdminMutation({
  args: { ...s.scope, cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    cursor: v.string(),
    done: v.boolean(),
    repaired: v.number(),
  }),
  handler: async (ctx, input) => {
    s.gate(ctx.principal, input);
    const page = await ctx.db
      .query("outreachThreads")
      .withIndex("by_orgId", (q) => q.eq("orgId", ctx.principal.orgId))
      .paginate({ cursor: input.cursor, numItems: 3 });
    let repaired = 0;
    for (const row of page.page) {
      if (
        row.activity &&
        row.sourceFacts !== undefined &&
        row.sourceIsDemo !== undefined
      )
        continue;
      const messages = await s.history(ctx, row);
      const search = await ctx.db.get(row.searchId);
      const account =
        search?.orgId === row.orgId
          ? search.accounts.find((a) => a.id === row.accountId)
          : undefined;
      const parent = row.referral
        ? await s.requireThread(ctx, row.orgId, row.referral.threadId)
        : null;
      const valid = account && qualifiedAccount(account);
      await ctx.db.patch(row._id, {
        activity: activityFromHistory(messages),
        sourceFacts:
          parent?.sourceFacts ?? (valid ? p.sourceFacts(account) : []),
        sourceIsDemo:
          parent?.sourceIsDemo ??
          (valid ? false : account?.is_demo === true ? true : undefined),
        approvalId: null,
        revision: row.revision + 1,
        updatedAt: Date.now(),
      });
      repaired++;
    }
    return { cursor: page.continueCursor, done: page.isDone, repaired };
  },
});
