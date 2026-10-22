"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { errorMessage, jsonBody } from "../lib/api";
import type { OutreachThread } from "../lib/outreach";
import { isCustomerMessageDraft, type CustomerMessageDraft } from "./customer-result-view";
import { useWorkspaceSession } from "./workspace-session";

type Suggestion = {
  draft: CustomerMessageDraft;
  snapshot_key: string;
  expected_revision: number;
  inbound_id: string;
  facts: { id: string; excerpt: string }[];
};

function isSuggestion(value: unknown, thread: OutreachThread): value is Suggestion {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Suggestion>;
  return Boolean(
    isCustomerMessageDraft(data.draft) &&
    typeof data.snapshot_key === "string" && /^[a-f0-9]{64}$/.test(data.snapshot_key) &&
    data.expected_revision === thread.revision &&
    data.inbound_id === thread.messages.at(-1)?.id &&
    Array.isArray(data.facts) && data.facts.length <= 6 &&
    data.facts.every(fact => fact && typeof fact.id === "string" && typeof fact.excerpt === "string") &&
    data.draft!.evidence_ids.every(id => data.facts!.some(fact => fact.id === id)),
  );
}

// Parent remounts this suggestion-only scope on saved context or unsaved-state
// changes. A late provider/check response cannot overwrite the private editor.
export function ReplyCopilot({ thread, disabled, onApply }: {
  thread: OutreachThread;
  disabled: boolean;
  onApply: (draft: CustomerMessageDraft) => void;
}) {
  const { api, mode } = useWorkspaceSession();
  const [confirmed, setConfirmed] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestKey = useRef<string | null>(null);
  // An equivalent freshly fetched object is not a context change. Parent keys
  // include suspension/reload and the actual saved/private context boundaries.
  useLayoutEffect(() => () => controller.current?.abort(), [api, mode, thread.id, thread.revision, disabled]);
  const latest = thread.messages.at(-1);
  const eligible = latest?.direction === "inbound" &&
    latest.recipient.toLowerCase() === thread.recipient.toLowerCase() &&
    ["interested", "question"].includes(thread.reply_state || "") &&
    !thread.paused && !thread.suppressed && thread.recipient_status !== "invalid";

  async function request() {
    if (!eligible || disabled || busy || !confirmed) return;
    const flight = new AbortController();
    controller.current?.abort();
    controller.current = flight;
    requestKey.current ||= crypto.randomUUID();
    setBusy("request"); setError(""); setNotice("");
    try {
      const value = await api<unknown>(`/outreach/${encodeURIComponent(thread.id)}/reply-draft`, {
        method: "POST", body: jsonBody({ expected_revision: thread.revision, idempotency_key: requestKey.current,
          context_confirmed: true, context_version: "reply-context-v2" }), signal: flight.signal,
      });
      if (flight.signal.aborted) return;
      if (!isSuggestion(value, thread)) throw new Error("The suggestion could not be checked. Keep writing manually.");
      setSuggestion(value);
    } catch (cause) {
      if (!flight.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!flight.signal.aborted) setBusy("");
    }
  }

  async function apply() {
    if (!suggestion || disabled || busy) return;
    const flight = new AbortController();
    controller.current?.abort(); controller.current = flight;
    setBusy("check"); setError("");
    try {
      const result = await api<{ current: boolean; snapshot_key: string }>(`/outreach/${encodeURIComponent(thread.id)}/reply-draft/check`, {
        method: "POST", body: jsonBody({ expected_revision: thread.revision, snapshot_key: suggestion.snapshot_key }), signal: flight.signal,
      });
      if (flight.signal.aborted) return;
      if (result.current !== true || result.snapshot_key !== suggestion.snapshot_key)
        throw new Error("The conversation changed. Keep your edits and request a fresh suggestion.");
      onApply(suggestion.draft);
    } catch (cause) {
      if (!flight.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!flight.signal.aborted) setBusy("");
    }
  }

  if (mode !== "local-demo" || !eligible) return null;
  return <section className="outreach-reply-copilot" aria-label="Optional AI reply help" aria-busy={!!busy}>
    <h4>Need a starting point?</h4>
    <p>Optional AI help uses your saved offering, public company excerpts and excerpts from the last six manually recorded messages, plus the full latest received reply within its supported record limit. Email, link and phone patterns are removed; this does not guarantee anonymization. Review the conversation above and exclude private or sensitive information.</p>
    <label className="outreach-ai-consent"><input type="checkbox" checked={confirmed} disabled={disabled || !!busy}
      onChange={event => setConfirmed(event.target.checked)} />
      I reviewed this context and agree to share it with DeepSeek when I request help.
    </label>
    <p>New generation requires separately authorized pricing and monetary admission. A key alone does not enable it. Cached suggestions can reopen without another provider call. Nothing sends or becomes approved.</p>
    <button className="btn" type="button" disabled={disabled || !!busy || !confirmed} onClick={() => void request()}>
      {busy === "request" ? "Preparing suggestion…" : suggestion ? "Reopen saved suggestion" : "Request reply suggestion"}
    </button>
    {error && <><p role="alert">{error}</p><button type="button" disabled={disabled || !!busy}
      onClick={() => { requestKey.current = null; setError(""); setNotice("Ready for an explicit new request. It may incur usage if admitted; your editor is unchanged."); }}>Start a new attempt</button></>}
    {notice && <p role="status">{notice}</p>}
    {suggestion && <div>
      <p className="outreach-ai-suggestion">{suggestion.draft.body}</p>
      <ul>{suggestion.draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      <details><summary>Check suggested claims</summary><p>Supplied excerpts cited by the model; references do not establish that every statement is supported.</p>
        <ul>{suggestion.facts.filter(fact => suggestion.draft.evidence_ids.includes(fact.id)).map(fact => <li key={fact.id}>{fact.excerpt}</li>)}</ul>
      </details>
      <button className="btn" type="button" disabled={disabled || !!busy} onClick={() => void apply()}>{busy === "check" ? "Checking context…" : "Use as editable reply"}</button>
      <p>This only fills the editor. Review, save and approve the exact message separately.</p>
    </div>}
  </section>;
}
