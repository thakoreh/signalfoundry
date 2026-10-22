# Focused next-action UX/spec review

Source: `626093dc56a49af0fb1534785f217b9817fbf07b`, detached clean `worktrees/legal-review`. This is a focused read-only review, not app acceptance. Product source was not edited. No browser was controlled, owner data opened, provider called, message sent, or remote state changed.

## Verdict and evidence

**P1: The instruction can recommend an unavailable approval and always jumps to the approval bar instead of the needed review control.** In `frontend/components/outreach-workspace.tsx:189`, the next-action ternary checks neither actual reply classification nor its prerequisites before falling through to “approve.” The separate approval guard at line 1005 rejects actual inbound classifications other than interested/question (`replyPermitsAction`, line 158). Thus saved `awaiting_review` and referral conversations can display an approval instruction while approval is disabled. The main instruction should explain the current prerequisite, not make the user discover it at the bottom.

The link at line 596 always targets `#outreach-actions`. Reply classification and referral inputs are above that bar. Contact evidence guidance also jumps past its own editor. **Meetings has no such target at all**: its render branch precedes the alternate branch containing the action bar at line 1004. The same instruction/destination mismatch affects missing sender/footer details, edits, and timed lifecycle work.

Parent supplied fresh real Chrome captures from its isolated fictional local run, inspected for this review:

- `chrome-20261021-evidence/11-referral-review-390.jpg`: referral fields and conversation history appear above the bottom action bar; generic guidance does not take the founder to referral work. This supports the reported mismatch.
- `chrome-20261021-evidence/08-review-390.jpg`: establishes the baseline lengthy review screen. The visible approval appears active in this capture; it is not independent screenshot proof of the later awaiting-review disabled state. That case is supported by source guards and the parent's direct live observation.
- `chrome-20261021-evidence/07-next-up-390.jpg`: returning queue layout is styled, but Refresh, Refresh saved work, and Refresh activity appear as native controls. This is **P2 visual consistency**, not evidence that the entire theme failed. Their component buttons lack the existing shared `btn` class.

Other relevant source gaps: `company_conflict` and invalid/bounced recipient state are absent from nextAction; basis presence alone is treated as sufficient despite dirty/incomplete evidence; blank subject/body has no actionable instruction. Recipient status `invalid` also falls through to “unknown” in the displayed recipient label (line 179). Preserve the invalid distinction rather than softening it.

## Minimal repair

Replace the text-only ternary and universal anchor with one pure next-step descriptor: `{message, view, target, kind}`. Derive the label and destination together. Reuse existing sections with stable, scoped IDs/refs and focusable headings or controls; do not add pages, new research panels, or another workflow layer. The server remains authoritative for readiness, company decisions, suppression, time and exact approval. The resolver describes prerequisites; it must not grant eligibility.

The jump may select the needed existing tab, then focus/scroll its matching rendered section. It must not save, classify, approve, resume, generate, copy, open email or report a send. Avoid a live jump to an absent or disabled control. A stopped/waiting state may point to relevant history or saved timing instead of presenting an approval action. Retain all outgoing, inbound, referral, basis and date buffers across view changes.

## Truthful next action and destination

These are guidance rules, not permission to bypass backend guards. Blocking safety states take precedence over an outbound CTA; editable work can remain available without implying contact is allowed.

