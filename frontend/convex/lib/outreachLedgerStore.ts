// Shared transactional manual-ledger storage; no public functions or transports.
import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Principal } from "./auth";
import { appError } from "./errors";
import { requireWorkspace } from "./records";
import * as p from "./outreachLedgerPolicy";
import * as validators from "./outreachLedgerValidators";
import {
  activityFromHistory,
  life,
  manualBlock,
} from "./outreachLifecyclePolicy";

export type Reader = Pick<QueryCtx, "db">;
export type Scope = { expectedOrgId: string };
export const scope = { expectedOrgId: v.string() };
export const revision = {
  ...scope,
  threadId: v.id("outreachThreads"),
  expectedRevision: v.number(),
  idempotencyKey: v.string(),
};
export const gate = (principal: Principal, args: Scope) => {
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
export async function requireThread(
  ctx: Reader,
  orgId: string,
  id: Id<"outreachThreads">,
) {
  const row = await ctx.db.get(id);
  if (!row || row.orgId !== orgId)
    throw appError("NOT_FOUND", "Conversation not found");
  return row;
}
export async function company(ctx: Reader, thread: Doc<"outreachThreads">) {
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
export async function stop(ctx: Reader, orgId: string, target: string) {
  return ctx.db
    .query("outreachSuppressions")
    .withIndex("by_orgId_and_target", (q) =>
      q.eq("orgId", orgId).eq("target", target),
    )
    .unique();
}
export async function binding(
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
    lifecycle: life(thread),
    bookingLink: thread.bookingLink ?? "",
  });
}
export async function history(ctx: Reader, row: Doc<"outreachThreads">) {
  const messages = await ctx.db
    .query("outreachMessages")
    .withIndex("by_orgId_and_threadId", (q) =>
      q.eq("orgId", row.orgId).eq("threadId", row._id),
    )
    .take(51);
  if (
    messages.length > 50 ||
    messages.length !== row.messageCount ||
    (row.latestInboundId &&
      messages.findLast((m) => m.direction === "inbound")?._id !==
        row.latestInboundId)
  )
    throw appError("CONFLICT", "Conversation history needs recovery");
  return messages;
}
export async function context(
  ctx: Reader,
  row: Doc<"outreachThreads">,
  a: Infer<typeof validators.activity>,
) {
  const workspace = await requireWorkspace(ctx, row.orgId);
  const safety = await company(ctx, row);
  const [domainStop, emailStop] = await Promise.all([
    stop(ctx, row.orgId, `domain:${row.companyKey}`),
    stop(ctx, row.orgId, `email:${row.recipient.toLowerCase()}`),
  ]);
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
    a.lastInboundRecipient?.toLowerCase() !== row.recipient.toLowerCase()
  )
    reason = "The received reply belongs to a different recipient";
  else if (!footer)
    reason = "Save sender name, company, mailing address and reachable contact";
  else if (!p.basisReady(row.contactBasis, row.recipient))
    reason =
      "Review the public address, role relevance and US/Canada contact basis";
  else if (row.sourceIsDemo !== false || !row.sourceFacts?.length)
    reason = "Review the saved research eligibility and public company facts";
  else if (
    !row.recipient ||
    !row.subject ||
    !row.body ||
    !row.body.endsWith(footer)
  )
    reason = "Save a complete message with the current sender footer";
  else if (
    row.replyState !== "interested" &&
    (row.bookingLink ||
      /https?:\/\/(?:www\.)?(?:calendly\.com|cal\.com|calendar\.[^/\s?#]+)(?=[/?#\s]|$)/i.test(
        row.subject + "\n" + row.body,
      ))
  )
    reason = "Offer the booking link only after interest is recorded";
  else reason = manualBlock(row, a, Date.now());
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
  return {
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
export async function view(
  ctx: Reader,
  row: Doc<"outreachThreads">,
): Promise<Infer<typeof validators.view>> {
  const messages = await history(ctx, row);
  const projected = await context(ctx, row, activityFromHistory(messages));
  const events = await ctx.db
    .query("outreachEvents")
    .withIndex("by_orgId_and_threadId", (q) =>
      q.eq("orgId", row.orgId).eq("threadId", row._id),
    )
    .take(201);
  if (events.length > 200 || events.length !== (row.eventCount ?? 0))
    throw appError("CONFLICT", "Planning history needs recovery");
  return {
    thread: { ...row, approvalId: projected.approval?._id ?? null },
    messages,
    events,
    ...projected,
  };
}
export function checkClock(bucket: number) {
  // Cache invalidation only. Never use caller time to authorize an action.
  if (
    !Number.isSafeInteger(bucket) ||
    Math.abs(bucket - Math.floor(Date.now() / 60_000)) > 2
  )
    throw appError("VALIDATION_ERROR", "Refresh the current clock bucket");
}
export async function ledger(ctx: MutationCtx, orgId: string) {
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
export async function request(
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
export async function record(
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
export async function revise(
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
export async function save(
  ctx: MutationCtx,
  row: Doc<"outreachThreads">,
  patch: Partial<Doc<"outreachThreads">>,
) {
  const updated = { ...row, ...patch };
  const messages = await history(ctx, updated);
  await ctx.db.patch(row._id, {
    ...patch,
    activity: activityFromHistory(messages),
    revision: row.revision + 1,
    updatedAt: Date.now(),
  });
}
