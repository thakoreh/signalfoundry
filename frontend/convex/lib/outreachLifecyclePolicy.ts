// Pure lifecycle rules. Time never schedules, approves or sends anything.
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { WorkerAccount } from "../validators";
import { normalizeWebsite } from "./validation";
import {
  activity,
  lifecycle,
  replyClassification,
} from "./outreachLedgerValidators";

export const emptyActivity = (): Infer<typeof activity> => ({
  version: 2,
  humanReplyCount: 0,
  latestReply: null,
  outboundCount: 0,
  coldFollowupsSent: 0,
  hadInbound: false,
  initialRecipient: null,
  lastOutboundAt: null,
  lastOutboundRecipient: null,
  lastInboundRecipient: null,
  answeredInboundId: null,
  confirmedMeetingVersions: [],
});
export const life = (
  row: Pick<Doc<"outreachThreads">, "lifecycle" | "latestInboundId">,
): Infer<typeof lifecycle> =>
  row.lifecycle ?? {
    purpose: row.latestInboundId ? "answer" : "initial",
    dueAt: null,
    dueTimezone: null,
    meeting: null,
    sale: "not_recorded",
  };
export function activityFromHistory(
  messages: Doc<"outreachMessages">[],
  classifications: Infer<typeof replyClassification>[] = [],
): Infer<typeof activity> {
  const outbound = messages.filter((m) => m.direction === "outbound");
  const firstInbound = messages.findIndex((m) => m.direction === "inbound");
  const cold = (
    firstInbound < 0 ? messages : messages.slice(0, firstInbound)
  ).filter((m) => m.direction === "outbound");
  const latestInbound = messages.findLast((m) => m.direction === "inbound");
  const latestOutboundIndex = messages.findLastIndex(
    (m) => m.direction === "outbound",
  );
  const latestInboundIndex = messages.findLastIndex(
    (m) => m.direction === "inbound",
  );
  const inbounds = messages.filter((m) => m.direction === "inbound");
  const effective = (m: Doc<"outreachMessages">) =>
    classifications.find((c) => c.messageId === m._id)?.state ??
    m.reportedReplyState ??
    "awaiting_review";
  return {
    version: 2,
    humanReplyCount: inbounds.filter(
      (m) =>
        !["awaiting_review", "uncertain", "auto_reply", "bounce"].includes(
          effective(m),
        ),
    ).length,
    latestReply: latestInbound
      ? {
          messageId: latestInbound._id,
          receivedAt: latestInbound.createdAt,
          creationTime: latestInbound._creationTime,
          state: effective(latestInbound),
        }
      : null,
    outboundCount: outbound.length,
    coldFollowupsSent: Math.max(0, cold.length - 1),
    hadInbound: firstInbound >= 0,
    initialRecipient: cold[0]?.recipient ?? null,
    lastOutboundAt: outbound.at(-1)?.createdAt ?? null,
    lastOutboundRecipient: outbound.at(-1)?.recipient ?? null,
    lastInboundRecipient: latestInbound?.recipient ?? null,
    answeredInboundId:
      latestInbound && latestOutboundIndex > latestInboundIndex
        ? latestInbound._id
        : null,
    confirmedMeetingVersions: [
      ...new Set(
        outbound
          .filter(
            (m) =>
              m.purpose === "meeting_confirmation" &&
              m.meetingVersion !== undefined &&
              m.meetingVersion !== null,
          )
          .map((m) => m.meetingVersion!),
      ),
    ],
  };
}
// Keep explicit corrections outside immutable received-message snapshots.
// For legacy rows only the latest correction survives; never invent older ones.
export function classificationHistory(
  row: Pick<
    Doc<"outreachThreads">,
    "replyClassifications" | "latestInboundId" | "replyState"
  >,
) {
  return row.latestInboundId
    ? [
        ...(row.replyClassifications ?? []).filter(
          (c) => c.messageId !== row.latestInboundId,
        ),
        { messageId: row.latestInboundId, state: row.replyState },
      ]
    : (row.replyClassifications ?? []);
}
export function qualifiedAccount(account: WorkerAccount) {
  return (
    !account.is_demo &&
    !account.score_breakdown.some(
      (part) => part.label === "Exclusion penalty",
    ) &&
    account.score_breakdown.some(
      (part) => part.label === "Customer-type language" && part.points >= 60,
    ) &&
    account.evidence.some((fact) => {
      if (
        fact.is_demo ||
        !["company", "fit"].includes(fact.kind) ||
        !fact.excerpt.trim()
      )
        return false;
      try {
        normalizeWebsite(fact.url);
        return true;
      } catch {
        return false;
      }
    })
  );
}
export function manualBlock(
  row: Doc<"outreachThreads">,
  a: Infer<typeof activity>,
  current: number,
) {
  const l = life(row);
  if (l.purpose === "cold_followup") {
    if (row.coldFollowupsStopped || a.hadInbound)
      return "A received reply or meeting permanently stopped this cold sequence";
    if (!a.outboundCount || a.coldFollowupsSent >= 2)
      return "Only two cold followups follow a first reported send";
    if (
      !a.initialRecipient ||
      a.initialRecipient.toLowerCase() !== row.recipient.toLowerCase() ||
      a.lastOutboundRecipient?.toLowerCase() !== row.recipient.toLowerCase()
    )
      return "Keep the original recipient for a cold followup";
    if (l.meeting) return "A reported meeting stops cold followups";
    if (l.dueAt === null || !l.dueTimezone)
      return "Confirm a followup date and IANA timezone";
    if (l.dueAt > current)
      return "The followup is not due yet; approve it only when due";
  } else if (l.purpose === "meeting_confirmation") {
    if (
      !l.meeting ||
      l.meeting.recipient.toLowerCase() !== row.recipient.toLowerCase()
    )
      return "This booking belongs to a different or unknown recipient";
    if (l.meeting.state !== "booked_reported")
      return "A confirmation requires a current reported booking";
    if (l.meeting.at <= current)
      return "The meeting time has passed; report its outcome instead";
    if (a.confirmedMeetingVersions.includes(l.meeting.version))
      return "A confirmation was already recorded for this meeting version";
  } else if (a.outboundCount && !a.hadInbound)
    return "Use dated followup planning instead of repeating an initial cold message";
  return null;
}
export function localDay(instant: number, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return Date.parse(
    `${part("year")}-${part("month")}-${part("day")}T00:00:00Z`,
  );
}
export function weekdayGap(start: number, end: number, zone: string) {
  let cursor = localDay(start, zone),
    count = 0;
  const final = localDay(end, zone);
  while (cursor < final && count < 4) {
    cursor += 86_400_000;
    if (![0, 6].includes(new Date(cursor).getUTCDay())) count++;
  }
  return count;
}