| State | Next instruction / existing destination |
| --- | --- |
| Suppression / source question treated as stop | Explain contact is stopped; review received history or evidence if useful. Never suggest approval, send or automatic restoration. |
| Bounce / invalid address | Explain address invalid and stopped; focus recipient/contact correction. A replacement address needs its own reviewed evidence and exact approval; no automatic transfer of permission. |
| Thread pause / company conflict | Explain the relevant pause; focus thread/company controls for an explicit founder decision. Do not promise resume clears all other blockers or restores old approval. |
| Unsaved outgoing message, including pasted inbound too | Focus message save/cancel controls first. Current Save received reply is disabled while `dirty` and explicitly asks to save message edits. Preserve the pasted reply and outgoing text; do not jump to or invoke that disabled save. |
| Unsaved pasted inbound with clean outgoing draft | Conversations → received-reply save/review controls. Recording an actual inbound stops the cold sequence. |
| Saved inbound awaiting_review / uncertain | Conversations → Review reply status and received context. Classification precedes an outbound approval. |
| Referral | Conversations → Add referred contact. Keep parent referral stopped; new contact requires its own evidence, suppression/company checks and approval. The parent should not fall through to approve. |
| Not interested / unsubscribe / complaint | Explain stop and route to history or relevant review. Do not frame further outreach as the next task. |
| Not now / out of office | Missing/incomplete date: existing return-date controls. Future date: waiting/review-date summary. Due date: review received context and current permission; being due alone never authorizes sending. Auto-reply is not a human response. |
| Pending date edits / pending reply return-date review | Focus the correct save/cancel date section, including cleared values. Current `replySelections` is only set for not_now/auto_reply, so its date wording is presently accurate; keep other timing purposes distinct. |
| Interested / question with blank reply | Conversations → editable reply, with saved offer facts. Review claims, save, then approve only if all current guards permit. No generation or sending on navigation. |
| Missing sender identity / footer | Missing identity: existing Edit business entry. Removed footer: Restore sender footer, then save the draft. Do not call missing details verified merely because entered. |
| Edited recipient | Save/cancel recipient edit first; then fresh evidence for that exact saved address. Do not point to a basis save disabled for an unsaved recipient. |
| Dirty, absent or incomplete/mismatched contact basis | Existing Contact basis editor/save controls. Treat manual attestation honestly; guidance must not claim automated consent or verification. Do not reduce this to object truthiness. |
| Blank recipient, subject or body | Focus the missing field / message editor. Do not recommend disabled exact approval. |
| First send reported; no inbound; reminder not planned | Existing reminder editor and future weekday date controls. If blank message or unsaved edits block scheduling, write/save first. At most two cold followups; any inbound stops them. |
| Future reminder / two-followup cap | Show waiting date or sequence-complete status. Do not send the user to disabled approval. A due reminder still requires current checks and fresh exact approval. |
| Booking/time needs review | Meetings → timed booking controls or relevant save/cancel controls. Preserve zone/offset and existing recipient/version requirements. |
| Future booked meeting | Appropriate existing confirmation preparation/review or saved booking details, subject to current blocks. Preparing is not sending, a link is not a booking. |
| Meeting time passed | Meetings → reported meeting outcome controls. Do not infer attendance or customer conversion. Unknown sale remains unknown. |
| All prerequisites satisfied, saved unapproved message | Exact approval action bar, only when the corresponding control is eligible. |
| Current approved and server-ready message | Copy/open-email and manual sent-report action bar, with current readiness revalidation. Copy/open is not a send. |

If several non-safety tasks compete, prefer the lifecycle task requiring a founder decision (received reply, referral, due meeting outcome) over generic approval. A pending edit that disables that task must be resolved explicitly first. Make this precedence visible in tests; do not silently discard private edits to make the recommended action work.

## Meaningful regression counterexamples

1. Same saved draft/basis/footer with no inbound versus actual awaiting_review inbound: the former may reach approval; the latter must reach classification. Assert matching label, selected view, visible destination and disabled-approval consistency.
2. Referral parent, and fresh referred child with no basis: parent points to referral, child points to its own evidence. Neither should inherit the old approval or basis.
3. Review tab contains latest question or referral work: jump selects Conversations and focuses the relevant section. A Meetings jump focuses a real visible destination; it cannot leave an unresolved hash.
4. Unsaved outgoing text plus unsaved inbound: preserve both byte-for-byte and point to the outgoing prerequisite. Clicking jump makes no mutation/provider call and does not claim the reply was saved.
5. Dirty basis and saved-but-incomplete basis: each points to evidence work rather than approval. Unsaved recipient does not point to a disabled basis save.
6. Invalid recipient, company conflict without `paused`, and suppressed thread with otherwise complete approved content: no misleading approve/copy CTA. Invalid stays visibly invalid.
7. Return-date edits cleared, future OOO, future reminder, two-followup limit, and past meeting with future OOO: select the actual repair/wait/outcome destination; no premature outbound authority.
8. Missing sender footer, blank message, and pending save each lead to the enabled repair control. Navigation alone never approves or changes content.
9. Keyboard activation changes view/focus correctly, retained editors survive round trips, and no broken target or duplicate ID exists for the active thread. Parent should confirm this in its separately authorized Chrome session; component/source review does not establish rendered keyboard acceptance.

## Scope and contract

Contract basis: `docs/continuation/OWNER_CONTRACT.md:52` (one primary next action), lines 53–63 (reply consequences, bounded followups, meeting outcomes), lines 74–81 (referral, OOO, bounce, company decisions), line 112 (exact approvals and honest reported facts). This report reviews the current local guidance only; no hosted parity, browser-wide, provider, deliverability, legal or production acceptance is asserted.

Read-only checks: `git rev-parse HEAD`, `git status --short`, targeted `rg` and source reads of outreach-workspace, next-up-queue, saved-outreach, outreach-insights, and OWNER_CONTRACT. Fresh supplied screenshots were inspected locally. No new automated probe was required to establish the separate hardcoded target and guard mismatch; author tests alone were not treated as acceptance. Parent owns the repair and regression execution.
