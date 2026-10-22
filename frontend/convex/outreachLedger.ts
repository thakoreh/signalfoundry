/** Internal manual-ledger prerequisites. The REST adapter remains CLOSED.
 * No transport, scheduler, provider, account connection or paid operation lives here.
 */
import { v, type Infer } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAdminMutation, internalTenantQuery } from "./lib/auth";
import { appError } from "./lib/errors";
import { requireWorkspace } from "./lib/records";
import { text } from "./lib/validation";
import * as p from "./lib/outreachLedgerPolicy";
import * as validators from "./lib/outreachLedgerValidators";

import {
  scope,
  revision,
  gate,
  requireThread,
  company,
  stop,
  binding,
  view,
  request,
  record,
  revise,
  save,
  checkClock,
} from "./lib/outreachLedgerStore";
import {
  emptyActivity,
  life,
  qualifiedAccount,
} from "./lib/outreachLifecyclePolicy";

export const get = internalTenantQuery({
  args: {
    ...scope,
    threadId: v.id("outreachThreads"),
    clockBucket: v.optional(v.number()),
  },
  returns: validators.view,
  handler: async (ctx, args) => {
    gate(ctx.principal, args);
    if (args.clockBucket !== undefined) checkClock(args.clockBucket);
    return view(
      ctx,
      await requireThread(ctx, ctx.principal.orgId, args.threadId),
    );
  },
});
export const list = internalTenantQuery({
  args: scope,
  returns: v.array(
    v.object({
      id: v.id("outreachThreads"),
      companyName: v.string(),
      recipient: v.string(),
      revision: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    gate(ctx.principal, args);
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
    return rows.map((row) => ({
      id: row._id,
      companyName: row.companyName,
      recipient: row.recipient,
      revision: row.revision,
    }));
  },
});
export const start = internalAdminMutation({
  args: {
    ...scope,
    searchId: v.id("customerSearches"),
    accountIds: v.array(v.string()),
    idempotencyKey: v.string(),
  },
  returns: v.array(validators.view),
  handler: async (ctx, args) => {
    gate(ctx.principal, args);
    const orgId = ctx.principal.orgId;
    const search = await ctx.db.get(args.searchId);
    if (!search || search.orgId !== orgId)
      throw appError("NOT_FOUND", "Search not found");
    if (!["complete", "partial"].includes(search.status))
      throw appError("CONFLICT", "Wait for research to finish");
    if (
      !args.accountIds.length ||
      args.accountIds.length > 5 ||
      new Set(args.accountIds).size !== args.accountIds.length
    )
      throw appError(
        "VALIDATION_ERROR",
        "Choose one to five distinct saved prospects",
      );
    const admission = await request(
      ctx,
      orgId,
      args.idempotencyKey,
      "start",
      args,
    );
    if (admission.old)
      return Promise.all(
        admission.old.threadIds.map(async (id) =>
          view(ctx, await requireThread(ctx, orgId, id)),
        ),
      );
    const results: Id<"outreachThreads">[] = [];
    let added = 0;
    for (const accountId of args.accountIds) {
      const account = search.accounts.find((item) => item.id === accountId);
      if (!account)
        throw appError("NOT_FOUND", "Prospect not found in this search");
      const existing = await ctx.db
        .query("outreachThreads")
        .withIndex("by_orgId_and_searchId_and_accountId", (q) =>
          q
            .eq("orgId", orgId)
            .eq("searchId", search._id)
            .eq("accountId", accountId),
        )
        .unique();
      if (existing) {
        results.push(existing._id);
        continue;
      }
      if (account.is_demo)
        throw appError(
          "VALIDATION_ERROR",
          "Fictional demo research cannot establish hosted outreach permission",
        );
      if (!qualifiedAccount(account) || !p.sourceFacts(account).length)
        throw appError(
          "VALIDATION_ERROR",
          "Choose researched prospects with clear customer-type evidence, without exclusions",
        );
      if (admission.limits.threadCount + ++added > 100)
        throw appError("RATE_LIMITED", "Conversation allowance reached");
      const key = p.companyKey(account.domain);
      let safety = await ctx.db
        .query("outreachCompanies")
        .withIndex("by_orgId_and_companyKey", (q) =>
          q.eq("orgId", orgId).eq("companyKey", key),
        )
        .unique();
      if (!safety) {
        const id = await ctx.db.insert("outreachCompanies", {
          orgId,
          companyKey: key,
          reviewVersion: 0,
        });
        safety = (await ctx.db.get(id))!;
      }
      const shared =
        /^(info|hello|support|sales|contact|admin|office|team|enquiries|inquiries)@/i;
      const contacts = account.contacts
        .flatMap((contact) => {
          try {
            const address = p.email(contact.email ?? "", true);
            return address ? [{ ...contact, email: address }] : [];
          } catch {
            return [];
          } // A malformed candidate cannot hide valid alternates.
        })
        .sort(
          (a, b) =>
            Number(shared.test(a.email!)) - Number(shared.test(b.email!)),
        );
      const recipient = contacts[0]?.email ?? "";
      const id = await ctx.db.insert("outreachThreads", {
        orgId,
        searchId: search._id,
        accountId,
        companyKey: key,
        companyName: text(account.name, "Company", 240),
        recipient,
        recipientName: recipient ? (contacts[0]?.name ?? "") : "",
        recipientStatus: recipient ? "published_unverified" : "missing",
        subject: "",
        body: "",
        contactBasis: null,
        paused: safety.reviewVersion > 0,
        companyReviewVersion: 0,
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
        sourceFacts: p.sourceFacts(account),
        sourceIsDemo: false,
        completedReferralIds: [],
      });
      results.push(id);
    }
    await ctx.db.patch(admission.limits._id, {
      threadCount: admission.limits.threadCount + added,
    });
    await record(ctx, orgId, args.idempotencyKey, admission, results);
    return Promise.all(
      results.map(async (id) => view(ctx, await requireThread(ctx, orgId, id))),
    );
  },
});
export const edit = internalAdminMutation({
  args: {
    ...revision,
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    bookingLink: v.optional(v.string()),
  },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "edit",
      args,
    );
    if (!admission.old) {
      const recipient = p.email(args.recipient, true);
      const changed = recipient !== row.recipient;
      await save(ctx, row, {
        recipient,
        subject: p.line(args.subject, "Subject", 160, true),
        body: args.body.trim() ? text(args.body, "Message", 6000) : "",
        approvalId: null,
        ...(args.bookingLink !== undefined
          ? { bookingLink: p.bookingLink(args.bookingLink) }
          : {}),
        ...(changed
          ? {
              recipientName: "",
              recipientStatus: recipient
                ? ("user_entered" as const)
                : ("missing" as const),
              contactBasis: null,
              lifecycle: {
                ...life(row),
                purpose: row.latestInboundId
                  ? ("answer" as const)
                  : ("initial" as const),
                dueAt: null,
                dueTimezone: null,
              },
            }
          : {}),
      });
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
export const saveBasis = internalAdminMutation({
  args: { ...revision, basis: v.union(validators.contactBasis, v.null()) },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "basis",
      args,
    );
    if (!admission.old) {
      await save(ctx, row, {
        contactBasis: p.validatedBasis(args.basis),
        approvalId: null,
      });
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
export const pause = internalAdminMutation({
  args: { ...revision, paused: v.boolean() },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "pause",
      args,
    );
    if (!admission.old) {
      const safety = await company(ctx, row);
      await save(ctx, row, {
        paused: args.paused,
        companyReviewVersion: args.paused
          ? row.companyReviewVersion
          : safety.reviewVersion,
        approvalId: null,
        lifecycle: {
          ...life(row),
          purpose: row.latestInboundId ? "answer" : "initial",
          dueAt: null,
          dueTimezone: null,
        },
      });
      if (args.paused && safety.coldOwnerId === row._id)
        await ctx.db.patch(safety._id, { coldOwnerId: undefined });
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
export const approve = internalAdminMutation({
  args: revision,
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "approve",
      args,
    );
    if (!admission.old) {
      const current = await view(ctx, row);
      if (current.blockedReason)
        throw appError("CONFLICT", current.blockedReason);
      const safety = await company(ctx, row);
      const workspace = await requireWorkspace(ctx, row.orgId);
      const next = { ...row, revision: row.revision + 1 };
      const id = await ctx.db.insert("outreachApprovals", {
        orgId: row.orgId,
        threadId: row._id,
        recipient: row.recipient,
        subject: row.subject,
        body:
          row.body +
          (row.bookingLink ? "\n\nBooking link: " + row.bookingLink : ""),
        basis: row.contactBasis!,
        binding: await binding(
          next,
          workspace.profileVersion,
          safety.reviewVersion,
        ),
        profileVersion: workspace.profileVersion,
        companyVersion: safety.reviewVersion,
        approvedBy: ctx.principal.userId,
        approvedAt: Date.now(),
        lifecycleSnapshot: life(row),
        bookingLink: row.bookingLink ?? "",
      });
      if (!row.latestInboundId)
        await ctx.db.patch(safety._id, { coldOwnerId: row._id });
      await save(ctx, row, { approvalId: id });
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
export const checkManualAction = internalTenantQuery({
  args: {
    ...scope,
    threadId: v.id("outreachThreads"),
    expectedRevision: v.number(),
    approvalId: v.id("outreachApprovals"),
  },
  returns: validators.approval,
  handler: async (ctx, args) => {
    gate(ctx.principal, args);
    const row = await requireThread(ctx, ctx.principal.orgId, args.threadId);
    // Cached queries cannot certify time-bound handoffs. Keep this legacy
    // untimed read compatible; the full journey uses fresh mutation preflight.
    if (["cold_followup", "meeting_confirmation"].includes(life(row).purpose))
      throw appError(
        "CONFLICT",
        "Use the fresh manual-action preflight for a timed message",
      );
    const current = await view(ctx, row);
    if (
      !current.readyForManualAction ||
      current.thread.revision !== args.expectedRevision ||
      current.approval?._id !== args.approvalId
    )
      throw appError(
        "CONFLICT",
        "The exact approval is no longer current. Reload and review again.",
      );
    return current.approval!;
  },
});
export const reportSent = internalAdminMutation({
  args: {
    ...revision,
    approvalId: v.id("outreachApprovals"),
    sentAs: v.union(v.literal("approved"), v.literal("with_changes")),
    actualSubject: v.optional(v.string()),
    actualBody: v.optional(v.string()),
  },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "sent",
      args,
    );
    if (!admission.old) {
      const current = await view(ctx, row);
      if (
        !current.readyForManualAction ||
        current.approval?._id !== args.approvalId
      )
        throw appError(
          "CONFLICT",
          "Approve the exact message before reporting an external send",
        );
      if (row.messageCount >= 50)
        throw appError(
          "RATE_LIMITED",
          "Conversation message allowance reached",
        );
      if (args.sentAs === "approved" && (args.actualSubject || args.actualBody))
        throw appError(
          "VALIDATION_ERROR",
          "Choose Sent with changes for different text",
        );
      const subject =
        args.sentAs === "approved"
          ? current.approval.subject
          : p.line(args.actualSubject ?? "", "Actual subject", 160);
      const body =
        args.sentAs === "approved"
          ? current.approval.body
          : text(args.actualBody ?? "", "Actual sent message", 10000);
      await ctx.db.insert("outreachMessages", {
        orgId: row.orgId,
        threadId: row._id,
        direction: "outbound",
        recipient: row.recipient,
        subject,
        body,
        approvalId: current.approval._id,
        sentAs: args.sentAs,
        reportedReplyState: null,
        source: "user_reported",
        reportedBy: ctx.principal.userId,
        createdAt: Date.now(),
        purpose: life(row).purpose,
        scheduledAt: life(row).dueAt,
        scheduledTimezone: life(row).dueTimezone,
        meetingVersion:
          life(row).purpose === "meeting_confirmation"
            ? (life(row).meeting?.version ?? null)
            : null,
      });
      await save(ctx, row, {
        approvalId: null,
        body: "",
        messageCount: row.messageCount + 1,
        bookingLink: "",
        lifecycle: {
          ...life(row),
          purpose: row.latestInboundId ? "answer" : "initial",
          dueAt: null,
          dueTimezone: null,
        },
      });
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
const replyArgs = {
  ...revision,
  replyState: validators.replyState,
  revisitAt: v.optional(v.string()),
  revisitTimezone: v.optional(v.string()),
};
async function applyReply(
  ctx: MutationCtx,
  row: Doc<"outreachThreads">,
  selected: Infer<typeof validators.replyState>,
  body: string,
  recipient: string,
  date?: string,
  zone?: string,
) {
  const state = p.detectedReply(body, selected) as Infer<
    typeof validators.replyState
  >;
  let effective = state;
  let revisitAt: number | null = null,
    revisitTimezone: string | null = null;
  if (["not_now", "auto_reply"].includes(state)) {
    if (date && zone) {
      revisitAt = p.zonedInstant(date, zone);
      revisitTimezone = zone;
    } else effective = "awaiting_review"; // Keep the text, never silently infer a return date.
  } else if (date || zone)
    throw appError(
      "VALIDATION_ERROR",
      "Return dates belong to Not now or Auto-reply",
    );
  if (["opt_out", "source_question", "bounce"].includes(state)) {
    const targets =
      state === "bounce"
        ? [`email:${recipient.toLowerCase()}`]
        : [
            `domain:${row.companyKey}`,
            `email:${recipient.toLowerCase()}`,
            ...(row.recipient ? [`email:${row.recipient.toLowerCase()}`] : []),
          ];
    for (const target of new Set(targets))
      if (!(await stop(ctx, row.orgId, target)))
        await ctx.db.insert("outreachSuppressions", {
          orgId: row.orgId,
          target,
          reason: state as "opt_out" | "source_question" | "bounce",
          threadId: row._id,
          createdAt: Date.now(),
        });
  }
  const safety = await company(ctx, row);
  await ctx.db.patch(safety._id, {
    reviewVersion: safety.reviewVersion + 1,
    coldOwnerId: undefined,
  });
  return {
    replyState: effective,
    revisitAt,
    revisitTimezone,
    companyReviewVersion: safety.reviewVersion + 1,
    approvalId: null,
    body: "",
    coldFollowupsStopped: true,
    bookingLink: "",
    lifecycle: {
      ...life(row),
      purpose: "answer" as const,
      dueAt: null,
      dueTimezone: null,
    },
  };
}
export const pasteReply = internalAdminMutation({
  args: { ...replyArgs, body: v.string() },
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "reply",
      args,
    );
    if (!admission.old) {
      if (row.messageCount >= 50)
        throw appError(
          "RATE_LIMITED",
          "Conversation message allowance reached",
        );
      if (!row.recipient)
        throw appError(
          "VALIDATION_ERROR",
          "Identify the recipient before recording a reply",
        );
      const body = text(args.body, "Received reply", 6000);
      const patch = await applyReply(
        ctx,
        row,
        args.replyState,
        body,
        row.recipient,
        args.revisitAt,
        args.revisitTimezone,
      );
      const id = await ctx.db.insert("outreachMessages", {
        orgId: row.orgId,
        threadId: row._id,
        direction: "inbound",
        recipient: row.recipient,
        subject: row.subject,
        body,
        approvalId: null,
        sentAs: null,
        reportedReplyState: patch.replyState,
        source: "user_reported",
        reportedBy: ctx.principal.userId,
        createdAt: Date.now(),
      });
      await save(ctx, row, {
        ...patch,
        latestInboundId: id,
        messageCount: row.messageCount + 1,
      });
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
export const classifyReply = internalAdminMutation({
  args: replyArgs,
  returns: validators.view,
  handler: async (ctx, args) => {
    const { row, admission } = await revise(
      ctx,
      ctx.principal,
      args,
      "classify",
      args,
    );
    if (!admission.old) {
      const latest = row.latestInboundId
        ? await ctx.db.get(row.latestInboundId)
        : null;
      if (
        !latest ||
        latest.orgId !== row.orgId ||
        latest.threadId !== row._id ||
        latest.direction !== "inbound"
      )
        throw appError("CONFLICT", "Paste a reply before classifying it");
      await save(
        ctx,
        row,
        await applyReply(
          ctx,
          row,
          args.replyState,
          latest.body,
          latest.recipient,
          args.revisitAt,
          args.revisitTimezone,
        ),
      );
      await record(ctx, row.orgId, args.idempotencyKey, admission, [row._id]);
    }
    return view(ctx, await requireThread(ctx, row.orgId, row._id));
  },
});
