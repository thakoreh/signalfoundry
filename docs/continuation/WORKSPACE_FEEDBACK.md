# Focused workspace feedback and outreach research

**Locally checked UI revision; actual email transport remains unconnected.** The owner paused the broad release goal, then authorized a simpler workspace and mailbox research during voice feedback. Application checkpoint: `f65fa8069a9cce3047c12e238ab89e0d6ebed516`, including the functional repair `d41f6f16a2026a4523050cf9608019ca3920f306`. This is not whole-product acceptance or permission to resume the release backlog.

## Delivered

- One home activity view replaces the stacked returning-work, Saved conversations, Next up and local-data panels. It retains existing stored work and uses read-only, tenant-scoped summary/action/insight APIs. Contacted, human replies and meetings held are explicitly reported company counts, not connected-mailbox facts.
- Replies and Meetings filters, company search and exact-thread destinations keep the dashboard focused. Meeting labels include the saved timezone/offset. Settings holds the existing business and local-data controls through the same runtime/auth/session gates.
- A customer row's Start outreach action prepares only that selected company's existing local ledger and opens its exact Review thread. AI drafting stays a separate explicit action. Empty/unrelated/malformed successful responses show an error and retain the same retry key; they cannot silently open another company.
- The UI visibly says email is not connected. Preparation does not generate, approve, send, connect a mailbox or start an autonomous agent. Existing exact approvals, sticky suppression, immutable sent reports and five-result maximum are unchanged.

## Review and verification

The first immutable checkpoint `618b101` was **not accepted**: independent review reproduced a real compact-summary/full-thread mismatch, incorrect approved/sent labels and a generic-route fallback. The original [failed report](reports/WORKSPACE_REVIEW_618b101.md) remains. Repair adds a minimal explicit 19-field summary with activity flags and meeting facts; private message bodies, approval snapshots, sender identity, source excerpts and contact-basis objects stay out of the aggregate response.

Root verification: **240 backend unittest cases**, **165 component cases across 24 files**, focused ESLint and nonincremental TypeScript pass. The initial pytest command did not run because pytest is not installed; the correct existing unittest runner subsequently passed. Optimized webpack production builds, including TypeScript, pass on exact `d41f6f1` and exact `f65fa80`. No dependencies or test requirements were weakened. The existing idempotency success fixture now returns a selected thread instead of an empty response, preserving its repeated-key assertions.

Independent [repair recheck](reports/WORKSPACE_RECHECK_d41f6f1.md): original 13 expectations pass; extended **19 distinct** component cases pass, including 12 actual temporary in-process GET snapshots and exact private-field exclusion checks. Counts overlap author tests; they are not additive whole-product acceptance.

Fresh connected Chrome used the standalone Next/FastAPI production app and the same task-owned fictional SQLite fixture, with providers disabled:

- Dashboard renders actual compact summaries; Replies does not crash; Meetings shows the saved Toronto offset and a View meeting link. Enter operates the filter with focus retained.
- Settings exposes the preserved data section away from home. Customer results contain none of the removed home panels. Clicking fictional Echo opens exactly Echo's Review thread; no approve/send/draft action is clicked.
- At actual 1440, 390 and 320 widths, page scroll width equals client width. A measured sub-44px header navigation target was repaired in `f65fa80`; final 390/320 DOM measurements show every dashboard .btn at least 44px high.
- Original connected viewport handle became unavailable after reload; a fresh dedicated Chrome tab completed the final measurements. No alternate browser automation was substituted. Emulation is cleared and the final workspace tab remains open.

Screenshots 37–42 document `d41f6f1`; 43–45 document final `f65fa80`. Capture39 is a clipped desktop slice and is excluded as390 evidence;45 has filter/row paint ambiguity and cannot prove a specific filter state. The independent [visual addendum](reports/WORKSPACE_VISUAL_RECHECK_f65fa80.md) accepts37/38 desktop and43/44 responsive layouts within scope. A later Chrome state read timed out; a screenshot showed the tab on a different fictional conversation, so no further navigation/recapture was attempted. All businesses/messages/metrics are manufactured fixtures, not owner data or commercial proof. Retained images are in [the evidence directory](evidence/screenshots/20261021/). Valid [desktop](evidence/screenshots/20261021/37-workspace-desktop-d41f6f1.jpg), final [390px](evidence/screenshots/20261021/43-workspace-final-390-f65fa80.jpg) and [320px](evidence/screenshots/20261021/44-workspace-final-320-f65fa80.jpg) views are directly inspectable. No new physical-device, screen-reader, 200% zoom, full-journey, CSV-download, hosted or provider acceptance is claimed.

## Current decision and boundaries

The owner subsequently ruled out using customers' main mailboxes and suggested Instantly/separate sending accounts. The earlier [mailbox comparison](MAILBOX_PILOT_OPTIONS_20261022.md) is retained as a conditional consented-test comparison, not the current selected path. [Agent research](OUTREACH_AGENT_RESEARCH_20261022.md) covers official Explee/AutoGTM, competitor and provider/legal boundaries. [Instantly cost/API/policy research](INSTANTLY_PILOT_OPTIONS_20261022.md) finds47USD platform alone, at least112 initial component estimate for its minimum pre-warmed batch, and unresolved Growth reply/commercial rights. No provider is chosen or connected. Warming is not consent, provider permission, guaranteed inbox placement or protection from suspension. Fake customer endorsements were declined and are absent.

Preview: `http://127.0.0.1:3001/workspace`; results use the task-owned search linked from the fixture. Owned production wrapper PID47364, Next49292, session36713; API8025. Exact external fixture identity is authoritative before stopping that tree. Original owner checkout, modified next-env, databases, env, preview and private edits remain untouched. Optional separate landing-only dev3021 is older source and is not this workspace revision.

The existing draft PR remains open. Required checks on the final pushed evidence head need separate readback; previous green landing checks do not prove this head. No real outreach, model/provider call, purchase, account connection, Ads, deployment, merge or main push. US$25 includes unknown historical DeepSeek usage; remaining funds are unknown. Broad release goal stays paused/incomplete. Actual sending-agent implementation waits for a permitted and affordable provider decision.
