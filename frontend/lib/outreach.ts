export type ReplyState =
  | "awaiting_review"
  | "interested"
  | "question"
  | "not_now"
  | "not_interested"
  | "opt_out"
  | "uncertain"
  | "referral"
  | "source_question"
  | "auto_reply"
  | "bounce";
export type NextUpItem = {
  thread_id: string;
  search_id: string;
  company_name: string;
  action: "review_reply" | "answer_reply" | "report_meeting" | "manual_send" | "review_followup";
  reason: string;
  reply_state: ReplyState;
  meeting_state: OutreachThread["meeting_state"];
  updated_at: string;
};
export type NextUpResponse = { items: NextUpItem[] };
export type CompanyFlag = { domain: string; contacted: boolean; suppressed: boolean; paused: boolean };
export type OutreachInsights = {
  funnel: { companies: number; contacted: number; replied: number; interested: number; meetings_held: number; customers: number };
  excluded_example_companies: number;
  company_flags: CompanyFlag[];
  departure: { approvals_pending: number; upcoming: { thread_id: string; search_id: string; company_name: string; action: string; at: string; timezone: string; view: string }[] };
  provenance: string;
};
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
  contact_basis_snapshot?: ContactBasis | null;
};
export type ContactBasis = {
  version: 1;
  basis_type: "conspicuous_publication";
  published_email: string;
  source_url: string;
  captured_at: string | null;
  publisher_attribution: "recipient" | "caused_by_recipient" | "third_party" | "unknown";
  notice_status: "clear" | "prohibits" | "unknown";
  recipient_role: string;
  message_relevance: string;
  recipient_country: "US" | "CA" | "unknown" | "other";
  recipient_timezone: string | null;
};
export type OutreachThread = {
  contact_basis?: ContactBasis | null;
  id: string;
  search_id: string;
  account_id: string;
  company_name: string;
  domain: string;
  recipient: string;
  recipient_status: string;
  recipient_name?: string;
  referrer_thread_id?: string | null;
  referrer_message_id?: string | null;
  referrer_name?: string;
  referral_completed_message_ids?: string[];
  outbound_purpose?: "initial" | "answer" | "cold_followup" | "meeting_confirmation";
  next_followup_at?: string | null;
  followup_timezone?: string | null;
  followups_sent?: number;
  manual_action_block?: string | null;
  meeting_at?: string | null;
  meeting_timezone?: string | null;
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
export const normalizeContactBasisForApi = (value: ContactBasis) => ({
  ...value,
  captured_at: value.captured_at ?? "",
  recipient_timezone: value.recipient_timezone ?? "",
});
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
  referral: "Referred contact",
  source_question: "Asked for source",
  auto_reply: "Auto-reply / OOO",
  bounce: "Address bounced",
};
