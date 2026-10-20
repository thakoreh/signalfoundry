# Refined Clientrove implementation goal

Owner-approved October 19, 2026 (Toronto). This adds to and overrides conflicting older overnight briefs. After a context reset, read this file and PROGRESS.md before continuing.

Deliver the strongest verified release candidate: every unblocked P0, then P1. Implement, test, inspect the running application, fix independent review findings, and leave a truthful evidence-based handoff. Continue other useful work when external inputs block an integration. A deadline is not evidence of readiness.

## Starting point and working rules

- Start from latest origin/main at or after cfd22af0e693a4854e3e2c46e034ccf5a39127f3. The old outreach branch and merged PR 5 are finished history; never push to them or reopen that PR.
- Integration branch: codex/clientrove-release-candidate. One draft PR to main; push small checkpoints. Merge newer origin/main into the branch as needed. No rebase of pushed history or force push.
- Preserve uncommitted owner edits and all saved profiles/searches/drafts/outreach history. Preserve the running owner preview and its ports/databases. Root and each parallel agent use separate worktrees, explicit file ownership, isolated test data and distinct ports.
- Read the four OVERNIGHT_* briefs, LOCAL_OUTREACH.md, OUTREACH_EMAIL_OPTIONS.md, applicable AGENTS.md, and Convex instructions before editing convex/. Current source and this refined goal supersede stale architecture or readiness notes. Verify current official provider/legal documentation for integration decisions.
- Chrome only. The in-app browser crashes Codex. Extend the application rather than rebuilding it.
- Owner-confirmed GitHub policy supersedes the stale final paragraph of the pasted goal: main requires a PR and source-checks/container-checks, with zero approving reviews and no last-pusher approval. Preserve remaining protections and independent AI security/UX reviews. Do not recreate the solo-maintainer approval deadlock.

## Product and current truth

For founders selling launched B2B SaaS: website → confirmed seller/offer/buyer → relevant prospects → approved outreach → qualified conversations → meetings → measured customer outcomes. Lists and introductions are foundations. Local manual-assisted use comes first and must give a reason to return tomorrow.

Existing: website/manual setup, bounded DeepSeek discovery, saved progress/results, compact contact-first leads, selected CSV, initial AI drafts, and a local persistent Review/Conversations/Meetings ledger with exact approval, manual external-send records, pasted replies, pause/opt-out, and reported outcomes. Missing: hosted outreach parity, live transport/inbox/calendar, guarded reply AI, and a demonstrated global monetary ledger. Examples are test businesses. Local tests do not establish hosted readiness.

## P0: daily manual-assisted loop and coherent UI

1. Returning users land on an in-app **Next up** queue: replies to answer, approvals pending, follow-ups due, due snoozes and meetings needing an outcome. Each item has one primary action. Preserve saved work and safe unsaved text. First-session target from saved profile to an approved, sendable message is about ten minutes without instructions; measure it rather than claim it.
2. Prompt at natural moments with minimal friction: after Copy/Open ask Sent as approved / Sent with changes / Not yet; on follow-up ask whether there was a reply; after a reported meeting time ask whether it happened. No answer leaves Unknown. Copy/Open is not sending.
3. Add Open in email app using mailto recipient/subject/body, with a conservative encoded-length fallback to Copy. Never auto-launch or send. Sent with changes requires the actual pasted outbound text; preserve it as a separate immutable user-reported snapshot, distinct from the approved version.
4. Draft review identifies claims grounded in stored evidence and flags unsupported claims before approval. Do not pretend citation IDs prove every sentence true. Keep evidence in review, not rejected research-heavy result panels.
5. Default introductions: plain text around 50–125 words; one specific verifiable recipient observation, one plain line about the seller, one low-pressure interest question. No flattering opener, invented familiarity/urgency/connections, fake Re:/Fwd:, images or attachments. Default first email has no booking link and at most one link; a deliberate founder override is possible.
6. Up to two manually executed follow-ups in the same thread, several business days apart. A reminder and draft each need fresh exact approval. Nothing automatically sends. Do not assert that follow-ups guarantee replies; timing is a product default to test.
7. Manual reply classifications: interested; question/objection; referral; not now; not interested; opt-out; source challenge (where did you get my email); auto-reply/out-of-office; bounce; uncertain/needs review. AI classification suggestions remain behind spending admission.
8. Referral adds a new same-company contact, requires a fresh suppression check and exact approval, and records the referring person only from real user-supplied evidence. Not now stores a revisit date and snoozes. Not interested stops. Opt-out/source challenge suppress and stop. Out-of-office pauses until a real supplied return date and is excluded from reply metrics. Bounce invalidates the address, stops outreach and is not a reply. Missing return date is unknown, not inferred.
9. Show other contacted people at the same company. Default one active cold thread per company. A genuine reply, opt-out or meeting pauses other pending company outreach until explicit founder review; opt-out suppression cannot be casually reversed by that review.
10. Label common role addresses (info/hello/support/sales) as shared inboxes. Rank named contacts above shared inboxes within honest verification/contact ordering, and never address a shared mailbox as a named person. Show the saved source and retrieval date; unknown date remains unknown.
11. Show recipient local time only when a reliable timezone is known. Suggest weekday working hours, never an optimal-time promise. Booking is user-reported unless integrated; offer an approved confirmation draft and ask the outcome only after the supplied meeting time.
12. Consistent warm paper/white/forest theme, shared semantic tokens and logo, measured contrast, restrained reduced-motion-safe motion. Preserve website-first setup/manual alternative, compact seller/offer context, dense desktop leads and reachable phone actions. Keep generic fit explanations and Research details removed from list rows.

