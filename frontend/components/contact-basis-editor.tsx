"use client";

import type { ContactBasis } from "../lib/outreach";
import { safeUrl } from "../lib/utils";

export function emptyContactBasis(email: string): ContactBasis {
  return { version: 1, basis_type: "conspicuous_publication", published_email: email,
    source_url: "", captured_at: "", publisher_attribution: "unknown",
    notice_status: "unknown", recipient_role: "", message_relevance: "",
    recipient_country: "unknown", recipient_timezone: "" };
}

export function ContactBasisEditor({ value, disabled, dirty, recipientChanged, onChange, onSave }: {
  value: ContactBasis; disabled: boolean; dirty: boolean; recipientChanged: boolean;
  onChange: (value: ContactBasis) => void; onSave: () => void;
}) {
  function edit(field: keyof ContactBasis, text: string) {
    onChange({ ...value, [field]: text });
  }
  const source = safeUrl(value.source_url);
  const unsafeSource = Boolean(value.source_url && !source);
  return <section className="outreach-draft-fields" aria-label="Contact basis">
    <h3>Contact basis · recipient evidence</h3>
    <p>Review where this recipient published the address and why this message relates to their role. Your attestation is not independent verification, permission or legal clearance. Only US/Canada are allowed; the same publication policy applies to both.</p>
    <p>Evidence for: {value.published_email || "No saved recipient"}. Missing, unknown or contradictory evidence blocks approval.</p>
    {recipientChanged && <p>Save the recipient change first. It clears the old contact basis.</p>}
    {([ ["source_url", "Publication source URL"], ["captured_at", "Observation time (with timezone)"], ["recipient_role", "Recipient role"], ["message_relevance", "Message relevance to this role"], ["recipient_timezone", "Recipient timezone · optional IANA"] ] as const).map(([key, label]) => <label key={key}>{label}<input disabled={disabled} value={value[key] || ""} onChange={event => edit(key, event.target.value)} /></label>)}
    <label>Publication attribution<select disabled={disabled} value={value.publisher_attribution} onChange={e => edit("publisher_attribution", e.target.value)}><option value="unknown">Unknown</option><option value="recipient">Published by recipient</option><option value="caused_by_recipient">Publication caused by recipient</option><option value="third_party">Third party only</option></select></label>
    <label>Unsolicited-message notice review<select disabled={disabled} value={value.notice_status} onChange={e => edit("notice_status", e.target.value)}><option value="unknown">Not reviewed / unknown</option><option value="clear">Reviewed: no prohibition stated</option><option value="prohibits">Unsolicited messages prohibited</option></select></label>
    <label>Recipient country<select disabled={disabled} value={value.recipient_country} onChange={e => edit("recipient_country", e.target.value)}><option value="unknown">Unknown</option><option value="US">United States</option><option value="CA">Canada</option><option value="other">Other (blocked)</option></select></label>
    {unsafeSource && <p role="alert">Source URL is not a safe public link. Keep it as text and use a public HTTP(S) URL without credentials, local/private hosts, or IP literals.</p>}
    {source && <a href={source} target="_blank" rel="noopener noreferrer">Review publication source (external)</a>}
    <button type="button" disabled={disabled || recipientChanged || !dirty} onClick={onSave}>Save contact basis</button>
    {dirty && <p>Unsaved evidence. Save explicitly before approval or Copy. Saving clears pending approval.</p>}
  </section>;
}
