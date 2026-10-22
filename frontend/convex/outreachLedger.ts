/** Internal manual-ledger prerequisites. The REST adapter remains CLOSED.
 * No transport, scheduler, provider, account connection or paid operation lives here.
 */
import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAdminMutation,
  internalTenantQuery,
  type Principal,
} from "./lib/auth";
import { appError } from "./lib/errors";
import { requireWorkspace } from "./lib/records";
import { text } from "./lib/validation";
import * as p from "./lib/outreachLedgerPolicy";
import * as validators from "./lib/outreachLedgerValidators";

type Reader = Pick<QueryCtx, "db">;
type Scope = { expectedOrgId: string };
const scope = { expectedOrgId: v.string() };
const revision = {
  ...scope,
  threadId: v.id("outreachThreads"),
  expectedRevision: v.number(),
  idempotencyKey: v.string(),
};
const gate = (principal: Principal, args: Scope) => {
  if (process.env.SIGNALFOUNDRY_HOSTED_OUTREACH_PERSISTENCE_ENABLED !== "true")
    throw appError(
      "CONFIGURATION_ERROR",
      "Hosted outreach persistence is disabled; its adapter is not available",
    );
  if (args.expectedOrgId !== principal.orgId)
    throw appError(
      "CONFLICT",
      "The active organization changed. Reopen saved work.",
    );
};
async function requireThread(
  ctx: Reader,
  orgId: string,
  id: Id<"outreachThreads">,
) {
  const row = await ctx.db.get(id);
  if (!row || row.orgId !== orgId)
    throw appError("NOT_FOUND", "Conversation not found");
  return row;
}
async function company(ctx: Reader, thread: Doc<"outreachThreads">) {
  const row = await ctx.db
    .query("outreachCompanies")
    .withIndex("by_orgId_and_companyKey", (q) =>
      q.eq("orgId", thread.orgId).eq("companyKey", thread.companyKey),
    )
    .unique();
  if (!row)
    throw appError(
      "CONFLICT",
      "This conversation is missing its company safety record",
    );
  return row;
}
async function stop(ctx: Reader, orgId: string, target: string) {
  return ctx.db
    .query("outreachSuppressions")
    .withIndex("by_orgId_and_target", (q) =>
      q.eq("orgId", orgId).eq("target", target),
    )
    .unique();
}
async function binding(
  thread: Doc<"outreachThreads">,
  profileVersion: number,
  companyVersion: number,
) {
  return p.fingerprint({
    threadId: thread._id,
    recipient: thread.recipient,
    subject: thread.subject,
    body: thread.body,
    contactBasis: thread.contactBasis,
    latestInboundId: thread.latestInboundId,
    replyState: thread.replyState,
    profileVersion,
    companyVersion,
    revision: thread.revision,
  });
}
async function view(
  ctx: Reader,
  row: Doc<"outreachThreads">,
): Promise<Infer<typeof validators.view>> {
  const workspace = await requireWorkspace(ctx, row.orgId);
  const safety = await company(ctx, row);
  const [domainStop, emailStop, messages] = await Promise.all([
    stop(ctx, row.orgId, `domain:${row.companyKey}`),
    stop(ctx, row.orgId, `email:${row.recipient.toLowerCase()}`),
    ctx.db
      .query("outreachMessages")
      .withIndex("by_orgId_and_threadId", (q) =>
        q.eq("orgId", row.orgId).eq("threadId", row._id),
      )
      .take(51),
  ]);
  if (messages.length > 50 || messages.length !== row.messageCount)
    throw appError("CONFLICT", "Conversation history needs recovery");
  const footer = p.senderFooter(workspace.profile);
  const suppressed = Boolean(
    domainStop || (emailStop?.reason !== "bounce" && emailStop),
  );
  const invalid = emailStop?.reason === "bounce";
  const companyPaused =
    row.companyReviewVersion !== safety.reviewVersion ||
    Boolean(safety.coldOwnerId && safety.coldOwnerId !== row._id);
  let reason: string | null = null;
  if (suppressed) reason = "A permanent opt-out or contact-source stop applies";
  else if (invalid) reason = "This address was reported invalid";
  else if (row.paused || companyPaused)
    reason = "Review the paused company and make an explicit decision";
  else if (
    row.latestInboundId &&
    !["interested", "question"].includes(row.replyState)
  )
    reason = "Review the received reply before outreach";
  else if (
    row.latestInboundId &&
    messages
      .find((m) => m._id === row.latestInboundId)
      ?.recipient.toLowerCase() !== row.recipient.toLowerCase()
  )
    reason = "The received reply belongs to a different recipient";
  else if (
    !row.latestInboundId &&
    messages.some((m) => m.direction === "outbound")
  )
    reason =
      "Hosted followup planning is not available; do not repeat an initial cold message";
  else if (!footer)
    reason = "Save sender name, company, mailing address and reachable contact";
  else if (!p.basisReady(row.contactBasis, row.recipient))
    reason =
      "Review the public address, role relevance and US/Canada contact basis";
  else if (
    !row.recipient ||
    !row.subject ||
    !row.body ||
    !row.body.endsWith(footer)
  )
    reason = "Save a complete message with the current sender footer";
  else if (
    row.replyState !== "interested" &&
    /https?:\/\/(?:www\.)?(?:calendly\.com|cal\.com|calendar\.[^/\s?#]+)(?=[/?#\s]|$)/i.test(
      row.subject + "\n" + row.body,
    )
  )
    reason = "Offer the booking link only after interest is recorded";
  let approval = row.approvalId ? await ctx.db.get(row.approvalId) : null;
  if (
    approval &&
    (approval.orgId !== row.orgId ||
      approval.threadId !== row._id ||
      approval.binding !==
        (await binding(row, workspace.profileVersion, safety.reviewVersion)))
  )
    approval = null;
  if (reason) approval = null;
  // Hide stale approval references in the view; never rewrite immutable history on GET.
  return {
    thread: { ...row, approvalId: approval?._id ?? null },
    messages,
    approval,
    senderFooter: footer,
    blockedReason: reason,
    readyForManualAction: Boolean(!reason && approval),
    companyPaused,
    suppressed,
    invalidRecipient: invalid,
    reviewDue:
      row.revisitAt !== null &&
      ["not_now", "auto_reply"].includes(row.replyState) &&
      row.revisitAt <= Date.now(),
  };
}
async function ledger(ctx: MutationCtx, orgId: string) {
  const row = await ctx.db
    .query("outreachLedgers")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .unique();
  if (row) return row;
  const id = await ctx.db.insert("outreachLedgers", {
    orgId,
    requestCount: 0,
    threadCount: 0,
  });
  return (await ctx.db.get(id))!;
}
async function request(
  ctx: MutationCtx,
  orgId: string,
  key: string,
  operation: string,
  args: unknown,
) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key))
    throw appError("VALIDATION_ERROR", "Invalid operation key");
  const digest = await p.fingerprint([operation, args]);
  const old = await ctx.db
    .query("outreachRequests")
    .withIndex("by_orgId_and_requestKey", (q) =>
      q.eq("orgId", orgId).eq("requestKey", key),
    )
    .unique();
  if (old && old.fingerprint !== digest)
    throw appError(
      "CONFLICT",
      "This operation key belongs to different changes",
    );
  const limits = await ledger(ctx, orgId);
  if (!old && limits.requestCount >= 10_000)
    throw appError("RATE_LIMITED", "Manual operation allowance reached");
  return { old, digest, limits };
}
async function record(
  ctx: MutationCtx,
  orgId: string,
  key: string,
  admission: Awaited<ReturnType<typeof request>>,
  ids: Id<"outreachThreads">[],
) {
  await ctx.db.insert("outreachRequests", {
    orgId,
    requestKey: key,
    fingerprint: admission.digest,
    threadIds: ids,
    createdAt: Date.now(),
  });
  await ctx.db.patch(admission.limits._id, {
    requestCount: admission.limits.requestCount + 1,
  });
}
async function revise(
  ctx: MutationCtx,
  principal: Principal,
  args: Scope & {
    threadId: Id<"outreachThreads">;
    expectedRevision: number;
    idempotencyKey: string;
  },
  operation: string,
  input: unknown,
) {
  gate(principal, args);
  const row = await requireThread(ctx, principal.orgId, args.threadId);
  const admission = await request(
    ctx,
    principal.orgId,
    args.idempotencyKey,
    operation,
    input,
  );
  if (
    !admission.old &&
    (!Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision !== row.revision ||
      row.revision >= 1_000_000)
  )
    throw appError("CONFLICT", "Conversation changed. Reload before saving.");
  return { row, admission };
}
async function save(
  ctx: MutationCtx,
  row: Doc<"outreachThreads">,
  patch: Partial<Doc<"outreachThreads">>,
) {
  await ctx.db.patch(row._id, {
    ...patch,
    revision: row.revision + 1,
    updatedAt: Date.now(),
  });
}

export const get = internalTenantQuery({
  args: { ...scope, threadId: v.id("outreachThreads") },
  returns: validators.view,
  handler: async (ctx, args) => {
    gate(ctx.principal, args);
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
        ...(changed
          ? {
              recipientName: "",
              recipientStatus: recipient
                ? ("user_entered" as const)
                : ("missing" as const),
              contactBasis: null,
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
        body: row.body,
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
    const current = await view(
      ctx,
      await requireThread(ctx, ctx.principal.orgId, args.threadId),
    );
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
      });
      await save(ctx, row, {
        approvalId: null,
        body: "",
        messageCount: row.messageCount + 1,
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
