export type ReplyState =
  | "awaiting_review"
  | "interested"
  | "question"
  | "not_now"
  | "not_interested"
  | "opt_out"
  | "uncertain";
export type OutreachMessage = {
  id: string;
  direction: "outbound" | "inbound";
  recipient: string;
  subject: string;
  body: string;
  source: "user_reported";
  sent_as?: "approved" | "with_changes" | null;
  approved_subject?: string | null;
  approved_body?: string | null;
  reply_state: ReplyState | null;
  created_at: string;
};
export type OutreachThread = {
  id: string;
  search_id: string;
  account_id: string;
  company_name: string;
  domain: string;
  recipient: string;
  recipient_status: string;
  subject: string;
  body: string;
  booking_link: string;
  sender_footer?: string;
  paused: boolean;
  suppressed: boolean;
  suppression_reason: string | null;
  reply_state: ReplyState | null;
  revision: number;
  approval: {
    content_hash: string;
    approved_at: string;
    revision: number;
  } | null;
  ready_for_manual_action: boolean;
  messages: OutreachMessage[];
  meeting_state:
    | "not_recorded"
    | "booked_reported"
    | "attended_reported"
    | "no_show_reported"
    | "cancelled_reported";
  sale_state: "not_recorded" | "won_reported" | "lost_reported";
  created_at: string;
  updated_at: string;
};
export type OutreachDraft = Pick<
  OutreachThread,
  "recipient" | "subject" | "body" | "booking_link"
>;
export const threadDraft = (thread: OutreachThread): OutreachDraft => ({
  recipient: thread.recipient,
  subject: thread.subject,
  body: thread.body,
  booking_link: thread.booking_link,
});
export const outreachMessageBody = (
  draft: Pick<OutreachDraft, "body" | "booking_link">,
) =>
  draft.booking_link
    ? `${draft.body}\n\nBooking link: ${draft.booking_link}`
    : draft.body;
export const sameOutreachDraft = (left: OutreachDraft, right: OutreachDraft) =>
  left.recipient === right.recipient &&
  left.subject === right.subject &&
  left.body === right.body &&
  left.booking_link === right.booking_link;
export const replyLabels: Record<ReplyState, string> = {
  awaiting_review: "Needs review",
  interested: "Interested",
  question: "Has a question",
  not_now: "Not now",
  not_interested: "Not interested",
  opt_out: "Opted out",
  uncertain: "Uncertain",
};