## P0: compliance and deliverability

Verify current US/Canadian official rules; implementation assistance is not legal advice or proof that a contact may legally receive mail.

- Every copied/mailto outreach includes saved sender name/company/mailing address and plain opt-out language. Missing identity/address blocks approval. Never invent identity or an address. Snapshot the approved footer and invalidate stale approval when sender facts change.
- Per-recipient contact basis stores publication source URL and why the message relates to the role, plus relevant no-solicitation checks. A public address is not blanket consent, and its source must not prohibit unsolicited messages. Gate ambiguous Canadian consent/basis cases with an honest review requirement.
- Opt-outs are effective immediately and persist across searches, address edits and reclassification. Verify statutory timing, but the application uses immediate suppression.
- Default scope US/Canada. Unknown geography needs review rather than being silently classified. Exclude EU/UK unless explicitly enabled after owner review of relevant obligations; no country inference from a generic .com address.
- No open/click pixels, tracking-link rewriting, or fabricated engagement. Measure genuine replies/outcomes, excluding bounces and auto-replies.
- Gated future transport includes gradual daily caps, owner SPF/DKIM/DMARC steps, and automatic transport stop thresholds for bounces/complaints. No real transport without prerequisite authorization.

## P0: cost admission, hosted parity, then guarded integrations

Priority after the local daily loop:

1. Durable global and tenant monetary admission, including **local mode** and existing DeepSeek search/initial draft usage. Reserve before dispatch, settle/reconcile actual usage, deduplicate attempts, bound tokens/time/retries/concurrency, stop on unknown exposure, and provide a kill switch. Cover paid data and failures as well as successes. Existing usage needs reconciliation before paid work can safely resume.
2. Authenticated tenant-scoped Convex outreach parity before enabling the hosted adapter: ownership/roles, revision/idempotency, exact approvals, immutable sent snapshots, suppression and session/org races. SQLite stays loopback-only. Keep hosted outreach gated if parity is not completed and tested; never sacrifice the local loop to hide that gap.
3. Grounded editable reply copilot after cost admission and independent review of conversation/product-fact boundaries. Prepare one permitted mailbox adapter, encrypted delegated OAuth, durable outbox, suppression checks, ambiguous-send reconciliation, inbound recovery, stop-on-reply and deliverability limits. Missing mailbox/provider ownership/permission leaves live operation gated; use offline/test seams.
4. Candidate/contact accuracy benchmark, real auth/billing test boundaries, privacy/export/deletion, privacy-safe funnel events, private worker isolation, alerts/operations, isolated backup/restore and rollback. Landing/actions reflect actual availability. Booking links first; distinguish reported from provider-confirmed facts.

## Budget and external boundaries

US$25/month including existing DeepSeek. Prior spend unknown until reconciled. Ads allocation unresolved: no Ads spend. Preserve five-result max/default. Reuse infrastructure; no new subscriptions/top-ups, silent paid fallback or unbounded tests. Budget is not authorization to send, connect accounts, buy services, run ads, charge, publish or migrate production. Reuse clear prior authorization; otherwise implement/test the seam and leave it gated with exact owner steps.

An email is unverified until real verifier evidence exists. Edits/new inbound/pause/suppression invalidate approval. A copy/open is not a send; acceptance is not delivery; a booking link is not a booking; meetings are not sales; auto-replies and bounces are not genuine replies. Keep user reports separate. No fabricated capabilities/prices/proof/intent/outcomes. Defer broad CRM, mailbox fleets, multichannel and hundreds of leads.

## Run discipline and evidence

- Update PROGRESS.md after each milestone with checklist, commands/results, decisions, blockers and next action. Reread it and this goal after context reset.
- Time-box blocked paths after two distinct failed approaches or ~45 minutes without progress. Record evidence, gate, move on; resume with new information. This does not excuse skipping other unblocked P0 work.
- Parallel agents get own worktrees and file ownership. Integrate often and rerun affected tests. Commit/push small working checkpoints. No weakening/skipping/deleting tests, loosening lint/types, unrelated broad rewrites or unreviewed dependencies. Check needed dependency license/maintenance and lockfile.
- Built requires command output on the exact commit; verified requires checking the running app. Mocks prove logic, not providers. Stop a path if secrets appear, user data is at risk, cost becomes unbounded or any action would send a real message; record it and continue safe work.
- Test every implemented feature and transition: setup, search/progress/reload/partial/empty/error, sorting/selection/CSV, cache/quota/drafts, invalidation, mailto/changed-send snapshots, follow-up business-day timing, all reply types/referral/OOO/bounce, company hold, suppression/pause, outcomes/return, role/tenant/race/failure cases. Isolated fixtures/DBs and mocked providers only in automation.
- Fresh independent security/tenant/cost and UX/spec reviews. UX reviewer plays a busy founder on a 390px phone through first use and next-day Next up return. Fix findings, targeted regressions, re-review critical changes, final required checks.
- Fresh Chrome desktop and 390/320px evidence throughout, all reply types, keyboard/focus/dialog, zoom 200%, long text/errors/contrast/reduced motion. Disclose physical-device/screen-reader gaps.
- Morning report starts with verdict and owner decisions, then maps every P0/P1 to built / locally tested / staging verified / production verified / blocked / deferred with reason. Include branch/PR/base/final commit/checks, working links/screenshots, defects, spend known/unknown, manual/connected status, owner actions and rollback. Verdict may be incomplete; do not equate mocks/builds/deadline with production readiness.
