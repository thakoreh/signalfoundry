import type { OutreachDraft, OutreachThread } from "./outreach";

export type OutreachView = "Review" | "Conversations" | "Meetings";
type Pending = {
  view: OutreachView;
  dirty: boolean;
  incomingDirty: boolean;
  basisDirty: boolean;
  footerMissing: boolean;
  pendingReplyReview: boolean;
  timingView: "Review" | "Meetings" | null;
  canAct: boolean;
};
export type OutreachNextStep = {
  message: string;
  view: OutreachView;
  target: string;
};

/** Navigation guidance only. This never grants approval or manual-action permission. */
export function outreachNextStep(
  t: OutreachThread,
  draft: OutreachDraft,
  p: Pending,
  current = Date.now(),
): OutreachNextStep {
  const next = (
    message: string,
    target: string,
    view: OutreachView = p.view,
  ) => ({ message, target: "outreach-" + target, view });
  if (p.dirty)
    return next(
      "Next: save your message edits. Approval stays off until the exact saved version is reviewed.",
      p.view === "Meetings" ? "meetings" : "save",
    );
  if (p.incomingDirty)
    return next(
      "Next: save and review the received reply. Copy and email handoff stay off while this reply is unsaved.",
      "incoming",
      "Conversations",
    );
  if (p.pendingReplyReview)
    return next(
      "Next: save or cancel the return-date review. Nothing resumes automatically.",
      "revisit",
      "Conversations",
    );
  if (p.timingView)
    return next(
      "Next: save or cancel the date review before approving or handing off a message.",
      p.timingView === "Meetings" ? "meetings" : "followup",
      p.timingView,
    );
  const meetingDue =
    t.meeting_state === "booked_reported" &&
    t.meeting_at &&
    Date.parse(t.meeting_at) <= current;
  if (p.view === "Meetings" || meetingDue)
    return next(
      meetingDue
        ? "Next: report whether the meeting happened. Unknown attendance and customer outcomes stay unknown."
        : "Next: review or record the meeting time and its reported outcome. A meeting is not a sale.",
      "meetings",
      "Meetings",
    );
  if (t.suppressed)
    return next(
      "This outreach is blocked by an opt-out or source challenge. Review the saved conversation; do not contact this recipient.",
      "history",
      "Conversations",
    );
  if (t.recipient_status === "invalid" || t.reply_state === "bounce")
    return next(
      "This address was recorded as bounced. Review a different recipient and fresh evidence before any outreach.",
      "draft-fields",
      "Review",
    );
  if (t.paused)
    return next(
      "This outreach is paused. Review the company and resume only when appropriate; a new approval is required.",
      "thread-controls",
    );
  const inbound = t.messages.some((m) => m.direction === "inbound");
  if (inbound && !["interested", "question"].includes(t.reply_state || "")) {
    if (t.reply_state === "referral")
      return next(
        "Next: review the referred contact. Its own recipient evidence and fresh approval are required.",
        "referral",
        "Conversations",
      );
    if (["not_now", "auto_reply"].includes(t.reply_state || ""))
      return next(
        "Next: review the recorded return date. Outreach stays stopped; an automatic reply is not a human response.",
        "reply-review",
        "Conversations",
      );
    if (
      t.reply_state === "not_interested" ||
      t.reply_state === "opt_out" ||
      t.reply_state === "source_question"
    )
      return next(
        "This reply does not invite further outreach. Review the recorded reply and keep contact stopped.",
        "reply-review",
        "Conversations",
      );
    return next(
      "Next: review the received reply and choose its status before preparing an answer.",
      "reply-review",
      "Conversations",
    );
  }
  if (t.company_conflict)
    return next(
      "Another contact at this company has active outreach. Review the company's prepared contacts and pause the other thread before preparing a new approved message.",
      "company-contacts",
    );
  if (p.footerMissing || !t.sender_footer)
    return next(
      p.footerMissing
        ? "Next: restore the required sender footer, then save changes before approval."
        : "Next: save your sender details in Edit business before approval.",
      "sender-footer",
    );
  const basis = t.contact_basis;
  const basisReviewed =
    basis &&
    draft.recipient.trim() &&
    basis.published_email.toLowerCase() ===
      draft.recipient.trim().toLowerCase() &&
    basis.source_url.trim() &&
    basis.captured_at &&
    ["recipient", "caused_by_recipient"].includes(
      basis.publisher_attribution,
    ) &&
    basis.notice_status === "clear" &&
    basis.recipient_role.trim() &&
    basis.message_relevance.trim() &&
    ["US", "CA"].includes(basis.recipient_country);
  if (p.basisDirty || !basisReviewed || draft.recipient !== t.recipient)
    return next(
      "Next: review and save recipient evidence before approval.",
      "contact-basis",
    );
  if (t.manual_action_block) {
    const cold =
      !inbound &&
      t.messages.some((m) => m.direction === "outbound") &&
      t.meeting_state === "not_recorded";
    return next(t.manual_action_block, cold ? "followup" : "draft-fields");
  }
  if (!draft.recipient.trim() || !draft.subject.trim() || !draft.body.trim())
    return next(
      inbound
        ? "Next: write and save your answer using the received reply and saved facts."
        : "Next: write and save the recipient, subject and message before approval.",
      "draft-fields",
      inbound ? "Conversations" : "Review",
    );
  if (!t.approval)
    return next(
      "Next: approve the exact saved message after review.",
      "actions",
    );
  if (p.canAct)
    return next(
      "Next: copy the approved message, then record what you sent externally.",
      "actions",
    );
  return next(
    "Review the current outreach state before taking action.",
    "thread-controls",
  );
}
