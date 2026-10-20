"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { errorMessage, jsonBody } from "../lib/api";
import {
  replyLabels,
  outreachMessageBody,
  sameOutreachDraft,
  threadDraft,
  type OutreachDraft,
  type OutreachThread,
} from "../lib/outreach";
import { isCustomerMessageDraft } from "./customer-result-view";
import { useWorkspaceSession } from "./workspace-session";
import "./outreach-workspace.css";

type Step = "Review" | "Conversations" | "Meetings";
export function OutreachWorkspace({ searchId }: { searchId: string }) {
  const { api, mode } = useWorkspaceSession();
  const [threads, setThreads] = useState<OutreachThread[]>([]);
  const [active, setActive] = useState("");
  const [step, setStep] = useState<Step>("Review");
  const [drafts, setDrafts] = useState<Record<string, OutreachDraft>>({});
  const [incoming, setIncoming] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [terminalFailures, setTerminalFailures] = useState<
    Record<string, boolean>
  >({});
  const scope = useRef<AbortController | null>(null);
  const flight = useRef(false);
  const keys = useRef(new Map<string, string>());
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    if (mode !== "local-demo") {
      return () => controller.abort();
    }
    api<{ threads: OutreachThread[] }>(
      `/outreach?search_id=${encodeURIComponent(searchId)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setThreads(data.threads);
        setActive((current) =>
          data.threads.some((t) => t.id === current)
            ? current
            : data.threads[0]?.id || "",
        );
        setDrafts({});
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, mode, searchId, reload]);
  const thread = threads.find((item) => item.id === active);
  const draft = thread ? drafts[thread.id] || threadDraft(thread) : null;
  const dirty = Boolean(
    thread && draft && !sameOutreachDraft(draft, threadDraft(thread)),
  );
  const replyPermitsAction =
    !thread?.messages.some((message) => message.direction === "inbound") ||
    !thread?.reply_state ||
    ["interested", "question"].includes(thread.reply_state);
  const canAct = Boolean(
    thread?.ready_for_manual_action &&
    !dirty &&
    !thread.paused &&
    !thread.suppressed &&
    thread.approval,
  );
  function edit(field: keyof OutreachDraft, value: string) {
    if (!thread || !draft) return;
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
    flight.current = true;
    setBusy(action);
    setError("");
    setNotice("");
    const signal = scope.current.signal;
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
      setThreads((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (["draft", "sent", "replies"].includes(action))
        setDrafts((current) => {
          const next = { ...current };
          delete next[updated.id];
          return next;
        });
      if (action === "replies")
        setIncoming((current) => ({ ...current, [thread.id]: "" }));
      setNotice(
        action === "sent"
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
          body: result.body,
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
    if (!draft || !canAct) return;
    try {
      await navigator.clipboard.writeText(
        `To: ${draft.recipient}\nSubject: ${draft.subject}\n\n${outreachMessageBody(draft)}`,
      );
      setNotice("Approved message copied. Nothing was sent.");
    } catch {
      setError(
        "Copy was unavailable. Select the approved text and copy it manually.",
      );
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
      {error && (
        <div className="outreach-feedback" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              setLoading(true);
              setError("");
              setReload((value) => value + 1);
            }}
          >
            {dirty
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
                </div>
                <button
                  type="button"
                  disabled={!!busy || thread.suppressed}
                  onClick={() =>
                    void mutate("pause", "PATCH", { paused: !thread.paused })
                  }
                >
                  {thread.paused ? "Resume" : "Pause"}
                </button>
              </header>
              {(thread.suppressed || thread.paused) && (
                <p className="outreach-blocked" role="status">
                  {thread.suppressed
                    ? "This business opted out. Further outreach is blocked."
                    : "Outreach is paused. Resume only when appropriate."}
                </p>
              )}
              {step === "Meetings" ? (
                <div className="outreach-meetings">
                  <h3>Track what happened</h3>
                  <p>
                    These are your records. A booking link or a sent message
                    does not establish that a meeting happened.
                  </p>
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
                      <option value="booked_reported">Booked</option>
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
                  {step === "Conversations" && (
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
                        </div>
                      ))}
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
                        <label>
                          Review reply status
                          <select
                            value={thread.reply_state || "awaiting_review"}
                            disabled={!!busy}
                            onChange={(event) =>
                              void mutate("reply-state", "PATCH", {
                                reply_state: event.target.value,
                              })
                            }
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
                      )}
                      <h3>Write your reply</h3>
                      <p>
                        Check the received reply and write your response below.
                        Replies are written by you.
                      </p>
                    </section>
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
                      {draft.recipient === thread.recipient
                        ? thread.recipient_status === "verified"
                          ? "Provider verified email"
                          : thread.recipient_status === "published_unverified"
                            ? "Unverified email"
                            : "Email status not verified"
                        : "Edited recipient · verification not established"}
                    </p>
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
                  <div className="outreach-action-bar">
                    <button
                      className="btn primary"
                      type="button"
                      disabled={
                        !!busy ||
                        dirty ||
                        !draft.recipient.trim() ||
                        !draft.subject.trim() ||
                        !draft.body.trim() ||
                        thread.suppressed ||
                        thread.paused ||
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
                  </div>
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
