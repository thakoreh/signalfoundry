"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { errorMessage, jsonBody } from "../lib/api";
import type { Profile } from "../lib/types";
import {
  replyLabels,
  outreachMessageBody,
  normalizeContactBasisForApi,
  sameOutreachDraft,
  threadDraft,
  type ContactBasis,
  type OutreachDraft,
  type OutreachThread,
} from "../lib/outreach";
import { ContactBasisEditor, emptyContactBasis } from "./contact-basis-editor";
import { isCustomerMessageDraft } from "./customer-result-view";
import { useWorkspaceSession } from "./workspace-session";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { TimingFields, SavedMeeting, type TimingInput } from "./outreach-timing";
import { OutreachInsights } from "./outreach-insights";
import "./outreach-workspace.css";

type Step = "Review" | "Conversations" | "Meetings";
export function OutreachWorkspace({
  searchId,
  initialThreadId,
  initialView,
  profile,
  profileRefresh = 0,
  suspended = false,
}: {
  searchId: string;
  initialThreadId?: string;
  initialView?: "Review" | "Conversations" | "Meetings";
  profile?: Profile | null;
  profileRefresh?: number;
  suspended?: boolean;
}) {
  const { api, mode } = useWorkspaceSession();
  const [threads, setThreads] = useState<OutreachThread[]>([]);
  const [active, setActive] = useState("");
  const [step, setStep] = useState<Step>(initialView || "Review");
  const [drafts, setDrafts] = useState<Record<string, OutreachDraft>>({});
  const [bases, setBases] = useState<Record<string, ContactBasis>>({});
  const basisGeneration = useRef(0);
  const [incoming, setIncoming] = useState<Record<string, string>>({});
  const [replySelections, setReplySelections] = useState<Record<string, string>>({});
  const [referrals, setReferrals] = useState<Record<string, { recipient: string; contact_name: string; referrer_name: string }>>({});
  const [timings, setTimings] = useState<Record<string, TimingInput>>({});
  const [revisitAtDrafts, setRevisitAtDrafts] = useState<Record<string, string>>({});
  const [revisitZoneDrafts, setRevisitZoneDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changedSent, setChangedSent] = useState<{
    id: string;
    subject: string;
    body: string;
  } | null>(null);
  const [reload, setReload] = useState(0);
  const [terminalFailures, setTerminalFailures] = useState<
    Record<string, boolean>
  >({});
  const scope = useRef<AbortController | null>(null);
  const flight = useRef(false);
  const keys = useRef(new Map<string, string>());
  const copyGeneration = useRef(0);
  const copyAttempt = useRef<AbortController | null>(null);
  function cancelCopy() {
    copyGeneration.current++;
    copyAttempt.current?.abort();
    copyAttempt.current = null;
  }
  // Invalidate intent at committed navigation/session changes and unmount.
  // Capture the original request signal; a replacement scope cannot revive it.
  useLayoutEffect(() => {
    return () => cancelCopy();
  }, [api, mode, searchId, active, step, reload, profileRefresh, suspended]);
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    // An aborted mutation cannot clear its own flight in finally. The new
    // profile-return scope must be usable, while obsolete completions stay inert.
    flight.current = false;
    if (mode !== "local-demo" || suspended) {
      return () => controller.abort();
    }
    api<{ threads: OutreachThread[] }>(
      `/outreach?search_id=${encodeURIComponent(searchId)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setBusy("");
        setThreads(data.threads);
        setBases((current) => {
          const next: Record<string, ContactBasis> = {};
          for (const [id, basis] of Object.entries(current)) {
            const refreshed = data.threads.find((item) => item.id === id);
            if (refreshed && basis.published_email === refreshed.recipient)
              next[id] = basis;
          }
          return next;
        });
        setActive((current) =>
          initialThreadId && data.threads.some((t) => t.id === initialThreadId)
            ? initialThreadId
            : data.threads.some((t) => t.id === current)
              ? current
              : data.threads[0]?.id || "",
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, mode, searchId, reload, profileRefresh, suspended, initialThreadId]);
  const thread = threads.find((item) => item.id === active);
  const draft = thread ? drafts[thread.id] || threadDraft(thread) : null;
  const dirty = Boolean(
    thread && draft && !sameOutreachDraft(draft, threadDraft(thread)),
  );
  const recipientChanged = Boolean(
    thread && draft && draft.recipient !== thread.recipient,
  );
  const basis = thread
    ? recipientChanged
      ? emptyContactBasis(draft?.recipient || "")
      : bases[thread.id] || thread.contact_basis || emptyContactBasis(thread.recipient)
    : null;
  const basisDirty = Boolean(thread && bases[thread.id]);
  useUnsavedChanges(
    Object.keys(bases).length > 0 ||
    Object.keys(drafts).length > 0 ||
      Object.values(incoming).some(Boolean) ||
      Object.keys(referrals).length > 0 ||
      Object.keys(timings).length > 0 || Object.values(revisitAtDrafts).some(Boolean) || Object.values(revisitZoneDrafts).some(Boolean) ||
      !!changedSent,
  );
  const replyPermitsAction =
    !thread?.messages.some((message) => message.direction === "inbound") ||
    !thread?.reply_state ||
    ["interested", "question"].includes(thread.reply_state);
  const canAct = Boolean(
    thread?.ready_for_manual_action &&
    !dirty &&
    !basisDirty &&
    !thread.paused &&
    !thread.suppressed &&
    thread.approval,
  );
  const footerMissing = Boolean(
    thread?.sender_footer &&
      draft?.body.trim() &&
      !draft.body.endsWith(thread.sender_footer),
  );
  const savedRecipientEvidence = !recipientChanged
    ? thread?.contact_basis
    : null;
  const recipientStatus =
    recipientChanged
      ? "edited recipient · verification not established"
      : thread?.recipient_status === "verified"
        ? "provider reports verified"
        : thread?.recipient_status === "published_unverified"
          ? "published but not verified"
          : thread?.recipient_status === "user_entered"
            ? "user-entered · verification unknown"
            : "unknown";
  const nextAction =
    !thread || !draft
      ? ""
      : thread.suppressed
        ? "This outreach is blocked by an opt-out. Do not contact this recipient."
        : thread.paused
          ? "This outreach is paused. Resume this outreach only when appropriate."
          : dirty
            ? "Next: save your message edits. Approval stays off until the exact saved version is reviewed."
            : footerMissing
              ? "Next: restore the required sender footer, then save changes before approval."
              : !thread.sender_footer
                ? "Next: save your sender details in Edit business before approval."
                : !thread.contact_basis
                  ? "Next: review and save recipient evidence before approval."
                  : thread.manual_action_block
                    ? thread.manual_action_block
                  : !thread.approval
                    ? "Next: approve the exact saved message after review."
                    : canAct
                      ? "Next: copy the approved message, then record what you sent externally."
                      : "Review the current outreach state before taking action.";
  function edit(field: keyof OutreachDraft, value: string) {
    if (!thread || !draft) return;
    cancelCopy();
    setDrafts((current) => ({
      ...current,
      [thread.id]: { ...draft, [field]: value },
    }));
    setNotice("");
  }
  async function mutate(
    action: string,
    method: string,
    payload: Record<string, unknown> = {},
  ) {
    if (!thread || flight.current || !scope.current) return;
    cancelCopy();
    flight.current = true;
    setBusy(action);
    setError("");
    setNotice("");
    const signal = scope.current.signal;
    const basisVersion = basisGeneration.current;
    const signature = JSON.stringify([
      thread.id,
      thread.revision,
      action,
      payload,
    ]);
    const key = keys.current.get(signature) || crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const updated = await api<OutreachThread>(
        `/outreach/${encodeURIComponent(thread.id)}/${action}`,
        {
          method,
          signal,
          body: jsonBody({
            ...payload,
            expected_revision: thread.revision,
            idempotency_key: key,
          }),
        },
      );
      if (signal.aborted) return;
      if (action === "referrals") {
        const saved = await api<{ threads: OutreachThread[] }>(`/outreach?search_id=${encodeURIComponent(searchId)}`, { signal });
        if (signal.aborted) return;
        setThreads(saved.threads);
        setActive(updated.id);
        setStep("Review");
        setReferrals((current) => { const next = { ...current }; delete next[thread.id]; return next; });
      } else {
        setThreads((current) => current.map((item) => item.id === updated.id ? updated : item));
      }
      if (["draft", "sent", "replies"].includes(action))
        setDrafts((current) => {
          const next = { ...current };
          delete next[updated.id];
          return next;
        });
      if (action === "contact-basis" && basisGeneration.current === basisVersion)
        setBases((current) => { const next = { ...current }; delete next[updated.id]; return next; });
      if (action === "draft" && updated.recipient !== thread.recipient)
        setBases((current) => { const next = { ...current }; delete next[updated.id]; return next; });
      if (action === "replies")
        setIncoming((current) => ({ ...current, [thread.id]: "" }));
      if (action === "reply-state")
        setReplySelections((current) => { const next = { ...current }; delete next[updated.id]; return next; });
      if (action === "sent") setChangedSent(null);
      if (action === "meeting" || action === "followups")
        setTimings(current => { const next = { ...current }; delete next[thread.id]; return next; });
      if (action === "meeting-confirmation") setStep("Review");
      setNotice(
        action === "referrals"
          ? "New referred contact saved. Review its own contact basis and message before fresh approval."
          : action === "sent"
          ? "Recorded as sent externally. Clientrove did not send this message."
          : action === "approve"
            ? "This exact message is approved for your manual action."
            : "Saved.",
      );
      keys.current.delete(signature);
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!signal.aborted) {
        flight.current = false;
        setBusy("");
      }
    }
  }
  async function generate() {
    if (!thread || flight.current || !scope.current) return;
    cancelCopy();
    flight.current = true;
    setBusy("generate");
    setError("");
    setNotice("");
    const signal = scope.current.signal;
    const signature = `ai:${thread.id}`;
    const key = keys.current.get(signature) || crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const result = await api<unknown>(
        `/customers/searches/${encodeURIComponent(searchId)}/accounts/${encodeURIComponent(thread.account_id)}/draft`,
        { method: "POST", signal, body: jsonBody({ idempotency_key: key }) },
      );
      if (signal.aborted) return;
      if (!isCustomerMessageDraft(result))
        throw new Error(
          "The AI draft could not be read. Try again to retrieve the saved draft.",
        );
      setDrafts((current) => ({
        ...current,
        [thread.id]: {
          ...(current[thread.id] || threadDraft(thread)),
          subject: result.subject,
          body: result.body + (thread.sender_footer || ""),
        },
      }));
      setNotice(
        "AI draft added to the editor. Review the facts, then save and approve it.",
      );
      setTerminalFailures((current) => ({ ...current, [thread.id]: false }));
    } catch (cause) {
      if (!signal.aborted) {
        setError(errorMessage(cause));
        if (
          cause &&
          typeof cause === "object" &&
          "code" in cause &&
          cause.code === "DRAFT_FAILED"
        ) {
          keys.current.delete(signature);
          setTerminalFailures((current) => ({ ...current, [thread.id]: true }));
        }
      }
    } finally {
      if (!signal.aborted) {
        flight.current = false;
        setBusy("");
      }
    }
  }
  async function copy() {
    if (
      !thread ||
      !draft ||
      !canAct ||
      flight.current ||
      copyAttempt.current ||
      !scope.current ||
      scope.current.signal.aborted
    )
      return;
    const controller = new AbortController();
    copyAttempt.current = controller;
    const signal = AbortSignal.any([controller.signal, scope.current.signal]);
    const generation = copyGeneration.current;
    const intent = {
      id: thread.id,
      searchId: thread.search_id,
      revision: thread.revision,
      approval: { ...thread.approval! },
      footer: thread.sender_footer,
      draft: { ...draft },
    };
    const isCurrent = () =>
      !signal.aborted &&
      generation === copyGeneration.current &&
      copyAttempt.current === controller;
    setError("");
    setNotice("");
    try {
      const current = await api<OutreachThread>(
        `/outreach/${encodeURIComponent(intent.id)}`,
        { signal },
      );
      if (!isCurrent()) return;
      if (
        current.id !== intent.id ||
        current.search_id !== intent.searchId ||
        current.revision !== intent.revision ||
        current.ready_for_manual_action !== true ||
        current.paused !== false ||
        current.suppressed !== false ||
        !current.approval ||
        current.approval.content_hash !== intent.approval.content_hash ||
        current.approval.approved_at !== intent.approval.approved_at ||
        current.approval.revision !== intent.approval.revision ||
        current.sender_footer !== intent.footer ||
        !sameOutreachDraft(intent.draft, threadDraft(current))
      ) {
        setError(
          "Approval changed. Restore the saved sender footer, save and approve again. Your edits are still here.",
        );
        return;
      }
      await navigator.clipboard.writeText(
        `To: ${current.recipient}\nSubject: ${current.subject}\n\n${outreachMessageBody(current)}`,
      );
      if (isCurrent()) setNotice("Approved message copied. Nothing was sent.");
    } catch {
      if (isCurrent())
        setError(
          "Copy readiness could not be confirmed or clipboard access failed. Nothing was sent. Check your connection and try Copy again.",
        );
    } finally {
      if (copyAttempt.current === controller) copyAttempt.current = null;
    }
  }
  if (mode !== "local-demo")
    return (
      <section className="outreach-workspace">
        <h1>Outreach isn’t available in this workspace yet.</h1>
        <p>
          Your customer research remains available. Outreach requires
          server-backed persistence for this deployment.
        </p>
        <Link href={`/workspace/customers/${encodeURIComponent(searchId)}`}>
          Return to your customer list
        </Link>
      </section>
    );
  return (
    <section className="outreach-workspace" aria-labelledby="outreach-title">
      <Link
        className="outreach-back"
        href={`/workspace/customers/${encodeURIComponent(searchId)}`}
      >
        ← Customer list
      </Link>
      <header className="outreach-heading">
        <span className="eyebrow">YOUR NEXT CONVERSATIONS</span>
        <h1 id="outreach-title">Turn a customer list into conversations.</h1>
        <p>
          No mailbox is connected. Review here, send in your own email app, and
          record what happened.
        </p>
      </header>
      <nav className="outreach-steps" aria-label="Outreach stages">
        {(["Review", "Conversations", "Meetings"] as Step[]).map((label) => (
          <button
            key={label}
            type="button"
            aria-current={step === label ? "step" : undefined}
            onClick={() => {
              setStep(label);
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <OutreachInsights revision={threads.reduce((total, item) => total + item.revision, 0)} />
      {error && (
        <div className="outreach-feedback" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              setBases({});
              setDrafts({});
              setIncoming({});
              setReferrals({});
              setTimings({});
              setRevisitAtDrafts({});
              setRevisitZoneDrafts({});
              setLoading(true);
              setError("");
              setReload((value) => value + 1);
            }}
          >
            {dirty || basisDirty || Object.values(incoming).some(Boolean) || Object.keys(referrals).length > 0 || Object.keys(timings).length > 0 || changedSent
              ? "Reload saved version (discard edits)"
              : "Reload saved outreach"}
          </button>
        </div>
      )}
      {notice && (
        <p className="outreach-feedback" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading saved outreach…</p>
      ) : !threads.length ? (
        <div className="outreach-empty">
          <h2>No businesses prepared yet.</h2>
          <p>
            Select up to five businesses from your list, then choose Prepare
            outreach.
          </p>
          <Link
            className="btn primary"
            href={`/workspace/customers/${encodeURIComponent(searchId)}`}
          >
            Choose businesses
          </Link>
        </div>
      ) : (
        <div className="outreach-layout">
          <aside className="outreach-leads" aria-label="Prepared businesses">
            {threads.map((item) => (
              <button
                key={item.id}
                type="button"
                className="outreach-lead"
                aria-pressed={item.id === active}
                disabled={!!busy}
                onClick={() => {
                  setActive(item.id);
                  setError("");
                  setNotice("");
                }}
              >
                <strong>{item.company_name}</strong>
                <span>{item.recipient || item.domain}</span>
                <small>
                  {item.suppressed
                    ? "Opted out"
                    : item.paused
                      ? "Paused"
                      : item.reply_state &&
                          item.messages.some(
                            (message) => message.direction === "inbound",
                          )
                        ? replyLabels[item.reply_state]
                        : item.messages.some((m) => m.direction === "outbound")
                          ? "Sent externally"
                          : item.approval
                            ? "Approved"
                            : "Needs review"}
                </small>
              </button>
            ))}
          </aside>
          {thread && draft && (
            <article
              className="outreach-editor"
              aria-labelledby="outreach-company"
            >
              <header className="outreach-company">
                <div>
                  <h2 id="outreach-company">{thread.company_name}</h2>
                  <p>{thread.domain}</p>
                  {thread.referrer_name && <p>Referred by {thread.referrer_name} · new contact, verification not inherited</p>}
                </div>
                <button
                  type="button"
                  disabled={!!busy || thread.suppressed}
                  onClick={() =>
                    void mutate("pause", "PATCH", { paused: !thread.paused })
                  }
                >
                  {thread.paused ? "Resume this outreach" : "Pause this outreach"}
                </button>
              </header>
              {(thread.suppressed || thread.paused) && (
                <p className="outreach-blocked" role="status">
                  {thread.suppressed
                    ? "This business opted out. Further outreach is blocked."
                    : "Outreach is paused. Resume only when appropriate."}
                </p>
              )}
              <section className="outreach-next-action" aria-label="Current outreach step">
                <div>
                  <strong>Current state and next safe action</strong>
                  <p>{nextAction}</p>
                </div>
                <a href="#outreach-actions">Jump to next safe action</a>
              </section>
              {step === "Meetings" ? (
                <div className="outreach-meetings">
                  <h3>Track what happened</h3>
                  <p>
                    These are your records. A booking link or a sent message
                    does not establish that a meeting happened.
                  </p>
                  <SavedMeeting thread={thread} />
                  <TimingFields kind="Meeting" disabled={!!busy} value={timings[thread.id] || { at: "", zone: "" }}
                    onChange={value => setTimings(current => ({ ...current, [thread.id]: value }))} />
                  <button className="btn" type="button" disabled={!!busy || dirty || !timings[thread.id]?.at || !timings[thread.id]?.zone}
                    onClick={() => void mutate("meeting", "POST", { meeting_at: timings[thread.id].at, meeting_timezone: timings[thread.id].zone })}>
                    {thread.meeting_at ? "Report a changed meeting time" : "Report a timed booking"}
                  </button>
                  {thread.meeting_state === "booked_reported" && thread.meeting_at && (
                    <button className="btn" type="button" disabled={!!busy || dirty || thread.suppressed || thread.paused}
                      onClick={() => void mutate("meeting-confirmation", "POST", {
                        subject: "Confirming our meeting", body: `Confirming our meeting at ${thread.meeting_at} (${thread.meeting_timezone}). Please reply if this time no longer works.${thread.sender_footer || ""}`,
                      })}>Prepare a confirmation for review</button>
                  )}
                  <label>
                    Booking link
                    <input
                      disabled={!!busy}
                      type="url"
                      value={draft.booking_link}
                      onChange={(event) =>
                        edit("booking_link", event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="btn"
                    type="button"
                    disabled={!!busy || !dirty}
                    onClick={() => void mutate("draft", "PUT", draft)}
                  >
                    Save booking link
                  </button>
                  <label>
                    Meeting · reported by you
                    <select
                      value={thread.meeting_state}
                      disabled={!!busy}
                      onChange={(event) =>
                        void mutate("outcomes", "PATCH", {
                          meeting_state: event.target.value,
                          sale_state: thread.sale_state,
                        })
                      }
                    >
                      <option value="not_recorded">Not recorded</option>
                      <option value="booked_reported" disabled>Booked · confirm the time above</option>
                      <option value="attended_reported">Attended</option>
                      <option value="no_show_reported">No show</option>
                      <option value="cancelled_reported">Cancelled</option>
                    </select>
                  </label>
                  <label>
                    Customer outcome · reported by you
                    <select
                      value={thread.sale_state}
                      disabled={!!busy}
                      onChange={(event) =>
                        void mutate("outcomes", "PATCH", {
                          meeting_state: thread.meeting_state,
                          sale_state: event.target.value,
                        })
                      }
                    >
                      <option value="not_recorded">Not recorded</option>
                      <option value="won_reported">Became a customer</option>
                      <option value="lost_reported">
                        Did not become a customer
                      </option>
                    </select>
                  </label>
                </div>
              ) : (
                <>
                  {!thread.messages.some(message => message.direction === "inbound") && thread.messages.some(message => message.direction === "outbound") && thread.meeting_state === "not_recorded" && (
                    <section className="outreach-followup" aria-label="Manual followup plan">
                      <h3>Plan a reminder</h3>
                      <p>{thread.followups_sent || 0} of 2 followups recorded. Check your inbox first. Every received reply stops the cold sequence.</p>
                      {thread.next_followup_at && <p>Next review: {thread.next_followup_at} ({thread.followup_timezone}). Approval is required when due.</p>}
                      <TimingFields kind="Followup" disabled={!!busy} value={timings[thread.id] || { at: "", zone: "" }}
                        onChange={value => setTimings(current => ({ ...current, [thread.id]: value }))} />
                      <p>Write and save the reminder below, then choose a weekday at least three business days after your last reported send.</p>
                      <button className="btn" type="button" disabled={!!busy || dirty || !draft.subject.trim() || !draft.body.trim() || !timings[thread.id]?.at || !timings[thread.id]?.zone || (thread.followups_sent || 0) >= 2 || thread.suppressed || thread.paused}
                        onClick={() => void mutate("followups", "POST", { subject: draft.subject, body: draft.body,
                          scheduled_at: timings[thread.id].at, scheduled_timezone: timings[thread.id].zone })}>Save followup review date</button>
                    </section>
                  )}
                  {step === "Conversations" && (
                    <>
                    <section className="outreach-saved-facts" aria-label="Saved offer facts">
                      <h3>Saved offer facts</h3>
                      <p><strong>What you sell:</strong> {profile?.description || "Unknown"}</p>
                      <p><strong>Buyer roles:</strong> {profile?.buyer_roles.length ? profile.buyer_roles.join(", ") : "Unknown"}</p>
                      <p><strong>Industries:</strong> {profile?.industries.length ? profile.industries.join(", ") : "Unknown"}</p>
                      <p><strong>Geographies:</strong> {profile?.geographies.length ? profile.geographies.join(", ") : "Unknown"}</p>
                      <p><strong>Price or integration details:</strong> Unknown</p>
                    </section>
                    <section className="outreach-conversation">
                    <h3>Conversation history</h3>
                      {!thread.messages.length && (
                        <p>No messages recorded yet.</p>
                      )}
                      {thread.messages.map((message) => (
                        <div className="outreach-message" key={message.id}>
                          <strong>
                            {message.direction === "inbound"
                              ? "Received reply · pasted by you"
                              : "Sent externally · recorded by you"}
                          </strong>
                          <p>{message.body}</p>
                          {message.direction === "outbound" && <details>
                            <summary>Contact basis saved at approval</summary>
                            {message.contact_basis_snapshot ? <>
                              <p>{message.contact_basis_snapshot.source_url} · observed {message.contact_basis_snapshot.captured_at || "time unknown"}</p>
                              <p>{message.contact_basis_snapshot.recipient_role}: {message.contact_basis_snapshot.message_relevance}</p>
                            </> : <p>Unknown for this older record. No basis has been backfilled.</p>}
                          </details>}
                          {message.sent_as === "with_changes" && (
                            <details>
                              <summary>
                                Sent with changes · original approval
                              </summary>
                              <p>{message.approved_subject}</p>
                              <p>{message.approved_body}</p>
                            </details>
                          )}
                        </div>
                      ))}
                      {thread.reply_state === "referral" && !thread.suppressed && (
                        <section className="outreach-referral" aria-label="Referred contact">
                          <h3>Add the referred contact</h3>
                          <p>The original thread stays intact. This is your explicit choice to review a new contact at this company; its own basis and approval are required.</p>
                          {([['recipient', 'Referred email'], ['contact_name', 'Referred name · optional'], ['referrer_name', 'Person who referred you']] as const).map(([name, label]) => (
                            <label key={name}>{label}<input type={name === 'recipient' ? 'email' : 'text'} disabled={!!busy} maxLength={name === 'recipient' ? 320 : 160}
                              value={referrals[thread.id]?.[name] || ''} onChange={(event) => setReferrals(current => ({ ...current,
                                [thread.id]: { ...(current[thread.id] || { recipient: '', contact_name: '', referrer_name: '' }), [name]: event.target.value } }))} /></label>
                          ))}
                          <button type="button" className="btn" disabled={!!busy || dirty || !referrals[thread.id]?.recipient.trim() || !referrals[thread.id]?.referrer_name.trim()}
                            onClick={() => void mutate("referrals", "POST", { ...referrals[thread.id], referrer_message_id: thread.messages.findLast(message => message.direction === 'inbound')?.id })}>
                            Add referred contact
                          </button>
                        </section>
                      )}
                      <label>
                        Paste a received reply
                        <textarea
                          disabled={!!busy}
                          value={incoming[thread.id] || ""}
                          onChange={(event) =>
                            setIncoming((current) => ({
                              ...current,
                              [thread.id]: event.target.value,
                            }))
                          }
                          rows={3}
                        />
                      </label>
                      <button
                        className="btn"
                        type="button"
                        disabled={
                          !!busy || dirty || !incoming[thread.id]?.trim()
                        }
                        onClick={() =>
                          void mutate("replies", "POST", {
                            body: incoming[thread.id],
                            reply_state: "awaiting_review",
                          })
                        }
                      >
                        Save received reply
                      </button>
                      {dirty && (
                        <p className="outreach-review-note">
                          Save your message edits before recording a received
                          reply.
                        </p>
                      )}
                      {thread.messages.some(
                        (message) => message.direction === "inbound",
                      ) && (
                        <>
                        <label>
                          Review reply status
                          <select
                            value={replySelections[thread.id] || thread.reply_state || "awaiting_review"}
                            disabled={!!busy}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "not_now" || value === "auto_reply") {
                                setReplySelections((current) => ({ ...current, [thread.id]: value }));
                              } else {
                                void mutate("reply-state", "PATCH", { reply_state: value });
                              }
                            }}
                          >
                            {Object.entries(replyLabels).map(
                              ([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        {(replySelections[thread.id] === "not_now" || replySelections[thread.id] === "auto_reply") && (
                          <section className="outreach-revisit-controls" aria-label="Revisit date controls">
                            <label>
                              Return date and time (include numeric offset)
                              <input placeholder="2026-11-05T10:00:00-05:00" value={revisitAtDrafts[thread.id] || ""} onChange={(event) => setRevisitAtDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} />
                            </label>
                            <label>
                              IANA timezone
                              <input placeholder="America/Toronto" value={revisitZoneDrafts[thread.id] || ""} onChange={(event) => setRevisitZoneDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} />
                            </label>
                            <button className="btn" type="button" disabled={!!busy} onClick={() => void mutate("reply-state", "PATCH", { reply_state: replySelections[thread.id], revisit_at: revisitAtDrafts[thread.id] || null, revisit_timezone: revisitZoneDrafts[thread.id] || null })}>
                              Save reply review
                            </button>
                          </section>
                        )}
                        </>
                      )}
                      <h3>Write your reply</h3>
                      <p>
                        Check the received reply and write your response below.
                        Replies are written by you.
                      </p>
                    </section>
                    </>
                  )}
                  <div className="outreach-draft-fields">
                    <label>
                      Recipient
                      <input
                        disabled={!!busy}
                        type="email"
                        autoComplete="off"
                        maxLength={320}
                        value={draft.recipient}
                        onChange={(event) =>
                          edit("recipient", event.target.value)
                        }
                      />
                    </label>
                    <p className="outreach-recipient-status">
                      Email status: {recipientStatus}
                    </p>
                    <section
                      className="outreach-recipient-evidence"
                      aria-label="Recipient email evidence"
                    >
                      <p>
                        <strong>Provenance:</strong>{" "}
                        {savedRecipientEvidence?.source_url
                          ? savedRecipientEvidence.source_url
                          : "Unknown — no saved source evidence."}
                      </p>
                      <p>
                        <strong>Observed:</strong>{" "}
                        {savedRecipientEvidence?.captured_at || "Unknown"}
                      </p>
                      <p>
                        Approval confirms exact content; it does not verify
                        reachability or delivery.
                      </p>
                    </section>
                    <label>
                      Subject
                      <input
                        disabled={!!busy}
                        value={draft.subject}
                        maxLength={160}
                        onChange={(event) =>
                          edit("subject", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Message
                      <textarea
                        disabled={!!busy}
                        rows={9}
                        maxLength={6000}
                        value={draft.body}
                        onChange={(event) => edit("body", event.target.value)}
                      />
                    </label>
                    <label>
                      Booking link · optional
                      <input
                        disabled={!!busy}
                        type="url"
                        value={draft.booking_link}
                        onChange={(event) =>
                          edit("booking_link", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  {basis && <ContactBasisEditor value={basis} disabled={!!busy && busy !== "contact-basis"}
                    dirty={basisDirty} recipientChanged={recipientChanged}
                    onChange={(value) => { cancelCopy(); basisGeneration.current++; setBases(current => ({ ...current, [thread.id]: value })); setNotice(""); }}
                    onSave={() => void mutate("contact-basis", "PUT", { contact_basis: normalizeContactBasisForApi(basis) })} />}
                  {step === "Review" && !thread.messages.length && (
                    <p className="outreach-review-note">
                      The first cold message must not include a booking link.
                    </p>
                  )}
                  {thread.sender_footer ? (
                    <>
                      {footerMissing && (
                        <p className="outreach-footer-repair-note" role="status">
                          Restore the required sender footer, then save changes
                          before approval.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => {
                          if (!draft.body.endsWith(thread.sender_footer!))
                            edit(
                              "body",
                              draft.body.trimEnd() + thread.sender_footer,
                            );
                        }}
                      >
                        Restore saved sender footer
                      </button>
                    </>
                  ) : (
                    <p>
                      Before approval,{" "}
                      <Link href="/workspace/setup">Edit business</Link> to save
                      your sender name, company, mailing address and reachable
                      contact. Outreach must include these details.
                    </p>
                  )}
                  {step === "Review" && !thread.messages.length && (
                    <p className="outreach-review-note">
                      AI generation uses the configured provider when no cached
                      original exists. Review the result before approving it.
                      {terminalFailures[thread.id]
                        ? " The previous attempt failed. Trying again can use another generation allowance."
                        : ""}
                    </p>
                  )}
                  <div className="outreach-edit-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={!!busy || !dirty}
                      onClick={() => void mutate("draft", "PUT", draft)}
                    >
                      {busy === "draft" ? "Saving…" : "Save changes"}
                    </button>
                    {step === "Review" && !thread.messages.length && (
                      <button
                        type="button"
                        disabled={!!busy || thread.suppressed || thread.paused}
                        onClick={() => void generate()}
                      >
                        {busy === "generate"
                          ? "Preparing AI draft…"
                          : draft.body
                            ? "Retrieve original AI draft"
                            : "Generate AI draft"}
                      </button>
                    )}
                  </div>
                  <p className="outreach-review-note">
                    {dirty
                      ? "Unsaved edits. Save and approve this exact version before taking action."
                      : thread.approval
                        ? "This saved version is approved. Any edit requires a new approval."
                        : "Review the recipient and facts, save your message, then approve the exact content."}
                  </p>
                  <div className="outreach-action-bar" id="outreach-actions">
                    <button
                      className="btn primary"
                      type="button"
                      disabled={
                        !!busy ||
                        dirty ||
                        footerMissing ||
                        basisDirty ||
                        !draft.recipient.trim() ||
                        !draft.subject.trim() ||
                        !draft.body.trim() ||
                        thread.suppressed ||
                        thread.paused ||
                        !!thread.manual_action_block ||
                        !replyPermitsAction ||
                        !!thread.approval
                      }
                      onClick={() => void mutate("approve", "POST")}
                    >
                      Approve exact message
                    </button>
                    <button
                      className="btn"
                      type="button"
                      disabled={!!busy || !canAct}
                      onClick={() => void copy()}
                    >
                      Copy approved message
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !canAct}
                      onClick={() => void mutate("sent", "POST")}
                    >
                      Record sent externally
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !canAct}
                      onClick={() =>
                        setChangedSent({
                          id: thread.id,
                          subject: thread.subject,
                          body: outreachMessageBody(draft),
                        })
                      }
                    >
                      Sent with changes
                    </button>
                  </div>
                  {changedSent?.id === thread.id && (
                    <section
                      className="outreach-draft-fields"
                      aria-label="Record actual sent message"
                    >
                      <p>
                        Reported by you, not sent by Clientrove. Include the
                        complete text that actually went out. The original
                        approved text stays separate.
                      </p>
                      <label>
                        Actual subject sent
                        <input
                          maxLength={160}
                          value={changedSent.subject}
                          onChange={(e) =>
                            setChangedSent({
                              ...changedSent,
                              subject: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Actual message sent
                        <textarea
                          rows={6}
                          maxLength={10000}
                          value={changedSent.body}
                          onChange={(e) =>
                            setChangedSent({
                              ...changedSent,
                              body: e.target.value,
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          !!busy ||
                          !canAct ||
                          !changedSent.subject.trim() ||
                          !changedSent.body.trim()
                        }
                        onClick={() =>
                          void mutate("sent", "POST", {
                            sent_as: "with_changes",
                            actual_subject: changedSent.subject,
                            actual_body: changedSent.body,
                          })
                        }
                      >
                        Record changed message
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => setChangedSent(null)}
                      >
                        Not yet
                      </button>
                    </section>
                  )}
                  {!replyPermitsAction && !thread.suppressed && (
                    <p className="outreach-review-note">
                      This reply needs review or does not invite further
                      outreach. Approval is blocked for its current status.
                    </p>
                  )}
                  <p className="outreach-review-note">
                    Nothing is sent automatically. Record sent externally only
                    after you have sent this exact message yourself.
                  </p>
                </>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
